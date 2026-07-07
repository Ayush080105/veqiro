"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBillingStatus } from "@/lib/api/billing"

// $3 = 50 credits. Mirrors apps/server/.../maya.quotas.ts's
// TOPUP_DOLLAR_UNIT/TOPUP_CREDITS_PER_UNIT — keep both in sync manually,
// there's no shared package across the Next/Express boundary.
const DOLLAR_UNIT = 3
const CREDITS_PER_UNIT = 50
const PRESET_AMOUNTS = [3, 6, 9, 12, 15]

// STUB: no backend call yet — confirm just shows a "coming soon" toast.
// When this is wired up, it can't reuse `adjustCurrentPeriodUsage`
// (apps/server/src/modules/agents/maya/maya.usage.service.ts) as-is: that
// primitive only refunds `used` back up to the existing hardcoded tier
// quota (see maya.quotas.ts), it can't raise the ceiling. A real top-up
// needs a new mechanism to raise the limit for the current period (e.g.
// bonus columns on `MayaUsage`), plus a real one-off Dodo purchase flow —
// billing today is subscription-only (apps/server/.../billing.routes.ts).
export function MayaTopUpButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(DOLLAR_UNIT))

  const { data: billing } = useBillingStatus(organizationId)
  const isActiveSubscriber = billing?.subscription?.status === "ACTIVE"

  const dollars = Number(amount) > 0 ? Number(amount) : 0
  const isValidAmount = dollars > 0 && dollars % DOLLAR_UNIT === 0
  const credits = isValidAmount ? (dollars / DOLLAR_UNIT) * CREDITS_PER_UNIT : 0

  function handleConfirm() {
    toast("Top-ups are coming soon — check back shortly.")
    setOpen(false)
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
              {`Amount (multiples of $${DOLLAR_UNIT})`}
            </label>
            <div className="flex gap-1.5">
              {PRESET_AMOUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
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
            <Input
              type="number"
              min={DOLLAR_UNIT}
              step={DOLLAR_UNIT}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!isValidAmount && dollars > 0 && (
              <p className="text-xs text-destructive">{`Amount must be a multiple of $${DOLLAR_UNIT}.`}</p>
            )}
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!isActiveSubscriber || !isValidAmount}>
              Top Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
