import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import type { SageSavedKeyword, SageDiscoverPagesResult } from "@/lib/types/agents"

/** Imperative fetch — call from form handlers, not hooks. */
export async function discoverPages(domain: string): Promise<SageDiscoverPagesResult> {
  return apiFetch<SageDiscoverPagesResult>("/agents/sage/discover-pages", {
    method: "POST",
    body: { domain },
  })
}

const SAVED_KW_KEY = ["sage", "keywords", "saved"] as const

export function useSavedKeywords() {
  return useQuery<SageSavedKeyword[]>({
    queryKey: SAVED_KW_KEY,
    queryFn: () => apiFetch<SageSavedKeyword[]>("/agents/sage/keywords/saved"),
    staleTime: 30_000,
  })
}

export function useSaveKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<SageSavedKeyword, "id" | "createdAt" | "organizationId">) =>
      apiFetch<SageSavedKeyword>("/agents/sage/keywords/saved", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SAVED_KW_KEY }),
  })
}

export function useUnsaveKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/agents/sage/keywords/saved/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SAVED_KW_KEY }),
  })
}
