import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import type { AgentSlug } from "@/lib/types"
import type { SocialAccount } from "@/lib/api/integrations"
import type { McpConnectionSummary } from "@/lib/api/mcp"
import { qk } from "@/lib/query-keys"

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
}

export type DashboardIntegrationHealth = {
  accounts: SocialAccount[]
  mcpConnections: McpConnectionSummary[]
}

export type RangeKind = "24h" | "7d" | "30d"
export type Range =
  | { kind: RangeKind }
  | { kind: "custom"; from: Date; to: Date }

export type DashboardFilters = {
  range: Range
  // `agents` is the list of slugs explicitly selected. An empty array means
  // "no agents selected" - zero data. `undefined` / all-six-selected both
  // mean "no agent filter".
  agents: AgentSlug[]
}

const ALL_SLUGS: AgentSlug[] = ["maya", "rex", "scout", "sage", "lex", "vega"]

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
  return await apiFetch<DashboardSummary>(`/dashboard/summary?${buildQuery(filters)}`)
}

export function useDashboardSummary(filters: DashboardFilters) {
  return useQuery({
    queryKey: cacheKey(filters),
    queryFn: () => getDashboardSummary(filters),
    staleTime: 10_000,
    placeholderData: (prev) => prev, // keep previous data on filter change
  })
}

export function useDashboardIntegrationHealth() {
  return useQuery({
    queryKey: qk.dashboardIntegrationHealth(),
    queryFn: () => apiFetch<DashboardIntegrationHealth>("/dashboard/integration-health"),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

export { ALL_SLUGS }
