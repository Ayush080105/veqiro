# Dashboard Filters and Skeleton Loading — Design

## Context

The dashboard at [dashboard/page.tsx](apps/main/src/app/(dashboard)/dashboard/page.tsx) renders eight sections pulled from `GET /dashboard/summary`. Time windows are hardcoded server-side (7d for metrics, 14d for the activity chart, 30d elsewhere), and there is no way to narrow the view to a subset of agents. Loading states are ad-hoc: only `BrandSnapshot` and `StatusRow` show placeholders, via inline `Skeleton()` functions defined locally in those files — most sections pop in blank.

Goal: let the user (a) change the time window via a toggle group (24h / 7d / 30d) or a custom date range, (b) narrow the view to any subset of the six agents, and (c) see a coherent loading experience while the dashboard fetches. Filters flow end-to-end — the server recomputes aggregates from the selected window and agent set, so the numbers actually change.

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Scope | Frontend **and** backend, fully functional |
| Custom range granularity | Date-only (start-of-`from`-day → end-of-`to`-day) |
| Agent selector | Multi-select chips, default = all selected |
| Filter bar location | New strip between the greeting hero and the metrics strip inside `dashboard/page.tsx` |
| Refetch UX | Keep previous data, show a thin progress bar at the top of the dashboard content |
| Shared types | Ad-hoc — frontend keeps its `Range` type in `lib/api/dashboard.ts`; backend defines a zod schema in its dashboard module. Aligned by convention. |
| Initial range default | `7d` |
| Initial agent default | All six agents selected |

## Components

### New shadcn primitives to install

Run from `apps/main/`:

```bash
pnpm dlx shadcn@latest add toggle-group popover calendar
```

Each adds a file under `apps/main/src/components/ui/`. `skeleton` is already installed — use the shadcn primitive directly instead of the ad-hoc inline `Skeleton()` functions.

### `DashboardFilters` — new component

**File:** `apps/main/src/components/dashboard/DashboardFilters.tsx` (new, client component)

Responsibilities:
- Render the agent chip row (All + 6 agents) and the range control (toggle group + calendar popover button).
- Accept controlled props `{ range, agents, onRangeChange, onAgentsChange }`. No internal state beyond popover open/close.
- "All" chip toggles every agent on/off. Individual chip toggles one. Chip style uses shadcn `Badge` + `Button` variants, active state matches the existing veqiro styling (see [AppSidebar.tsx](apps/main/src/components/layout/AppSidebar.tsx) for the current pill treatment).
- Toggle group uses shadcn `ToggleGroup` with three items: `24h`, `7d`, `30d`.
- Calendar button opens a `Popover` with a `Calendar` in range-selection mode. Applying a range sets `range.kind = "custom"` and clears the toggle group selection. Clearing the custom range (via an "X" on the button) reverts to the last active preset (or `7d` if none).

### `DashboardProgressBar` — new tiny component

**File:** `apps/main/src/components/dashboard/DashboardProgressBar.tsx` (new)

A thin animated bar rendered at the top of the dashboard content when `useDashboardSummary().isFetching && !useDashboardSummary().isPending` (refetch with cached data). Pure presentational — 2px tall, accent color, looped CSS translate animation. No shadcn dependency.

### Per-section skeleton components

Colocated with each parent in `apps/main/src/components/dashboard/`:

- `MetricCardSkeleton.tsx` — matches the `MetricCard` layout (value, trend, sparkline).
- `ActivityChartSkeleton.tsx` — card frame + a gray chart placeholder at the same height as the real chart.
- `CrewLeaderboardSkeleton.tsx` — 6 row placeholders with avatar + label + bar.
- `ContentPipelineSkeleton.tsx` — 2-column placeholder matching the donut + bars layout.

Each is a plain function that renders shadcn `<Skeleton>` blocks at the right dimensions. Replace the inline `Skeleton()` in `BrandSnapshot.tsx` and `StatusRow.tsx` with the same shadcn primitive for consistency (a small targeted cleanup; do not rewrite the components otherwise).

### Updated `useDashboardSummary` hook

**File:** `apps/main/src/lib/api/dashboard.ts` (modify)

- Export a new type:

  ```ts
  export type Range =
    | { kind: "24h" | "7d" | "30d" }
    | { kind: "custom"; from: Date; to: Date }
  ```

