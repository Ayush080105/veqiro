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
  incomingHandoffs: IncomingHandoff[]
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

export type MemoryOrigin = "USER" | "AGENT" | "IMPORTED"

export interface MemoryItem {
  id: string
  agent: string | null
  kind: string
  content: string
  origin: MemoryOrigin
  confirmed: boolean
  sourceKind: string | null
  sourceId: string | null
  createdAt: string
}

export interface WorkspaceMemory {
  agent: string
  runningSummary: string
  longTermFacts: string[]
  messageCount: number
  org: { runningSummary: string; longTermFacts: string[] }
  items: MemoryItem[]
}

export type MemoryKind = "fact" | "preference" | "constraint" | "decision"
export type MemoryScope = "agent" | "company"

/** Tell an employee something to remember. Lands confirmed: it is the customer's own word. */
export function useAddMemoryItem(agent: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { content: string; kind: MemoryKind; scope: MemoryScope }) =>
      apiFetch<MemoryItem>(`/workspace/${agent}/memory-items`, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.workspaceMemory(agent) })
    },
  })
}

/** Confirm a remembered fact, or retire one the agent should stop believing. */
export function useUpdateMemoryItem(agent: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      confirmed?: boolean
      retired?: boolean
    }) =>
      apiFetch<{ id: string; confirmed: boolean; retired: boolean }>(
        `/workspace/memory-items/${id}`,
        { method: "PATCH", body },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.workspaceMemory(agent) })
    },
  })
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

// ─── Scout research projects ─────────────────────────────────────────────────

export type ResearchStatus = "BRIEF" | "RESEARCHING" | "READY" | "CLOSED" | "ARCHIVED"

export interface ResearchProjectSummary {
  id: string
  title: string
  question: string
  status: ResearchStatus
  subjectCompany: string | null
  summary: string | null
  monitored: boolean
  sourceCount: number
  findingCount: number
  lastResearchedAt: string | null
  updatedAt: string
}

export interface ResearchSource {
  id: string
  title: string
  url: string
  publisher: string | null
  publishedAt: string | null
  snippet: string
  retrievedAt: string
}

export interface ResearchFinding {
  id: string
  statement: string
  confidence: "LOW" | "MEDIUM" | "HIGH"
  category: string
  sourceId: string | null
}

export interface ResearchProjectDetail extends Omit<ResearchProjectSummary, "sourceCount" | "findingCount"> {
  brief: string | null
  createdAt: string
  sources: ResearchSource[]
  findings: ResearchFinding[]
}

export function useResearchProjects() {
  return useQuery({
    queryKey: qk.scoutProjects(),
    queryFn: () => apiFetch<ResearchProjectSummary[]>("/agents/scout/projects"),
  })
}

export function useResearchProject(id: string | undefined) {
  return useQuery({
    queryKey: qk.scoutProject(id ?? ""),
    queryFn: () => apiFetch<ResearchProjectDetail>(`/agents/scout/projects/${id}`),
    enabled: Boolean(id),
  })
}

export function useUpdateResearchProject(organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      status?: ResearchStatus
      monitored?: boolean
    }) =>
      apiFetch<{ id: string; status: ResearchStatus; monitored: boolean }>(
        `/agents/scout/projects/${id}`,
        { method: "PATCH", body },
      ),
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: qk.scoutProjects() })
      void qc.invalidateQueries({ queryKey: qk.scoutProject(variables.id) })
      void qc.invalidateQueries({ queryKey: qk.workspaceOverview("scout", organizationId) })
      void qc.invalidateQueries({ queryKey: ["workspace", "work", "scout"] })
    },
  })
}

// ─── Company pulse (Vega) ────────────────────────────────────────────────────

export interface AgentPulse {
  agent: string
  openInsights: number
  criticalInsights: number
  pendingApprovals: number
  needsReview: number
  lastActivityAt: string | null
}

export interface CompanyPulse {
  agents: AgentPulse[]
  totals: { openInsights: number; pendingApprovals: number; needsReview: number }
  topInsights: Insight[]
  recentActivity: ActivityEvent[]
  handoffsInFlight: number
}

export function useCompanyPulse(organizationId: string) {
  return useQuery({
    queryKey: qk.companyPulse(organizationId),
    queryFn: () => apiFetch<CompanyPulse>("/workspace/pulse"),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  })
}

// ─── Handoffs ────────────────────────────────────────────────────────────────

export type HandoffStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED"

