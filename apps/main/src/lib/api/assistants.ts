import type { Message, AgentSlug, AgentStatusData } from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"
import { apiFetch, AgentNotAvailableError } from "@/lib/api/client"
import { findAction } from "@/lib/agents/actions"

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
