import { prisma } from "../../config/prisma.js";
import {
  Agent,
  HandoffStatus,
  InsightStatus,
  McpPendingActionStatus,
  WorkObjectStatus,
} from "../../../prisma/generated/prisma/client.js";
import { listActivityEvents, type ActivityEventEntry } from "../activity/activity-event.service.js";
import { listInsights, type InsightEntry } from "./insights.service.js";

/**
 * Work-object listing and the overview aggregate.
 *
 * The overview is one endpoint on purpose. It answers the PRD's six questions
 * ("what is happening / what needs me / what did you find / what happens next /
 * what did you do / how do I delegate"), and six separate requests to paint one
 * screen is how a landing page ends up feeling slower than the chat box it
 * replaced.
 */

export interface WorkObjectEntry {
  id: string;
  kind: string;
  sourceId: string;
  title: string;
  status: WorkObjectStatus;
  dueAt: string | null;
  ownerUserId: string | null;
  preview: unknown;
  updatedAt: string;
}

export async function listWorkObjects(params: {
  organizationId: string;
  agent: Agent;
  kind?: string;
  status?: WorkObjectStatus;
  q?: string;
  limit?: number;
  cursor?: Date;
}): Promise<{ items: WorkObjectEntry[]; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const rows = await prisma.workObjectIndex.findMany({
    where: {
      organizationId: params.organizationId,
      agent: params.agent,
      ...(params.kind ? { kind: params.kind } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.q ? { title: { contains: params.q, mode: "insensitive" as const } } : {}),
      ...(params.cursor ? { sourceUpdatedAt: { lt: params.cursor } } : {}),
    },
    orderBy: { sourceUpdatedAt: "desc" },
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit ? (page[page.length - 1]?.sourceUpdatedAt.toISOString() ?? null) : null;

  return {
    items: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      sourceId: r.sourceId,
      title: r.title,
      status: r.status,
      dueAt: r.dueAt?.toISOString() ?? null,
      ownerUserId: r.ownerUserId,
      preview: r.preview,
      updatedAt: r.sourceUpdatedAt.toISOString(),
    })),
    nextCursor,
  };
}

export interface WorkspaceOverview {
  agent: Agent;
  /** Count per kind, then per status, for the Work module's nav badges. */
  workCounts: { kind: string; status: WorkObjectStatus; count: number }[];
  /** "What needs me?" — soonest first. */
  upcoming: WorkObjectEntry[];
  /** "What did you find?" */
  insights: InsightEntry[];
  /** "What did you do?" */
  recentActivity: ActivityEventEntry[];
  pendingApprovals: number;
  automations: { total: number; enabled: number; failing: number };
  /** Work another employee has asked this one to do. */
  incomingHandoffs: {
    id: string;
    fromAgent: Agent | null;
    note: string;
    requestedActionId: string | null;
    requestedArgs: unknown;
    objectKind: string | null;
    objectId: string | null;
    createdAt: string;
  }[];
}

