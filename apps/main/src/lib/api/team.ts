import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "./client"
import type { Message } from "@/lib/types"

/** The agents actually in the room — exactly the ones the org is entitled to. */
export interface TeamComposition {
  agents: string[]
  lead: string | null
}

const qk = {
  team: ["team"] as const,
  messages: (orgId: string) => ["teamMessages", orgId] as const,
}

export const getTeam = () => apiFetch<TeamComposition>("/agents/team")

export const getTeamMessages = (limit = 20, before?: string) =>
  apiFetch<Message[]>(
    `/agents/team/chat?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
  )

export const sendTeamMessage = (content: string) =>
  apiFetch<Message>("/agents/team/chat", { method: "POST", body: { content } })

export function useTeam() {
  return useQuery({
    queryKey: qk.team,
    queryFn: getTeam,
    // Composition only changes when billing does.
    staleTime: 5 * 60_000,
  })
}

export function useTeamMessages(organizationId: string | undefined) {
  return useQuery({
    queryKey: qk.messages(organizationId ?? ""),
    queryFn: () => getTeamMessages(20),
    enabled: Boolean(organizationId),
  })
}

export function useSendTeamMessage(organizationId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    // Keyed so the "thinking" state survives navigating away and back, the
    // same reason the per-agent chat keys its send mutation.
    mutationKey: ["sendTeamMessage", organizationId],
    mutationFn: (content: string) => sendTeamMessage(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.messages(organizationId ?? "") })
    },
  })
}
