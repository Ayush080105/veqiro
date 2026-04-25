import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import type { ScoutCompetitorWatch } from "@/lib/types/agents"

const COMPETITORS_KEY = ["scout", "competitors"] as const

export function useCompetitorWatches() {
  return useQuery<ScoutCompetitorWatch[]>({
    queryKey: COMPETITORS_KEY,
    queryFn: () => apiFetch<ScoutCompetitorWatch[]>("/agents/scout/competitors"),
    staleTime: 30_000,
  })
}

export function useAddCompetitorWatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; url: string }) =>
      apiFetch<ScoutCompetitorWatch>("/agents/scout/competitors", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPETITORS_KEY }),
  })
}

export function useRemoveCompetitorWatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/agents/scout/competitors/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPETITORS_KEY }),
  })
}