export async function getOverview(params: {
  organizationId: string;
  agent: Agent;
}): Promise<WorkspaceOverview> {
  const { organizationId, agent } = params;

  const [grouped, upcomingRows, insights, activity, pendingApprovals, plays, handoffs] =
    await Promise.all([
    prisma.workObjectIndex.groupBy({
      by: ["kind", "status"],
      where: { organizationId, agent },
      _count: { _all: true },
    }),
    // Anything with a date attached that has not been archived — overdue items
    // included, since those are the ones that most need saying out loud.
    prisma.workObjectIndex.findMany({
      where: {
        organizationId,
        agent,
        dueAt: { not: null },
        status: { notIn: [WorkObjectStatus.DONE, WorkObjectStatus.ARCHIVED] },
      },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    listInsights({ organizationId, agent, status: InsightStatus.OPEN, limit: 10 }),
    listActivityEvents({ organizationId, agent, limit: 15 }),
    prisma.mcpPendingAction.count({
      where: { organizationId, agent, status: McpPendingActionStatus.PENDING },
    }),
    prisma.mcpPlay.findMany({
      where: { organizationId },
      select: { enabled: true, lastError: true },
    }),
    // Pending only: an accepted handoff is already being dealt with, and
    // showing it as something that needs attention would be double-counting.
    prisma.handoff.findMany({
      where: { organizationId, toAgent: agent, status: HandoffStatus.PENDING },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    agent,
    workCounts: grouped.map((g) => ({
      kind: g.kind,
      status: g.status,
      count: g._count._all,
    })),
    upcoming: upcomingRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      sourceId: r.sourceId,
      title: r.title,
      status: r.status,
      dueAt: r.dueAt?.toISOString() ?? null,
      ownerUserId: r.ownerUserId,
      preview: r.preview,
      updatedAt: r.sourceUpdatedAt.toISOString(),
    })),
    insights,
    recentActivity: activity.events,
    pendingApprovals,
    automations: {
      total: plays.length,
      enabled: plays.filter((p) => p.enabled).length,
      // A play whose last run failed is the one thing the overview must not
      // stay quiet about — a silently broken automation is worse than none.
      failing: plays.filter((p) => p.lastError !== null).length,
    },
    incomingHandoffs: handoffs.map((h) => ({
      id: h.id,
      fromAgent: h.fromAgent,
      note: h.note,
      requestedActionId: h.requestedActionId,
      requestedArgs: h.requestedArgs,
      objectKind: h.objectKind,
      objectId: h.objectId,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export interface AgentPulse {
  agent: Agent;
  openInsights: number;
  criticalInsights: number;
  pendingApprovals: number;
  needsReview: number;
  lastActivityAt: string | null;
}

export interface CompanyPulse {
  agents: AgentPulse[];
  totals: { openInsights: number; pendingApprovals: number; needsReview: number };
  topInsights: InsightEntry[];
  recentActivity: ActivityEventEntry[];
  handoffsInFlight: number;
}

/**
 * The company-wide view: what every employee is sitting on, in one call.
 *
 * This is the thing the four org-scoped framework tables were for. Because
 * ActivityEvent, Insight and WorkObjectIndex all carry an `agent` column
 * rather than living in per-agent tables, "how is the company doing" is a
 * group-by instead of six round-trips and a merge — which is what makes
 * Vega's acceptance criterion (summarise the workforce without opening every
 * workspace) achievable at all.
 */
export async function getCompanyPulse(organizationId: string): Promise<CompanyPulse> {
  const [insightGroups, approvalGroups, workGroups, lastActivity, topInsights, activity, handoffs] =
    await Promise.all([
      prisma.insight.groupBy({
        by: ["agent", "severity"],
        where: { organizationId, status: InsightStatus.OPEN },
        _count: { _all: true },
      }),
      prisma.mcpPendingAction.groupBy({
        by: ["agent"],
        where: { organizationId, status: McpPendingActionStatus.PENDING },
        _count: { _all: true },
      }),
      prisma.workObjectIndex.groupBy({
        by: ["agent"],
        where: { organizationId, status: WorkObjectStatus.NEEDS_REVIEW },
        _count: { _all: true },
      }),
      prisma.activityEvent.groupBy({
        by: ["agent"],
        where: { organizationId, agent: { not: null } },
        _max: { createdAt: true },
      }),
      listInsights({ organizationId, status: InsightStatus.OPEN, limit: 8 }),
      listActivityEvents({ organizationId, limit: 20 }),
      prisma.handoff.count({
        where: {
          organizationId,
          status: { in: [HandoffStatus.PENDING, HandoffStatus.ACCEPTED] },
        },
      }),
    ]);

  const agents = Object.values(Agent).map((agent) => {
    const insights = insightGroups.filter((g) => g.agent === agent);
    return {
      agent,
      openInsights: insights.reduce((sum, g) => sum + g._count._all, 0),
      criticalInsights: insights
        .filter((g) => g.severity === "CRITICAL" || g.severity === "HIGH")
        .reduce((sum, g) => sum + g._count._all, 0),
      pendingApprovals:
        approvalGroups.find((g) => g.agent === agent)?._count._all ?? 0,
      needsReview: workGroups.find((g) => g.agent === agent)?._count._all ?? 0,
      lastActivityAt:
        lastActivity.find((g) => g.agent === agent)?._max.createdAt?.toISOString() ?? null,
    };
  });

  return {
    agents,
    totals: {
      openInsights: agents.reduce((sum, a) => sum + a.openInsights, 0),
      pendingApprovals: agents.reduce((sum, a) => sum + a.pendingApprovals, 0),
      needsReview: agents.reduce((sum, a) => sum + a.needsReview, 0),
    },
    topInsights,
    recentActivity: activity.events,
    handoffsInFlight: handoffs,
  };
}
