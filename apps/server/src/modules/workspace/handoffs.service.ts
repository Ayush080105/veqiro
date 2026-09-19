import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import {
  ActorKind,
  Agent,
  HandoffStatus,
  type Prisma,
} from "../../../prisma/generated/prisma/client.js";
import { recordActivityEvent } from "../activity/activity-event.service.js";

/**
 * Cross-agent work requests.
 *
 * Shipped dormant in Phase 0: the table, the queries and the lifecycle exist so
 * that ActivityEvent and the workspace UI can already point at handoffs, but
 * nothing creates one until the workforce phase. Accepting a handoff will
 * dispatch an AgentRun — this module stays a request/result record and never
 * becomes a second executor.
 */

export interface HandoffEntry {
  id: string;
  fromAgent: Agent | null;
  toAgent: Agent;
  requestedActionId: string | null;
  requestedArgs: unknown;
  note: string;
  objectKind: string | null;
  objectId: string | null;
  status: HandoffStatus;
  runId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const toEntry = (r: Awaited<ReturnType<typeof prisma.handoff.create>>): HandoffEntry => ({
  id: r.id,
  fromAgent: r.fromAgent,
  toAgent: r.toAgent,
  requestedActionId: r.requestedActionId,
  requestedArgs: r.requestedArgs,
  note: r.note,
  objectKind: r.objectKind,
  objectId: r.objectId,
  status: r.status,
  runId: r.runId,
  dueAt: r.dueAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export async function createHandoff(params: {
  organizationId: string;
  userId: string;
  fromAgent?: Agent | null;
  toAgent: Agent;
  requestedActionId?: string | null;
  /**
   * Accepted as a plain object and narrowed on write. Prisma's InputJsonValue
   * does not accept Record<string, unknown>, and pushing that type out to every
   * caller would make the HTTP boundary awkward for no gain.
   */
  requestedArgs?: Record<string, unknown>;
  note?: string;
  objectKind?: string | null;
  objectId?: string | null;
  sourceMessageId?: string | null;
  dueAt?: Date | null;
}): Promise<HandoffEntry> {
  if (params.fromAgent && params.fromAgent === params.toAgent) {
    throw new BadRequestError("An agent cannot hand work to itself");
  }

  const row = await prisma.handoff.create({
    data: {
      organizationId: params.organizationId,
      createdByUserId: params.userId,
      fromAgent: params.fromAgent ?? null,
      toAgent: params.toAgent,
      requestedActionId: params.requestedActionId ?? null,
      requestedArgs: params.requestedArgs as Prisma.InputJsonValue | undefined,
      note: params.note ?? "",
      objectKind: params.objectKind ?? null,
      objectId: params.objectId ?? null,
      sourceMessageId: params.sourceMessageId ?? null,
      dueAt: params.dueAt ?? null,
    },
  });

  await recordActivityEvent({
    organizationId: params.organizationId,
    agent: params.fromAgent ?? null,
    actorKind: params.fromAgent ? ActorKind.AGENT : ActorKind.USER,
    actorUserId: params.userId,
    verb: "workspace.handoff.created",
    summary: `${params.fromAgent ?? "You"} asked ${params.toAgent} to ${
      params.requestedActionId ?? "help"
    }`,
    objectKind: params.objectKind,
    objectId: params.objectId,
    metadata: { handoffId: row.id, toAgent: params.toAgent },
  });

  return toEntry(row);
}

export async function listHandoffs(params: {
  organizationId: string;
  agent: Agent;
  direction: "in" | "out";
  status?: HandoffStatus;
  limit?: number;
}): Promise<HandoffEntry[]> {
  const rows = await prisma.handoff.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.direction === "in" ? { toAgent: params.agent } : { fromAgent: params.agent }),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 200),
  });
  return rows.map(toEntry);
}

/** Legal transitions. Anything else is a bug in the caller, not a no-op. */
const ALLOWED_TRANSITIONS: Record<HandoffStatus, HandoffStatus[]> = {
  PENDING: [HandoffStatus.ACCEPTED, HandoffStatus.DECLINED, HandoffStatus.CANCELLED],
  ACCEPTED: [HandoffStatus.COMPLETED, HandoffStatus.CANCELLED],
  DECLINED: [],
  COMPLETED: [],
  CANCELLED: [],
};

export async function setHandoffStatus(params: {
  organizationId: string;
  id: string;
  status: HandoffStatus;
  runId?: string | null;
  resultMessageId?: string | null;
}): Promise<HandoffEntry> {
  const existing = await prisma.handoff.findUnique({ where: { id: params.id } });
  if (!existing || existing.organizationId !== params.organizationId) {
    throw new NotFoundError("Handoff not found");
  }
  if (!ALLOWED_TRANSITIONS[existing.status].includes(params.status)) {
    throw new BadRequestError(
      `Cannot move a handoff from ${existing.status} to ${params.status}`,
    );
  }

  const row = await prisma.handoff.update({
    where: { id: params.id },
    data: {
      status: params.status,
      ...(params.runId !== undefined ? { runId: params.runId } : {}),
      ...(params.resultMessageId !== undefined
        ? { resultMessageId: params.resultMessageId }
        : {}),
    },
  });

  await recordActivityEvent({
    organizationId: params.organizationId,
    agent: row.toAgent,
    actorKind: ActorKind.AGENT,
    verb: `workspace.handoff.${params.status.toLowerCase()}`,
    summary: `${row.toAgent} ${params.status.toLowerCase()} work from ${row.fromAgent ?? "you"}`,
    objectKind: row.objectKind,
    objectId: row.objectId,
    metadata: { handoffId: row.id },
  });

  return toEntry(row);
}

export { HandoffStatus };
