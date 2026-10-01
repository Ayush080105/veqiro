import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { API_URL, apiFetch } from "@/lib/api/client"

// ── Types (mirror apps/server rex.dashboards.service.ts) ───────────────────

export type WidgetKind = "kpi" | "chart" | "table" | "text"
export type ChartType = "bar" | "line" | "area" | "pie" | "scatter"

export interface ChartYKey {
  key: string
  label?: string
  color?: string
}

export interface WidgetSpec {
  size?: "s" | "m" | "l" | "xl" | null
  chart?: { type?: ChartType; xKey?: string; yKeys?: ChartYKey[]; stacked?: boolean }
  kpi?: {
    valueKey?: string
    format?: "number" | "currency" | "percent"
    prefix?: string
    suffix?: string
    compareKey?: string | null
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

export function useDashboard(id: string | undefined, state: FilterState = {}) {
  return useQuery({
    queryKey: keys.one(id ?? "", state),
    queryFn: () => apiFetch<Dashboard>(`/agents/rex/dashboards/${id}${stateParam(state)}`),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
    // While a refresh runs in the background, check back until it lands.
    refetchInterval: (q) => (q.state.data?.refreshStatus === "running" ? 3000 : false),
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

export const useRefreshDashboard = (id: string) =>
  useDashboardMutation(id, async () =>
    (await apiFetch<{ dashboard: Dashboard }>(`/agents/rex/dashboards/${id}/refresh`, { method: "POST" })).dashboard)

export function useSaveLayout(id: string) {
  return useMutation({
    mutationFn: (items: Array<GridPos & { id: string }>) =>
      apiFetch<void>(`/agents/rex/dashboards/${id}/layout`, { method: "PATCH", body: { items } }),
  })
}

export function useShareDashboard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isPublic: boolean) =>
      apiFetch<{ isPublic: boolean; shareToken: string | null }>(`/agents/rex/dashboards/${id}/share`, {
        method: "PATCH",
        body: { isPublic },
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
