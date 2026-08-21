import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"

export type McpConnectionStatus = "PENDING" | "AUTH_REQUIRED" | "CONNECTED" | "ERROR" | "DISCONNECTED"

export interface McpConnectionSummary {
  slug: string
  connectionId: string
  toolkitSlug: string
  ownerAgent: string
  status: McpConnectionStatus
  lastConnectedAt: string | null
  lastError: string | null
}

export interface McpConfigSchema {
  type?: string
  properties?: Record<string, { type?: string; description?: string; enum?: string[] }>
  required?: string[]
}

export interface McpConnectResult {
  status: "connected" | "auth_required" | "input_required" | "error"
  setupUrl?: string
  message?: string
}

export type McpPendingActionStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXECUTED" | "FAILED"

export interface McpPendingActionSummary {
  id: string
  agent: string
  integrationSlug: string
  toolName: string
  summary: string
  status: McpPendingActionStatus
  resultJson: unknown
  errorMessage: string | null
}

export async function listMcpConnections(): Promise<McpConnectionSummary[]> {
  return apiFetch<McpConnectionSummary[]>("/mcp/connections")
}

export async function getMcpConfigSchema(slug: string): Promise<McpConfigSchema> {
  return apiFetch<McpConfigSchema>(`/mcp/connections/${slug}/config-schema`)
}

export async function connectMcp(slug: string, configValues?: Record<string, unknown>): Promise<McpConnectResult> {
  return apiFetch<McpConnectResult>(`/mcp/connections/${slug}/connect`, {
    method: "POST",
    body: { configValues },
  })
}

export async function getMcpConnectionStatus(slug: string): Promise<McpConnectionSummary> {
  return apiFetch<McpConnectionSummary>(`/mcp/connections/${slug}/status`)
}

export async function disconnectMcp(slug: string): Promise<void> {
  await apiFetch<void>(`/mcp/connections/${slug}`, { method: "DELETE" })
}

/** What a just-connected system can actually see — shown on the connect
 *  success screen. `headline` is absent when the integration has no proof
 *  spec, or the read returned nothing countable. */
export interface McpConnectionProof {
  headline?: string
  toolCount: number
  integrationName: string
}

export async function getMcpConnectionProof(slug: string): Promise<McpConnectionProof> {
  return apiFetch<McpConnectionProof>(`/mcp/connections/${slug}/proof`)
}

export interface CommandCenterSummary {
  /** Staged actions waiting on a human. */
  pendingActionCount: number
  /** Connected integrations. */
  connectedCount: number
  /** Successful provider calls in the last 24h. */
  recentActionCount: number
}

export async function getCommandCenter(): Promise<CommandCenterSummary> {
  return apiFetch<CommandCenterSummary>("/mcp/command-center")
}

/** What the agents actually did across connected systems this period — the
 *  renewal artifact. `hoursSaved` is null while the sample is too small. */
export interface ValueReport {
  periodDays: number
  actions: number
  writes: number
  systemsTouched: number
  breakdown: { slug: string; name: string; actions: number }[]
  hoursSaved: number | null
}

export async function getValueReport(): Promise<ValueReport> {
  return apiFetch<ValueReport>("/mcp/value-report")
}

/** One metric a user can pin to the dashboard from a given integration. */
export interface MetricCandidate {
  toolName: string
  label: string
  noun: string
  argFree: boolean
  important: boolean
}

export type WidgetKind = "metric" | "list"

/** One row of a list widget — a real email, meeting, or search query. */
export interface WidgetRow {
  title: string
  subtitle?: string
  meta?: string
  link?: string
}

export interface McpToolPreference {
  preferredIntegrationSlug: string | null
}

export async function getMcpToolPreference(agent: string): Promise<McpToolPreference> {
  return apiFetch<McpToolPreference>(`/mcp/tool-preference/${agent}`)
}

export async function setMcpToolPreference(agent: string, preferredIntegrationSlug: string | null): Promise<McpToolPreference> {
  return apiFetch<McpToolPreference>(`/mcp/tool-preference/${agent}`, {
    method: "PATCH",
    body: { preferredIntegrationSlug },
  })
}

export async function getMcpPendingAction(id: string): Promise<McpPendingActionSummary> {
  return apiFetch<McpPendingActionSummary>(`/mcp/pending-actions/${id}`)
}

export async function confirmMcpPendingAction(id: string): Promise<McpPendingActionSummary> {
  return apiFetch<McpPendingActionSummary>(`/mcp/pending-actions/${id}/confirm`, { method: "POST" })
}

