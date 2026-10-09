import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { API_URL, apiFetch } from "@/lib/api/client"

// ── Types (mirror apps/server rex.dashboards.service.ts) ───────────────────

export type WidgetKind = "kpi" | "chart" | "table" | "text"
export type ChartType =
  | "bar" | "line" | "area" | "pie" | "scatter"
  | "combo" | "waterfall" | "funnel" | "heatmap" | "treemap" | "progress" | "ranked"

export interface ChartYKey {
  key: string
  label?: string
  /** A palette slot ("s1".."s8"), or a hex saved by older dashboards. */
  color?: string
  /** combo only: how this series is drawn. */
  as?: "bar" | "line"
  /** A comparison series (last year, plan): drawn quietly behind the main one. */
  ghost?: boolean
}

export interface ChartSpec {
  type?: ChartType
  xKey?: string
  yKeys?: ChartYKey[]
  stacked?: boolean
  /** Stacked bars as shares of 100%. */
  normalize?: boolean
  /** heatmap: the second dimension (rows). */
  groupKey?: string | null
  /** progress: the goal column. */
  targetKey?: string | null
  /** waterfall: the first row is an opening balance, not a change. */
  baseFirst?: boolean
  reference?: "average" | null
}

export interface WidgetSpec {
  size?: "s" | "m" | "l" | "xl" | null
  chart?: ChartSpec
  kpi?: {
    valueKey?: string
    format?: "number" | "currency" | "percent"
    prefix?: string
    suffix?: string
    compareKey?: string | null
    /** Trend KPI: the query returns one row per period; the last row is the value. */
    periodKey?: string | null
    goodDirection?: "up" | "down"
  }
  text?: string
}

export interface GridPos {
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardWidget {
  id: string
  kind: WidgetKind
  title: string
  sql?: string | null
  spec: WidgetSpec
  layout: GridPos
  filterIds: string[]
}

export interface DashboardFilter {
  id: string
  label: string
  type: "category" | "date_range"
  options?: string[] | null
  table?: string
  column?: string
}

export interface WidgetResult {
  columns: string[]
  rows: Record<string, unknown>[]
  error?: string | null
}

export type FilterState = Record<string, string>

export interface DashboardSource {
  id: string
  name: string
  sourceKind: string
  sourceUrl: string | null
  lastSyncedAt: string | null
  syncError: string | null
  updatedAt: string
  rowCount?: number | null
  syncNote?: string | null
  connectionId?: string | null
  containsPii?: boolean
}

export interface Dashboard {
  id: string
  title: string
  description: string | null
  prompt: string | null
  datasetIds: string[]
  filters: DashboardFilter[]
  widgets: DashboardWidget[]
  results: Record<string, WidgetResult>
  isPublic: boolean
  shareToken: string | null
  refreshStatus: "idle" | "running" | "error"
  refreshError: string | null
  lastRefreshedAt: string | null
  sources: DashboardSource[]
  /** True when a dataset it reads includes personal data from HubSpot. */
  containsPii?: boolean
  updatedAt: string
  /** Widgets the model proposed but whose query never ran — only on create/edit responses. */
  dropped?: Array<{ title: string; error: string }>
}

export interface DashboardSummary {
  id: string
  title: string
  description: string | null
  datasetIds: string[]
  isPublic: boolean
  shareToken: string | null
  lastRefreshedAt: string | null
  refreshStatus: string
  updatedAt: string
  _count: { widgets: number }
}

export interface PublicDashboard {
  title: string
  description: string | null
  filters: DashboardFilter[]
  widgets: DashboardWidget[]
  results: Record<string, WidgetResult>
  lastRefreshedAt: string | null
  /** True when the data comes from a live source, so the page keeps itself fresh. */
  live?: boolean
}

export const DATE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "last_12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
]

const stateParam = (state: FilterState) => {
  const entries = Object.entries(state).filter(([, v]) => v)
  return entries.length ? `?f=${encodeURIComponent(JSON.stringify(Object.fromEntries(entries)))}` : ""
}

