import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import {
  AgentRunStatus,
  AgentRunStepStatus,
  McpActionSource,
  McpApprovalMode,
  McpPendingActionStatus,
  Prisma,
} from "../../../prisma/generated/prisma/client.js";
import * as repo from "./agent-runs.repository.js";
import * as mcpService from "../mcp/mcp.service.js";
import * as mcpRepo from "../mcp/mcp.repository.js";
import { isTerminal } from "./agent-runs.service.js";

/**
 * What apps/ai calls while executing a run.
 *
 * The executor lives in Python because that is where the LLM client, tool
 * assembly and agent registry are. Authorisation stays here: Python asks this
 * service to perform an already-approved write, and this service re-verifies
 * before doing anything. Python never gains write authority of its own.
 */

export const updateStep = async (
  runId: string,
  key: string,
  fields: {
    status?: AgentRunStepStatus;
    outputText?: string | null;
    actionId?: string | null;
    proposedActionId?: string | null;
    proposedArgs?: unknown;
    actionResult?: unknown;
    toolTrace?: unknown;
    errorMessage?: string | null;
    attempt?: number;
  },
) => {
  const data: Prisma.AgentRunStepUpdateInput = {};
  if (fields.status) {
    data.status = fields.status;
    if (fields.status === AgentRunStepStatus.RUNNING) data.startedAt = new Date();
    if (
      fields.status === AgentRunStepStatus.SUCCEEDED ||
      fields.status === AgentRunStepStatus.FAILED ||
      fields.status === AgentRunStepStatus.SKIPPED
    ) {
      data.finishedAt = new Date();
    }
  }
  if (fields.outputText !== undefined) data.outputText = fields.outputText;
  if (fields.actionId !== undefined) data.actionId = fields.actionId;
  if (fields.proposedActionId !== undefined) data.proposedActionId = fields.proposedActionId;
  if (fields.proposedArgs !== undefined) {
    data.proposedArgs = (fields.proposedArgs ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (fields.errorMessage !== undefined) data.errorMessage = fields.errorMessage;
  if (fields.attempt !== undefined) data.attempt = fields.attempt;
  if (fields.actionResult !== undefined) {
    data.actionResult = (fields.actionResult ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (fields.toolTrace !== undefined) {
    data.toolTrace = (fields.toolTrace ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  await repo.updateStep(runId, key, data);
};

/**
 * Liveness ping. The reply doubles as the cancel channel — the executor stops
 * scheduling when it sees `cancelled`, rather than being killed mid-tool-call,
 * which would leave a half-performed provider write with no record of it.
 */
export const heartbeat = async (runId: string, toolCallsUsed: number) => {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  if (!run) throw new NotFoundError("Run not found");
  await repo.updateRun(runId, { heartbeatAt: new Date(), toolCallsUsed });
  return {
    cancelled: run.status === AgentRunStatus.CANCELLED,
    status: run.status,
  };
};

/** `agent|integrationSlug` — the identity the user authorised at approval. */
const writeSignature = (agent: string, integrationSlug: string | null) =>
  `${agent}|${integrationSlug ?? ""}`;

export const executeWrite = async (
  runId: string,
  key: string,
  input: { connectionId: string; toolName: string; arguments: unknown; summary: string },
) => {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { steps: { where: { key } } },
  });
  if (!run) throw new NotFoundError("Run not found");
  const step = run.steps[0];
  if (!step) throw new NotFoundError("Step not found");
  if (run.status !== AgentRunStatus.RUNNING) {
    throw new BadRequestError(`Run is ${run.status.toLowerCase()}, not running`);
  }
  if (!run.approvedAt) {
    throw new BadRequestError("Run was never approved");
  }

  const connection = await mcpRepo.findByConnectionId(input.connectionId);
  if (!connection || connection.organizationId !== run.organizationId) {
    throw new NotFoundError("Connection not found");
  }

  // The user approved an intent, not a set of arguments — those are computed
  // from data they had not seen. A write outside the approved set therefore
  // creates nothing and pauses the run instead.
  const signature = writeSignature(step.agent, connection.integrationSlug);
  if (!run.approvedWrites.includes(signature)) {
    return { executed: false, requiresApproval: true as const };
  }

  const mode = await mcpService.resolveApprovalMode(
    run.organizationId,
    connection.integrationSlug,
    input.toolName,
  );

  // An explicit NEVER outbids plan approval: the user blocked this integration
  // deliberately, and a plan approval is not a licence to override that.
  if (mode === McpApprovalMode.NEVER) {
    return { executed: false, error: "Blocked by your approval rules" };
  }

  // Recorded before the call, and as CONFIRMED rather than PENDING: it is
  // authorised but not yet performed. PENDING keeps meaning "a human still has
  // to click", which is what stops a stray card double-confirming this.
  const pendingActionId = crypto.randomUUID();
  await mcpRepo.createPendingActions([
    {
      id: pendingActionId,
      organizationId: run.organizationId,
      userId: run.userId,
      agent: step.agent,
      messageId: run.messageId ?? undefined,
      connectionId: input.connectionId,
      integrationSlug: connection.integrationSlug,
      toolName: input.toolName,
      arguments: input.arguments as Record<string, unknown>,
      summary: input.summary,
      source: run.trigger === "CHAT" ? McpActionSource.CHAT : McpActionSource.TRIGGER,
    },
  ]);
  await prisma.mcpPendingAction.update({
    where: { id: pendingActionId },
    data: { status: McpPendingActionStatus.CONFIRMED, runStepId: step.id },
  });

  try {
    const result = await mcpService.callTool(
      run.organizationId,
      input.connectionId,
      input.toolName,
      input.arguments as Record<string, unknown>,
    );
    await mcpRepo.updatePendingActionStatus(pendingActionId, {
      status: McpPendingActionStatus.EXECUTED,
      resultJson: result as Prisma.InputJsonValue,
    });
    return { executed: true, result, pendingActionId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await mcpRepo.updatePendingActionStatus(pendingActionId, {
      status: McpPendingActionStatus.FAILED,
      errorMessage: message,
    });
    return { executed: false, error: message, pendingActionId };
  }
};

export const finishRun = async (
  runId: string,
  status: string,
  summary: string,
  errorMessage?: string | null,
) => {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { status: true, messageId: true },
  });
  if (!run) throw new NotFoundError("Run not found");
  // A cancelled run stays cancelled — the executor may report its own terminal
  // status after the user already stopped it.
  if (isTerminal(run.status)) return;

  const next = (Object.values(AgentRunStatus) as string[]).includes(status)
    ? (status as AgentRunStatus)
    : AgentRunStatus.FAILED;

  await repo.updateRun(runId, {
    status: next,
    summary: summary || null,
    errorMessage: errorMessage ?? null,
    finishedAt: new Date(),
  });

  // The summary replaces the plan preamble on the message that renders the
  // graph, so the thread reads as a finished answer rather than a proposal.
  if (run.messageId && summary) {
    await prisma.message.update({
      where: { id: run.messageId },
      data: { content: summary },
    }).catch(() => undefined);
  }
};