- `useDashboardSummary` takes `{ range, agents }` and includes them in the React Query key so each combination caches independently.
- Serializes `range` and `agents` into the `/dashboard/summary` URL: `?range=7d&agents=maya,rex` (or `?range=custom&from=2026-04-01&to=2026-04-15&agents=...`).
- The fetcher continues to fall back to the existing empty-mock on error.

### `dashboard/page.tsx` — modify

Introduce local state for `range` and `agents`, pass into `useDashboardSummary`, render `<DashboardFilters>` above the metrics strip, render `<DashboardProgressBar>` at the very top of the dashboard content, and route each filterable section through its new skeleton when `isPending && !summary`.

## Backend — `GET /dashboard/summary`

### Query params

Parsed and validated with zod at the controller boundary:

```ts
const QuerySchema = z.object({
  range: z.enum(["24h", "7d", "30d", "custom"]).default("7d"),
  from: z.string().date().optional(),  // required if range=custom
  to: z.string().date().optional(),    // required if range=custom
  agents: z.string().optional(),       // comma-separated ids; absent = all
}).refine(
  (v) => v.range !== "custom" || (v.from && v.to),
  { message: "from and to are required when range=custom" }
)
```

### Service changes

**File:** `apps/server/src/modules/dashboard/dashboard.service.ts` (modify)

- Accept `{ range, from, to, agentIds }` alongside `organizationId`.
- Resolve a single `[windowStart, windowEnd]` pair:
  - `24h` → now − 24h to now
  - `7d` → start-of-day 7 days ago to now
  - `30d` → start-of-day 30 days ago to now
  - `custom` → start-of-day(from) to end-of-day(to)
- Replace the current hardcoded 7d/14d/30d windows with the resolved pair.
- Add `agent: { in: <enum values> }` to the Prisma `where` clauses on the `Message` model when `agentIds` is a non-empty subset of the six. Absent or full-set = no agent filter. The agent-filter does **not** touch `PublishedPost` queries (no schema attribution).
- Chart bucketing: switch from "always 14 daily buckets" to a window-aware bucketing — daily buckets for 7d/30d/custom, hourly buckets for 24h (returns 24 hourly buckets with `date` as an ISO timestamp). Same shape (`{ date, [agentSlug]: count }[]`) so the frontend chart doesn't change structurally — only the `date` axis formatter adapts.
- Leaderboard: aggregate only within `windowStart..windowEnd` and only for agents in `agentIds`. Agents not in the filter disappear from the leaderboard entirely.
- Content pipeline: apply the range filter (`createdAt BETWEEN windowStart AND windowEnd`) to the `by-platform` and `by-status` groupBy queries. Currently these queries have **no** time window at all — this change both adds range support and tightens the existing all-time counts to the selected window. Agent filter does not apply.
- Content-published metrics (`contentPublishedWeek`, `contentPublishedPrevWeek`): use the selected range as the "current" window and a same-length window immediately preceding it as the "previous" window for the delta. Agent filter does not apply.
- Attention banner: remains computed as today (no range or agent filter).
- `IntegrationHealth` and `BrandSnapshot` are served by separate endpoints (`useIntegrations()` and `useBrandKit()`, not `/dashboard/summary`) and are not touched by this change.

### Controller

**File:** `apps/server/src/modules/dashboard/dashboard.controller.ts` (modify)

Parses query with `QuerySchema`, splits `agents` on `,`, passes the parsed values to the service.

## Affected sections

| Section | Time range | Agent filter |
|---|---|---|
| Metrics · messages / tokens / hours saved | ✓ | ✓ |
| Metrics · content published (post count) | ✓ | — (posts have no agent attribution in schema) |
| ActivityChart (message-driven) | ✓ | ✓ (hides filtered series) |
| CrewLeaderboard (message-driven) | ✓ | ✓ (hides rows) |
| ContentPipeline (post-driven) | ✓ | — (same schema constraint as above) |
| Attention banner | — | — (failed-posts + expiring-token, neither is agent-scoped) |
| IntegrationHealth | — | — |
| BrandSnapshot | — | — |

**Schema constraint:** The `PublishedPost` model in `apps/server/prisma/schema.prisma` has no `agent` / `agentId` field. Adding one is out of scope for this spec (requires a migration and a change to how posts are recorded). Any post-driven data therefore stays agent-agnostic; the agent filter only narrows message-driven data. This is surfaced to the user through a small hint next to the agent chip row: "*Agent filter applies to assistant activity. Post counts show all agents.*"

