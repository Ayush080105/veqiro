import { prisma } from "../../../config/prisma.js";
import {
  ActorKind,
  Agent,
  InsightSeverity,
  WorkObjectStatus,
} from "../../../../prisma/generated/prisma/client.js";
import { recordActivityEvent } from "../../activity/activity-event.service.js";
import { upsertInsight } from "../../workspace/insights.service.js";
import {
  WORK_OBJECT_KINDS,
  projectWorkObject,
  reprojectAll,
  unprojectWorkObject,
  type ProjectInput,
} from "../../workspace/work-objects.projector.js";

/**
 * The bridge between Lex's own tables and the shared workspace framework.
 *
 * Everything workspace-shaped that Lex does lives here rather than being
 * scattered through lex.service/lex.memory, so there is one file to read when
 * asking "how does Lex appear in the workspace?" — and one file to copy when
 * wiring the next agent.
 */

// ─── Work objects ────────────────────────────────────────────────────────────

/** Project one LexSource into the index. Safe to call after any write to it. */
export async function projectLexSource(sourceRowId: string): Promise<void> {
  // projection-guard: the index is derived bookkeeping, so a failure here
  // must never propagate into the publish or upload that triggered it.
  try {
    const source = await prisma.lexSource.findUnique({ where: { id: sourceRowId } });
    if (!source) {
      await unprojectWorkObject(WORK_OBJECT_KINDS.lexContract, sourceRowId);
      return;
    }
    await projectWorkObject(lexSourceToWorkObject(source));

  } catch (err) {
    console.error("[lex] projection failed", err);
  }
}

export async function unprojectLexSource(sourceRowId: string): Promise<void> {
  await unprojectWorkObject(WORK_OBJECT_KINDS.lexContract, sourceRowId);
}

// ─── Activity ────────────────────────────────────────────────────────────────

/**
 * Mirror a LexActivity row into the shared feed.
 *
 * Dual-write rather than cut-over: LexActivity still backs Lex's own activity
 * list and the weekly brief, and moving both at once would mean one migration
 * with two ways to be wrong. LexActivity gets backfilled and dropped once the
 * workspace feed is the only reader.
 */
export async function mirrorLexActivity(input: {
  organizationId: string;
  sourceRowId?: string | null;
  actor: "lex" | "user";
  userId?: string;
  action: string;
  detail?: string;
}): Promise<void> {
  await recordActivityEvent({
    organizationId: input.organizationId,
    agent: Agent.LEX,
    actorKind: input.actor === "lex" ? ActorKind.AGENT : ActorKind.USER,
    actorUserId: input.userId ?? null,
    // LexActivity.action is free prose ("Reviewed NDA"), so it cannot become a
    // dotted verb without inventing a mapping that would immediately drift.
    // The prose goes in the summary where it belongs and the verb stays coarse.
    verb: input.actor === "lex" ? "lex.agent.acted" : "lex.user.acted",
    summary: input.action,
    objectKind: input.sourceRowId ? WORK_OBJECT_KINDS.lexContract : null,
    objectId: input.sourceRowId ?? null,
    metadata: input.detail ? { detail: input.detail } : undefined,
  });
}

// ─── Insights ────────────────────────────────────────────────────────────────

type WatchKind = "deadline" | "notice" | "renewal" | "expiry" | "new_version" | "needs_review";
type WatchSeverity = "critical" | "high" | "medium" | "info";

const SEVERITY_BY_WATCH: Record<WatchSeverity, InsightSeverity> = {
  critical: InsightSeverity.CRITICAL,
  high: InsightSeverity.HIGH,
  medium: InsightSeverity.MEDIUM,
  info: InsightSeverity.INFO,
};

/** What the customer should be offered when a given watch item is showing. */
const SUGGESTED_ACTION: Partial<Record<WatchKind, string>> = {
  notice: "lex:draft-reply",
  renewal: "lex:draft-reply",
  expiry: "lex:draft-reply",
  new_version: "lex:analyze-contract",
  needs_review: "lex:analyze-contract",
};

/**
 * The period segment of an insight's dedupeKey.
 *
 * A dated item is keyed by its own due date, so next year's renewal is a
 * genuinely different insight from this year's and a dismissal does not carry
 * over. An undated one falls back to the month, so it can resurface after being
 * dismissed rather than being silenced forever.
 */
