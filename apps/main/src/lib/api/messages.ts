import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Message, AgentSlug } from "@/lib/types"
import { apiFetch } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"

/**
 * Cross-agent message actions (pin, search) — server derives organizationId
 * from the session, same as /agents/last-messages, so nothing but the agent
 * slug and message id need to travel with these calls.
 */
export async function setMessagePinned(id: string, pinned: boolean): Promise<Message> {
  return apiFetch<Message>(`/agents/messages/${id}/pin`, {
    method: "PATCH",
    body: { pinned },
  })
}

export async function listPinnedMessages(agentSlug: AgentSlug): Promise<Message[]> {
  return apiFetch<Message[]>(`/agents/messages/pinned?agent=${agentSlug}`)
}

export async function searchMessages(agentSlug: AgentSlug, query: string): Promise<Message[]> {
  if (!query.trim()) return []
  const qs = new URLSearchParams({ agent: agentSlug, q: query })
  return apiFetch<Message[]>(`/agents/messages/search?${qs.toString()}`)
}

export function usePinnedMessages(agentSlug: AgentSlug, organizationId: string) {
  return useQuery({
    queryKey: qk.pinnedMessages(agentSlug, organizationId),
    queryFn: () => listPinnedMessages(agentSlug),
    enabled: !!agentSlug && !!organizationId,
  })
}

export function useTogglePinMessage(agentSlug: AgentSlug, organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => setMessagePinned(id, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.pinnedMessages(agentSlug, organizationId) })
    },
  })
}

export function useSearchMessages(agentSlug: AgentSlug | null, query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ["message-search", agentSlug, trimmed],
    queryFn: () => searchMessages(agentSlug as AgentSlug, trimmed),
    enabled: !!agentSlug && trimmed.length >= 2,
    placeholderData: (prev) => prev,
  })
}
