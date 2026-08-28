"use client"

import { useCallback, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2, PenLine } from "lucide-react"
import { toast } from "sonner"

import {
  useAgentRun,
  useApproveRun,
  useRejectRun,
  useCancelRun,
  useSubmitStepAction,
} from "@/lib/api/runs"
import { RunActionDialog } from "@/components/chat/RunActionDialog"
import { authClient } from "@/lib/auth-client"
import type { AgentActionId } from "@/lib/types/agents"
import type { AgentRun, AgentRunStatus, AgentRunStep } from "@/lib/types/runs"
import { getAgent } from "@/lib/config/agents"

// React Flow measures the DOM on mount, so it cannot prerender on the server.
const RunGraph = dynamic(() => import("./RunGraph").then((m) => m.RunGraph), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 180,
        borderRadius: 12,
        border: "1px solid rgba(20,18,14,0.10)",
        background: "#F5EEE0",
        display: "grid",
        placeItems: "center",
        color: "#8B857A",
        fontSize: 13,
      }}
    >
      Drawing the plan…
    </div>
  ),
})

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  PLANNING: "Planning",
  AWAITING_PLAN_APPROVAL: "Waiting for your approval",
  RUNNING: "Running",
  AWAITING_ACTION_APPROVAL: "Needs your approval",
  REPLANNING: "Adjusting the plan",
  COMPLETED: "Done",
  PARTIAL: "Partly done",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REJECTED: "Discarded",
}

/**
 * Every step that transitively depends on `seeds`.
 *
 * Mirrors the server's `dependentClosure` for immediate feedback only — the
 * server recomputes it on approval and does not trust what the client sends.
 */
const dependentClosure = (steps: AgentRunStep[], seeds: Set<string>): Set<string> => {
  const dependentsOf = new Map<string, string[]>()
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      dependentsOf.set(dep, [...(dependentsOf.get(dep) ?? []), s.key])
    }
  }
  const out = new Set<string>()
  const queue = [...seeds]
  while (queue.length) {
    const key = queue.shift()!
    for (const child of dependentsOf.get(key) ?? []) {
      if (out.has(child)) continue
      out.add(child)
      queue.push(child)
    }
  }
  for (const seed of seeds) out.delete(seed)
  return out
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      fontFamily: "var(--font-mono), monospace",
      fontSize: 10,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#56514A",
      background: "rgba(20,18,14,0.06)",
      borderRadius: 999,
      padding: "3px 9px",
    }}
  >
    {children}
  </span>
)

