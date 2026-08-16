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

export function useMcpConfigSchema(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mcpConfigSchema(slug),
    queryFn: () => getMcpConfigSchema(slug),
    enabled,
  })
}

export function useConnectMcp(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (configValues?: Record<string, unknown>) => connectMcp(slug, configValues),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.mcpConnections() })
    },
  })
}

export function useMcpConnectionStatus(slug: string, opts: { enabled: boolean }) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: qk.mcpConnectionStatus(slug),
    queryFn: async () => {
      const result = await getMcpConnectionStatus(slug)
      if (result.status === "CONNECTED") {
        queryClient.invalidateQueries({ queryKey: qk.mcpConnections() })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.mcpConnections() })
    },
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
