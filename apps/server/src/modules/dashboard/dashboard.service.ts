import * as repo from "./dashboard.repository.js";
import type { AgentSlug, MessageRow } from "./dashboard.repository.js";
import type { DashboardQueryInput } from "./dashboard.schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const AGENT_SLUGS = ["maya", "rex", "scout", "sage", "lex", "vega"] as const;

export type DashboardSummary = {
  metrics: {
    messagesWeek: number;
    messagesPrevWeek: number;
    messagesSparkline: number[];
    contentPublishedWeek: number;
    contentPublishedPrevWeek: number;
    tokensMonth: number;
    hoursSavedEstimate: number;
  };
  activityChart: Array<{ date: string } & Record<AgentSlug, number>>;
  leaderboard: Array<{
    slug: AgentSlug;
    messagesWeek: number;
    sparkline: number[];
    lastActivity: string | null;
  }>;
  contentPipeline: {
    byPlatform: { twitter: number; linkedin: number; instagram: number };
    byStatus: { draft: number; scheduled: number; published: number; failed: number };
  };
  recentActivity: Array<{
    type: "message" | "post";
    agent?: AgentSlug;
    title: string;
    href?: string;
    at: string;
  }>;
  attention: Array<{
    kind: "failed-posts" | "expiring-token";
    message: string;
    href: string;
    severity: "warning" | "critical";
  }>;
};

const startOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const dayKey = (d: Date) => startOfDayUTC(d).toISOString().slice(0, 10);

const emptyAgentMap = (): Record<AgentSlug, number> => ({
  maya: 0,
  rex: 0,
  scout: 0,
  sage: 0,
  lex: 0,
  vega: 0,
});

type ResolvedWindow = {
  from: Date;
  to: Date;
  bucket: "day" | "hour";
  bucketCount: number;
};

function resolveWindow(input: {
  range: "24h" | "7d" | "30d" | "custom";
  from?: string;
  to?: string;
}): ResolvedWindow {
  const now = new Date();
  const startOfToday = startOfDayUTC(now);
  const dayAfterToday = new Date(startOfToday.getTime() + DAY_MS);
  switch (input.range) {
    case "24h":
      return { from: new Date(now.getTime() - 24 * HOUR_MS), to: now, bucket: "hour", bucketCount: 24 };
    case "7d":
      return { from: new Date(dayAfterToday.getTime() - 7 * DAY_MS), to: dayAfterToday, bucket: "day", bucketCount: 7 };
    case "30d":
      return { from: new Date(dayAfterToday.getTime() - 30 * DAY_MS), to: dayAfterToday, bucket: "day", bucketCount: 30 };
    case "custom": {
      const from = startOfDayUTC(new Date(`${input.from!}T00:00:00Z`));
      const toStartOfDay = startOfDayUTC(new Date(`${input.to!}T00:00:00Z`));
      const to = new Date(toStartOfDay.getTime() + DAY_MS);
      const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
      return { from, to, bucket: "day", bucketCount: days };
    }
  }
}

function bucketByHourAndAgent(
  rows: MessageRow[],
  endExclusive: Date,
): Array<{ date: string } & Record<AgentSlug, number>> {
  const endFloor = new Date(endExclusive.getTime());
  endFloor.setUTCMinutes(0, 0, 0);
  const start = new Date(endFloor.getTime() - 23 * HOUR_MS);
  const out: Array<{ date: string } & Record<AgentSlug, number>> = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(start.getTime() + i * HOUR_MS);
    out.push({ date: d.toISOString(), ...emptyAgentMap() });
  }
  const index = new Map(out.map((row, i) => [row.date, i]));
  for (const r of rows) {
    const d = new Date(r.createdAt);
    d.setUTCMinutes(0, 0, 0);
    const k = d.toISOString();
    const idx = index.get(k);
    if (idx === undefined) continue;
    const slug = repo.SLUG_BY_ENUM[r.agent];
    out[idx][slug] += 1;
  }
  return out;
}

