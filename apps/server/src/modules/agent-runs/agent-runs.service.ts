import { NotFoundError } from "../../common/errors/notFound.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import {
  Agent,
  AgentRunStatus,
  AgentRunStepStatus,
  Prisma,
} from "../../../prisma/generated/prisma/client.js";
import * as repo from "./agent-runs.repository.js";
import type { RunView, RunStepView, CreateRunInput } from "./agent-runs.types.js";
import { dispatchApprovedRun } from "./agent-runs.dispatch.js";

/** Runs past these are immutable. */
const TERMINAL: ReadonlySet<AgentRunStatus> = new Set([
  AgentRunStatus.COMPLETED,
  AgentRunStatus.PARTIAL,
  AgentRunStatus.FAILED,
  AgentRunStatus.CANCELLED,
  AgentRunStatus.REJECTED,
]);

export const isTerminal = (status: AgentRunStatus) => TERMINAL.has(status);

/**
 * Every step that transitively depends on `seeds`, excluding the seeds.
 *
 * Computed server-side on approval: the client renders the same cascade for
 * feedback, but a client that omits a dependent would otherwise get a step
 * executed against inputs its producer never generated.
 */
export const dependentClosure = (
  steps: { key: string; dependsOn: string[] }[],
  seeds: Iterable<string>,
): Set<string> => {
  const dependentsOf = new Map<string, string[]>();
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      dependentsOf.set(dep, [...(dependentsOf.get(dep) ?? []), s.key]);
    }
  }
  const out = new Set<string>();
  const queue = [...seeds];
  while (queue.length) {
    const key = queue.shift()!;
    for (const child of dependentsOf.get(key) ?? []) {
      if (out.has(child)) continue;
      out.add(child);
      queue.push(child);
    }
  }
  for (const seed of seeds) out.delete(seed);
  return out;
};

const toStepView = (s: repo.RunWithSteps["steps"][number]): RunStepView => ({
  id: s.id,
  key: s.key,
  seq: s.seq,
  agent: s.agent,
  title: s.title,
  intent: s.intent,
  integrationSlug: s.integrationSlug,
  isWrite: s.isWrite,
  expectedScope: s.expectedScope,
  dependsOn: s.dependsOn,
  status: s.status,
  enabled: s.enabled,
  attempt: s.attempt,
  outputText: s.outputText,
  actionId: s.actionId,
  actionResult: s.actionResult,
  proposedActionId: s.proposedActionId,
  proposedArgs: s.proposedArgs,
  errorMessage: s.errorMessage,
  startedAt: s.startedAt,
  finishedAt: s.finishedAt,
  pendingActions: s.pendingActions,
});

const toRunView = (run: repo.RunWithSteps): RunView => ({
  id: run.id,
  agent: run.agent,
  trigger: run.trigger,
  requestText: run.requestText,
  status: run.status,
  goal: run.goal,
  planVersion: run.planVersion,
  approvedWrites: run.approvedWrites,
  approvedAt: run.approvedAt,
  messageId: run.messageId,
  summary: run.summary,
  errorMessage: run.errorMessage,
  toolCallsUsed: run.toolCallsUsed,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  createdAt: run.createdAt,
  steps: run.steps.map(toStepView),
});

/** Org-scoped fetch. Never resolve a run belonging to another organization. */
const requireRun = async (organizationId: string, runId: string) => {
  const run = await repo.findRunById(runId);
  if (!run || run.organizationId !== organizationId) {
    throw new NotFoundError("Run not found");
  }
  return run;
};

export const getRun = async (organizationId: string, runId: string): Promise<RunView> =>
  toRunView(await requireRun(organizationId, runId));

export const listRuns = (organizationId: string, agent: Agent | undefined, limit: number) =>
  repo.listRunsByOrg(organizationId, { agent, limit });

export const createRun = async (input: CreateRunInput) => {
  if (input.nodes.length === 0) {
    throw new BadRequestError("A run needs at least one step");
  }
  return repo.createRunWithSteps(input);
};

/**
 * Approve the plan, optionally switching steps off.
 *
 * `approvedWrites` records write *identities* (`agent|integrationSlug`), not
 * arguments — those are computed from data the user has not seen at approval
 * time, so binding to them would re-ask for every write and defeat
 * approve-once. Scope is communicated instead via each step's expectedScope.
 */
/** Links the run to the assistant message that renders its graph. */
export const attachMessage = (runId: string, messageId: string) =>
  repo.updateRun(runId, { message: { connect: { id: messageId } } });

export const approvePlan = async (
  organizationId: string,
  userId: string,
  runId: string,
  disabledStepKeys: string[],
) => {
  const run = await requireRun(organizationId, runId);
  if (run.status !== AgentRunStatus.AWAITING_PLAN_APPROVAL) {
    throw new BadRequestError(`Run is ${run.status.toLowerCase()}, not awaiting approval`);
  }

  const known = new Set(run.steps.map((s) => s.key));
  const unknown = disabledStepKeys.filter((k) => !known.has(k));
  if (unknown.length) {
    throw new BadRequestError(`Unknown step keys: ${unknown.join(", ")}`);
  }

  const cascaded = dependentClosure(run.steps, disabledStepKeys);
  const offKeys = new Set([...disabledStepKeys, ...cascaded]);
  const enabledSteps = run.steps.filter((s) => !offKeys.has(s.key));
  if (enabledSteps.length === 0) {
    throw new BadRequestError("Every step was disabled — nothing left to run");
  }

  if (offKeys.size) {
    await repo.setStepStatusByKeys(
      runId,
      [...offKeys],
      AgentRunStepStatus.DISABLED,
      false,
    );
  }

  const approvedWrites = [
    ...new Set(
      enabledSteps
        .filter((s) => s.isWrite)
        .map((s) => `${s.agent}|${s.integrationSlug ?? ""}`),
    ),
  ];

  await repo.updateRun(runId, {
    status: AgentRunStatus.RUNNING,
    approvedByUserId: userId,
    approvedAt: new Date(),
    approvedWrites,
    startedAt: new Date(),
    heartbeatAt: new Date(),
  });

  const view = await getRun(organizationId, runId);

  // Not awaited: execution takes minutes and the user is waiting on this
  // response to see the graph go live. dispatchApprovedRun fails the run
  // itself if apps/ai cannot be reached, so a lost dispatch is still visible.
  void dispatchApprovedRun(runId);

  return {
    run: view,
    disabledKeys: [...offKeys],
    approvedWrites,
  };
};

