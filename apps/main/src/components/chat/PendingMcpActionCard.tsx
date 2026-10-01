"use client"

import * as React from "react"
import { Check, ChevronDown, Loader2, ShieldCheck, X } from "lucide-react"
import { getIntegrationBySlug } from "@repo/integrations-catalog"

import { findAction } from "@/lib/agents/actions"
import { useConfirmMcpPendingAction, useMcpPendingAction, useRejectMcpPendingAction } from "@/lib/api/mcp"
import { presentPendingAction, type PresentedField } from "@/lib/mcp/present-action"
import type { AgentActionId } from "@/lib/types/agents"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IntegrationLogo } from "@/components/integrations/IntegrationCatalogCard"
import { StatusPill } from "@/components/ui/status-pill"

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

  // What is about to happen, in words. Until the record loads we only have the
  // one-line summary the message was saved with, so show that rather than a gap.
  const record = live.data
  const native = record?.integrationSlug === "native"
  const integration = record && !native ? getIntegrationBySlug(record.integrationSlug) : undefined
  const presented = record
    ? presentPendingAction({
        integrationSlug: record.integrationSlug,
        toolName: record.toolName,
        arguments: record.arguments,
        nativeLabel: native ? findAction(record.toolName as AgentActionId)?.label : undefined,
      })
    : null
  const sourceName = native ? "Veqiro" : (integration?.name ?? record?.integrationSlug ?? "")

  const pill =
    status === "EXECUTED"
      ? { level: "ok" as const, text: presented?.doneLabel ?? "Done" }
      : status === "REJECTED"
        ? { level: "info" as const, text: "Rejected" }
        : status === "FAILED"
          ? { level: "danger" as const, text: "Didn't go through" }
          : { level: "warn" as const, text: checkingLiveStatus ? "Checking…" : "Needs your OK" }

  return (
    <div className="mt-1.5 w-full max-w-[460px] overflow-hidden rounded-[var(--vq-r)] border border-border bg-card">
      <div className="px-3.5 pt-3.5">
        {/* Source and status share a line; the title gets a full-width line of
            its own so it is never the thing that gets truncated. */}
        <div className="flex items-center gap-2">
          {sourceName ? <IntegrationLogo name={sourceName} logoUrl={integration?.logoUrl} /> : null}
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{sourceName}</p>
          <StatusPill level={pill.level} className="shrink-0">
            {pill.text}
          </StatusPill>
        </div>
        <p className="mt-2 font-head text-[15px] leading-snug text-foreground">
          {presented?.title ?? "Waiting for your OK"}
        </p>
      </div>

      {presented && presented.fields.length > 0 ? (
        <dl className="mx-3.5 mt-3 divide-y divide-(--vq-line-2) overflow-hidden rounded-[var(--vq-r-sm)] border border-(--vq-line-2)">
          {presented.fields.map((field) => (
            <FieldRow key={field.key} field={field} />
          ))}
        </dl>
      ) : (
        // No structured details (still loading, or nothing readable in them):
        // fall back to the sentence the agent wrote.
        <p className="mx-3.5 mt-3 text-[13px] leading-snug text-foreground">{summary}</p>
      )}
      {presented && presented.hiddenCount > 0 && (
        <p className="mx-3.5 mt-1.5 text-[11px] text-muted-foreground">
          +{presented.hiddenCount} more {presented.hiddenCount === 1 ? "detail" : "details"} not shown
        </p>
      )}

      {error && (
        <p role="alert" className="mx-3.5 mt-3 rounded-[var(--vq-r-sm)] bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {pending ? (
        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5 pt-3">
          <Button size="sm" onClick={handleConfirm} disabled={busy} className="gap-1.5">
            {confirm.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {presented?.confirmLabel ?? "Confirm"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReject} disabled={busy} className="gap-1.5">
            {reject.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            Reject
          </Button>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Nothing happens until you confirm
          </span>
        </div>
      ) : (
        <div className="h-3.5" />
      )}
    </div>
  )
}

/** One label/value row. Long text is clamped, with a toggle only if it actually overflows. */
function FieldRow({ field }: { field: PresentedField }) {
  const [open, setOpen] = React.useState(false)
  const clamp = field.long && !open
  const canExpand = field.long && (field.value.length > 160 || field.value.split(String.fromCharCode(10)).length > 3)
  return (
    <div className="grid grid-cols-[68px_1fr] gap-3 px-3 py-2 text-[13px]">
      <dt className="pt-px text-xs text-muted-foreground">{field.label}</dt>
      <dd className="min-w-0">
        <p
          className={cn(
            "break-words leading-snug text-foreground",
            field.long && "whitespace-pre-wrap",
            clamp && canExpand && "line-clamp-4",
          )}
        >
          {field.value}
        </p>
        {canExpand && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {open ? "Show less" : "Show all"}
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </dd>
    </div>
  )
}
