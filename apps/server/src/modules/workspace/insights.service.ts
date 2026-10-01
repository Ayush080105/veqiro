import { prisma } from "../../config/prisma.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import {
  InsightSeverity,
  InsightStatus,
  type Agent,
  type Prisma,
} from "../../../prisma/generated/prisma/client.js";

/**
 * Proactive findings — the "Lex noticed..." cards.
 *
 * The model's whole point is that a finding is dismissible and actionable, so
 * detectors upsert on a stable dedupeKey instead of inserting: re-running a
 * nightly scan must update the existing card, not stack a tenth copy of it.
 */

export interface UpsertInsightInput {
  organizationId: string;
  agent: Agent;
  /** See assertPeriodicDedupeKey — must carry a period segment. */
  dedupeKey: string;
  kind: string;
  title: string;
  body?: string;
  severity?: InsightSeverity;
  /** An AgentActionId from the frontend catalog. */
  suggestedActionId?: string | null;
  suggestedArgs?: Prisma.InputJsonValue;
  objectKind?: string | null;
  objectId?: string | null;
  runId?: string | null;
  expiresAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * A dedupeKey must have at least three colon-separated parts, the last of
 * which is a period, e.g. "lex.renewal:{sourceId}:2026-Q1".
 *
 * This is enforced rather than documented because getting it wrong fails
 * silently and permanently: without a period segment, the customer dismisses
 * the card once and every later scan upserts onto that dismissed row, so the
 * insight never appears again and nobody finds out.
 */
export function assertPeriodicDedupeKey(dedupeKey: string): void {
  const parts = dedupeKey.split(":");
  if (parts.length < 3 || !parts[parts.length - 1]) {
    throw new BadRequestError(
      `Insight dedupeKey "${dedupeKey}" needs a trailing period segment ` +
        `(e.g. "lex.renewal:<id>:2026-Q1"), otherwise a dismissal is permanent.`,
    );
  }
}

/**
 * Create or refresh an insight.
 *
 * A row the customer already dismissed or acted on stays that way: its content
 * is refreshed so the card is accurate if something reopens it, but the status
 * is not reset. Re-detecting is not a reason to re-nag.
 */
export async function upsertInsight(input: UpsertInsightInput): Promise<void> {
  assertPeriodicDedupeKey(input.dedupeKey);

  const content = {
    kind: input.kind,
    title: input.title,
    body: input.body ?? "",
    severity: input.severity ?? InsightSeverity.MEDIUM,
    suggestedActionId: input.suggestedActionId ?? null,
    suggestedArgs: input.suggestedArgs,
    objectKind: input.objectKind ?? null,
    objectId: input.objectId ?? null,
    runId: input.runId ?? null,
    expiresAt: input.expiresAt ?? null,
    metadata: input.metadata,
  };

  try {
    await prisma.insight.upsert({
      where: {
        organizationId_dedupeKey: {
          organizationId: input.organizationId,
          dedupeKey: input.dedupeKey,
        },
      },
      create: {
        organizationId: input.organizationId,
        agent: input.agent,
        dedupeKey: input.dedupeKey,
        ...content,
      },
      update: content,
    });
  } catch (err) {
    console.error("[insights] upsert failed", input.dedupeKey, err);
  }
}

export interface InsightEntry {
  id: string;
  agent: Agent;
  kind: string;
  title: string;
  body: string;
  severity: InsightSeverity;
  status: InsightStatus;
  suggestedActionId: string | null;
  suggestedArgs: unknown;
  objectKind: string | null;
  objectId: string | null;
  createdAt: string;
}

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export async function listInsights(params: {
  organizationId: string;
  agent?: Agent;
  status?: InsightStatus;
  severity?: InsightSeverity;
  limit?: number;
}): Promise<InsightEntry[]> {
  const rows = await prisma.insight.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.agent ? { agent: params.agent } : {}),
      // Default to the open queue: an overview asking "what needs me?" should
      // not have to filter out everything already dealt with.
      status: params.status ?? InsightStatus.OPEN,
      ...(params.severity ? { severity: params.severity } : {}),
      // Expired-but-not-yet-swept rows are noise, so hide them on read rather
      // than depending on a sweeper having run.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 200),
  });

  return rows
    .map((r) => ({
      id: r.id,
      agent: r.agent,
      kind: r.kind,
      title: r.title,
      body: r.body,
      severity: r.severity,
      status: r.status,
      suggestedActionId: r.suggestedActionId,
      suggestedArgs: r.suggestedArgs,
      objectKind: r.objectKind,
      objectId: r.objectId,
      createdAt: r.createdAt.toISOString(),
    }))
    // Severity first, recency second — a critical finding from Tuesday
    // outranks an informational one from this morning.
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

export async function setInsightStatus(params: {
  organizationId: string;
  id: string;
  status: InsightStatus;
  userId: string;
}): Promise<InsightEntry> {
  const existing = await prisma.insight.findUnique({ where: { id: params.id } });
  if (!existing || existing.organizationId !== params.organizationId) {
    throw new NotFoundError("Insight not found");
  }

  const acknowledged =
    params.status === InsightStatus.ACKNOWLEDGED ||
    params.status === InsightStatus.ACTED ||
    params.status === InsightStatus.DISMISSED;

  const row = await prisma.insight.update({
    where: { id: params.id },
    data: {
      status: params.status,
      ...(acknowledged
        ? { acknowledgedAt: new Date(), acknowledgedByUserId: params.userId }
        : {}),
    },
  });

  return {
    id: row.id,
    agent: row.agent,
    kind: row.kind,
    title: row.title,
    body: row.body,
    severity: row.severity,
    status: row.status,
    suggestedActionId: row.suggestedActionId,
    suggestedArgs: row.suggestedArgs,
    objectKind: row.objectKind,
    objectId: row.objectId,
    createdAt: row.createdAt.toISOString(),
  };
}

export { InsightSeverity, InsightStatus };