function periodFor(dueDate: string | null, now: Date): string {
  if (dueDate) return dueDate.slice(0, 10);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The shape this bridge needs from buildWatch's items, structurally. */
export interface WatchItemLike {
  id: string;
  kind: string;
  severity: string;
  sourceRowId: string;
  documentName: string;
  title: string;
  dueDate: string | null;
  daysLeft: number | null;
}

/**
 * Mirror Legal Watch into Insights.
 *
 * Legal Watch is computed on read and always has been; this does not change
 * that. It gives the same findings a durable, dismissible form so they can
 * appear on the workspace overview and be acted on, while /agents/lex/watch
 * keeps returning exactly what it returned before.
 *
 * Takes the already-built items rather than calling buildWatch itself: this
 * module is imported by lex.memory (for the activity mirror), so importing
 * lex.memory back would make the pair circular. Keeping the bridge a pure
 * mapping avoids that entirely.
 *
 * Fire-and-forget: a failure here must not break the watch response.
 */
export async function syncLexInsights(
  organizationId: string,
  items: WatchItemLike[],
  now = new Date(),
): Promise<void> {
  try {
    for (const item of items) {
      const kind = item.kind as WatchKind;
      const severity = SEVERITY_BY_WATCH[item.severity as WatchSeverity] ?? InsightSeverity.MEDIUM;
      const period = periodFor(item.dueDate, now);

      await upsertInsight({
        organizationId,
        agent: Agent.LEX,
        // Three segments, period last — see assertPeriodicDedupeKey.
        dedupeKey: `lex.${kind}:${item.sourceRowId}:${period}`,
        kind: `lex.${kind}`,
        title: item.title,
        body: item.documentName,
        severity,
        suggestedActionId: SUGGESTED_ACTION[kind] ?? null,
        suggestedArgs: item.sourceRowId ? { sourceRowId: item.sourceRowId } : undefined,
        objectKind: WORK_OBJECT_KINDS.lexContract,
        objectId: item.sourceRowId,
        metadata: { daysLeft: item.daysLeft, watchItemId: item.id },
      });
    }
  } catch (err) {
    console.error("[lex] insight sync failed", err);
  }
}

// ─── Reindex ─────────────────────────────────────────────────────────────────

type LexSourceRow = Awaited<ReturnType<typeof prisma.lexSource.findMany>>[number];

/** Map Lex's own status string onto the shared lifecycle. */
function lexStatusToWorkObjectStatus(
  status: string,
  hasUnreviewedRisk: boolean,
): WorkObjectStatus {
  if (status === "archived") return WorkObjectStatus.ARCHIVED;
  if (status === "draft") return WorkObjectStatus.DRAFT;
  if (hasUnreviewedRisk) return WorkObjectStatus.NEEDS_REVIEW;
  return WorkObjectStatus.ACTIVE;
}

/**
 * The one place that knows how a LexSource becomes an index row, so the
 * incremental projection and the bulk reindex cannot disagree.
 */
export function lexSourceToWorkObject(source: LexSourceRow): ProjectInput {
  // The soonest date that needs a human. Notice deadlines come before the
  // renewal they protect, which is exactly why they are listed first.
  const candidates = [source.noticeDeadline, source.renewalDate, source.expiryDate].filter(
    (d): d is Date => d instanceof Date,
  );
  const dueAt =
    candidates.length > 0 ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;

  const hasUnreviewedRisk = source.criticalCount > 0 || source.highCount > 0;

  return {
    organizationId: source.organizationId,
    agent: Agent.LEX,
    kind: WORK_OBJECT_KINDS.lexContract,
    sourceId: source.id,
    title: source.name,
    status: lexStatusToWorkObjectStatus(source.status, hasUnreviewedRisk),
    dueAt,
    ownerUserId: source.userId,
    preview: {
      counterparty: source.counterparty,
      riskLevel: source.riskLevel,
      reviewHeadline: source.reviewHeadline,
      criticalCount: source.criticalCount,
      highCount: source.highCount,
      contractValue: source.contractValue,
      type: source.typeDetected ?? source.type,
    },
    sourceUpdatedAt: source.lastReviewedAt ?? source.createdAt,
  };
}

/** Rebuild every contract index row from lex_source. */
export async function reindexLexContracts(organizationId?: string) {
  const sources = await prisma.lexSource.findMany({
    where: organizationId ? { organizationId } : undefined,
  });
  return reprojectAll(
    WORK_OBJECT_KINDS.lexContract,
    sources.map(lexSourceToWorkObject),
    organizationId,
  );
}
