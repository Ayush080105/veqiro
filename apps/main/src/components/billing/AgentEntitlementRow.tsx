"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cancelAgent, resumeAgent, type AgentEntitlement } from "@/lib/api/billing"
import { billingActionErrorMessage } from "@/components/billing/entitlement-errors"

const AGENT_IMAGES: Record<string, string> = {
  MAYA: "/agents/maya.jpeg", SAGE: "/agents/sage.jpeg", LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg", SCOUT: "/agents/scout.jpeg", VEGA: "/agents/vega.jpeg",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function AgentEntitlementRow({
  entitlement, onChanged,
}: { entitlement: AgentEntitlement; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { agent, source, status, currentPeriodEnd, cancelAtPeriodEnd } = entitlement

  // Crew and trial agents have no independent auto-pay to toggle: Crew is one
  // subscription for all six, and a trial has no subscription at all.
  const togglable = source === "AGENT"

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
    } catch (e) {
      toast.error(billingActionErrorMessage(e))
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="relative size-10 overflow-hidden rounded-full border bg-muted">
          <Image src={AGENT_IMAGES[agent]} alt={`${agent} portrait`} fill sizes="40px" className="object-cover" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize">{agent.toLowerCase()}</span>
            {source === "TRIAL" && <Badge variant="secondary">Trial</Badge>}
            {source === "CREW" && <Badge variant="secondary">Crew</Badge>}
            {status === "PAST_DUE" && <Badge variant="destructive">Payment failed</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {cancelAtPeriodEnd
              ? `Access until ${formatDate(currentPeriodEnd)}`
              : source === "TRIAL"
                ? `Trial ends ${formatDate(currentPeriodEnd)}`
                : `Renews ${formatDate(currentPeriodEnd)}`}
          </p>
        </div>
      </div>

      {togglable && (
        cancelAtPeriodEnd ? (
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => run(() => resumeAgent(agent), `${agent} will renew again`)}>
            Resume auto-pay
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmOpen(true)}>
              Cancel auto-pay
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel auto-pay for {agent.toLowerCase()}?</AlertDialogTitle>
                  {/* State the exact date: the user keeps the time they already
                      paid for, and must not read this as losing access today. */}
                  <AlertDialogDescription>
                    You&apos;ll keep access until <strong>{formatDate(currentPeriodEnd)}</strong>, the end of
                    the period you&apos;ve already paid for. It won&apos;t renew after that. Your other agents
                    aren&apos;t affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep auto-pay</AlertDialogCancel>
                  <AlertDialogAction disabled={busy}
                    onClick={() => run(() => cancelAgent(agent), `${agent} won't renew`)}>
                    Cancel auto-pay
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )
      )}
    </div>
  )
}
