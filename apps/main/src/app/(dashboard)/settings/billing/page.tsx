"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { CreditCard } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { authClient, useSession } from "@/lib/auth-client"
import { AgentEntitlementRow } from "@/components/billing/AgentEntitlementRow"
import { CrewUpgradeCard } from "@/components/billing/CrewUpgradeCard"
import { AgentBuyCard } from "@/components/billing/AgentBuyCard"
import { BillingAgent, openBillingPortal, useBillingStatus } from "@/lib/api/billing"

const ALL_AGENTS: BillingAgent[] = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"]

// Individual agents are MONTHLY-only, so there is no cadence here — Annual
// exists only for Crew (see CrewUpgradeCard).
const AGENT_PRICE_ENV: Record<BillingAgent, string | undefined> = {
  MAYA: process.env.NEXT_PUBLIC_AGENT_PRICE_MAYA_MONTHLY_CENTS,
  SAGE: process.env.NEXT_PUBLIC_AGENT_PRICE_SAGE_MONTHLY_CENTS,
  LEX: process.env.NEXT_PUBLIC_AGENT_PRICE_LEX_MONTHLY_CENTS,
  REX: process.env.NEXT_PUBLIC_AGENT_PRICE_REX_MONTHLY_CENTS,
  SCOUT: process.env.NEXT_PUBLIC_AGENT_PRICE_SCOUT_MONTHLY_CENTS,
  VEGA: process.env.NEXT_PUBLIC_AGENT_PRICE_VEGA_MONTHLY_CENTS,
}

const DEFAULT_AGENT_MONTHLY_CENTS: Record<BillingAgent, number> = {
  MAYA: 1900,
  SAGE: 900,
  LEX: 900,
  REX: 900,
  SCOUT: 900,
  VEGA: 900,
}

function getMonthlyPrice(agent: BillingAgent): number {
  const raw = AGENT_PRICE_ENV[agent]
  if (!raw) return DEFAULT_AGENT_MONTHLY_CENTS[agent]
  const cents = Number(raw)
  return Number.isInteger(cents) && cents > 0 ? cents : DEFAULT_AGENT_MONTHLY_CENTS[agent]
}

type AugmentedSession = {
  activeOrganization?: { id?: string } | null
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const augmented = session as (AugmentedSession & typeof session) | null
  const organizationId = activeOrg?.id ?? augmented?.activeOrganization?.id
  const { data: billing, refetch, isPending } = useBillingStatus(organizationId)
  const sub = billing?.subscription

  const [portaling, setPortaling] = useState(false)
  const [syncingCheckout, setSyncingCheckout] = useState(false)

  useEffect(() => {
    if (searchParams.get("status") !== "success") return
    void refetch().then(() => {
      setSyncingCheckout(true)
      toast.info("Payment complete", { description: "Syncing your agent access..." })
      router.replace("/settings/billing")
    })
  }, [searchParams, refetch, router])

  useEffect(() => {
    if (!syncingCheckout) return
    const interval = window.setInterval(() => {
      void refetch().then((result) => {
        if (!result.data?.subscription?.pendingCheckout) {
          setSyncingCheckout(false)
          toast.success("Billing updated", { description: "Your agent access is ready." })
        }
      })
    }, 2000)
    return () => window.clearInterval(interval)
  }, [syncingCheckout, refetch])

  async function handlePortal() {
    setPortaling(true)
    try {
      const res = await openBillingPortal()
      if (res.url) window.location.href = res.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal")
    } finally {
      setPortaling(false)
    }
  }

  const entitlements = useMemo(() => sub?.entitlements ?? [], [sub?.entitlements])
  const ownedAgents = useMemo(() => new Set(entitlements.map((e) => e.agent)), [entitlements])
  // A CREW row exists for every agent while Crew is active (even mid-cancel,
  // until period end), so this is the same signal the server uses for
  // crew-covers-all-agents — the individual buy UI must not be offered.
  const crewActive = entitlements.some((e) => e.source === "CREW")
  const unownedAgents = ALL_AGENTS.filter((agent) => !ownedAgents.has(agent))
  // Data hasn't arrived yet: don't flash "buy all six" for a paying customer
  // while their real entitlements are still loading.
  const dataReady = Boolean(organizationId) && !isPending

  const canManageBilling = sub?.status === "ACTIVE" || sub?.status === "CANCELLED" || sub?.status === "PAST_DUE"

  const statusLabel =
    !sub ? "No subscription"
    : sub.status === "TRIALING" ? `Trial · ${sub.daysRemaining ?? 0} days left`
    : sub.status === "ACTIVE" ? (sub.entitlementMode === "CREW" ? "Crew plan" : "Individual agents")
    : sub.status === "PAST_DUE" ? "Payment failed"
    : sub.status === "CANCELLED" ? "Cancelled"
    : "Expired"

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Each agent bills on its own — buy, cancel, or resume independently."
        sticker={{ label: "agent billing", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold">Current access</CardTitle>
              <CardDescription>
                {sub ? "Manage each agent's billing below." : "You haven't purchased any agents yet."}
              </CardDescription>
            </div>
            <Badge variant={sub?.status === "ACTIVE" ? "default" : "secondary"}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        {(sub?.pendingCheckout || canManageBilling) && (
          <CardContent className="flex flex-col gap-4">
            {sub?.pendingCheckout && (
              <Badge variant="secondary" className="w-fit">
                Checkout syncing
              </Badge>
            )}
            {canManageBilling && (
              <>
                <Separator />
                <Button variant="outline" className="self-start" onClick={handlePortal} disabled={portaling}>
                  <CreditCard className="size-3.5" />
                  {portaling ? "Opening..." : "View invoices"}
                </Button>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {dataReady && <CrewUpgradeCard organizationId={organizationId} />}

      {!dataReady ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading your agents...</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your agents</CardTitle>
              <CardDescription>Each row is its own subscription with its own renewal date.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {entitlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents yet — buy one below to get started.</p>
              ) : (
                entitlements.map((entitlement) => (
                  // Overlapping rows for the same agent are legal (e.g. an
                  // AGENT row and a CREW row both covering MAYA mid-upgrade —
                  // see entitlement.service.ts), so `agent` alone isn't a
                  // unique key.
                  <AgentEntitlementRow
                    key={`${entitlement.agent}-${entitlement.source}-${entitlement.currentPeriodEnd}`}
                    entitlement={entitlement}
                    onChanged={() => void refetch()}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Crew already covers every agent — offering per-agent purchase on
              top of it would just hit crew-covers-all-agents on the server. */}
          {!crewActive && unownedAgents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add agents</CardTitle>
                <CardDescription>Each purchase is its own checkout — no bundling required.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {unownedAgents.map((agent) => (
                  <AgentBuyCard
                    key={agent}
                    agent={agent}
                    priceCents={getMonthlyPrice(agent)}
                    onResumed={() => void refetch()}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