export interface Handoff {
  id: string
  fromAgent: string | null
  toAgent: string
  requestedActionId: string | null
  requestedArgs: Record<string, unknown> | null
  note: string
  objectKind: string | null
  objectId: string | null
  status: HandoffStatus
  runId: string | null
  dueAt: string | null
  createdAt: string
  updatedAt: string
}

/** Work another employee has asked this one to do, as the overview returns it. */
export interface IncomingHandoff {
  id: string
  fromAgent: string | null
  note: string
  requestedActionId: string | null
  requestedArgs: Record<string, unknown> | null
  objectKind: string | null
  objectId: string | null
  createdAt: string
}

export function useHandoffs(agent: string, direction: "in" | "out" = "in") {
  return useQuery({
    queryKey: qk.workspaceHandoffs(agent, direction),
    queryFn: () =>
      apiFetch<Handoff[]>(`/workspace/${agent}/handoffs?direction=${direction}`),
    enabled: Boolean(agent),
  })
}

/** Hand a piece of work to another employee. */
export function useCreateHandoff(organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      fromAgent?: string
      toAgent: string
      requestedActionId?: string
      requestedArgs?: Record<string, unknown>
      note?: string
      objectKind?: string
      objectId?: string
    }) => apiFetch<Handoff>("/workspace/handoffs", { method: "POST", body }),
    onSuccess: (handoff) => {
      // Both sides change: the sender's outbox and the receiver's overview.
      void qc.invalidateQueries({ queryKey: ["workspace", "handoffs"] })
      void qc.invalidateQueries({
        queryKey: qk.workspaceOverview(handoff.toAgent.toLowerCase(), organizationId),
      })
      void qc.invalidateQueries({ queryKey: qk.companyPulse(organizationId) })
    },
  })
}

export function useRespondToHandoff(agent: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
      apiFetch<Handoff>(`/workspace/handoffs/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspace", "handoffs"] })
      void qc.invalidateQueries({ queryKey: qk.workspaceOverview(agent, organizationId) })
      void qc.invalidateQueries({ queryKey: qk.companyPulse(organizationId) })
    },
  })
}

// ─── Outcomes (PRD §15 success criteria) ─────────────────────────────────────

export interface OutcomeMetrics {
  periodDays: number
  workCompleted: number
  workNeedingAttention: number
  insightsSurfaced: number
  /** Null when nothing has been decided yet — not zero. */
  actionRate: number | null
  automationsEnabled: number
  proactiveShare: number | null
  handoffsCreated: number
  handoffsCompleted: number
  approvalMedianMinutes: number | null
  approvalsPending: number
}

export function useOutcomes(organizationId: string, days = 30) {
  return useQuery({
    queryKey: qk.workspaceOutcomes(organizationId, days),
    queryFn: () => apiFetch<OutcomeMetrics>(`/workspace/outcomes?days=${days}`),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  })
}

// ─── Sage pages (SEO monitoring) ─────────────────────────────────────────────

export type SeoIssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "QUICK_WIN"
export type SeoIssueStatus = "OPEN" | "FIXED" | "IGNORED"

export interface SeoPageSummary {
  id: string
  url: string
  title: string
  targetKeyword: string
  score: number | null
  previousScore: number | null
  nextMove: string
  openIssues: number
  lastAuditedAt: string | null
}

export interface SeoIssue {
  id: string
  severity: SeoIssueSeverity
  description: string
  status: SeoIssueStatus
  firstSeenAt: string
  lastSeenAt: string
}

export interface SeoPageDetail extends Omit<SeoPageSummary, "openIssues"> {
  summary: string
  issues: SeoIssue[]
}

export function useSeoPages() {
  return useQuery({
    queryKey: qk.sagePages(),
    queryFn: () => apiFetch<SeoPageSummary[]>("/agents/sage/pages"),
  })
}

export function useSeoPage(id: string | undefined) {
  return useQuery({
    queryKey: qk.sagePage(id ?? ""),
    queryFn: () => apiFetch<SeoPageDetail>(`/agents/sage/pages/${id}`),
    enabled: Boolean(id),
  })
}

export function useSetIssueStatus(organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SeoIssueStatus }) =>
      apiFetch<{ id: string; status: SeoIssueStatus }>(`/agents/sage/issues/${id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sage", "pages"] })
      void qc.invalidateQueries({ queryKey: ["sage", "page"] })
      void qc.invalidateQueries({ queryKey: qk.workspaceOverview("sage", organizationId) })
    },
  })
}
