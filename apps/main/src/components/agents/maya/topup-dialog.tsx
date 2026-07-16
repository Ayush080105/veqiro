"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { startMayaTopupCheckout, useBillingStatus } from "@/lib/api/billing"
import { billingActionErrorMessage, hasMayaEntitlement } from "@/components/billing/entitlement-errors"

// $3 = 50 credits. Mirrors apps/server/.../maya.quotas.ts's
// TOPUP_DOLLAR_UNIT/TOPUP_CREDITS_PER_UNIT — keep both in sync manually,
// there's no shared package across the Next/Express boundary.
const DOLLAR_UNIT = 3
const CREDITS_PER_UNIT = 50
// Matches the server's closed allowlist exactly (maya.quotas.ts's
// ALLOWED_TOPUP_DOLLARS) — the backend rejects any amount not in this list,
// so there is no free-text amount entry here; only these 5 presets exist.
const PRESET_AMOUNTS = [3, 6, 9, 12, 15]

// Real one-time Dodo checkout — see billing.topup.ts's createMayaTopupCheckout
// and billing.webhooks.ts's handleMayaTopupPaymentSucceeded on the server.
export function MayaTopUpButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  const [dollars, setDollars] = useState(PRESET_AMOUNTS[0])
  const [busy, setBusy] = useState(false)

  const { data: billing } = useBillingStatus(organizationId)
  // Gate on Maya's own entitlement, not the legacy org-wide subscription
  // status — see hasMayaEntitlement's doc comment for why this is stricter
  // and more correct than `billing?.subscription?.status === "ACTIVE"`.
  const isActiveSubscriber = hasMayaEntitlement(billing?.subscription)

  const credits = (dollars / DOLLAR_UNIT) * CREDITS_PER_UNIT

  async function handleConfirm() {
    setBusy(true)
    try {
      const result = await startMayaTopupCheckout({ dollars })
      window.location.href = result.url
    } catch (e) {
      toast.error(billingActionErrorMessage(e, "Couldn't start checkout"))
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full bg-[#F0F0F0] px-2 py-1 text-[11px] font-medium text-[#555] transition-colors hover:bg-[#E5E5E5]"
      >
        <Plus className="size-3" /> Top up
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top up Maya credits</DialogTitle>
            <DialogDescription>
              Add extra credits for this billing period — use them on images or video, however you like.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Amount
            </label>
            <div className="flex gap-1.5">
              {PRESET_AMOUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDollars(n)}
                  className="flex-1 py-1.5 text-xs rounded transition-colors"
                  style={{
                    border: "2px solid var(--border)",
                    background: dollars === n ? "var(--foreground)" : "transparent",
                    color: dollars === n ? "var(--background)" : "var(--foreground)",
                    fontWeight: dollars === n ? 700 : 400,
                  }}
                >
                  ${n}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            You&apos;ll get {credits} credits.
          </p>

          {!isActiveSubscriber && (
            <p className="text-xs text-destructive">
              Top-ups are available for active Maya subscribers. Upgrade your plan to unlock this.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!isActiveSubscriber || busy}>
              {busy ? "Opening checkout..." : "Top Up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
