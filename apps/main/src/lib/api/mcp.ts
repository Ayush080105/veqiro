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
