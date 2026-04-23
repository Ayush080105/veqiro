# Dashboard Filters and Skeleton Loading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filter bar (time-range toggle 24h/7d/30d, custom date-range picker, multi-select agent chips) and a coherent skeleton-loading experience to the dashboard, with the filters flowing end-to-end through the `/dashboard/summary` API.

**Architecture:** Controlled local state in `dashboard/page.tsx` drives a new `DashboardFilters` client component and is passed into `useDashboardSummary({ range, agents })`. The hook serializes filters into query-string params. The Express controller validates with zod, the service resolves one `[windowStart, windowEnd]` pair from the range, then repository helpers take those plus an optional `Agent[]` filter to narrow Prisma `where` clauses. Post-driven data (ContentPipeline, `contentPublished*` metrics) responds to range only (no agent attribution on `PublishedPost`). A shared `Skeleton` primitive from shadcn replaces ad-hoc inline placeholders. Refetches keep prior data visible behind a thin progress bar.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query v5, shadcn/ui (`Skeleton`, new: `ToggleGroup`, `Popover`, `Calendar`), Express, Prisma, zod.

**Testing note:** No test infrastructure exists in this repo (confirmed — `apps/main/package.json` and `apps/server/package.json` have no test script). Bootstrapping vitest/jest is out of scope for this feature. Each task uses `pnpm tsc --noEmit`, `pnpm lint`, and a manual smoke step as its verification. TDD is not applicable here.

**Reference spec:** [docs/superpowers/specs/2026-04-23-dashboard-filters-and-skeletons-design.md](docs/superpowers/specs/2026-04-23-dashboard-filters-and-skeletons-design.md). Also heed [apps/main/AGENTS.md](apps/main/AGENTS.md) — this project uses Next.js 16.2.1; read docs under `node_modules/.pnpm/next@16.2.1_*/node_modules/next/dist/docs/` before writing any code that uses Next-specific APIs.

---

## File Structure

**Create:**
- `apps/main/src/components/ui/toggle-group.tsx` (via shadcn CLI)
- `apps/main/src/components/ui/popover.tsx` (via shadcn CLI)
- `apps/main/src/components/ui/calendar.tsx` (via shadcn CLI)
- `apps/main/src/components/dashboard/DashboardFilters.tsx`
- `apps/main/src/components/dashboard/DashboardProgressBar.tsx`
- `apps/main/src/components/dashboard/MetricCardSkeleton.tsx`
- `apps/main/src/components/dashboard/ActivityChartSkeleton.tsx`
- `apps/main/src/components/dashboard/CrewLeaderboardSkeleton.tsx`
- `apps/main/src/components/dashboard/ContentPipelineSkeleton.tsx`
- `apps/server/src/modules/dashboard/dashboard.schema.ts`

**Modify:**
- `apps/main/src/lib/api/dashboard.ts`
- `apps/main/src/app/(dashboard)/dashboard/page.tsx`
- `apps/main/src/components/dashboard/BrandSnapshot.tsx` (small skeleton swap)
- `apps/main/src/components/dashboard/StatusRow.tsx` (small skeleton swap)
- `apps/server/src/modules/dashboard/dashboard.controller.ts`
- `apps/server/src/modules/dashboard/dashboard.service.ts`
- `apps/server/src/modules/dashboard/dashboard.repository.ts`

---

## Task 1: Install shadcn primitives

**Files:**
- Create: `apps/main/src/components/ui/toggle-group.tsx`
- Create: `apps/main/src/components/ui/popover.tsx`
- Create: `apps/main/src/components/ui/calendar.tsx`

- [ ] **Step 1: Install the three components**

Run from `d:/Coding/veqiro/apps/main`:

```bash
pnpm dlx shadcn@latest add toggle-group popover calendar --yes
```

Expected: CLI reports created files in `src/components/ui/`.

- [ ] **Step 2: Verify the three files exist**

```bash
ls apps/main/src/components/ui/toggle-group.tsx apps/main/src/components/ui/popover.tsx apps/main/src/components/ui/calendar.tsx
```

Expected: all three paths print.

- [ ] **Step 3: Verify they typecheck against this project**

From `apps/main/`:

```bash
npx tsc --noEmit 2>&1 | grep -E "(toggle-group|popover|calendar)\.tsx" || echo "no errors in new files"
```

Expected: `no errors in new files`.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/ui/toggle-group.tsx apps/main/src/components/ui/popover.tsx apps/main/src/components/ui/calendar.tsx apps/main/components.json apps/main/package.json pnpm-lock.yaml
git commit -m "chore(ui): add shadcn toggle-group, popover, calendar primitives"
```

---

## Task 2: Add `ENUM_BY_SLUG` reverse map to the dashboard repository

**Files:**
- Modify: `apps/server/src/modules/dashboard/dashboard.repository.ts`

The existing repo has `SLUG_BY_ENUM` (Prisma enum → slug). The service will filter messages by agent slug input, so we need the reverse to translate slugs back to the Prisma `Agent` enum for `where` clauses.

- [ ] **Step 1: Add the reverse map and a helper**

Edit `apps/server/src/modules/dashboard/dashboard.repository.ts`. Find the `SLUG_BY_ENUM` declaration (around line 7) and add below it:

```ts
export const ENUM_BY_SLUG: Record<AgentSlug, Agent> = {
  maya: Agent.MAYA,
  rex: Agent.REX,
  scout: Agent.SCOUT,
  sage: Agent.SAGE,
  lex: Agent.LEX,
  vega: Agent.VEGA,
};

