import { prisma } from "../../config/prisma.js";
import {
  ActorKind,
  Prisma,
  type Agent,
} from "../../../prisma/generated/prisma/client.js";

/**
 * The workspace activity feed — "what has this employee been doing?".
 *
 * Deliberately a sibling of logActivity (ActivityLog) rather than a
 * replacement. ActivityLog answers a different question for a different
 * audience: it is user-scoped, backs the admin portal, and its action enum is
 * closed. This one is org-scoped, can be written by an agent with no acting
 * user, and takes a free-form dotted verb so new phases add verbs without a
 * migration.
 */

export interface RecordEventInput {
  organizationId: string;
  /** Null for org-level and cross-agent events. */
  agent?: Agent | null;
  actorKind: ActorKind;
  actorUserId?: string | null;
  /** Dotted verb, e.g. "lex.contract.reviewed". */
  verb: string;
  /**
   * The one-line summary shown in the feed. Written now, on purpose: it has to
   * keep describing what happened even after the object it refers to changes.
   */
  summary: string;
  objectKind?: string | null;
  objectId?: string | null;
  runId?: string | null;
  playId?: string | null;
  pendingActionId?: string | null;
  messageId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Fire-and-forget, for the same reason logActivity is: recording that a
 * contract was reviewed must never be the thing that fails the review.
 */
export async function recordActivityEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        organizationId: input.organizationId,
        agent: input.agent ?? null,
        actorKind: input.actorKind,
        actorUserId: input.actorUserId ?? null,
        verb: input.verb,
        summary: input.summary,
        objectKind: input.objectKind ?? null,
        objectId: input.objectId ?? null,
        runId: input.runId ?? null,
        playId: input.playId ?? null,
        pendingActionId: input.pendingActionId ?? null,
        messageId: input.messageId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.error("[activity-event] failed to record", input.verb, err);
  }
}

export interface ListEventsParams {
  organizationId: string;
  agent?: Agent;
  verb?: string;
  objectKind?: string;
  objectId?: string;
  /** createdAt of the last row from the previous page. */
  cursor?: Date;
  limit?: number;
}

export interface ActivityEventEntry {
  id: string;
  agent: Agent | null;
  actorKind: ActorKind;
  actorUserId: string | null;
  verb: string;
  summary: string;
  objectKind: string | null;
  objectId: string | null;
  runId: string | null;
  playId: string | null;
  pendingActionId: string | null;
  messageId: string | null;
  metadata: unknown;
  createdAt: string;
}

export async function listActivityEvents(
  params: ListEventsParams,
): Promise<{ events: ActivityEventEntry[]; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const rows = await prisma.activityEvent.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.agent ? { agent: params.agent } : {}),
      ...(params.verb ? { verb: params.verb } : {}),
      ...(params.objectKind ? { objectKind: params.objectKind } : {}),
      ...(params.objectId ? { objectId: params.objectId } : {}),
      ...(params.cursor ? { createdAt: { lt: params.cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    // One extra row is how we know whether another page exists without a
    // second count query.
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null;

  return {
    events: page.map((r) => ({
      id: r.id,
      agent: r.agent,
      actorKind: r.actorKind,
      actorUserId: r.actorUserId,
      verb: r.verb,
      summary: r.summary,
      objectKind: r.objectKind,
      objectId: r.objectId,
      runId: r.runId,
      playId: r.playId,
      pendingActionId: r.pendingActionId,
      messageId: r.messageId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export { ActorKind };
