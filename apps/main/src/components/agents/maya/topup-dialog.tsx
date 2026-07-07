"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TopUpResource = "images" | "video"

// $1 = 20 image credits, $1 = 20 video seconds.
const CREDITS_PER_DOLLAR: Record<TopUpResource, number> = { images: 20, video: 20 }
const RESOURCE_LABEL: Record<TopUpResource, string> = { images: "image credits", video: "video seconds" }

// STUB: no backend call yet — confirm just shows a "coming soon" toast.
// When this is wired up, it can't reuse `adjustCurrentPeriodUsage`
// (apps/server/src/modules/agents/maya/maya.usage.service.ts) as-is: that
// primitive only refunds `used` back up to the existing hardcoded tier
// quota (see maya.quotas.ts), it can't raise the ceiling. A real top-up
// needs a new mechanism to raise the limit for the current period (e.g.
// bonus columns on `MayaUsage`), plus a real one-off Dodo purchase flow —
// billing today is subscription-only (apps/server/.../billing.routes.ts).
export function MayaTopUpButton() {
  const [open, setOpen] = useState(false)
  const [resource, setResource] = useState<TopUpResource>("images")
  const [amount, setAmount] = useState("5")

  const dollars = Number(amount) > 0 ? Number(amount) : 0
  const credits = dollars * CREDITS_PER_DOLLAR[resource]

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
              Add extra image or video credits for this billing period.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={resource} onValueChange={(v) => setResource(v as TopUpResource)}>
            <label className="flex items-center gap-2 text-xs">
              <RadioGroupItem value="images" /> Images — $1 = 20 credits
            </label>
            <label className="flex items-center gap-2 text-xs">
              <RadioGroupItem value="video" /> Video — $1 = 20 seconds
            </label>
          </RadioGroup>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Amount (USD)
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            You&apos;ll get {credits} {RESOURCE_LABEL[resource]}.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={dollars <= 0}>
              Top Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
