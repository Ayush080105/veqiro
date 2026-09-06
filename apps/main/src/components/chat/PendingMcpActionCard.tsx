"use client"

import * as React from "react"
import { Check, X, Loader2 } from "lucide-react"
import { FONT } from "@/lib/fonts"
import { useConfirmMcpPendingAction, useMcpPendingAction, useRejectMcpPendingAction } from "@/lib/api/mcp"

type LocalStatus = "PENDING" | "EXECUTED" | "REJECTED" | "FAILED"

function toLocalStatus(s: string): LocalStatus {
  return s === "EXECUTED" || s === "REJECTED" || s === "FAILED" ? s : "PENDING"
}

export function PendingMcpActionCard({
  id,
  summary,
  status: initialStatus,
}: {
  id: string
  summary: string
  status: string
}) {
  const [status, setStatus] = React.useState<LocalStatus>(toLocalStatus(initialStatus))
  const [error, setError] = React.useState<string | null>(null)
  const confirm = useConfirmMcpPendingAction()
  const reject = useRejectMcpPendingAction()

  // The status prop is a snapshot taken when this message was first saved —
  // it goes stale the moment the action is actually confirmed/rejected
  // (e.g. on a page refresh). Reconcile with the live DB status once, on
  // mount. Guarded to only apply while we're still showing "PENDING" locally
  // so it can't clobber a status we just set ourselves from a live mutation.
  const live = useMcpPendingAction(id)
  React.useEffect(() => {
    if (!live.data) return
    setStatus((current) => (current === "PENDING" ? toLocalStatus(live.data.status) : current))
    if (live.data.status === "FAILED" && live.data.errorMessage) {
      setError((current) => current ?? live.data.errorMessage)
    }
  }, [live.data])

  const handleConfirm = () => {
    confirm.mutate(id, {
      onSuccess: (result) => {
        if (result.status === "FAILED") {
          setStatus("FAILED")
          setError(result.errorMessage ?? "Action failed")
        } else {
          setStatus("EXECUTED")
        }
      },
      onError: (err) => {
        setStatus("FAILED")
        setError(err instanceof Error ? err.message : "Action failed")
      },
    })
  }

  const handleReject = () => {
    reject.mutate(id, {
      onSuccess: () => setStatus("REJECTED"),
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to reject")
      },
    })
  }

  const pending = status === "PENDING"
  // Block clicks until the initial live-status check resolves — otherwise a
  // stale "PENDING" snapshot briefly renders clickable buttons for an action
  // that may have already been confirmed/rejected elsewhere or on a prior visit.
  const checkingLiveStatus = pending && live.isLoading
  const busy = confirm.isPending || reject.isPending || checkingLiveStatus

  return (
    <div
      style={{
        border: "1px solid var(--vq-line-2)",
        borderRadius: 12,
        padding: "10px 12px",
        marginTop: 6,
        background: "var(--card)",
        fontFamily: FONT.body,
        maxWidth: 420,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.3px", fontFamily: FONT.mono, color: "var(--muted-foreground)", marginBottom: 4 }}>
        {checkingLiveStatus
          ? "CHECKING STATUS..."
          : pending
            ? "AWAITING YOUR CONFIRMATION"
            : status === "EXECUTED"
              ? "DONE"
              : status === "REJECTED"
                ? "REJECTED"
                : "FAILED"}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.4, color: "var(--foreground)" }}>{summary}</div>
      {error && (
        <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: 4 }}>{error}</div>
      )}
      {pending && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={handleConfirm}
            disabled={busy}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "var(--primary)", color: "var(--primary-foreground)", border: "none",
              borderRadius: 8, padding: "5px 10px", fontSize: 12.5,
              fontFamily: FONT.body, cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {confirm.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Confirm
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "transparent", color: "var(--foreground)",
              border: "1px solid var(--vq-line-2)",
              borderRadius: 8, padding: "5px 10px", fontSize: 12.5,
              fontFamily: FONT.body, cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {reject.isPending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
