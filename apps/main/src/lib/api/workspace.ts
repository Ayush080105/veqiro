import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "./client"
import { qk } from "@/lib/query-keys"

/** Mirrors the server's WorkObjectStatus. */
export type WorkObjectStatus =
  | "DRAFT"
  | "ACTIVE"
  | "NEEDS_REVIEW"
  | "BLOCKED"
  | "DONE"
  | "ARCHIVED"

export type InsightSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type InsightStatus = "OPEN" | "ACKNOWLEDGED" | "ACTED" | "DISMISSED" | "EXPIRED"

export interface WorkObject {
  id: string
  kind: string
  sourceId: string
  title: string
  status: WorkObjectStatus
  dueAt: string | null
  ownerUserId: string | null
  preview: Record<string, unknown> | null
  updatedAt: string
}

export interface Insight {
  id: string
  agent: string
  kind: string
  title: string
  body: string
  severity: InsightSeverity
  status: InsightStatus
  suggestedActionId: string | null
  suggestedArgs: Record<string, unknown> | null
  objectKind: string | null
  objectId: string | null
  createdAt: string
}

export interface ActivityEvent {
  id: string
  agent: string | null
  actorKind: "USER" | "AGENT" | "SYSTEM"
  verb: string
  summary: string
  objectKind: string | null
  objectId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface PendingApproval {
  id: string
  kind: string
  agent: string
  integrationSlug: string
  toolName: string
  actionId: string | null
  summary: string
  arguments: Record<string, unknown>
  objectKind: string | null
  objectId: string | null
  source: string
  createdAt: string
}

export interface WorkspaceOverview {
  agent: string
  workCounts: { kind: string; status: WorkObjectStatus; count: number }[]
  upcoming: WorkObject[]
  insights: Insight[]
  recentActivity: ActivityEvent[]
  pendingApprovals: number
  automations: { total: number; enabled: number; failing: number }
}

/**
 * One request paints the whole overview. Deliberately not split into per-panel
 * queries: the landing page of an agent workspace has to feel faster than the
 * chat box it replaced, and six round-trips is how that promise gets lost.
 */
export function useWorkspaceOverview(agent: string, organizationId: string) {
  return useQuery({
    queryKey: qk.workspaceOverview(agent, organizationId),
    queryFn: () => apiFetch<WorkspaceOverview>(`/workspace/${agent}/overview`),
    enabled: Boolean(agent && organizationId),
    staleTime: 30_000,
  })
}

export function useWorkspaceWork(
  agent: string,
  params: { kind?: string; status?: WorkObjectStatus; q?: string } = {},
) {
  const search = new URLSearchParams()
  if (params.kind) search.set("kind", params.kind)
  if (params.status) search.set("status", params.status)
  if (params.q) search.set("q", params.q)
  const qs = search.toString()

  return useQuery({
    queryKey: qk.workspaceWork(agent, qs),
    queryFn: () =>
      apiFetch<{ items: WorkObject[]; nextCursor: string | null }>(
        `/workspace/${agent}/work${qs ? `?${qs}` : ""}`,
      ),
    enabled: Boolean(agent),
  })
}

export function useWorkspaceActivity(agent: string, params: { objectId?: string } = {}) {
  const qs = params.objectId ? `?objectId=${encodeURIComponent(params.objectId)}` : ""
  return useQuery({
    queryKey: qk.workspaceActivity(agent, qs),
    queryFn: () =>
      apiFetch<{ events: ActivityEvent[]; nextCursor: string | null }>(
        `/workspace/${agent}/activity${qs}`,
      ),
    enabled: Boolean(agent),
  })
}

export function useWorkspaceInsights(agent: string, status?: InsightStatus) {
  const qs = status ? `?status=${status}` : ""
  return useQuery({
    queryKey: qk.workspaceInsights(agent, status ?? "OPEN"),
    queryFn: () => apiFetch<Insight[]>(`/workspace/${agent}/insights${qs}`),
    enabled: Boolean(agent),
  })
}

export function useWorkspaceApprovals(agent: string) {
  return useQuery({
    queryKey: qk.workspaceApprovals(agent),
    queryFn: () => apiFetch<PendingApproval[]>(`/workspace/${agent}/approvals`),
    enabled: Boolean(agent),
  })
}

export interface WorkspaceMemory {
  agent: string
  runningSummary: string
  longTermFacts: string[]
  messageCount: number
  org: { runningSummary: string; longTermFacts: string[] }
}

export function useWorkspaceMemory(agent: string) {
  return useQuery({
    queryKey: qk.workspaceMemory(agent),
    queryFn: () => apiFetch<WorkspaceMemory>(`/workspace/${agent}/memory`),
    enabled: Boolean(agent),
  })
}

export function useSetInsightStatus(agent: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InsightStatus }) =>
      apiFetch<Insight>(`/workspace/insights/${id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      // Both the list and the overview embed insights, so both go stale.
      void qc.invalidateQueries({ queryKey: qk.workspaceInsights(agent, "OPEN") })
      void qc.invalidateQueries({ queryKey: qk.workspaceOverview(agent, organizationId) })
    },
  })
}

// ─── Maya campaigns ──────────────────────────────────────────────────────────
// Campaigns live under /agents/maya rather than /workspace because they are a
// Maya domain object, not a framework one. The workspace reads them through
// the Work module like any other typed list.

export type CampaignStatus =
  | "BRIEF"
  | "GENERATING"
  | "REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED"

export interface CampaignPhoto {
  image?: { image_url?: string }
  composition_role?: string
}

export interface Campaign {
  id: string
  name: string
  brief: string
  objective: string | null
  audience: string | null
  platform: string
  status: CampaignStatus
  productImageUrls: string[]
  assets: { photos?: CampaignPhoto[] } | null
  caption: { body?: string; hashtags?: string[]; cta?: string } | null
  approvedAt: string | null
  scheduledFor: string | null
  createdAt: string
  updatedAt: string
}

export function useCampaigns(status?: CampaignStatus) {
  const qs = status ? `?status=${status}` : ""
  return useQuery({
    queryKey: qk.mayaCampaigns(status ?? "all"),
    queryFn: () => apiFetch<Campaign[]>(`/agents/maya/campaigns${qs}`),
  })
}

/** Approve, schedule or archive — the human-control step of the campaign flow. */
export function useCampaignAction(organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      scheduledFor,
    }: {
      id: string
      action: "approve" | "schedule" | "archive"
      scheduledFor?: string
    }) =>
      apiFetch<Campaign>(`/agents/maya/campaigns/${id}/${action}`, {
        method: "POST",
        body: action === "schedule" ? { scheduledFor } : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["maya", "campaigns"] })
      void qc.invalidateQueries({ queryKey: qk.workspaceOverview("maya", organizationId) })
      void qc.invalidateQueries({ queryKey: ["workspace", "work", "maya"] })
    },
  })
}
