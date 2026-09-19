import { prisma } from "../../config/prisma.js";
import {
  ActorKind,
  HandoffStatus,
  InsightStatus,
  McpPendingActionStatus,
  WorkObjectStatus,
} from "../../../prisma/generated/prisma/client.js";

/**
 * The PRD's success criteria, computed.
 *
 * "Measure completed business work, not merely chat volume" — which is exactly
 * what the framework tables make possible, and what message counts never
 * could. Every number here comes from ActivityEvent, Insight, Handoff,
 * WorkObjectIndex or the approval queue.
 *
 * Distinct from mcp.getValueReport, which counts provider tool calls and
 * answers "what did your integrations do". This answers "did the employees
 * accomplish anything", and the two are not the same question.
 *
 * Rates are null rather than 0 when the denominator is empty. A brand-new org
 * has not got a 0% action rate; it has no action rate, and showing 0% would
 * read as a failing grade for having just signed up.
 */

export interface OutcomeMetrics {
  periodDays: number;

  /** Work objects that reached a terminal state in the period. */
  workCompleted: number;
  /** Work still open and waiting on the customer. */
  workNeedingAttention: number;

  /** Findings surfaced without anyone asking. */
  insightsSurfaced: number;
  /**
   * Of the findings decided on, the share acted upon rather than dismissed.
   * The PRD's "action rate": whether proactive work is actually useful, or
   * just noise the customer clears away.
   */
  actionRate: number | null;

  /** Enabled automations, and whether the org has adopted any at all. */
  automationsEnabled: number;
  /** Share of recorded work an agent started on its own rather than on a prompt. */
  proactiveShare: number | null;

  /** Cross-agent handoffs created, and how many reached a result. */
  handoffsCreated: number;
  handoffsCompleted: number;

  /** Median minutes from an approval being requested to being decided. */
  approvalMedianMinutes: number | null;
  approvalsPending: number;
}

/** Median, not mean: one approval left over a weekend would drag a mean useless. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : Math.round(sorted[mid]!);
}

export async function getOutcomeMetrics(
  organizationId: string,
  periodDays = 30,
): Promise<OutcomeMetrics> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [
    workCompleted,
    workNeedingAttention,
    insightsSurfaced,
    insightsActed,
    insightsDismissed,
    automationsEnabled,
    agentEvents,
    proactiveEvents,
    handoffsCreated,
    handoffsCompleted,
    decidedApprovals,
    approvalsPending,
  ] = await Promise.all([
    prisma.workObjectIndex.count({
      where: {
        organizationId,
        status: WorkObjectStatus.DONE,
        sourceUpdatedAt: { gte: since },
      },
    }),
    prisma.workObjectIndex.count({
      where: { organizationId, status: WorkObjectStatus.NEEDS_REVIEW },
    }),
    prisma.insight.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.insight.count({
      where: { organizationId, status: InsightStatus.ACTED, updatedAt: { gte: since } },
    }),
    prisma.insight.count({
      where: { organizationId, status: InsightStatus.DISMISSED, updatedAt: { gte: since } },
    }),
    prisma.mcpPlay.count({ where: { organizationId, enabled: true } }),
    prisma.activityEvent.count({
      where: { organizationId, actorKind: ActorKind.AGENT, createdAt: { gte: since } },
    }),
    // Work an agent started on its own: it came from a scheduled play or a
    // planned run rather than from someone typing. That is the PRD's
    // "proactive value" — meaningful work initiated by monitoring.
    prisma.activityEvent.count({
      where: {
        organizationId,
        actorKind: ActorKind.AGENT,
        createdAt: { gte: since },
        OR: [{ playId: { not: null } }, { runId: { not: null } }],
      },
    }),
    prisma.handoff.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.handoff.count({
      where: {
        organizationId,
        status: HandoffStatus.COMPLETED,
        updatedAt: { gte: since },
      },
    }),
    prisma.mcpPendingAction.findMany({
      where: {
        organizationId,
        status: {
          in: [
            McpPendingActionStatus.CONFIRMED,
            McpPendingActionStatus.EXECUTED,
            McpPendingActionStatus.REJECTED,
          ],
        },
        createdAt: { gte: since },
      },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.mcpPendingAction.count({
      where: { organizationId, status: McpPendingActionStatus.PENDING },
    }),
  ]);

  const insightsDecided = insightsActed + insightsDismissed;

  return {
    periodDays,
    workCompleted,
    workNeedingAttention,
    insightsSurfaced,
    actionRate: insightsDecided > 0 ? insightsActed / insightsDecided : null,
    automationsEnabled,
    proactiveShare: agentEvents > 0 ? proactiveEvents / agentEvents : null,
    handoffsCreated,
    handoffsCompleted,
    approvalMedianMinutes: median(
      decidedApprovals.map((a) =>
        Math.round((a.updatedAt.getTime() - a.createdAt.getTime()) / 60_000),
      ),
    ),
    approvalsPending,
  };
}
