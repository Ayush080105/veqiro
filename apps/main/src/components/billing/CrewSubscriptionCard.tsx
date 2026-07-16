"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cancelCrew, resumeCrew, type AgentEntitlement } from "@/lib/api/billing"
import { billingActionErrorMessage } from "@/components/billing/entitlement-errors"
import { money } from "@/lib/format"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// Crew produces six identical-shaped CREW entitlement rows (one per agent,
// all sharing the same billingSubscriptionId, currentPeriodEnd, and
// cancelAtPeriodEnd — see applyCrewActivation). A single card representing
// the whole subscription is the right shape here, not one cancel/resume
// button repeated six times in AgentEntitlementRow.
export function CrewSubscriptionCard({
  entitlements, onChanged, isOwner = true,
}: { entitlements: AgentEntitlement[]; onChanged: () => void; isOwner?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const crewRow = entitlements.find((e) => e.source === "CREW")
  if (!crewRow) return null

  const { currentPeriodEnd, cancelAtPeriodEnd, status } = crewRow
  const totalPriceCents = entitlements
    .filter((e) => e.source === "CREW")
    .reduce((sum, e) => sum + e.priceCents, 0)
  const ownerOnlyTitle = isOwner ? undefined : "Only the organization owner can manage billing"

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
    <Card variant="brand">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Crew plan</CardTitle>
              <Badge variant="secondary">All 6 agents</Badge>
              {status === "PAST_DUE" && <Badge variant="destructive">Payment failed</Badge>}
            </div>
            <CardDescription>
              {money(totalPriceCents)}/mo ·{" "}
              {cancelAtPeriodEnd
                ? `Access until ${formatDate(currentPeriodEnd)}`
                : `Renews ${formatDate(currentPeriodEnd)}`}
            </CardDescription>
          </div>
          {cancelAtPeriodEnd ? (
            <Button size="sm" variant="outline" disabled={busy || !isOwner} title={ownerOnlyTitle}
              onClick={() => run(() => resumeCrew(), "Crew will renew again")}>
              {busy ? "Resuming…" : "Resume auto-pay"}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy || !isOwner} title={ownerOnlyTitle}
              onClick={() => setConfirmOpen(true)}>
              {busy ? "Cancelling…" : "Cancel auto-pay"}
            </Button>
          )}
        </div>
      </CardHeader>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your Crew plan?</AlertDialogTitle>
            {/* Deliberately the opposite of per-agent cancel's copy: cancelling
                Crew stops all six agents together, not just one. */}
            <AlertDialogDescription>
              This stops auto-pay for <strong>all six agents together</strong> — that&apos;s what Crew means.
              You&apos;ll keep access until <strong>{formatDate(currentPeriodEnd)}</strong>, the end of the
              period you&apos;ve already paid for. It won&apos;t renew after that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep auto-pay</AlertDialogCancel>
            <AlertDialogAction disabled={busy}
              onClick={() => run(() => cancelCrew(), "Crew won't renew")}>
              {busy ? "Cancelling…" : "Cancel auto-pay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
