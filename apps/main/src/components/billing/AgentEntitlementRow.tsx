"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AgentEntitlement } from "@/lib/api/billing"
import { money } from "@/lib/format"

const AGENT_IMAGES: Record<string, string> = {
  MAYA: "/agents/maya.jpeg", SAGE: "/agents/sage.jpeg", LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg", SCOUT: "/agents/scout.jpeg", VEGA: "/agents/vega.jpeg",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// Read-only: cancelling or resuming an agent's auto-pay happens through
// Dodo's hosted billing portal now (see settings/billing/page.tsx's "Manage
// billing" button), not an in-app toggle.
export function AgentEntitlementRow({ entitlement }: { entitlement: AgentEntitlement }) {
  const { agent, source, status, currentPeriodEnd, cancelAtPeriodEnd, priceCents } = entitlement

  return (
    <Card variant="brand" size="sm">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative size-10 overflow-hidden rounded-full border border-[var(--vq-line-2)] bg-muted">
            <Image src={AGENT_IMAGES[agent]} alt={`${agent} portrait`} fill sizes="40px" className="object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{agent.toLowerCase()}</span>
              {source === "TRIAL" && <Badge variant="secondary">Trial</Badge>}
              {status === "PAST_DUE" && <Badge variant="destructive">Payment failed</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {cancelAtPeriodEnd
                ? `Access until ${formatDate(currentPeriodEnd)}`
                : source === "TRIAL"
                  ? `Trial ends ${formatDate(currentPeriodEnd)}`
                  : `Renews ${formatDate(currentPeriodEnd)}`}
              {source !== "TRIAL" && <> · {money(priceCents)}/mo</>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