export async function rejectMcpPendingAction(id: string): Promise<McpPendingActionSummary> {
  return apiFetch<McpPendingActionSummary>(`/mcp/pending-actions/${id}/reject`, { method: "POST" })
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMcpConnections() {
  return useQuery({
    queryKey: qk.mcpConnections(),
    queryFn: () => listMcpConnections(),
    placeholderData: (prev) => prev,
  })
}

/** Fires once, on the connect success screen. No retry: a failed proof read
 *  already degrades server-side to a tool count, and the connection itself is
 *  fine either way — retrying would just delay the modal. */
export function useMcpConnectionProof(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mcpConnectionProof(slug),
    queryFn: () => getMcpConnectionProof(slug),
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
}

/** Backs the dashboard's Command Center. The server caches provider reads for a
 *  minute; this refetches on mount and focus so returning to the tab shows
 *  current data rather than whatever was there when it was opened. */
export function useCommandCenter() {
  return useQuery({
    queryKey: qk.mcpCommandCenter(),
    queryFn: () => getCommandCenter(),
    placeholderData: (prev) => prev,
    // The server serves cached signals instantly and refreshes them in the
    // background, so refetching here buys nothing and costs a provider call
    // per tile. Focus-refetching in particular meant every tab-back could fan
    // out across every connected integration. Explicit refresh still works.
    staleTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useValueReport() {
  return useQuery({
    queryKey: qk.mcpValueReport(),
    queryFn: () => getValueReport(),
    placeholderData: (prev) => prev,
  })
}

export function useMcpConfigSchema(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mcpConfigSchema(slug),
    queryFn: () => getMcpConfigSchema(slug),
    enabled,
  })
}

/** Everything that becomes stale when a connection is added or removed. The
 *  Command Center's connected count and the trigger/play availability flags all
 *  depend on which integrations are live. */
function invalidateConnectionDependents(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: qk.mcpConnections() })
  queryClient.invalidateQueries({ queryKey: qk.mcpCommandCenter() })
  queryClient.invalidateQueries({ queryKey: qk.mcpTriggers() })
  queryClient.invalidateQueries({ queryKey: qk.mcpPlays() })
}

export function useConnectMcp(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (configValues?: Record<string, unknown>) => connectMcp(slug, configValues),
    onSuccess: () => invalidateConnectionDependents(queryClient),
  })
}

export function useMcpConnectionStatus(slug: string, opts: { enabled: boolean }) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: qk.mcpConnectionStatus(slug),
    queryFn: async () => {
      const result = await getMcpConnectionStatus(slug)
      if (result.status === "CONNECTED") {
        invalidateConnectionDependents(queryClient)
      }
      return result
    },
    enabled: opts.enabled,
    refetchInterval: (query) => (query.state.data?.status === "CONNECTED" ? false : 2000),
  })
}

export function useDisconnectMcp(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => disconnectMcp(slug),
    onSuccess: () => invalidateConnectionDependents(queryClient),
  })
}

export function useMcpToolPreference(agent: string) {
  return useQuery({
    queryKey: qk.mcpToolPreference(agent),
    queryFn: () => getMcpToolPreference(agent),
  })
}

export function useSetMcpToolPreference(agent: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferredIntegrationSlug: string | null) => setMcpToolPreference(agent, preferredIntegrationSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.mcpToolPreference(agent) })
    },
  })
}

export function useMcpPendingAction(id: string) {
  return useQuery({
    queryKey: qk.mcpPendingAction(id),
    queryFn: () => getMcpPendingAction(id),
    staleTime: 0,
  })
}

export function useConfirmMcpPendingAction() {
  return useMutation({
    mutationFn: (id: string) => confirmMcpPendingAction(id),
  })
}

export function useRejectMcpPendingAction() {
  return useMutation({
    mutationFn: (id: string) => rejectMcpPendingAction(id),
  })
}

/** One entry in the inbound-trigger catalog, with this org's state on it. */
export interface McpTrigger {
  id: string
  integrationSlug: string
  label: string
  description: string
  agent: string
  /** False when the integration this needs isn't connected yet. */
  available: boolean
  subscribed: boolean
  enabled: boolean
  lastEventAt: string | null
  lastError: string | null
}

export async function listMcpTriggers(): Promise<McpTrigger[]> {
  return apiFetch<McpTrigger[]>("/mcp/triggers")
}

export async function subscribeMcpTrigger(
  id: string,
  config?: Record<string, unknown>
): Promise<McpTrigger> {
  return apiFetch<McpTrigger>(`/mcp/triggers/${id}`, { method: "POST", body: { config } })
}

