"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createCheckout, type BillingAgent } from "@/lib/api/billing"
import { billingActionErrorMessage } from "@/components/billing/entitlement-errors"
import { AGENTS } from "@/lib/config/agents"

const AGENT_IMAGES: Record<string, string> = {
  MAYA: "/agents/maya.jpeg", SAGE: "/agents/sage.jpeg", LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg", SCOUT: "/agents/scout.jpeg", VEGA: "/agents/vega.jpeg",
}

export function AgentBuyCard({
  agent, priceCents, disabled, disabledReason, onResumed,
}: {
  agent: BillingAgent
  priceCents: number
  disabled?: boolean
  disabledReason?: string
  onResumed?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const meta = AGENTS.find((a) => a.id.toUpperCase() === agent)

  async function buy() {
    setBusy(true)
    try {
      const result = await createCheckout({ agent })
      // A cancelled-but-unexpired agent resumes instead of charging, and returns
      // no URL. Assigning window.location.href = null would navigate to "null".
      if (result.resumed) {
        toast.success(`${meta?.name ?? agent} will renew again`)
        onResumed?.()
        return
      }
      window.location.href = result.url
    } catch (e) {
      toast.error(billingActionErrorMessage(e, "Couldn't start checkout"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="relative size-12 overflow-hidden rounded-full border bg-muted">
          <Image src={AGENT_IMAGES[agent]} alt={`${meta?.name ?? agent} portrait`}
                 fill sizes="48px" className="object-cover" />
        </div>
        <div>
          <div className="text-sm font-semibold">{meta?.name ?? agent}</div>
          <div className="text-xs text-muted-foreground">{meta?.role}</div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{meta?.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">
          ${priceCents / 100}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">/mo</span>
        </span>
        <Button size="sm" onClick={buy} disabled={busy || disabled}
                title={disabled ? disabledReason : undefined}>
          {busy ? "Opening..." : "Buy"}
        </Button>
      </div>
    </div>
  )
}
