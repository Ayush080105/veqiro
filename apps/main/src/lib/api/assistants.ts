import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Message, AgentSlug, AgentStatusData, LastMessage, ToolTraceEntry } from "@/lib/types"
import type { AgentActionId, LogoAnimationStylesResult } from "@/lib/types/agents"
import { apiFetch, AgentNotAvailableError, ApiError, API_URL, redirectToLogin } from "@/lib/api/client"
import { findAction } from "@/lib/agents/actions"
import { qk } from "@/lib/query-keys"

export { AgentNotAvailableError }

export interface StreamMessageHandlers {
  onToken?: (text: string) => void
  onToolCall?: (name: string) => void
  onToolResult?: (ok: boolean) => void
}

/**
 * Sends a message and consumes the agent's SSE reply
 * (apps/ai's core/streaming.py -> apps/server's contextService.ts relay).
 * Resolves with the final persisted `Message` row once the stream's
 * `persisted` (normal reply) or `plan_started` (became a planned run) frame
 * arrives — both carry a real, already-saved Message-shaped row, so the
 * caller doesn't need to distinguish them. `handlers` fire as progress
 * arrives so the caller can render tokens/tool activity live; the stream
 * itself is the only source of truth; nothing here is retried internally.
 */
export async function streamMessage(
  agentSlug: string,
  organizationId: string,
  content: string,
  conversationId: string | undefined,
  sourceIds: string[] | undefined,
  handlers: StreamMessageHandlers = {},
): Promise<Message> {
  const res = await fetch(`${API_URL}/agents/${agentSlug}/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, content, conversationId, sourceIds }),
  })

  if (res.status === 404) throw new AgentNotAvailableError(agentSlug)
  if (res.status === 401) {
    redirectToLogin()
    throw new ApiError(401, "Session expired")
  }
  if (!res.ok) {
    let detail = res.statusText
    let code: string | undefined
    try {
      const j = await res.json()
      detail = j.message ?? j.error ?? j.detail ?? detail
      code = j.error
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail, code)
  }
  if (!res.body) throw new ApiError(0, "No response body", "no_body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let finalMessage: Message | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sepIndex: number
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawFrame = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      const lines = rawFrame.split("\n")
      const eventLine = lines.find((l) => l.startsWith("event:"))
      const dataLine = lines.find((l) => l.startsWith("data:"))
      if (!eventLine || !dataLine) continue
      const event = eventLine.slice("event:".length).trim()
      const data = dataLine.slice("data:".length).trim()

      if (event === "token") {
        try {
          handlers.onToken?.((JSON.parse(data) as { text: string }).text)
        } catch {
          /* malformed frame — skip */
        }
      } else if (event === "tool_call") {
        try {
          handlers.onToolCall?.((JSON.parse(data) as { name: string }).name)
        } catch {
          /* ignore */
        }
      } else if (event === "tool_result") {
        try {
          handlers.onToolResult?.(Boolean((JSON.parse(data) as { ok: boolean }).ok))
        } catch {
          /* ignore */
        }
      } else if (event === "error") {
        let message = "Something went wrong."
        try {
          message = (JSON.parse(data) as { message?: string }).message ?? message
        } catch {
          /* ignore */
        }
        throw new ApiError(0, message, "stream_error")
      } else if (event === "persisted" || event === "plan_started") {
        try {
          finalMessage = JSON.parse(data) as Message
        } catch {
          /* ignore — falls through to the "no result" error below */
        }
      }
      // "metadata"/"done" carry data already folded into the "persisted" frame — no separate handling needed client-side.
    }
  }

  if (!finalMessage) throw new ApiError(0, "Stream ended without a result.", "no_result")
  return finalMessage
}

function humanizeToolLabel(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function getMessages(
  agentSlug: string,
  organizationId: string,
  before?: string,
  signal?: AbortSignal,
): Promise<Message[]> {
  try {
    const qs = new URLSearchParams({ organizationId, limit: "20" })
    if (before) qs.set("before", before)
    return await apiFetch<Message[]>(
      `/agents/${agentSlug}/chat?${qs.toString()}`,
      { agentSlugForNotFound: agentSlug, cache: "no-store", signal }
    )
  } catch (err) {
    if (err instanceof AgentNotAvailableError) return []
    throw err
  }
}

/**
 * Dispatch a specialized agent action. Frontend passes the payload through
 * Express which forwards to FastAPI. Result is the raw FastAPI response body.
 */
export async function runAgentAction<TInput, TResult>(
  actionId: AgentActionId,
  organizationId: string,
  input: TInput,
  conversationId?: string
): Promise<TResult> {
  const meta = findAction(actionId)
  if (!meta) throw new Error(`Unknown action: ${actionId}`)
  return apiFetch<TResult>(`/agents/${meta.agent}/${meta.endpoint}`, {
    method: "POST",
    body: { organizationId, conversationId, ...input },
    agentSlugForNotFound: meta.agent,
  })
}

export interface CampaignVideoStoryboardResult {
  /** One 3x3 sheet per 10-second segment, in story order. */
  storyboard_image_urls?: string[]
  storyboard_images_base64?: string[]
  beats: string[]
  model_used: string
}

export interface CampaignVideoPlanResult {
  /** One readable shot line per 10-second segment, in order, for display. */
  segments: string[]
  /** The structured shot plan (opaque JSON string), handed back on the render request. */
  video_plan?: string
  model_used: string
}

/** Plans the shot list before the (slow, expensive) render, so the user has something to read
 * while it runs and the video is shot from exactly the text they saw. Costs no credits. */
export async function generateCampaignVideoPlan(
  organizationId: string,
  input: {
    product_image_urls: string[]
    campaign_brief: string
    platform: string
    aspect_ratio: string
    duration_seconds: number
  },
  conversationId?: string
): Promise<CampaignVideoPlanResult> {
  return apiFetch<CampaignVideoPlanResult>("/agents/maya/campaign-video/plan", {
    method: "POST",
    body: { organizationId, conversationId, ...input },
    agentSlugForNotFound: "maya",
  })
}

export async function generateCampaignVideoStoryboard(
  organizationId: string,
  input: {
    product_image_urls: string[]
    campaign_brief: string
    platform: string
    aspect_ratio: string
    duration_seconds: number
    use_logo: boolean
  },
  conversationId?: string
): Promise<CampaignVideoStoryboardResult> {
  return apiFetch<CampaignVideoStoryboardResult>("/agents/maya/campaign-video/storyboard", {
    method: "POST",
    body: { organizationId, conversationId, ...input },
    agentSlugForNotFound: "maya",
  })
}

export async function getLogoAnimationStyles(): Promise<LogoAnimationStylesResult> {
  return apiFetch<LogoAnimationStylesResult>("/agents/maya/logo-animation/styles", {
    agentSlugForNotFound: "maya",
  })
}

export function useLogoAnimationStyles() {
  return useQuery({
    queryKey: qk.mayaLogoAnimationStyles(),
    queryFn: getLogoAnimationStyles,
    staleTime: Infinity, // hardcoded catalog on the backend — never changes at runtime
  })
}

export async function expandCampaignBrief(
  organizationId: string,
  brief: string,
  platform: string,
  productImageUrl?: string
): Promise<string> {
  const result = await apiFetch<{ expanded: string }>("/agents/maya/expand-brief", {
    method: "POST",
    body: { organizationId, brief, platform, productImageUrl },
  })
  return result.expanded
}

export interface PublishPostInput {
  /** Native OAuth account. Omit for platforms that publish over MCP. */
  socialAccountId?: string
  /** Publishes over the Composio MCP connection instead of a SocialAccount.
   *  Exactly one of this and socialAccountId must be set. */
  platform?: "instagram"
  caption: string
  hashtags?: string[]
  imageUrl?: string
  imageBase64?: string
  videoUrl?: string
  videoBase64?: string
  postType?: "post" | "reel"
}

export interface PublishPostResult {
  platform: "twitter" | "linkedin" | "instagram"
  platformPostId: string
  url?: string
  publishedAt: string
}

export async function publishPost(
  organizationId: string,
  input: PublishPostInput
): Promise<PublishPostResult> {
  return apiFetch<PublishPostResult>("/agents/maya/publish", {
    method: "POST",
    body: { organizationId, ...input },
    agentSlugForNotFound: "maya",
  })
}

export interface PublishCarouselInput {
  /** Native OAuth account. Omit for platforms that publish over MCP. */
  socialAccountId?: string
  /** See PublishPostInput.platform. */
  platform?: "instagram"
  caption?: string
  hashtags?: string[]
  imageUrls: string[]
}

export async function publishCarousel(
  organizationId: string,
  input: PublishCarouselInput
): Promise<PublishPostResult> {
  return apiFetch<PublishPostResult>("/agents/maya/publish-carousel", {
    method: "POST",
    body: { organizationId, ...input },
    agentSlugForNotFound: "maya",
  })
}

export interface SchedulePostInput extends PublishPostInput {
  scheduledAt: string
}

export interface ScheduleCarouselInput extends PublishCarouselInput {
  scheduledAt: string
}

export interface ScheduleResult {
  id: string
  scheduledAt: string
  platform: "twitter" | "linkedin" | "instagram"
}

export async function schedulePost(
  organizationId: string,
  input: SchedulePostInput
): Promise<ScheduleResult> {
  return apiFetch<ScheduleResult>("/agents/maya/schedule", {
    method: "POST",
    body: { organizationId, ...input },
    agentSlugForNotFound: "maya",
  })
}

export async function scheduleCarousel(
  organizationId: string,
  input: ScheduleCarouselInput
): Promise<ScheduleResult> {
  return apiFetch<ScheduleResult>("/agents/maya/schedule-carousel", {
    method: "POST",
    body: { organizationId, ...input },
    agentSlugForNotFound: "maya",
  })
}

export async function cancelScheduledPost(organizationId: string, id: string): Promise<void> {
  await apiFetch<unknown>(`/agents/maya/scheduled-posts/${id}/cancel`, {
    method: "POST",
    body: { organizationId },
    agentSlugForNotFound: "maya",
  })
}

// ─── Status fallback ──────────────────────────────────────────────────────────

const IDLE_ASSISTANT_STATUSES: Record<AgentSlug, AgentStatusData> = {
  maya: { status: "idle", lastActivity: "—" },
  rex: { status: "idle", lastActivity: "—" },
  scout: { status: "idle", lastActivity: "—" },
  sage: { status: "idle", lastActivity: "—" },
  lex: { status: "idle", lastActivity: "—" },
  vega: { status: "idle", lastActivity: "—" },
}

export async function getAssistantStatuses(): Promise<Record<AgentSlug, AgentStatusData>> {
  // There is no /assistants/status route in the server. The old call always
  // produced a 404 and then returned these same values from its catch block.
  // Keep the established UI behavior without issuing a known-bad request;
  // per-chat in-flight work is still shown from React Query mutation state.
  return { ...IDLE_ASSISTANT_STATUSES }
}

const EMPTY_LAST_MESSAGES: Record<AgentSlug, LastMessage | null> = {
  maya: null,
  rex: null,
  scout: null,
  sage: null,
  lex: null,
  vega: null,
}

export async function getLastMessages(): Promise<
  Record<AgentSlug, LastMessage | null>
> {
  try {
    return await apiFetch<Record<AgentSlug, LastMessage | null>>(
      `/agents/last-messages`
    )
  } catch {
    return { ...EMPTY_LAST_MESSAGES }
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAgentStatuses(organizationId: string) {
  return useQuery({
    queryKey: qk.assistantStatuses(organizationId),
    queryFn: () => getAssistantStatuses(),
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
  })
}

export function useLastMessages(organizationId: string) {
  return useQuery({
    queryKey: qk.lastMessages(organizationId),
    queryFn: () => getLastMessages(),
    enabled: !!organizationId,
  })
}

export function useMessages(agentSlug: string, organizationId: string) {
  return useQuery({
    queryKey: qk.chat(agentSlug, organizationId),
    queryFn: () => getMessages(agentSlug, organizationId),
    enabled: !!agentSlug && !!organizationId,
    placeholderData: (prev) => prev,
  })
}

export type SendMessageCallbacks = {
  onOptimistic?: (msg: Message, chatKey: string) => void
  /** Fired once, right as the stream opens, with a placeholder assistant message
   * (`deliveryStatus: "streaming"`, empty content) to insert into the window. */
  onAssistantStreaming?: (msg: Message, chatKey: string) => void
  /** Fired repeatedly as tokens/tool events arrive. `patch` always carries the
   * FULL accumulated state (not a delta) — replace the placeholder's fields
   * with it rather than appending. */
  onStreamUpdate?: (assistantId: string, chatKey: string, patch: Partial<Message>) => void
  /** `optimisticId` identifies the user message written by onOptimistic, `assistantId`
   * the placeholder written by onAssistantStreaming — both should be reconciled by
   * identity instead of by position in the list. */
  onSuccess?: (msg: Message, optimisticId: string, chatKey: string, assistantId: string) => void
  onError?: (optimisticId: string, chatKey: string) => void
  /** Fired instead of (not in addition to) onError when the stream had already
   * inserted an assistant placeholder before failing — that placeholder (which
   * may hold partial content from tokens that arrived before the failure)
   * should be marked failed rather than removed. */
  onAssistantError?: (assistantId: string, chatKey: string) => void
}

// Distinguishes optimistic/streaming client-only messages from persisted ones. Date.now()
// alone can repeat within a millisecond, and a duplicate React key silently drops a message.
let optimisticSeq = 0
const nextOptimisticId = () => `optimistic-${Date.now()}-${optimisticSeq++}`

export interface SendMessageVars {
  content: string
  /** Lex-only: ids of sources explicitly attached via the composer's "#" picker. */
  sourceIds?: string[]
}

export function useSendMessage(
  agentSlug: string,
  organizationId: string,
  conversationId?: string,
  callbacks?: SendMessageCallbacks,
) {
  const queryClient = useQueryClient()
  const chatKey = `${organizationId}:${agentSlug}`

  return useMutation({
    mutationKey: ["sendMessage", agentSlug, organizationId],

    mutationFn: async ({ content, sourceIds }: SendMessageVars) => {
      const assistantId = nextOptimisticId()
      const placeholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        imageUrl: null,
        createdAt: new Date().toISOString(),
        deliveryStatus: "streaming",
        customInput: { toolTrace: [] },
      }
      callbacks?.onAssistantStreaming?.(placeholder, chatKey)

      let textSoFar = ""
      let toolTrace: ToolTraceEntry[] = []

      try {
        const final = await streamMessage(agentSlug, organizationId, content, conversationId, sourceIds, {
          onToken: (text) => {
            textSoFar += text
            callbacks?.onStreamUpdate?.(assistantId, chatKey, { content: textSoFar })
          },
          onToolCall: (name) => {
            toolTrace = [...toolTrace, { label: humanizeToolLabel(name), status: "pending" }]
            callbacks?.onStreamUpdate?.(assistantId, chatKey, { customInput: { toolTrace } })
          },
          onToolResult: (ok) => {
            const idx = toolTrace.findIndex((t) => t.status === "pending")
            if (idx === -1) return
            toolTrace = toolTrace.map((t, i) => (i === idx ? { ...t, status: ok ? "ok" : "error" } : t))
            callbacks?.onStreamUpdate?.(assistantId, chatKey, { customInput: { toolTrace } })
          },
        })
        return { final, assistantId }
      } catch (err) {
        callbacks?.onAssistantError?.(assistantId, chatKey)
        throw err
      }
    },

    onMutate: ({ content }: SendMessageVars) => {
      const optimisticId = nextOptimisticId()
      const optimistic: Message = {
        id: optimisticId,
        role: "user",
        content,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        deliveryStatus: "sending",
      }
      callbacks?.onOptimistic?.(optimistic, chatKey)
      return { optimisticId, chatKey }
    },

    // `ctx` is undefined if onMutate itself threw — in which case no optimistic message was
    // ever written, so an id that matches nothing is the correct thing to pass on.
    onSuccess: ({ final, assistantId }, { content }, ctx) => {
      callbacks?.onSuccess?.(final, ctx?.optimisticId ?? "", ctx?.chatKey ?? chatKey, assistantId)

      queryClient.setQueryData<Record<AgentSlug, LastMessage | null>>(
        qk.lastMessages(organizationId),
        (prev) => {
          if (!prev) return prev
          const slug = agentSlug as AgentSlug
          return {
            ...prev,
            [slug]: {
              content: final.content || content,
              createdAt: final.createdAt ?? new Date().toISOString(),
              role: final.role,
            },
          }
        },
      )
    },

    // The assistant-placeholder side of a failure is already handled inside
    // mutationFn's catch (onAssistantError, fired with the real assistantId —
    // not available here since mutationFn's return value is unset on throw).
    onError: (_err, _content, ctx) => {
      callbacks?.onError?.(ctx?.optimisticId ?? "", ctx?.chatKey ?? "")
    },
  })
}

export function useRunAgentAction(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      actionId: AgentActionId
      input: unknown
      conversationId?: string
    }): Promise<{ agentSlug: string; result: unknown }> => {
      const meta = findAction(args.actionId)
      if (!meta) throw new Error(`Unknown action: ${args.actionId}`)
      const result = await runAgentAction<unknown, unknown>(
        args.actionId,
        organizationId,
        args.input,
        args.conversationId,
      )
      return { agentSlug: meta.agent, result }
    },
    onSuccess: ({ agentSlug }) => {
      queryClient.invalidateQueries({
        queryKey: qk.chat(agentSlug, organizationId),
      })
      queryClient.invalidateQueries({ queryKey: qk.lastMessages(organizationId) })
    },
  })
}

export function usePublishPost(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PublishPostInput) => publishPost(organizationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.integrations() })
      queryClient.invalidateQueries({ queryKey: qk.mayaPublishedPosts(organizationId) })
    },
  })
}

export function useCancelScheduledPost(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelScheduledPost(organizationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.mayaPublishedPosts(organizationId) })
    },
  })
}

export interface PublishedPost {
  id: string
  platform: "LINKEDIN" | "TWITTER" | "INSTAGRAM"
  caption: string
  hashtags: string[]
  imageUrl: string | null
  status: string
  error: string | null
  publishedAt: string | null
  scheduledAt: string | null
  createdAt: string
  platformPostId: string | null
}

export async function getPublishedPosts(organizationId: string): Promise<PublishedPost[]> {
  try {
    return await apiFetch<PublishedPost[]>(
      `/agents/maya/published-posts?organizationId=${encodeURIComponent(organizationId)}`,
      { agentSlugForNotFound: "maya" }
    )
  } catch (err) {
    if (err instanceof AgentNotAvailableError) return []
    throw err
  }
}

export function usePublishedPosts(organizationId: string) {
  return useQuery({
    queryKey: qk.mayaPublishedPosts(organizationId),
    queryFn: () => getPublishedPosts(organizationId),
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
  })
}

export type ContentFormat = "post" | "reel"

export interface ContentPlanItem {
  date: string
  day: string
  format: ContentFormat
  hook: string
  captionDirection: string
  reason: string
  /** True when Maya found no real signal and said so, rather than inventing one. */
  isGapFiller: boolean
  formatReason?: string
}

export interface ContentPlan {
  id: string
  weekStart: string
  note: string | null
  /** Null when the model's JSON couldn't be parsed — render rawText instead. */
  items: ContentPlanItem[] | null
  rawText: string
  createdAt: string
}

export async function listContentPlans(organizationId: string): Promise<ContentPlan[]> {
  return apiFetch<ContentPlan[]>(`/agents/maya/content-plan?organizationId=${encodeURIComponent(organizationId)}`, {
    agentSlugForNotFound: "maya",
  })
}

export async function generateContentPlan(organizationId: string): Promise<ContentPlan> {
  return apiFetch<ContentPlan>("/agents/maya/content-plan/generate", {
    method: "POST",
    body: { organizationId },
    agentSlugForNotFound: "maya",
  })
}

export function useContentPlans(organizationId: string) {
  return useQuery({
    queryKey: qk.mayaContentPlans(organizationId),
    queryFn: () => listContentPlans(organizationId),
    enabled: !!organizationId,
  })
}
