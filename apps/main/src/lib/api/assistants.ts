import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Message, AgentSlug, AgentStatusData, LastMessage } from "@/lib/types"
import type { AgentActionId, LogoAnimationStylesResult } from "@/lib/types/agents"
import { apiFetch, AgentNotAvailableError } from "@/lib/api/client"
import { findAction } from "@/lib/agents/actions"
import { qk } from "@/lib/query-keys"

export { AgentNotAvailableError }

export async function sendMessage(
  agentSlug: string,
  organizationId: string,
  content: string,
  conversationId?: string
): Promise<Message> {
  return apiFetch<Message>(`/agents/${agentSlug}/chat`, {
    method: "POST",
    body: { organizationId, content, conversationId },
    agentSlugForNotFound: agentSlug,
  })
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
  /** One narrative per 10-second segment, in order. */
  segments: string[]
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

// ─── Status (mock-fallback) ───────────────────────────────────────────────────

export async function getAssistantStatuses(
  _organizationId: string
): Promise<Record<AgentSlug, AgentStatusData>> {
  try {
    return await apiFetch<Record<AgentSlug, AgentStatusData>>(
      `/assistants/status?organizationId=${encodeURIComponent(_organizationId)}`
    )
  } catch {
    return {
      maya: { status: "idle", lastActivity: "—" },
      rex: { status: "idle", lastActivity: "—" },
      scout: { status: "idle", lastActivity: "—" },
      sage: { status: "idle", lastActivity: "—" },
      lex: { status: "idle", lastActivity: "—" },
      vega: { status: "idle", lastActivity: "—" },
    }
  }
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
    queryFn: () => getAssistantStatuses(organizationId),
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
  })
}

export function useLastMessages() {
  return useQuery({
    queryKey: qk.lastMessages(),
    queryFn: () => getLastMessages(),
    placeholderData: (prev) => prev,
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
  /** `optimisticId` identifies the user message written by onOptimistic, so the caller can
   * reconcile it by identity instead of by position in the list. */
  onSuccess?: (msg: Message, optimisticId: string, chatKey: string) => void
  onError?: (optimisticId: string, chatKey: string) => void
}

// Distinguishes optimistic user messages from persisted ones. Date.now() alone can repeat
// within a millisecond, and a duplicate React key silently drops a message from the list.
let optimisticSeq = 0
const nextOptimisticId = () => `optimistic-${Date.now()}-${optimisticSeq++}`

export function useSendMessage(
  agentSlug: string,
  organizationId: string,
  conversationId?: string,
  callbacks?: SendMessageCallbacks,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["sendMessage", agentSlug, organizationId],
    mutationFn: (content: string) =>
      sendMessage(agentSlug, organizationId, content, conversationId),

    onMutate: async (content: string) => {
      const optimisticId = nextOptimisticId()
      const chatKey = `${organizationId}:${agentSlug}`
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
    onSuccess: (serverMsg: Message, content: string, ctx) => {
      callbacks?.onSuccess?.(serverMsg, ctx?.optimisticId ?? "", ctx?.chatKey ?? "")

      queryClient.setQueryData<Record<AgentSlug, LastMessage | null>>(
        qk.lastMessages(),
        (prev) => {
          if (!prev) return prev
          const slug = agentSlug as AgentSlug
          return {
            ...prev,
            [slug]: {
              content: serverMsg.content || content,
              createdAt: serverMsg.createdAt ?? new Date().toISOString(),
              role: serverMsg.role,
            },
          }
        },
      )
    },

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
      queryClient.invalidateQueries({ queryKey: qk.lastMessages() })
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