export const rejectPlan = async (organizationId: string, runId: string) => {
  const run = await requireRun(organizationId, runId);
  if (run.status !== AgentRunStatus.AWAITING_PLAN_APPROVAL) {
    throw new BadRequestError(`Run is ${run.status.toLowerCase()}, not awaiting approval`);
  }
  await repo.updateRun(runId, {
    status: AgentRunStatus.REJECTED,
    finishedAt: new Date(),
  });
  return getRun(organizationId, runId);
};

/**
 * Cooperative cancel: the executor observes it on its next heartbeat and stops
 * scheduling. In-flight tool calls are allowed to finish — killing mid-call
 * would leave a half-executed provider write with no record of it.
 */
export const cancelRun = async (organizationId: string, runId: string) => {
  const run = await requireRun(organizationId, runId);
  if (isTerminal(run.status)) {
    throw new BadRequestError(`Run already ${run.status.toLowerCase()}`);
  }
  const notStarted = run.steps
    .filter((s) =>
      s.status === AgentRunStepStatus.PLANNED ||
      s.status === AgentRunStepStatus.READY ||
      s.status === AgentRunStepStatus.BLOCKED,
    )
    .map((s) => s.key);
  if (notStarted.length) {
    await repo.setStepStatusByKeys(runId, notStarted, AgentRunStepStatus.SKIPPED);
  }
  await repo.updateRun(runId, {
    status: AgentRunStatus.CANCELLED,
    finishedAt: new Date(),
  });
  return getRun(organizationId, runId);
};

/** Actions a form may legitimately resolve to instead of the one proposed. */
const SIBLING_ACTIONS: Record<string, string[]> = {
  "maya:draft-content": ["maya:draft-carousel"],
  "maya:draft-carousel": ["maya:draft-content"],
};

/** Upstream context is budgeted in the executor; this only bounds the column. */
const MAX_STEP_OUTPUT_CHARS = 20_000;


/**
 * Completes a step that paused for the user to review a native action.
 *
 * The console runs the action through its normal `/agents/:agent/:endpoint`
 * route — the same path the chat dialog uses — and then reports the result
 * here so the run can carry on with it as context.
 *
 * The result is therefore client-supplied. That is a deliberate trade: the
 * per-action submit logic (platform fan-out, carousel resolution) lives in the
 * console, and duplicating it here would guarantee the two drift. Nothing that
 * costs money or touches a third party is taken on trust — credits, writes and
 * provider calls all still happen inside the real action endpoint under its own
 * auth. What a tampered payload could corrupt is this org's own run summary,
 * which the user could equally achieve by typing into the chat. `actionId` is
 * still pinned to what the step proposed, so a different action cannot be
 * substituted for the one the plan approved.
 */
export const submitStepAction = async (
  organizationId: string,
  runId: string,
  key: string,
  body: { actionId: string; result: unknown; outputText?: string },
) => {
  const run = await requireRun(organizationId, runId);
  if (run.status !== AgentRunStatus.AWAITING_ACTION_APPROVAL) {
    throw new BadRequestError(`Run is ${run.status.toLowerCase()}, not awaiting input`);
  }

  const step = run.steps.find((s) => s.key === key);
  if (!step) throw new NotFoundError("Step not found");
  if (step.status !== AgentRunStepStatus.AWAITING_APPROVAL) {
    throw new BadRequestError("That step is not waiting for input");
  }
  if (!step.proposedActionId) {
    throw new BadRequestError("That step did not propose an action");
  }
  // The user may switch a draft to a carousel inside the form, which the
  // dialog resolves to a sibling action. Anything further afield is refused.
  const allowed = new Set([step.proposedActionId, ...SIBLING_ACTIONS[step.proposedActionId] ?? []]);
  if (!allowed.has(body.actionId)) {
    throw new BadRequestError("That action does not match what this step proposed");
  }

  await repo.updateStep(runId, key, {
    status: AgentRunStepStatus.SUCCEEDED,
    actionId: body.actionId,
    actionResult: (body.result ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    outputText: body.outputText?.slice(0, MAX_STEP_OUTPUT_CHARS) ?? null,
    // Cleared so the graph stops offering a form for work already done.
    proposedActionId: null,
    proposedArgs: Prisma.JsonNull,
    finishedAt: new Date(),
  });

  await repo.updateRun(runId, {
    status: AgentRunStatus.RUNNING,
    heartbeatAt: new Date(),
  });

  // Picks up from here: steps that already succeeded are replayed as such, so
  // this one is not run again.
  void dispatchApprovedRun(runId);

  return getRun(organizationId, runId);
};