export async function setMcpTriggerEnabled(id: string, enabled: boolean): Promise<McpTrigger> {
  return apiFetch<McpTrigger>(`/mcp/triggers/${id}`, { method: "PATCH", body: { enabled } })
}

export async function unsubscribeMcpTrigger(id: string): Promise<void> {
  await apiFetch<void>(`/mcp/triggers/${id}`, { method: "DELETE" })
}

/** Backs the "Let agents act on their own" section of Settings -> Integrations. */
export function useMcpTriggers() {
  return useQuery({
    queryKey: qk.mcpTriggers(),
    queryFn: () => listMcpTriggers(),
    placeholderData: (prev) => prev,
  })
}

/** One row of the customer-facing audit log. */
export interface ActionLogEntry {
  id: string
  integration: string
  integrationSlug: string
  agent: string | null
  action: string
  isWrite: boolean
  successful: boolean
  durationMs: number | null
  at: string
}

export interface ActionLogPage {
  entries: ActionLogEntry[]
  nextCursor: string | null
  integrations: { slug: string; name: string; count: number }[]
}

export interface ActionLogFilters {
  integrationSlug?: string
  agent?: string
  writesOnly?: boolean
  failuresOnly?: boolean
  before?: string
  limit?: number
}

export async function getActionLog(filters: ActionLogFilters = {}): Promise<ActionLogPage> {
  const params = new URLSearchParams()
  if (filters.integrationSlug) params.set("integrationSlug", filters.integrationSlug)
  if (filters.agent) params.set("agent", filters.agent)
  if (filters.writesOnly) params.set("writesOnly", "true")
  if (filters.failuresOnly) params.set("failuresOnly", "true")
  if (filters.before) params.set("before", filters.before)
  if (filters.limit) params.set("limit", String(filters.limit))
  const qs = params.toString()
  return apiFetch<ActionLogPage>(`/mcp/action-log${qs ? `?${qs}` : ""}`)
}

/** Backs the audit log on Settings -> Usage. */
export function useActionLog(filters: ActionLogFilters = {}) {
  return useQuery({
    queryKey: qk.mcpActionLog(JSON.stringify(filters)),
    queryFn: () => getActionLog(filters),
    placeholderData: (prev) => prev,
  })
}

export type McpApprovalMode = "ALWAYS_ASK" | "AUTO_RUN" | "NEVER"

export interface McpApprovalPolicy {
  id: string
  /** "*" means every integration. */
  integrationSlug: string
  /** "*" means every tool. */
  toolName: string
  mode: McpApprovalMode
  createdAt: string
}

export async function listApprovalPolicies(): Promise<McpApprovalPolicy[]> {
  return apiFetch<McpApprovalPolicy[]>("/mcp/approval-policies")
}

export async function setApprovalPolicy(input: {
  integrationSlug?: string
  toolName?: string
  mode: McpApprovalMode
}): Promise<McpApprovalPolicy> {
  return apiFetch<McpApprovalPolicy>("/mcp/approval-policies", { method: "POST", body: input })
}

export async function deleteApprovalPolicy(id: string): Promise<void> {
  await apiFetch<void>(`/mcp/approval-policies/${id}`, { method: "DELETE" })
}

export function useApprovalPolicies() {
  return useQuery({
    queryKey: qk.mcpApprovalPolicies(),
    queryFn: () => listApprovalPolicies(),
    placeholderData: (prev) => prev,
  })
}

/** A scheduled, repeatable job — "Monday briefing". */
export interface McpPlay {
  id: string
  name: string
  description: string
  agent: string
  scheduleLabel: string
  requires: string[]
  /** Required integrations not yet connected. */
  missing: string[]
  available: boolean
  enabled: boolean
  lastRunAt: string | null
  lastError: string | null
}

export async function listPlays(): Promise<McpPlay[]> {
  return apiFetch<McpPlay[]>("/mcp/plays")
}

export async function setPlayEnabled(id: string, enabled: boolean): Promise<McpPlay> {
  return apiFetch<McpPlay>(`/mcp/plays/${id}`, { method: "PATCH", body: { enabled } })
}

export async function runPlayNow(id: string): Promise<{ messageId: string }> {
  return apiFetch<{ messageId: string }>(`/mcp/plays/${id}/run`, { method: "POST" })
}

export function usePlays() {
  return useQuery({
    queryKey: qk.mcpPlays(),
    queryFn: () => listPlays(),
    placeholderData: (prev) => prev,
  })
}
