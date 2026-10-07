import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api/client"

// ── Types (mirror apps/server hubspot.connections.service.ts) ───────────────

export interface ObjectSelection {
  extra: string[]
  includePii: string[]
}

export interface ConnectionDataset {
  id: string
  object: string
  name: string
  enabled: boolean
  rowCount: number | null
  lastSyncedAt: string | null
  syncError: string | null
  syncNote: string | null
  syncing: boolean
  selection: ObjectSelection
}

export type ConnectionStatus = "active" | "auth_error" | "paused"

export interface Connection {
  id: string
  provider: string
  authType: "token" | "oauth"
  accountLabel: string | null
  status: ConnectionStatus
  lastError: string | null
  createdAt: string
  access: Array<{ type: string; ok: boolean; missingScope?: string }>
  datasets: ConnectionDataset[]
}

export interface ConnectionsResponse {
  oauthAvailable: boolean
  encryptionConfigured: boolean
  connections: Connection[]
}

export interface VerifyObject {
  type: string
  label: string
  tier: 1 | 2 | 3
  ok: boolean
  count: number | null
  missingScope?: string
  message?: string
}

export interface VerifyReport {
  account: string | null
  objects: VerifyObject[]
}

export interface FieldView {
  property: string
  column: string
  label: string
  group: string | null
  kind: "numeric" | "date" | "categorical" | "text"
  pii: boolean
  source: "recommended" | "custom" | "other"
  selected: boolean
}

export interface FieldsResponse {
  object: { type: string; label: string }
  recommended: FieldView[]
  custom: FieldView[]
  other: FieldView[]
  cap: number
  selection: ObjectSelection
}

export interface SyncResult {
  results: Array<{ datasetId: string; object: string; status: string; message?: string }>
}

const keys = {
  all: () => ["rex", "connections"] as const,
  fields: (id: string, type: string) => ["rex", "connections", id, "fields", type] as const,
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useConnections(opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: keys.all(),
    queryFn: () => apiFetch<ConnectionsResponse>("/agents/rex/connections"),
    // Keep checking while anything is syncing so progress and "last synced" stay true.
    refetchInterval: (q) =>
      opts.poll || q.state.data?.connections.some((c) => c.datasets.some((d) => d.syncing)) ? 2500 : false,
  })
}

export function useFields(connectionId: string | undefined, type: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.fields(connectionId ?? "", type ?? ""),
    queryFn: () => apiFetch<FieldsResponse>(`/agents/rex/connections/${connectionId}/objects/${encodeURIComponent(type!)}/fields`),
    enabled: Boolean(connectionId && type && enabled),
    staleTime: 5 * 60_000,
  })
}

// ── Mutations ───────────────────────────────────────────────────────────────

function useConnectionsMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all() })
      void qc.invalidateQueries({ queryKey: ["rex", "datasets"] })
    },
  })
}

export const useConnectToken = () =>
  useConnectionsMutation((token: string) =>
    apiFetch<{ connectionId: string; verify: VerifyReport }>("/agents/rex/connections/hubspot/token", { method: "POST", body: { token } }))

export const useStartOAuth = () =>
  useMutation({
    mutationFn: (returnTo: string) =>
      apiFetch<{ url: string }>("/agents/rex/connections/hubspot/oauth/start", { method: "POST", body: { returnTo } }),
  })

export const useVerify = () =>
  useConnectionsMutation((id: string) => apiFetch<VerifyReport>(`/agents/rex/connections/${id}/verify`))

export const useSaveSelection = () =>
  useConnectionsMutation((v: { connectionId: string; objects: Array<{ type: string } & ObjectSelection> }) =>
    apiFetch<{ datasets: Array<{ id: string; sourceObject: string }> }>(`/agents/rex/connections/${v.connectionId}/selection`, {
      method: "PUT",
      body: { objects: v.objects },
    }))

export const useSyncConnection = () =>
  useConnectionsMutation((v: { connectionId: string; mode?: "auto" | "incremental" | "full"; wait?: boolean }) =>
    apiFetch<SyncResult>(`/agents/rex/connections/${v.connectionId}/sync`, {
      method: "POST",
      body: { mode: v.mode ?? "auto", wait: v.wait ?? false },
    }))

export const useDisconnect = () =>
  useConnectionsMutation((v: { connectionId: string; mode: "keep" | "delete" }) =>
    apiFetch<void>(`/agents/rex/connections/${v.connectionId}?mode=${v.mode}`, { method: "DELETE" }))

// ── Coming back from HubSpot's consent screen ───────────────────────────────

export interface HubspotReturn {
  status: "connected" | "error"
  connectionId?: string
  reason?: string
}

/** Reads (once) and removes the `?hubspot=` flags the server adds when sending the browser back. */
export function useHubspotReturn(): HubspotReturn | null {
  const [value, setValue] = React.useState<HubspotReturn | null>(null)
  React.useEffect(() => {
    const url = new URL(window.location.href)
    const status = url.searchParams.get("hubspot")
    if (status !== "connected" && status !== "error") return
    setValue({
      status,
      connectionId: url.searchParams.get("connection") ?? undefined,
      reason: url.searchParams.get("reason") ?? undefined,
    })
    for (const k of ["hubspot", "connection", "reason"]) url.searchParams.delete(k)
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }, [])
  return value
}

export const HUBSPOT_ERROR_COPY: Record<string, string> = {
  denied: "HubSpot wasn't given permission, so nothing was connected.",
  state: "That connection link expired. Start again from Connect HubSpot.",
  exchange: "HubSpot didn't accept the connection. Try again, or use a Service Key.",
}

/** Where the dashboards list lives; used to open a dashboard right after building it. */
export const dashboardsPath = "/workspace/rex/work/dashboards"