export const agentEnumsFromSlugs = (slugs: AgentSlug[] | undefined): Agent[] | undefined =>
  slugs && slugs.length > 0 ? slugs.map((s) => ENUM_BY_SLUG[s]) : undefined;
```

Also update the re-export line at the bottom of the file so `ENUM_BY_SLUG` and `agentEnumsFromSlugs` are available to the service:

```ts
export { AGENT_SLUGS, SLUG_BY_ENUM, PLATFORM_BY_ENUM };
```

becomes:

```ts
export { AGENT_SLUGS, SLUG_BY_ENUM, PLATFORM_BY_ENUM, ENUM_BY_SLUG, agentEnumsFromSlugs };
```

- [ ] **Step 2: Typecheck the server**

From `apps/server/`:

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Expected: zero errors introduced (pre-existing errors in unrelated files are acceptable; no mention of `dashboard.repository.ts`).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/dashboard/dashboard.repository.ts
git commit -m "feat(dashboard): add ENUM_BY_SLUG map and agentEnumsFromSlugs helper"
```

---

## Task 3: Extend repository query helpers to accept a window and agent filter

**Files:**
- Modify: `apps/server/src/modules/dashboard/dashboard.repository.ts`

Every message-query helper gains an optional `agentFilter: Agent[]` parameter. The two post-groupBy queries gain an optional `window: { from: Date; to: Date }` parameter. Absent = the previous behavior.

- [ ] **Step 1: Update `findMessagesInWindow`**

Replace the current implementation (roughly lines 30–35):

```ts
export const findMessagesInWindow = (organizationId: string, since: Date): Promise<MessageRow[]> =>
  prisma.message.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { agent: true, role: true, content: true, createdAt: true, tokensUsed: true },
  });
```

with:

```ts
export const findMessagesInWindow = (
  organizationId: string,
  from: Date,
  to: Date,
  agentFilter?: Agent[],
): Promise<MessageRow[]> =>
  prisma.message.findMany({
    where: {
      organizationId,
      createdAt: { gte: from, lt: to },
      ...(agentFilter ? { agent: { in: agentFilter } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { agent: true, role: true, content: true, createdAt: true, tokensUsed: true },
  });
```

- [ ] **Step 2: Update `countMessagesBetween`**

```ts
export const countMessagesBetween = (
  organizationId: string,
  from: Date,
  to: Date,
  agentFilter?: Agent[],
) =>
  prisma.message.count({
    where: {
      organizationId,
      createdAt: { gte: from, lt: to },
      ...(agentFilter ? { agent: { in: agentFilter } } : {}),
    },
  });
```

- [ ] **Step 3: Update `sumTokensSince`**

```ts
export const sumTokensSince = async (
  organizationId: string,
  from: Date,
  to: Date,
  agentFilter?: Agent[],
): Promise<number> => {
  const agg = await prisma.message.aggregate({
    where: {
      organizationId,
      createdAt: { gte: from, lt: to },
      ...(agentFilter ? { agent: { in: agentFilter } } : {}),
    },
    _sum: { tokensUsed: true },
  });
  return agg._sum.tokensUsed ?? 0;
};
```

Note: the signature changed from `(orgId, since)` to `(orgId, from, to, agentFilter?)`. The service in Task 5 must be updated accordingly.

- [ ] **Step 4: Update `groupPostsByPlatform` and `groupPostsByStatus` to accept a window**

```ts
export const groupPostsByPlatform = (
  organizationId: string,
  window?: { from: Date; to: Date },
) =>
  prisma.publishedPost.groupBy({
    by: ["platform"],
    where: {
      organizationId,
      status: "success",
      ...(window ? { createdAt: { gte: window.from, lt: window.to } } : {}),
    },
    _count: { _all: true },
  });

export const groupPostsByStatus = (
  organizationId: string,
  window?: { from: Date; to: Date },
) =>
  prisma.publishedPost.groupBy({
    by: ["status"],
    where: {
      organizationId,
      ...(window ? { createdAt: { gte: window.from, lt: window.to } } : {}),
    },
    _count: { _all: true },
  });
```

- [ ] **Step 5: Typecheck**

From `apps/server/`:

```bash
npx tsc --noEmit 2>&1 | grep "dashboard.repository.ts" || echo "no errors in dashboard.repository.ts"
```

Expected: `no errors in dashboard.repository.ts`. There **will** be new errors elsewhere (the service still calls these helpers with old signatures) — that is fixed in Task 5; ignore those here.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/dashboard/dashboard.repository.ts
git commit -m "feat(dashboard): extend repo helpers with window + agent filter params"
```

---

## Task 4: Add zod schema for `GET /dashboard/summary` query params

**Files:**
- Create: `apps/server/src/modules/dashboard/dashboard.schema.ts`

- [ ] **Step 1: Create the schema file**

Write `apps/server/src/modules/dashboard/dashboard.schema.ts`:

```ts
import { z } from "zod";

const AGENT_SLUGS = ["maya", "rex", "scout", "sage", "lex", "vega"] as const;

