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
  return apiFetch<Message>(`/${agentSlug}/chat`, {
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
      `/${agentSlug}/chat?organizationId=${encodeURIComponent(organizationId)}`,
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
  return apiFetch<TResult>(`/${meta.agent}/${meta.endpoint}`, {
    method: "POST",
    body: { organizationId, conversationId, ...input },
    agentSlugForNotFound: meta.agent,
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