function bucketByDayAndAgentWindow(
  rows: MessageRow[],
  from: Date,
  days: number,
): Array<{ date: string } & Record<AgentSlug, number>> {
  const out: Array<{ date: string } & Record<AgentSlug, number>> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * DAY_MS);
    out.push({ date: dayKey(d), ...emptyAgentMap() });
  }
  const index = new Map(out.map((row, i) => [row.date, i]));
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    const idx = index.get(k);
    if (idx === undefined) continue;
    const slug = repo.SLUG_BY_ENUM[r.agent];
    out[idx][slug] += 1;
  }
  return out;
}

function sparklineFromBuckets(
  buckets: Array<Record<AgentSlug, number>>,
  slug: AgentSlug,
  take: number,
): number[] {
  return buckets.slice(-take).map((b) => b[slug]);
}

function totalSparkline(buckets: Array<Record<AgentSlug, number>>): number[] {
  return buckets.map((b) => AGENT_SLUGS.reduce((sum, s) => sum + b[s], 0));
}

export async function getDashboardSummary(
  organizationId: string,
  input: DashboardQueryInput,
): Promise<DashboardSummary> {
  const window = resolveWindow({ range: input.range, from: input.from, to: input.to });
  // Pass-through: undefined means "no agent filter" (all agents), empty array means "none", subset is itself.
  const selectedSlugs: AgentSlug[] | undefined = input.agents as AgentSlug[] | undefined;
  const agentFilter = repo.agentEnumsFromSlugs(selectedSlugs);
  const windowMs = window.to.getTime() - window.from.getTime();
  const prevFrom = new Date(window.from.getTime() - windowMs);
  const prevTo = window.from;
  const monthStart = new Date(window.to.getTime() - 30 * DAY_MS);
  const expiringBefore = new Date(Date.now() + 7 * DAY_MS);

  // Short-circuit: if user explicitly selected zero agents, every message-driven count is 0.
  const zeroAgents = selectedSlugs !== undefined && selectedSlugs.length === 0;

  const [
    messagesInWindow,
    messagesCount,
    messagesPrevCount,
    contentPublishedCount,
    contentPublishedPrevCount,
    tokensWindow,
    byPlatform,
    byStatus,
    failedPostsCount,
    expiringIntegrations,
    recentPosts,
    recentMessages,
  ] = await Promise.all([
    zeroAgents
      ? Promise.resolve([] as MessageRow[])
      : repo.findMessagesInWindow(organizationId, window.from, window.to, agentFilter),
    zeroAgents
      ? Promise.resolve(0)
      : repo.countMessagesBetween(organizationId, window.from, window.to, agentFilter),
    zeroAgents
      ? Promise.resolve(0)
      : repo.countMessagesBetween(organizationId, prevFrom, prevTo, agentFilter),
    repo.countPublishedBetween(organizationId, window.from, window.to),
    repo.countPublishedBetween(organizationId, prevFrom, prevTo),
    zeroAgents
      ? Promise.resolve(0)
      : repo.sumTokensSince(organizationId, monthStart, window.to, agentFilter),
    repo.groupPostsByPlatform(organizationId, { from: window.from, to: window.to }),
    repo.groupPostsByStatus(organizationId, { from: window.from, to: window.to }),
    repo.countFailedPosts(organizationId),
    repo.findExpiringIntegrations(organizationId, expiringBefore),
    repo.findRecentPublishedPosts(organizationId, 10),
    repo.findRecentMessages(organizationId, 10),
  ]);

  const buckets =
    window.bucket === "hour"
      ? bucketByHourAndAgent(messagesInWindow, window.to)
      : bucketByDayAndAgentWindow(messagesInWindow, window.from, window.bucketCount);

  const messagesSparkline = totalSparkline(buckets);
  const selectedSet = new Set<AgentSlug>(selectedSlugs ?? AGENT_SLUGS);

  const leaderboard = AGENT_SLUGS.filter((slug) => selectedSet.has(slug)).map((slug) => {
    const messagesWeekForAgent = buckets.reduce((sum, b) => sum + b[slug], 0);
    const sparkline = sparklineFromBuckets(buckets, slug, Math.min(buckets.length, 7));
    let lastActivity: string | null = null;
    for (let i = messagesInWindow.length - 1; i >= 0; i--) {
      if (repo.SLUG_BY_ENUM[messagesInWindow[i].agent] === slug) {
        lastActivity = messagesInWindow[i].createdAt.toISOString();
        break;
      }
    }
    return { slug, messagesWeek: messagesWeekForAgent, sparkline, lastActivity };
  });

  const platformCounts = { twitter: 0, linkedin: 0, instagram: 0 };
  for (const row of byPlatform) {
    platformCounts[repo.PLATFORM_BY_ENUM[row.platform]] = row._count._all;
  }

  const statusCounts = { draft: 0, scheduled: 0, published: 0, failed: 0 };
  for (const row of byStatus) {
    const status = row.status;
    if (status === "draft" || status === "scheduled" || status === "failed") {
      statusCounts[status] = row._count._all;
    } else if (status === "success" || status === "published") {
      statusCounts.published += row._count._all;
    }
  }

  type ActivityEntry = DashboardSummary["recentActivity"][number];
  const activity: ActivityEntry[] = [
    ...recentMessages.map<ActivityEntry>((m) => ({
      type: "message" as const,
      agent: repo.SLUG_BY_ENUM[m.agent],
      title:
        m.role === "user"
          ? `You asked ${repo.SLUG_BY_ENUM[m.agent]}: ${m.content.slice(0, 80)}`
          : `${repo.SLUG_BY_ENUM[m.agent]} replied: ${m.content.slice(0, 80)}`,
      href: `/assistants/${repo.SLUG_BY_ENUM[m.agent]}`,
      at: m.createdAt.toISOString(),
    })),
    ...recentPosts.map<ActivityEntry>((p) => ({
      type: "post" as const,
      title:
        p.status === "success"
          ? `Published to ${repo.PLATFORM_BY_ENUM[p.platform]}: ${p.caption.slice(0, 80)}`
          : p.status === "failed"
            ? `Failed ${repo.PLATFORM_BY_ENUM[p.platform]} post — retry`
            : `${p.status} ${repo.PLATFORM_BY_ENUM[p.platform]} post`,
      href: "/workspace/content",
      at: (p.publishedAt ?? p.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => (b.at > a.at ? 1 : -1))
    .slice(0, 20);

  const attention: DashboardSummary["attention"] = [];
  if (failedPostsCount > 0) {
    attention.push({
      kind: "failed-posts",
      message: `${failedPostsCount} post${failedPostsCount === 1 ? "" : "s"} failed to publish`,
      href: "/workspace/content",
      severity: "critical",
    });
  }
  for (const ex of expiringIntegrations) {
    const platform = repo.PLATFORM_BY_ENUM[ex.platform];
    const days = ex.accessTokenExpiresAt
      ? Math.max(
          0,
          Math.round((ex.accessTokenExpiresAt.getTime() - Date.now()) / DAY_MS),
        )
      : 0;
    attention.push({
      kind: "expiring-token",
      message: `${platform} token expires in ${days}d — reconnect`,
      href: "/settings/integrations",
      severity: days < 2 ? "critical" : "warning",
    });
  }

  const hoursSavedEstimate = Math.round((messagesCount * 3) / 60);

  return {
    metrics: {
      messagesWeek: messagesCount,
      messagesPrevWeek: messagesPrevCount,
      messagesSparkline,
      contentPublishedWeek: contentPublishedCount,
      contentPublishedPrevWeek: contentPublishedPrevCount,
      tokensMonth: tokensWindow,
      hoursSavedEstimate,
    },
    activityChart: buckets,
    leaderboard,
    contentPipeline: {
      byPlatform: platformCounts,
      byStatus: statusCounts,
    },
    recentActivity: activity,
    attention,
  };
}