export function RunPanel({ runId }: { runId: string }) {
  const { data: run, isLoading } = useAgentRun(runId)

  /**
   * Two sets, deliberately. Re-enabling a step must restore only the
   * dependents that were switched off *by the cascade*, never ones the user
   * turned off themselves — collapsing these into one set loses that.
   */
  const [explicitlyDisabled, setExplicitlyDisabled] = useState<Set<string>>(new Set())

  const steps = run?.steps ?? []
  const cascaded = useMemo(
    () => dependentClosure(steps, explicitlyDisabled),
    [steps, explicitlyDisabled],
  )

  const approve = useApproveRun(runId)
  const reject = useRejectRun(runId)
  const cancel = useCancelRun(runId)

  const toggle = useCallback((key: string) => {
    setExplicitlyDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (isLoading || !run) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8B857A", fontSize: 13 }}>
        <Loader2 size={13} className="animate-spin" />
        Loading plan…
      </div>
    )
  }

  // getAgent (not getAgentBySlug) — it returns undefined rather than
  // throwing, and an unrecognised agent must not blow up a chat bubble.
  const agentColor =
    (getAgent(run.agent.toLowerCase())?.color as string) ?? "var(--vq-yellow)"

  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const offKeys = new Set([...explicitlyDisabled, ...cascaded])
  const enabled = steps.filter((s) => !offKeys.has(s.key))
  const writeCount = enabled.filter((s) => s.isWrite).length
  const awaitingApproval = run.status === "AWAITING_PLAN_APPROVAL"
  // One at a time: the executor pauses the whole run on the first step that
  // needs input, so a second cannot be waiting yet.
  const reviewStep = steps.find(
    (s) => s.status === "AWAITING_APPROVAL" && s.proposedActionId,
  )
  const isLive = !awaitingApproval && run.status !== "REJECTED"
  const busy = approve.isPending || reject.isPending || cancel.isPending

  const onApprove = async () => {
    try {
      await approve.mutateAsync({ disabledStepKeys: [...explicitlyDisabled] })
      toast.success("Plan approved — running now")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve the plan")
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid rgba(20,18,14,0.10)",
        borderRadius: 14,
        background: "#FFFCF6",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(20,18,14,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#14120E" }}>
          {run.goal || "Plan"}
        </span>
        <Pill>{STATUS_LABEL[run.status]}</Pill>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#8B857A" }}>
          {enabled.length} of {steps.length} steps
          {writeCount > 0 && ` · ${writeCount} write${writeCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div style={{ padding: 12 }}>
        <RunGraph
          steps={steps}
          agentColor={agentColor}
          mode={awaitingApproval ? "approve" : "live"}
          disabledKeys={explicitlyDisabled}
          cascadedKeys={cascaded}
          onToggle={awaitingApproval ? toggle : undefined}
        />

        {awaitingApproval && (
          <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "#8B857A", lineHeight: 1.5 }}>
            Click a step to skip it — anything depending on it is skipped too.
            {writeCount > 0 && (
              <>
                {" "}
                <PenLine size={10} style={{ display: "inline", verticalAlign: -1 }} />{" "}
                Approving runs {writeCount} write{writeCount === 1 ? "" : "s"} without
                asking again.
              </>
            )}
          </p>
        )}

        {reviewStep && (
          <StepReviewBar
            key={reviewStep.key}
            runId={run.id}
            step={reviewStep}
            organizationId={organizationId}
          />
        )}

        {run.errorMessage && (
          <p style={{ margin: "10px 2px 0", fontSize: 12, color: "#B91C1C" }}>
            {run.errorMessage}
          </p>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid rgba(20,18,14,0.08)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        {awaitingApproval ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy || enabled.length === 0}
              style={{
                background: "#14120E",
                color: "#F2ECE0",
                border: "none",
                borderRadius: 9,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 550,
                cursor: busy || enabled.length === 0 ? "not-allowed" : "pointer",
                opacity: busy || enabled.length === 0 ? 0.5 : 1,
              }}
            >
              {approve.isPending ? "Starting…" : `Approve ${enabled.length} step${enabled.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => reject.mutate(undefined)}
              disabled={busy}
              style={{
                background: "transparent",
                color: "#56514A",
                border: "1px solid rgba(20,18,14,0.17)",
                borderRadius: 9,
                padding: "8px 14px",
                fontSize: 13,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Discard
            </button>
            {enabled.length === 0 && (
              <span style={{ fontSize: 11.5, color: "#B91C1C" }}>
                Nothing left to run
              </span>
            )}
          </>
        ) : isLive && run.status === "RUNNING" ? (
          <button
            type="button"
            onClick={() => cancel.mutate(undefined)}
            disabled={busy}
            style={{
              background: "transparent",
              color: "#56514A",
              border: "1px solid rgba(20,18,14,0.17)",
              borderRadius: 9,
              padding: "8px 14px",
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Stop
          </button>
        ) : (
          // Only the status. The summary is rendered as markdown in the
          // message bubble above, where its links are clickable — repeating it
          // here as plain text both duplicated it and made those links dead.
          <span style={{ fontSize: 12, color: "#8B857A" }}>
            {STATUS_LABEL[run.status]}
          </span>
        )}
      </div>
    </div>
  )
}

export type { AgentRun }

/**
 * A step that stopped to let the user check the inputs before the work runs.
 *
 * Maya's tools spend image credits and produce work whose taste matters, so
 * approving the plan is not by itself approval of the arguments a model chose
 * for them. The action runs through its own dialog — the same one the chat
 * uses — prefilled with what the model proposed; the result is then reported
 * back so the run continues with it as context.
 */
function StepReviewBar({
  runId,
  step,
  organizationId,
}: {
  runId: string
  step: AgentRunStep
  organizationId: string
}) {
  const [open, setOpen] = useState(false)
  const submit = useSubmitStepAction(runId, step.key)

  const prefill = (step.proposedArgs ?? undefined) as Record<string, unknown> | undefined

  return (
    <div
      style={{
        margin: "10px 0 0",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(245,197,24,0.55)",
        background: "rgba(245,197,24,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12.5, color: "#5A4A10", flex: 1, minWidth: 180 }}>
        <strong>{step.title}</strong> is ready to run — check the details first.
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={submit.isPending}
        style={{
          background: "#14120E",
          color: "#F2ECE0",
          border: "none",
          borderRadius: 9,
          padding: "7px 14px",
          fontSize: 12.5,
          cursor: submit.isPending ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {submit.isPending && <Loader2 size={12} className="animate-spin" />}
        Review and run
      </button>

      <RunActionDialog
        open={open}
        onOpenChange={setOpen}
        actionId={step.proposedActionId as AgentActionId | null}
        organizationId={organizationId}
        conversationId={`run-${runId}`}
        prefill={prefill}
        onComplete={async (ctx) => {
          try {
            await submit.mutateAsync({
              // The dialog may resolve a sibling action (a draft switched to a
              // carousel); the server checks it against what the step proposed.
              actionId: ctx.actionId ?? (step.proposedActionId as string),
              result: ctx.result,
              outputText:
                typeof ctx.result === "string" ? ctx.result : JSON.stringify(ctx.result),
            })
            setOpen(false)
            toast.success("Step done — carrying on with the run")
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not continue the run")
          }
        }}
      />
    </div>
  )
}