const keys = {
  list: () => ["rex", "dashboards"] as const,
  one: (id: string, state: FilterState) => ["rex", "dashboard", id, state] as const,
  oneAll: (id: string) => ["rex", "dashboard", id] as const,
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useDashboards() {
  return useQuery({
    queryKey: keys.list(),
    queryFn: () => apiFetch<DashboardSummary[]>("/agents/rex/dashboards"),
  })
}

export const isLiveSource = (s: DashboardSource) => s.sourceKind === "hubspot"

/** How often a dashboard backed by a live source re-reads itself while its tab is visible. */
const LIVE_POLL_MS = 30_000

export function useDashboard(id: string | undefined, state: FilterState = {}, opts: { fast?: boolean } = {}) {
  return useQuery({
    queryKey: keys.one(id ?? "", state),
    queryFn: () => apiFetch<Dashboard>(`/agents/rex/dashboards/${id}${stateParam(state)}`),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
    // While a refresh runs in the background, check back until it lands. A dashboard on a live
    // source also re-reads itself, which is what starts and then shows the next sync.
    refetchInterval: (q) => {
      const d = q.state.data
      if (d?.refreshStatus === "running" || opts.fast) return 3000
      return d?.sources.some(isLiveSource) ? LIVE_POLL_MS : false
    },
  })
}

/** Every mutation answers with the whole dashboard; write it into the unfiltered cache entry. */
function useDashboardMutation<V>(id: string, fn: (vars: V) => Promise<Dashboard>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(keys.one(id, {}), data)
      void qc.invalidateQueries({ queryKey: keys.oneAll(id), predicate: (q) => JSON.stringify(q.queryKey[3]) !== "{}" })
      void qc.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { prompt: string; datasetIds: string[] }) =>
      apiFetch<Dashboard>("/agents/rex/dashboards", { method: "POST", body }),
    onSuccess: (data) => {
      qc.setQueryData(keys.one(data.id, {}), data)
      void qc.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

export const usePromptEdit = (id: string) =>
  useDashboardMutation(id, (body: { prompt: string; widgetId?: string }) =>
    apiFetch<Dashboard>(`/agents/rex/dashboards/${id}/prompt`, { method: "POST", body }))

export const useUpdateDashboard = (id: string) =>
  useDashboardMutation(id, (body: { title?: string; description?: string | null }) =>
    apiFetch<Dashboard>(`/agents/rex/dashboards/${id}`, { method: "PATCH", body }))

export const useUpdateWidget = (id: string) =>
  useDashboardMutation(id, ({ widgetId, ...body }: { widgetId: string; title?: string; spec?: WidgetSpec; sql?: string; filterIds?: string[] }) =>
    apiFetch<Dashboard>(`/agents/rex/dashboards/${id}/widgets/${widgetId}`, { method: "PATCH", body }))

export const useDeleteWidget = (id: string) =>
  useDashboardMutation(id, (widgetId: string) =>
    apiFetch<Dashboard>(`/agents/rex/dashboards/${id}/widgets/${widgetId}`, { method: "DELETE" }))

export const useDuplicateWidget = (id: string) =>
  useDashboardMutation(id, (widgetId: string) =>
    apiFetch<Dashboard>(`/agents/rex/dashboards/${id}/widgets/${widgetId}/duplicate`, { method: "POST" }))

export interface RefreshOutcome {
  dashboard: Dashboard
  sync?: Array<{ datasetId: string; status: string; message?: string }>
}

/** Brings live sources up to date first, then recomputes. `full` re-reads everything from the source. */
export function useRefreshDashboard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts: { full?: boolean } = {}) =>
      apiFetch<RefreshOutcome>(`/agents/rex/dashboards/${id}/refresh`, { method: "POST", body: { full: opts.full ?? false } }),
    onSuccess: (out) => {
      qc.setQueryData(keys.one(id, {}), out.dashboard)
      void qc.invalidateQueries({ queryKey: keys.oneAll(id), predicate: (q) => JSON.stringify(q.queryKey[3]) !== "{}" })
      void qc.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

export function useSaveLayout(id: string) {
  return useMutation({
    mutationFn: (items: Array<GridPos & { id: string }>) =>
      apiFetch<void>(`/agents/rex/dashboards/${id}/layout`, { method: "PATCH", body: { items } }),
  })
}

export function useShareDashboard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { isPublic: boolean; confirmPii?: boolean }) =>
      apiFetch<{ isPublic: boolean; shareToken: string | null }>(`/agents/rex/dashboards/${id}/share`, {
        method: "PATCH",
        body: v,
      }),
    onSuccess: (share) => {
      qc.setQueriesData<Dashboard>({ queryKey: keys.oneAll(id) }, (d) => (d ? { ...d, ...share } : d))
      void qc.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/agents/rex/dashboards/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list() }),
  })
}

// ── Linked spreadsheets ─────────────────────────────────────────────────────

export interface LinkSource {
  sourceUrl: string
  downloadUrl: string
  contentHash: string
  provider: string
}

export const parseSpreadsheetLink = <T,>(url: string) =>
  apiFetch<T & { source: LinkSource }>("/agents/rex/datasets/link/parse", { method: "POST", body: { url } })

export const syncSpreadsheetLink = (sourceUrl: string) =>
  apiFetch<{ changed: boolean; error?: string }>("/agents/rex/datasets/link/sync", {
    method: "POST",
    body: { sourceUrl },
  })

// ── Public (no session) ─────────────────────────────────────────────────────

export async function fetchPublicDashboard(token: string, state: FilterState = {}): Promise<PublicDashboard | null> {
  const res = await fetch(`${API_URL}/agents/rex/dashboards/public/${encodeURIComponent(token)}${stateParam(state)}`, {
    cache: "no-store",
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null
    throw new Error(body?.message ?? body?.error ?? "Couldn't load this dashboard")
  }
  return (await res.json()) as PublicDashboard
}

export function publicDashboardUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin
  return `${origin}/share/rex/dashboard/${token}`
}