## Loading states

- **Initial load** (`isPending` and no cached data): full section skeletons in place of each filterable section. `IntegrationHealth` and `BrandSnapshot` continue to use their existing placeholders, but those placeholders are rewritten to use the shadcn `Skeleton` primitive (no other change to those components).
- **Refetch with cached data** (`isFetching && !isPending`): data stays on screen. `<DashboardProgressBar>` shows at the top of the dashboard content until the refetch resolves. No skeleton flash.

## Critical files

**Create:**
- `apps/main/src/components/dashboard/DashboardFilters.tsx`
- `apps/main/src/components/dashboard/DashboardProgressBar.tsx`
- `apps/main/src/components/dashboard/MetricCardSkeleton.tsx`
- `apps/main/src/components/dashboard/ActivityChartSkeleton.tsx`
- `apps/main/src/components/dashboard/CrewLeaderboardSkeleton.tsx`
- `apps/main/src/components/dashboard/ContentPipelineSkeleton.tsx`
- `apps/main/src/components/ui/toggle-group.tsx` (via shadcn CLI)
- `apps/main/src/components/ui/popover.tsx` (via shadcn CLI)
- `apps/main/src/components/ui/calendar.tsx` (via shadcn CLI)

**Modify:**
- `apps/main/src/app/(dashboard)/dashboard/page.tsx` — filter state + filter bar + progress bar + skeleton routing
- `apps/main/src/lib/api/dashboard.ts` — `Range` type, hook signature, URL serialization, query key
- `apps/main/src/components/dashboard/BrandSnapshot.tsx` — swap inline `Skeleton()` for shadcn primitive
- `apps/main/src/components/dashboard/StatusRow.tsx` — same swap
- `apps/server/src/modules/dashboard/dashboard.controller.ts` — parse query params
- `apps/server/src/modules/dashboard/dashboard.service.ts` — accept filters, use window + agent filters in Prisma queries, rework chart bucketing

**Read-only reference:**
- `apps/main/src/lib/config/agents.ts` — canonical agent list for the chip row
- `apps/main/AGENTS.md` — Next.js 16 disclaimer; read relevant docs in `node_modules/.pnpm/next@16.2.1_*/node_modules/next/dist/docs/` before writing code that uses `use client`, `usePathname`, etc.

## Verification

1. **Typecheck + lint pass clean** for all new and modified files: `pnpm tsc --noEmit` and `pnpm lint` from `apps/main/`; corresponding scripts for `apps/server/`.
2. **Initial load**: hard-refresh `/dashboard`. Every filterable section shows a skeleton, then the real data arrives.
3. **Range toggle**: click `24h` → metrics + chart + leaderboard + pipeline refetch and show narrower numbers. Progress bar appears briefly; data doesn't flash to skeleton. `30d` → wider numbers.
4. **Custom range**: open the calendar, pick a two-week range in the past. Data reflects that range exactly.
5. **Agent filter**: deselect Maya and Rex. Chart hides their series, leaderboard drops those rows, metrics drop their contributions. Re-select "All" — everything returns.
6. **Empty selection**: deselect every agent. Treat this as "no agents" (show empty-state, not "all agents") — the server returns zeros rather than interpreting absent = all. URL contract: `agents` param absent → treat as all agents. `agents=` (present but empty string) → treat as empty set. The frontend always sends the param explicitly; it only omits `agents` when every agent is selected, to keep URLs short and cache-friendly.
7. **URL roundtrip**: React Query cache key includes filters; switching between `7d → 30d → 7d` uses cached data on the third click (no refetch if fresh).
8. **Unaffected sections**: `IntegrationHealth` and `BrandSnapshot` never change when filters change.
9. **Back-end validation**: `GET /dashboard/summary?range=custom` without `from`/`to` returns a 400 with a zod error message.

## Out of scope

- Persisting filters in the URL (query string) for shareable links — keep as local state for now.
- Comparison mode ("this week vs last week") — current metrics already show previous-period deltas; a true side-by-side compare is a separate feature.
- Exporting filtered data (CSV/PDF).
- Per-section filter overrides (e.g., "chart range differs from metrics range").
- Moving IntegrationHealth / BrandSnapshot into the filterable set — they represent current state, so filters are out of scope for them.
- Timezone handling beyond "use the server's timezone" — revisit if org-level TZ becomes a real feature.
