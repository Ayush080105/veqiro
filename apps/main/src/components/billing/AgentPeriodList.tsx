"use client"

import Image from "next/image"
import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEntitlements, useMayaUsage, type AgentEntitlement } from "@/lib/api/billing"
import { getAgent } from "@/lib/config/agents"

const SOURCE_LABELS: Record<AgentEntitlement["source"], string> = {
  TRIAL: "Trial",
  AGENT: "Individual",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Read-only per-agent period/expiry list for the usage page. Deliberately
 * has no cancel/resume actions — that's AgentEntitlementRow's job on the
 * billing page. This just answers "what do I have, and when does each
 * piece renew or expire" from the same `useEntitlements()` slice.
 */
export function AgentPeriodList({ organizationId }: { organizationId?: string | null }) {
  const { entitlements, isPending } = useEntitlements(organizationId)
  // Only Maya has a credit quota — every other agent is genuinely unlimited,
  // so their rows show a static badge instead of an extra API call.
  const { data: mayaUsage } = useMayaUsage(organizationId)

  if (isPending) {
    return (
      <Card variant="brand">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Loading agent access…
        </CardContent>
      </Card>
    )
  }

  if (entitlements.length === 0) {
    return null
  }

  return (
    <Card variant="brand">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Agent access</CardTitle>
        <CardDescription>
          Each agent bills on its own — here&apos;s when each one renews or expires.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entitlements.map((entitlement) => {
          const agentId = entitlement.agent.toLowerCase()
          const agent = getAgent(agentId)
          return (
            // Overlapping rows for the same agent are legal (e.g. an AGENT
            // row and a lingering TRIAL row both covering the same agent,
            // when a trial-period purchase creates the AGENT row before the
            // TRIAL row has expired), so `agent` alone isn't a unique key —
            // see billing/page.tsx.
            <div
              key={`${entitlement.agent}-${entitlement.source}-${entitlement.currentPeriodEnd}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-[var(--vq-line-2)] bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative size-9 overflow-hidden rounded-full border border-[var(--vq-line-2)] bg-muted">
                  <Image
                    src={`/agents/${agentId}.jpeg`}
                    alt={`${agent?.name ?? entitlement.agent} portrait`}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{agent?.name ?? entitlement.agent}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {SOURCE_LABELS[entitlement.source]}
                    </Badge>
                    {entitlement.status === "PAST_DUE" && (
                      <Badge variant="destructive" className="text-[10px]">
                        Payment failed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entitlement.cancelAtPeriodEnd
                      ? `Access until ${formatDate(entitlement.currentPeriodEnd)} · won't renew`
                      : entitlement.source === "TRIAL"
                        ? `Trial ends ${formatDate(entitlement.currentPeriodEnd)}`
                        : `Renews ${formatDate(entitlement.currentPeriodEnd)}`}
                  </p>
                </div>
              </div>
              {entitlement.agent === "MAYA" ? (
                mayaUsage && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    <Sparkles className="size-3" />
                    {mayaUsage.credits.used}/{mayaUsage.credits.limit} credits
                  </span>
                )
              ) : (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Unlimited
                </Badge>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
