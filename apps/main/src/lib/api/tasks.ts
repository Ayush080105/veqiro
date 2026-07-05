import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"

export type TaskType = "AGENT" | "GENERAL"
export type AgentSlug = "MAYA" | "SAGE" | "LEX" | "REX" | "SCOUT" | "VEGA"

export interface Task {
  id: string
  organizationId: string
  name: string
  description: string | null
  type: TaskType
  agent: AgentSlug | null
  cronExpression: string | null
  timezone: string
  isEnabled: boolean
  isDefault: boolean
  payload: unknown
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

export function useTasks(type?: TaskType) {
  const qs = type ? `?type=${type}` : ""
  return useQuery({
    queryKey: ["tasks", type ?? "all"],
    queryFn: () => apiFetch<Task[]>(`/tasks${qs}`),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string | null; cronExpression?: string | null; timezone?: string; isEnabled?: boolean }) =>
      apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })
}

export function useRunTask() {
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ message: string }>(`/tasks/${id}/run`, { method: "POST" }),
  })
}
