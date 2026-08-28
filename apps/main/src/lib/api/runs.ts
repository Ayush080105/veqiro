import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "./client"
import type { AgentRun } from "@/lib/types/runs"
import { TERMINAL_RUN_STATUSES } from "@/lib/types/runs"

const qk = {
  run: (id: string) => ["agentRun", id] as const,
}

export const getRun = (id: string) => apiFetch<AgentRun>(`/agents/runs/${id}`)

/**
 * Live view of a planned run.
 *
 * Polls with a widening interval, mirroring useMcpConnectionStatus: a run is
 * minutes-long, so a flat short interval spends requests on nothing. Stops
 * entirely on a terminal status, and slows right down while the run is parked
 * waiting on a human — nothing will change until they click.
 */
export function useAgentRun(runId: string | undefined) {
  return useQuery({
    queryKey: qk.run(runId ?? ""),
    queryFn: () => getRun(runId!),
    enabled: Boolean(runId),
    // The snapshot stored on the message is only a handle; the run is the
    // source of truth and may have moved on since the message was written.
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return 1_500
      if (TERMINAL_RUN_STATUSES.has(status)) return false
      // Parked on a person — they may be away for minutes.
      if (status === "AWAITING_PLAN_APPROVAL" || status === "AWAITING_ACTION_APPROVAL") {
        return 15_000
      }
      const n = query.state.dataUpdateCount
      if (n < 20) return 1_500    // first ~30s of execution
      if (n < 60) return 3_000    // next ~2min
      if (n < 120) return 6_000   // next ~6min
      if (n < 160) return 15_000  // tapering
      return false                // ~18min, matches the executor's run timeout
    },
  })
}

const useRunMutation = <TBody,>(
  runId: string,
  path: string,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body?: TBody) =>
      apiFetch<AgentRun>(`/agents/runs/${runId}/${path}`, {
        method: "POST",
        body: body ?? {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.run(runId) })
    },
  })
}

/** `disabledStepKeys` is a hint — the server recomputes the dependent closure. */
export const useApproveRun = (runId: string) =>
  useRunMutation<{ disabledStepKeys: string[] }>(runId, "approve")

export const useRejectRun = (runId: string) => useRunMutation(runId, "reject")

export const useCancelRun = (runId: string) => useRunMutation(runId, "cancel")