const rangeKindSchema = z.enum(["24h", "7d", "30d", "custom"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// Input may arrive as a comma-separated string. We normalize to string[] before validation.
const agentArraySchema = z
  .array(z.enum(AGENT_SLUGS))
  .max(AGENT_SLUGS.length);

export const dashboardQuerySchema = z
  .object({
    range: rangeKindSchema.default("7d"),
    from: isoDate.optional(),
    to: isoDate.optional(),
    agents: agentArraySchema.optional(),
  })
  .refine(
    (v) => v.range !== "custom" || (v.from && v.to),
    { message: "from and to are required when range=custom" },
  );

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
export type AgentSlugInput = (typeof AGENT_SLUGS)[number];
```

- [ ] **Step 2: Typecheck**

From `apps/server/`:

```bash
npx tsc --noEmit 2>&1 | grep "dashboard.schema.ts" || echo "no errors in dashboard.schema.ts"
```

Expected: `no errors in dashboard.schema.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/dashboard/dashboard.schema.ts
git commit -m "feat(dashboard): add zod schema for summary query params"
```

---

## Task 5: Rework `dashboard.service.ts` — compute window, apply filters, handle hourly bucketing

**Files:**
- Modify: `apps/server/src/modules/dashboard/dashboard.service.ts`

This is the largest single change. The service now accepts a `DashboardQueryInput` object, resolves one `[windowStart, windowEnd]` pair, runs all queries against that pair, and buckets the activity chart either by day (7d/30d/custom) or by hour (24h).

- [ ] **Step 1: Add window resolution + hourly bucketing helpers at the top of the file**

Below the existing `bucketByDayAndAgent` function (around line 76), add:

```ts
const HOUR_MS = 60 * 60 * 1000;

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
  const out: Array<{ date: string } & Record<AgentSlug, number>> = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(endExclusive.getTime() - (i + 1) * HOUR_MS);
    d.setUTCMinutes(0, 0, 0);
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
```

The old `bucketByDayAndAgent` (which anchored to `endExclusive` and counted backward) stays in the file unused for now — remove it in the same commit as replacing the call site.

- [ ] **Step 2: Change `getDashboardSummary` signature and body**

Replace the entire `getDashboardSummary` function (starting at `export async function getDashboardSummary(...)` around line 90) with:

```ts
import type { DashboardQueryInput } from "./dashboard.schema.js";

export async function getDashboardSummary(
  organizationId: string,
  input: DashboardQueryInput,
): Promise<DashboardSummary> {
  const window = resolveWindow({ range: input.range, from: input.from, to: input.to });
  const selectedSlugs = input.agents && input.agents.length >= 0 ? input.agents : undefined;
  // Distinguish "agents param absent" (treat as all) from "agents=[]" (treat as none).
  // The controller converts missing param to undefined and empty array to [].
  const agentFilter = repo.agentEnumsFromSlugs(selectedSlugs as AgentSlug[] | undefined);
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
  const selectedSet = new Set<AgentSlug>(
    (selectedSlugs as AgentSlug[] | undefined) ?? AGENT_SLUGS,
  );

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
```

The `DashboardSummary` shape is unchanged — only the values differ based on filters. The `messagesWeek` / `messagesPrevWeek` / `contentPublishedWeek` field names stay for frontend compatibility, but they now mean "current window" and "previous same-length window".

- [ ] **Step 3: Remove the now-unused old `bucketByDayAndAgent` helper**

Delete the old `bucketByDayAndAgent` function (lines ~57–76 of the pre-change file). Search for any remaining callers:

```bash
grep -n "bucketByDayAndAgent\b" apps/server/src/modules/dashboard/dashboard.service.ts
```

Expected: no matches (the new code uses `bucketByHourAndAgent` and `bucketByDayAndAgentWindow`).

- [ ] **Step 4: Typecheck**

From `apps/server/`:

```bash
npx tsc --noEmit 2>&1 | tail -30
```

Expected: zero errors in `dashboard.service.ts` (unrelated pre-existing errors elsewhere are fine). If the service complains about `messagesCount` being used where `messagesWeek` is expected, re-check Step 2 — the rename propagated to the returned `metrics` object.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/dashboard/dashboard.service.ts
git commit -m "feat(dashboard): resolve range window and apply agent filter in service"
```

---

## Task 6: Update the dashboard controller to parse query params

**Files:**
- Modify: `apps/server/src/modules/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Rewrite the file**

Replace the whole contents of `apps/server/src/modules/dashboard/dashboard.controller.ts` with:

```ts
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as service from "./dashboard.service.js";
import { dashboardQuerySchema } from "./dashboard.schema.js";
import { UnauthenticatedError } from "../../errors/UnauthenticatedError.js";

export const summary = async (req: Request, res: Response) => {
  if (!req.organizationId) {
    throw new UnauthenticatedError("Missing organization context");
  }

  // `agents` may arrive as a comma-separated string (e.g. ?agents=maya,rex) or
  // missing (absent => treat as "all agents" server-side). We distinguish
  // "absent" from "present but empty" (=> "no agents", server returns zeros).
  const raw = req.query as Record<string, string | undefined>;
  const agentsParam =
    raw.agents === undefined
      ? undefined
      : raw.agents === ""
        ? []
        : raw.agents.split(",").map((s) => s.trim()).filter(Boolean);

  const input = dashboardQuerySchema.parse({
    range: raw.range,
    from: raw.from,
    to: raw.to,
    agents: agentsParam,
  });

  const data = await service.getDashboardSummary(req.organizationId, input);
  res.status(StatusCodes.OK).json(data);
};
```

If `UnauthenticatedError`'s import path differs in the actual file, preserve the current one — only the body/signature of `summary` needs updating.

- [ ] **Step 2: Typecheck**

From `apps/server/`:

```bash
npx tsc --noEmit 2>&1 | grep "dashboard.controller.ts" || echo "no errors in dashboard.controller.ts"
```

Expected: `no errors in dashboard.controller.ts`.

- [ ] **Step 3: Manual smoke — start server and curl each range**

From repo root, start the server in one terminal:

```bash
cd apps/server && pnpm dev
```

In a second terminal, log in via the frontend (needed to get the auth cookie) — easiest path: run `cd apps/main && pnpm dev -p 3001`, hit http://localhost:3001, sign in, then from DevTools copy the session cookie value and replace `<COOKIE>` below. Then:

```bash
curl -s "http://localhost:3000/dashboard/summary?range=24h" -H "Cookie: <COOKIE>" | head -c 200
curl -s "http://localhost:3000/dashboard/summary?range=7d" -H "Cookie: <COOKIE>" | head -c 200
curl -s "http://localhost:3000/dashboard/summary?range=30d" -H "Cookie: <COOKIE>" | head -c 200
curl -s "http://localhost:3000/dashboard/summary?range=custom" -H "Cookie: <COOKIE>" | head -c 200
curl -s "http://localhost:3000/dashboard/summary?range=custom&from=2026-04-01&to=2026-04-15" -H "Cookie: <COOKIE>" | head -c 200
curl -s "http://localhost:3000/dashboard/summary?range=7d&agents=maya,rex" -H "Cookie: <COOKIE>" | head -c 200
curl -s "http://localhost:3000/dashboard/summary?range=7d&agents=" -H "Cookie: <COOKIE>" | head -c 200
```

Expected:
- 24h/7d/30d: 200 OK, JSON summary
- custom without from/to: 400 with a zod error message
- custom with from/to: 200 OK
- agents=maya,rex: 200 OK with only maya+rex in the leaderboard
- agents= (empty): 200 OK with `messagesWeek: 0` and an empty `leaderboard: []`

If the server rejects the 24h request with a type error on `sumTokensSince` arguments, revisit Task 5 Step 2 — the `sumTokensSince` call site signature changed.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/dashboard/dashboard.controller.ts
git commit -m "feat(dashboard): parse range + agents query params in controller"
```

---

## Task 7: Frontend — add `Range` type and filter-aware `useDashboardSummary`

**Files:**
- Modify: `apps/main/src/lib/api/dashboard.ts`

- [ ] **Step 1: Replace the file contents**

Replace `apps/main/src/lib/api/dashboard.ts` entirely with:

```ts
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import type { AgentSlug } from "@/lib/types"

export type DashboardSummary = {
  metrics: {
    messagesWeek: number
    messagesPrevWeek: number
    messagesSparkline: number[]
    contentPublishedWeek: number
    contentPublishedPrevWeek: number
    tokensMonth: number
    hoursSavedEstimate: number
  }
  activityChart: Array<{ date: string } & Record<AgentSlug, number>>
  leaderboard: Array<{
    slug: AgentSlug
    messagesWeek: number
    sparkline: number[]
    lastActivity: string | null
  }>
  contentPipeline: {
    byPlatform: { twitter: number; linkedin: number; instagram: number }
    byStatus: { draft: number; scheduled: number; published: number; failed: number }
  }
  recentActivity: Array<{
    type: "message" | "post"
    agent?: AgentSlug
    title: string
    href?: string
    at: string
  }>
  attention: Array<{
    kind: "failed-posts" | "expiring-token"
    message: string
    href: string
    severity: "warning" | "critical"
  }>
}

export type RangeKind = "24h" | "7d" | "30d"
export type Range =
  | { kind: RangeKind }
  | { kind: "custom"; from: Date; to: Date }

export type DashboardFilters = {
  range: Range
  // `agents` is the list of slugs explicitly selected. An empty array means
  // "no agents selected" — zero data. `undefined` / all-six-selected both
  // mean "no agent filter".
  agents: AgentSlug[]
}

const ALL_SLUGS: AgentSlug[] = ["maya", "rex", "scout", "sage", "lex", "vega"]

const EMPTY_SUMMARY: DashboardSummary = {
  metrics: {
    messagesWeek: 0,
    messagesPrevWeek: 0,
    messagesSparkline: Array(7).fill(0),
    contentPublishedWeek: 0,
    contentPublishedPrevWeek: 0,
    tokensMonth: 0,
    hoursSavedEstimate: 0,
  },
  activityChart: [],
  leaderboard: [],
  contentPipeline: {
    byPlatform: { twitter: 0, linkedin: 0, instagram: 0 },
    byStatus: { draft: 0, scheduled: 0, published: 0, failed: 0 },
  },
  recentActivity: [],
  attention: [],
}

function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function buildQuery(filters: DashboardFilters): string {
  const sp = new URLSearchParams()
  if (filters.range.kind === "custom") {
    sp.set("range", "custom")
    sp.set("from", formatDateOnly(filters.range.from))
    sp.set("to", formatDateOnly(filters.range.to))
  } else {
    sp.set("range", filters.range.kind)
  }
  // Omit `agents` param entirely when every agent is selected (shorter URL,
  // better cache). Send explicit empty string when the user picked none.
  if (filters.agents.length !== ALL_SLUGS.length) {
    sp.set("agents", filters.agents.join(","))
  }
  return sp.toString()
}

function cacheKey(filters: DashboardFilters): readonly unknown[] {
  const rangeKey =
    filters.range.kind === "custom"
      ? ["custom", formatDateOnly(filters.range.from), formatDateOnly(filters.range.to)]
      : [filters.range.kind]
  const agentsKey = [...filters.agents].sort()
  return ["dashboard-summary", ...rangeKey, agentsKey] as const
}

export async function getDashboardSummary(
  filters: DashboardFilters,
): Promise<DashboardSummary> {
  try {
    return await apiFetch<DashboardSummary>(`/dashboard/summary?${buildQuery(filters)}`)
  } catch {
    return EMPTY_SUMMARY
  }
}

export function useDashboardSummary(filters: DashboardFilters) {
  return useQuery({
    queryKey: cacheKey(filters),
    queryFn: () => getDashboardSummary(filters),
    staleTime: 10_000,
    refetchOnMount: "always",
    placeholderData: (prev) => prev, // keep previous data on filter change
  })
}

export { ALL_SLUGS }
```

Key things:
- `placeholderData: (prev) => prev` keeps previous data visible while a new query is in flight — this is what powers the "keep old data + progress bar" refetch UX.
- `cacheKey` sorts the agents array so `[maya, rex]` and `[rex, maya]` share a cache entry.
- `buildQuery` omits `agents` when every agent is selected so the network URL is short and matches the controller contract.

- [ ] **Step 2: Typecheck**

From `apps/main/`:

```bash
npx tsc --noEmit 2>&1 | grep "lib/api/dashboard.ts" || echo "no errors in dashboard.ts"
```

Expected: `no errors in dashboard.ts`. The dashboard page will error in its own file because its call site hasn't been updated yet — that is Task 11. Ignore the page.tsx error here.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/lib/api/dashboard.ts
git commit -m "feat(dashboard): accept range + agents filters in useDashboardSummary"
```

---

## Task 8: Create `DashboardFilters` component (agent chips + range toggle + custom picker)

**Files:**
- Create: `apps/main/src/components/dashboard/DashboardFilters.tsx`

- [ ] **Step 1: Scaffold the component**

Write `apps/main/src/components/dashboard/DashboardFilters.tsx`:

```tsx
"use client"

import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AGENTS } from "@/lib/config/agents"
import { ALL_SLUGS, type Range, type RangeKind } from "@/lib/api/dashboard"
import type { AgentSlug } from "@/lib/types"

type Props = {
  range: Range
  agents: AgentSlug[]
  onRangeChange: (range: Range) => void
  onAgentsChange: (agents: AgentSlug[]) => void
}

function formatRangeLabel(range: Range): string {
  if (range.kind !== "custom") return ""
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${fmt(range.from)} – ${fmt(range.to)}`
}

export function DashboardFilters({ range, agents, onRangeChange, onAgentsChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const allSelected = agents.length === ALL_SLUGS.length
  const toggleGroupValue = range.kind === "custom" ? "" : range.kind

  const toggleAgent = (slug: AgentSlug) => {
    onAgentsChange(
      agents.includes(slug) ? agents.filter((a) => a !== slug) : [...agents, slug],
    )
  }

  const toggleAll = () => {
    onAgentsChange(allSelected ? [] : [...ALL_SLUGS])
  }

  const onToggleGroupChange = (value: string) => {
    if (value === "24h" || value === "7d" || value === "30d") {
      onRangeChange({ kind: value as RangeKind })
    }
  }

  const onCustomSelect = (picked: { from?: Date; to?: Date } | undefined) => {
    if (picked?.from && picked.to) {
      onRangeChange({ kind: "custom", from: picked.from, to: picked.to })
      setPickerOpen(false)
    }
  }

  const clearCustom = () => onRangeChange({ kind: "7d" })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[3px] border-[#111] bg-[#FFF9ED] p-3 shadow-[5px_5px_0_#111]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          data-active={allSelected}
          className="rounded-full border-2 border-[#111] px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors data-[active=true]:bg-[#111] data-[active=true]:text-[#EFE7D6] data-[active=false]:bg-white"
        >
          All
        </button>
        {AGENTS.map((a) => {
          const active = agents.includes(a.id)
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAgent(a.id)}
              data-active={active}
              className="rounded-full border-2 border-[#111] px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors data-[active=true]:text-[#111] data-[active=false]:bg-white data-[active=false]:text-[#555]"
              style={active ? { background: a.color } : undefined}
            >
              {a.name}
            </button>
          )
        })}
        <span className="ml-1 text-[10px] font-mono tracking-wider text-[#777]">
          agent filter applies to assistant activity. post counts show all agents.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={toggleGroupValue}
          onValueChange={onToggleGroupChange}
          className="rounded-full border-2 border-[#111] bg-white"
        >
          <ToggleGroupItem value="24h" className="px-3 py-1 text-xs font-mono uppercase">24h</ToggleGroupItem>
          <ToggleGroupItem value="7d" className="px-3 py-1 text-xs font-mono uppercase">7d</ToggleGroupItem>
          <ToggleGroupItem value="30d" className="px-3 py-1 text-xs font-mono uppercase">30d</ToggleGroupItem>
        </ToggleGroup>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <CalendarIcon className="mr-1 size-3.5" />
            {range.kind === "custom" ? formatRangeLabel(range) : "Custom"}
            {range.kind === "custom" && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); clearCustom() }}
                className="ml-2 inline-flex size-4 items-center justify-center rounded-full hover:bg-[#11111111]"
              >
                <X className="size-3" />
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={range.kind === "custom" ? { from: range.from, to: range.to } : undefined}
              onSelect={onCustomSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
```

Adapt prop names on `PopoverTrigger` / `ToggleGroup` / `Calendar` if this project's shadcn uses base-ui's `useRender` (the `PopoverTrigger render={<Button …/>}` pattern here follows the project's convention from [AppSidebar.tsx:156](apps/main/src/components/layout/AppSidebar.tsx) and [DashboardSidebarShell.tsx](apps/main/src/components/layout/DashboardSidebarShell.tsx)). If `ToggleGroup` uses a different props shape, read `apps/main/src/components/ui/toggle-group.tsx` after Task 1 installs it and match its API.

- [ ] **Step 2: Typecheck**

From `apps/main/`:

```bash
npx tsc --noEmit 2>&1 | grep "DashboardFilters" || echo "no errors in DashboardFilters.tsx"
```

Expected: `no errors in DashboardFilters.tsx`. If the shadcn components' prop shapes differ, fix the component to match before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/components/dashboard/DashboardFilters.tsx
git commit -m "feat(dashboard): add DashboardFilters component"
```

---

## Task 9: Create `DashboardProgressBar` + per-section skeleton components

**Files:**
- Create: `apps/main/src/components/dashboard/DashboardProgressBar.tsx`
- Create: `apps/main/src/components/dashboard/MetricCardSkeleton.tsx`
- Create: `apps/main/src/components/dashboard/ActivityChartSkeleton.tsx`
- Create: `apps/main/src/components/dashboard/CrewLeaderboardSkeleton.tsx`
- Create: `apps/main/src/components/dashboard/ContentPipelineSkeleton.tsx`

- [ ] **Step 1: Progress bar**

Write `apps/main/src/components/dashboard/DashboardProgressBar.tsx`:

```tsx
"use client"

export function DashboardProgressBar({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div
      aria-hidden
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        height: 2,
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "40%",
          background: "#111",
          animation: "dashboardProgress 1.1s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes dashboardProgress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: MetricCard skeleton**

Write `apps/main/src/components/dashboard/MetricCardSkeleton.tsx`:

```tsx
"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function MetricCardSkeleton() {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 14,
        boxShadow: "4px 4px 0 #111",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
```

- [ ] **Step 3: ActivityChart skeleton**

Write `apps/main/src/components/dashboard/ActivityChartSkeleton.tsx`:

```tsx
"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ActivityChartSkeleton() {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-[260px] w-full" />
    </div>
  )
}
```

- [ ] **Step 4: CrewLeaderboard skeleton**

Write `apps/main/src/components/dashboard/CrewLeaderboardSkeleton.tsx`:

```tsx
"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function CrewLeaderboardSkeleton() {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-7 w-44" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: ContentPipeline skeleton**

Write `apps/main/src/components/dashboard/ContentPipelineSkeleton.tsx`:

```tsx
"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ContentPipelineSkeleton() {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-48 w-48 self-center rounded-full" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck**

From `apps/main/`:

```bash
npx tsc --noEmit 2>&1 | grep -E "(DashboardProgressBar|MetricCardSkeleton|ActivityChartSkeleton|CrewLeaderboardSkeleton|ContentPipelineSkeleton)" || echo "no errors in new skeleton files"
```

Expected: `no errors in new skeleton files`.

- [ ] **Step 7: Commit**

```bash
git add apps/main/src/components/dashboard/DashboardProgressBar.tsx apps/main/src/components/dashboard/MetricCardSkeleton.tsx apps/main/src/components/dashboard/ActivityChartSkeleton.tsx apps/main/src/components/dashboard/CrewLeaderboardSkeleton.tsx apps/main/src/components/dashboard/ContentPipelineSkeleton.tsx
git commit -m "feat(dashboard): add progress bar and per-section skeleton components"
```

---

## Task 10: Wire filters, progress bar, and skeletons into `dashboard/page.tsx`

**Files:**
- Modify: `apps/main/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add state, update hook call, render filter bar + progress bar + skeletons**

Open `apps/main/src/app/(dashboard)/dashboard/page.tsx`. Make the following changes:

Add to the import block at the top:

```tsx
import { useState } from "react"
import { DashboardFilters } from "@/components/dashboard/DashboardFilters"
import { DashboardProgressBar } from "@/components/dashboard/DashboardProgressBar"
import { MetricCardSkeleton } from "@/components/dashboard/MetricCardSkeleton"
import { ActivityChartSkeleton } from "@/components/dashboard/ActivityChartSkeleton"
import { CrewLeaderboardSkeleton } from "@/components/dashboard/CrewLeaderboardSkeleton"
import { ContentPipelineSkeleton } from "@/components/dashboard/ContentPipelineSkeleton"
import { ALL_SLUGS, type Range } from "@/lib/api/dashboard"
import type { AgentSlug } from "@/lib/types"
```

Replace the two lines

```tsx
const { data: session } = authClient.useSession()
const { data: summary } = useDashboardSummary()
```

with:

```tsx
const { data: session } = authClient.useSession()
const [range, setRange] = useState<Range>({ kind: "7d" })
const [agents, setAgents] = useState<AgentSlug[]>([...ALL_SLUGS])
const { data: summary, isPending, isFetching } = useDashboardSummary({ range, agents })
const showSkeletons = isPending && !summary
const showProgressBar = isFetching && !isPending
```

Right after the `{/* Hero */}` block (before the attention banner), insert:

```tsx
<DashboardProgressBar active={showProgressBar} />
<DashboardFilters
  range={range}
  agents={agents}
  onRangeChange={setRange}
  onAgentsChange={setAgents}
/>
```

Replace the metrics strip block (the `<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>` wrapping the three `<MetricCard>`s) with a conditional:

```tsx
{/* Metrics strip */}
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
  <div style={sectionLabel}>[ at a glance ]</div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 14,
    }}
  >
    {showSkeletons ? (
      <>
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </>
    ) : (
      <>
        <MetricCard
          label="Messages"
          value={metrics ? formatNumber(metrics.messagesWeek) : "—"}
          change={metrics ? formatDelta(metrics.messagesWeek, metrics.messagesPrevWeek) : undefined}
          trend={metrics ? trendFromDelta(metrics.messagesWeek, metrics.messagesPrevWeek) : undefined}
          sparkline={metrics?.messagesSparkline}
        />
        <MetricCard
          label="Posts published"
          value={metrics ? formatNumber(metrics.contentPublishedWeek) : "—"}
          change={
            metrics
              ? formatDelta(metrics.contentPublishedWeek, metrics.contentPublishedPrevWeek)
              : undefined
          }
          trend={
            metrics
              ? trendFromDelta(metrics.contentPublishedWeek, metrics.contentPublishedPrevWeek)
              : undefined
          }
        />
        <MetricCard
          label="Hours saved · est."
          value={metrics ? `${metrics.hoursSavedEstimate}h` : "—"}
          change={metrics && metrics.hoursSavedEstimate > 0 ? "this window" : undefined}
          trend={metrics && metrics.hoursSavedEstimate > 0 ? "up" : "neutral"}
        />
      </>
    )}
  </div>
</div>
```

(The label strings lose their hardcoded "· 7d" suffix because the window is no longer fixed.)

Wrap the `<ActivityChart data={activity} />` line:

```tsx
{showSkeletons ? <ActivityChartSkeleton /> : <ActivityChart data={activity} />}
```

Wrap the `<CrewLeaderboard data={leaderboard} />` line:

```tsx
{showSkeletons ? <CrewLeaderboardSkeleton /> : <CrewLeaderboard data={leaderboard} />}
```

Wrap the `<ContentPipeline data={pipeline} />` line:

```tsx
{showSkeletons ? <ContentPipelineSkeleton /> : <ContentPipeline data={pipeline} />}
```

Leave `<IntegrationHealth />` and `<BrandSnapshot />` as-is (they have their own loading state and are not affected by dashboard filters).

- [ ] **Step 2: Typecheck**

From `apps/main/`:

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page.tsx" || echo "no errors in dashboard/page.tsx"
```

Expected: `no errors in dashboard/page.tsx`.

- [ ] **Step 3: Lint**

From `apps/main/`:

```bash
pnpm lint 2>&1 | grep -E "(DashboardFilters|DashboardProgressBar|dashboard/page)" | grep -i error || echo "no new lint errors in dashboard files"
```

Expected: `no new lint errors in dashboard files`.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): wire filters, progress bar, and skeletons into page"
```

---

## Task 11: Migrate inline `Skeleton()` helpers in `BrandSnapshot` and `StatusRow` to shadcn primitive

**Files:**
- Modify: `apps/main/src/components/dashboard/BrandSnapshot.tsx`
- Modify: `apps/main/src/components/dashboard/StatusRow.tsx`

- [ ] **Step 1: BrandSnapshot — replace the inline `Skeleton` function**

In `apps/main/src/components/dashboard/BrandSnapshot.tsx`:

1. Add to imports:
   ```tsx
   import { Skeleton as UiSkeleton } from "@/components/ui/skeleton"
   ```
2. Delete the locally-defined `function Skeleton() { ... }` (starts around line 49) entirely.
3. At the call site inside the `if (isPending)` branch, replace `<Skeleton />` with an inline set of `<UiSkeleton>` elements that reproduce the current placeholder layout:
   ```tsx
   <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
     <UiSkeleton className="h-6 w-40" />
     <UiSkeleton className="h-4 w-[60%]" />
     <UiSkeleton className="h-10 w-full" />
   </div>
   ```

- [ ] **Step 2: StatusRow — replace the inline placeholder divs**

In `apps/main/src/components/dashboard/StatusRow.tsx`:

1. Add to imports:
   ```tsx
   import { Skeleton } from "@/components/ui/skeleton"
   ```
2. Inside the `if (isPending)` branch, replace the inner `Array.from({ length: 6 })...` placeholder divs with:
   ```tsx
   return (
     <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
       {Array.from({ length: 6 }).map((_, i) => (
         <Skeleton key={i} className="h-[54px] w-[150px] rounded-xl" />
       ))}
     </div>
   )
   ```

- [ ] **Step 3: Typecheck + lint**

From `apps/main/`:

```bash
npx tsc --noEmit 2>&1 | grep -E "(BrandSnapshot|StatusRow)\.tsx" || echo "no errors in migrated files"
pnpm lint 2>&1 | grep -E "(BrandSnapshot|StatusRow)\.tsx" | grep -i error || echo "no new lint errors"
```

Expected: both lines say "no …".

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/dashboard/BrandSnapshot.tsx apps/main/src/components/dashboard/StatusRow.tsx
git commit -m "refactor(dashboard): migrate inline skeletons to shadcn primitive"
```

---

## Task 12: End-to-end smoke test

This is manual verification. No code changes.

- [ ] **Step 1: Start both dev servers**

Terminal A, from repo root:

```bash
cd apps/server && pnpm dev
```

Terminal B, from repo root:

```bash
cd apps/main && pnpm dev
```

- [ ] **Step 2: Initial load**

Open http://localhost:3001/dashboard in a clean browser (private window). Expected:
- While the first request is in flight: metrics strip, activity chart, crew leaderboard, and content pipeline all show gray skeleton placeholders (matched to the shape of each section).
- `IntegrationHealth` and `BrandSnapshot` show their existing placeholders (now rendered through the shadcn `Skeleton`, visually the same).
- Once data arrives, skeletons are replaced with real content.

- [ ] **Step 3: Time-range toggle**

Click the `24h` chip. Expected:
- Top of dashboard shows a thin animated progress bar for ~500ms.
- Data does **not** flash to skeletons — previous data stays visible until new data replaces it.
- Numbers in Messages / Posts / Hours metrics drop to 24-hour values.
- Activity chart re-renders with (up to) 24 hourly buckets instead of daily bars.
- Leaderboard totals shrink accordingly.

Click `30d`. Expected: numbers climb back up, activity chart spans 30 daily buckets.

- [ ] **Step 4: Custom range**

Click the `Custom` button. A two-month calendar popover opens. Pick a start date and an end date ~2 weeks apart. Expected:
- Popover closes on second click.
- The calendar button now shows the formatted range (e.g. "Apr 1 – Apr 15") with an `×` to clear.
- Data reflects exactly that range.
- Toggle-group value clears (none of 24h/7d/30d is highlighted).

Click the `×` on the custom button. Expected: range returns to `7d`, toggle group highlights `7d`, data refetches.

- [ ] **Step 5: Agent filter**

Click the `Maya` chip to deselect her (active state off). Expected:
- Chart's Maya area series disappears.
- Leaderboard drops the Maya row.
- Messages metric decreases (by Maya's contribution).
- Posts metric stays the same (agent filter does not apply to posts — documented constraint).

Click `All` chip when not all are selected → all agents re-select. Click `All` when all are selected → all agents deselect. Expected with zero agents: `messagesWeek = 0`, empty leaderboard, chart shows "no activity yet" empty state. Post metrics still reflect the range.

- [ ] **Step 6: Cache behavior**

Switch `7d → 30d → 7d`. Third click should render instantly from cache (no progress bar). Open DevTools Network: the third click should not produce a new `/dashboard/summary` request within the `staleTime` window (10s).

- [ ] **Step 7: Backend validation**

In DevTools console:

```js
fetch("/api-proxy-or-direct-server-url/dashboard/summary?range=custom", { credentials: "include" })
  .then((r) => r.status)
  .then(console.log)
```

Or directly against the server with the auth cookie. Expected: `400` with a zod error message like "from and to are required when range=custom".

- [ ] **Step 8: Report findings**

Write a two-paragraph summary: what worked, any visual oddities, any backend numbers that looked off. If everything passed, commit an empty completion marker:

```bash
git commit --allow-empty -m "chore: dashboard filters + skeletons smoke test passed"
```

If anything broke, create a follow-up task with the failing repro before calling the plan done.

---

## Self-review against the spec

Coverage check — spec requirements mapped to tasks:

| Spec requirement | Task(s) |
|---|---|
| Install shadcn `toggle-group`, `popover`, `calendar` | 1 |
| `DashboardFilters` component with chips + toggle group + calendar popover | 8 |
| Local `range` and `agents` state in `dashboard/page.tsx` | 10 |
| `useDashboardSummary({ range, agents })` with cache key containing filters | 7 |
| `/dashboard/summary` accepts `range`, `from`, `to`, `agents` query params | 4, 6 |
| zod validation; `range=custom` requires `from` + `to` | 4 (schema), 6 (controller parse), 12 step 7 (verify) |
| Service resolves one `[windowStart, windowEnd]` from input | 5 |
| Service filters messages by `Agent[]`, not posts (schema constraint) | 2, 3, 5 |
| Chart bucketing: daily for 7d/30d/custom, hourly for 24h | 5 (`bucketByHourAndAgent`, `bucketByDayAndAgentWindow`) |
| Leaderboard hides rows for unselected agents | 5 (filter by `selectedSet`) |
| Content pipeline respects range, ignores agents | 3 (window param), 5 (passed in) |
| Attention banner unchanged | 5 (unchanged block) |
| IntegrationHealth + BrandSnapshot unfiltered | 10 (not wrapped) |
| Refetch UX: keep old data + thin progress bar | 7 (`placeholderData`), 9 (`DashboardProgressBar`), 10 (wiring) |
| Per-section skeletons on initial load | 9 (create), 10 (wire) |
| Migrate inline `Skeleton()` in BrandSnapshot / StatusRow to shadcn primitive | 11 |
| URL contract: absent = all, empty = none, subset = comma list | 7 (`buildQuery`), 6 (`agentsParam`) |
| Hint about agent filter not applying to posts | 8 (hint line in component) |

No gaps found.

Placeholder scan: no "TBD", "TODO", or "fill in later" instructions. All code blocks are complete. All command expected-outputs are specified.

Type consistency check:
- `Range` — defined in Task 7, used identically in Task 8 and Task 10.
- `DashboardFilters` (type) — Task 7, used in Task 7 only (hook arg). `DashboardFilters` (component) — Task 8, used in Task 10.
- `AgentSlug` — imported from `@/lib/types` in all frontend tasks (Task 7, 8, 10).
- `ENUM_BY_SLUG` / `agentEnumsFromSlugs` — defined Task 2, consumed Task 5.
- Repository signatures — changed in Task 3, consumed in Task 5. Order of params verified: `(orgId, from, to, agentFilter?)` for message helpers.
- `dashboardQuerySchema` / `DashboardQueryInput` — defined Task 4, consumed Task 5 + 6.

All consistent.
