import { prisma } from "../../config/prisma.js";
import {
  Prisma,
  AgentRunStatus,
  AgentRunStepStatus,
  Agent,
} from "../../../prisma/generated/prisma/client.js";
import type { CreateRunInput } from "./agent-runs.types.js";

/** Run plus its DAG, with each step's staged writes attached. */
export const findRunById = (id: string) =>
  prisma.agentRun.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { seq: "asc" },
        include: {
          pendingActions: {
            select: {
              id: true,
              summary: true,
              status: true,
              toolName: true,
              integrationSlug: true,
            },
          },
        },
      },
    },
  });

export type RunWithSteps = NonNullable<Awaited<ReturnType<typeof findRunById>>>;

export const listRunsByOrg = (
  organizationId: string,
  opts: { agent?: Prisma.AgentRunWhereInput["agent"]; limit: number },
) =>
  prisma.agentRun.findMany({
    where: { organizationId, ...(opts.agent ? { agent: opts.agent } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    select: {
      id: true,
      agent: true,
      status: true,
      goal: true,
      requestText: true,
      createdAt: true,
      finishedAt: true,
    },
  });

/**
 * Creates the run and its DAG in one transaction — a run with no steps is not
 * a meaningful state for the executor or the graph to observe.
 */
export const createRunWithSteps = (input: CreateRunInput) =>
  prisma.agentRun.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      agent: input.agent,
      ...(input.trigger ? { trigger: input.trigger } : {}),
      requestText: input.requestText,
      ...(input.isTeam ? { isTeam: true } : {}),
      goal: input.goal,
      status: AgentRunStatus.AWAITING_PLAN_APPROVAL,
      ...(input.plannerMeta !== undefined
        ? { plannerMeta: input.plannerMeta as Prisma.InputJsonValue }
        : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
      steps: {
        create: input.nodes.map((n, i) => ({
          key: n.key,
          seq: i,
          agent: n.agent,
          title: n.title,
          intent: n.intent,
          integrationSlug: n.integrationSlug ?? null,
          isWrite: n.isWrite,
          expectedScope: n.expectedScope ?? null,
          dependsOn: n.dependsOn,
        })),
      },
    },
    include: { steps: { orderBy: { seq: "asc" } } },
  });

export const updateRun = (id: string, data: Prisma.AgentRunUpdateInput) =>
  prisma.agentRun.update({ where: { id }, data });

export const updateStep = (
  runId: string,
  key: string,
  data: Prisma.AgentRunStepUpdateInput,
) =>
  prisma.agentRunStep.update({
    where: { runId_key: { runId, key } },
    data,
  });

/** Bulk state change used by approval (disable) and cancellation (skip). */
export const setStepStatusByKeys = (
  runId: string,
  keys: string[],
  status: AgentRunStepStatus,
  enabled?: boolean,
) =>
  prisma.agentRunStep.updateMany({
    where: { runId, key: { in: keys } },
    data: { status, ...(enabled === undefined ? {} : { enabled }) },
  });

/**
 * Runs the sweeper should re-dispatch: alive-but-silent past the cutoff.
 * Backed by the [status, heartbeatAt] index.
 */
export const findStaleRuns = (cutoff: Date, limit: number) =>
  prisma.agentRun.findMany({
    where: {
      status: { in: [AgentRunStatus.RUNNING, AgentRunStatus.REPLANNING] },
      heartbeatAt: { lt: cutoff },
    },
    orderBy: { heartbeatAt: "asc" },
    take: limit,
    select: { id: true, resumeCount: true },
  });

/**
 * Appends steps a repair pass planned.
 *
 * `seq` continues from the highest existing step so the graph lays the detour
 * out after the work it replaces rather than interleaving it. skipDuplicates
 * guards the unique [runId, key]: a retried dispatch must not fail the whole
 * repair over a step that already landed.
 */
export const addSteps = async (
  runId: string,
  steps: {
    key: string;
    agent: Agent;
    title: string;
    intent: string;
    integrationSlug?: string | null;
    dependsOn: string[];
    isWrite: boolean;
  }[],
) => {
  const last = await prisma.agentRunStep.aggregate({
    where: { runId },
    _max: { seq: true },
  });
  const base = (last._max.seq ?? 0) + 1;
  return prisma.agentRunStep.createMany({
    data: steps.map((s, i) => ({
      runId,
      key: s.key,
      seq: base + i,
      agent: s.agent,
      title: s.title,
      intent: s.intent,
      integrationSlug: s.integrationSlug ?? null,
      dependsOn: s.dependsOn,
      isWrite: s.isWrite,
    })),
    skipDuplicates: true,
  });
};
