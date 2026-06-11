import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Message, AgentSlug, AgentStatusData, LastMessage } from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"
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
  organizationId: string
): Promise<Message[]> {
  try {
    return await apiFetch<Message[]>(
      `/agents/${agentSlug}/chat?organizationId=${encodeURIComponent(organizationId)}`,
      { agentSlugForNotFound: agentSlug }
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

export async function expandCampaignBrief(
  organizationId: string,
  brief: string,
  platform: string,
  productImageBase64?: string
): Promise<string> {
  const result = await apiFetch<{ expanded: string }>("/agents/maya/expand-brief", {
    method: "POST",
    body: { organizationId, brief, platform, product_image_base64: productImageBase64 },
  })
  return result.expanded
}

export interface PublishPostInput {
  socialAccountId: string
  caption: string
  hashtags?: string[]
  imageUrl?: string
  imageBase64?: string
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
  socialAccountId: string
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

export function useSendMessage(
  agentSlug: string,
  organizationId: string,
  conversationId?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["sendMessage", agentSlug, organizationId],
    mutationFn: (content: string) =>
      sendMessage(agentSlug, organizationId, content, conversationId),

    onMutate: async (content: string) => {
      const key = qk.chat(agentSlug, organizationId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Message[]>(key) ?? []
      const optimistic: Message = {
        role: "user",
        content,
        imageUrl: null,
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData<Message[]>(key, [...previous, optimistic])
      return { previous }
    },

    onSuccess: (serverMsg: Message, content: string) => {
      const key = qk.chat(agentSlug, organizationId)
      queryClient.setQueryData<Message[]>(key, (prev) => [
        ...(prev ?? []),
        serverMsg,
      ])

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
      if (!ctx) return
      queryClient.setQueryData<Message[]>(
        qk.chat(agentSlug, organizationId),
        ctx.previous,
      )
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

export interface PublishedPost {
  id: string
  platform: "LINKEDIN" | "TWITTER" | "INSTAGRAM"
  caption: string
  hashtags: string[]
  imageUrl: string | null
  status: string
  publishedAt: string | null
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
