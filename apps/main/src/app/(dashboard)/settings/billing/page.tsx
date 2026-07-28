"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
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
import { AgentBuyCard } from "@/components/billing/AgentBuyCard"
import { BillingAgent, dismissPendingCheckout, openBillingPortal, useBillingCatalog, useBillingStatus } from "@/lib/api/billing"
import { qk } from "@/lib/query-keys"

const ALL_AGENTS: BillingAgent[] = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"]

// Fallback only, for the brief window before /billing/catalog resolves — the
// real prices always come from the server (single source of truth, shared
// with apps/landing) so this can never drift from what's actually charged.
const DEFAULT_AGENT_MONTHLY_CENTS: Record<BillingAgent, number> = {
  MAYA: 1900,
  SAGE: 900,
  LEX: 900,
  REX: 900,
  SCOUT: 900,
  VEGA: 900,
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
  const { data: catalog } = useBillingCatalog()
  const { data: activeMemberRole, isPending: isRolePending } = authClient.useActiveMemberRole()
  const queryClient = useQueryClient()
  const sub = billing?.subscription

  // useMayaUsage rides its own query key (qk.mayaUsage), separate from
  // useBillingStatus's — a buy/resume here changes entitlements but never
  // auto-refreshes the Usage page's/Maya credits pill's own query, so it
  // must be invalidated explicitly alongside the billing-status refetch.
  function onEntitlementsChanged() {
    void refetch()
    if (organizationId) void queryClient.invalidateQueries({ queryKey: qk.mayaUsage(organizationId) })
  }
  // Server-side, every mutating billing route (checkout, portal) is
  // owner-gated via requireOrgOwner — a non-owner hitting them gets a 403.
  // Disabling proactively here is better UX than letting them click through
  // to a failed request. Default true while the role is still loading so
  // buttons don't flash disabled-then-enabled for the common owner case.
  const isOwner = isRolePending || activeMemberRole?.role === "owner"

  function getMonthlyPrice(agent: BillingAgent): number {
    return catalog?.agents[agent]?.priceCents ?? DEFAULT_AGENT_MONTHLY_CENTS[agent]
  }

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
    if (searchParams.get("status") !== "cancelled") return
    toast.info("Checkout cancelled", { description: "No charge was made." })
    router.replace("/settings/billing")
  }, [searchParams, router])

  useEffect(() => {
    if (!syncingCheckout) return
    // Caps the poll at ~30s (15 attempts * 2s) rather than spinning forever
    // if a webhook is lost or delayed — surfaces a "still syncing" state
    // instead of an endless silent loop.
    let attempts = 0
    const interval = window.setInterval(() => {
      attempts += 1
      void refetch().then((result) => {
        if (!result.data?.subscription?.pendingCheckout) {
          setSyncingCheckout(false)
          toast.success("Billing updated", { description: "Your agent access is ready." })
          // A fresh purchase can raise the credit tier — the Usage page /
          // credits pill's own query must not keep showing the pre-purchase
          // limit until its own staleTime happens to lapse.
          if (organizationId) void queryClient.invalidateQueries({ queryKey: qk.mayaUsage(organizationId) })
        } else if (attempts >= 15) {
          setSyncingCheckout(false)
          toast.warning("Still syncing", {
            description: "This is taking longer than usual — refresh the page or contact support if it doesn't update soon.",
          })
        }
      })
    }, 2000)
    return () => window.clearInterval(interval)
  }, [syncingCheckout, refetch, organizationId, queryClient])

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

  const [dismissing, setDismissing] = useState(false)
  // Only offered once a pending checkout has clearly stopped being "in
  // progress" — a real purchase resolves within seconds of a webhook
  // arriving, so anything older than this is genuinely stuck (lost webhook,
  // abandoned checkout) rather than mid-flight.
  const PENDING_CHECKOUT_STUCK_MS = 10 * 60 * 1000
  const pendingCheckoutAgeMs = sub?.pendingCheckout
    ? Date.now() - new Date(sub.pendingCheckout.createdAt).getTime()
    : 0
  const pendingCheckoutStuck = pendingCheckoutAgeMs > PENDING_CHECKOUT_STUCK_MS

  async function handleDismissPendingCheckout() {
    setDismissing(true)
    try {
      await dismissPendingCheckout()
      await refetch()
      toast.success("Cleared", { description: "You can start a new checkout any time." })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear this checkout")
    } finally {
      setDismissing(false)
    }
  }

  const entitlements = useMemo(() => sub?.entitlements ?? [], [sub?.entitlements])
  // TRIAL doesn't count as "owned" for Buy-card purposes — the backend
  // already allows converting a trialing agent to paid early
  // (assertAgentPurchasable explicitly permits this), so treating a TRIAL
  // row as ownership hid every per-agent Buy card for an org's entire 7-day
  // trial, even though buying one mid-trial is a real, working flow.
  //
  // A cancelAtPeriodEnd AGENT row also doesn't count as "owned" — cancel and
  // resume are portal-only now (AgentEntitlementRow no longer renders a
  // resume button), so if this row stayed "owned" a cancelled-but-unexpired
  // agent would have no in-app way back to auto-pay: no resume button (gone)
  // and no Buy card (excluded). Re-showing the Buy card here is safe: the
  // server's createCheckoutForOrg detects a cancelAtPeriodEnd row for the
  // same agent and resumes auto-pay instead of charging again
  // (`{ resumed: true, url: null }`), so "buying" a cancelled agent again
  // never double-charges.
  const ownedAgents = useMemo(
    () =>
      new Set(
        entitlements
          .filter((e) => e.source !== "TRIAL" && !e.cancelAtPeriodEnd)
          .map((e) => e.agent),
      ),
    [entitlements],
  )
  const unownedAgents = ALL_AGENTS.filter((agent) => !ownedAgents.has(agent))
  // Derived from the response body's per-entitlement `status`, not the
  // X-Billing-State header — that header is set by the single-agent
  // entitlement middleware (per request, for whichever one agent is being
  // checked), so it can only ever say "this one agent is past due." This
  // page needs to list every past-due agent at once, and the per-entitlement
  // status in the /billing/status body is the only source that can answer
  // that for a multi-agent list.
  const pastDueAgents = entitlements.filter((e) => e.status === "PAST_DUE")
  // Data hasn't arrived yet: don't flash "buy all six" for a paying customer
  // while their real entitlements are still loading.
  const dataReady = Boolean(organizationId) && !isPending

  // sub.status is the legacy Subscription.status column — it can never be
  // "TRIALING" any more (trial state lives on Entitlement rows now, see
  // deriveStatusFields's doc comment in billing.controller.ts), so a fresh
  // trial org's Subscription row sits at its ensureBillingCustomerForOrg
  // default of "EXPIRED" forever and never changes. Everything below derives
  // from entitlements instead.
  const isTrialing = entitlements.some((e) => e.source === "TRIAL")
  const agentCount = ownedAgents.size

  // A Dodo customer (and therefore something for the portal to show) exists
  // from the very first trial-start or checkout — a real, permanent signal,
  // unlike the dead status column this used to read.
  const canManageBilling = Boolean(sub?.dodoCustomerId)

  // "No active plan" is a real, reachable state (not just theoretical): the
  // trial is once-per-org-forever, so an org can sit here indefinitely after
  // it lapses without ever buying anything.
  const statusLabel =
    !sub ? "No subscription"
    : isTrialing ? `Trial · ${sub.daysRemaining ?? 0} days left`
    : agentCount > 0 ? `${agentCount} agent${agentCount === 1 ? "" : "s"} active`
    : "No active plan"

  const hasActiveAccess = isTrialing || agentCount > 0

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Each agent bills on its own — buy here, manage cancellation and payment through the billing portal."
        sticker={{ label: "agent billing", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      {pastDueAgents.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Payment failed for {pastDueAgents.map((e) => e.agent.toLowerCase()).join(", ")}. You still have access
          through the paid-for period — update your payment method via &quot;Manage billing&quot; below to keep it renewing.
        </div>
      )}

      <Card variant="brand">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold">Current access</CardTitle>
              <CardDescription>
                {sub ? "Each agent below is its own subscription." : "You haven't purchased any agents yet."}
              </CardDescription>
            </div>
            <Badge variant={hasActiveAccess ? "default" : "secondary"}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        {(sub?.pendingCheckout || canManageBilling) && (
          <CardContent className="flex flex-col gap-4">
            {sub?.pendingCheckout && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-fit">
                    Checkout syncing
                  </Badge>
                  {/* Not gated on syncStalled alone — a pendingCheckout row can
                      also be stale on a completely fresh page load (no active
                      polling session ever started), which previously left this
                      badge permanently stuck with no way to manually recheck. */}
                  {!syncingCheckout && (
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                      Check again
                    </Button>
                  )}
                  {pendingCheckoutStuck && (
                    <Button size="sm" variant="outline" onClick={handleDismissPendingCheckout} disabled={dismissing}>
                      {dismissing ? "Clearing..." : "Not you? Dismiss"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingCheckoutStuck
                    ? "This checkout has been syncing for a while — if you didn't complete it, dismiss it and start again."
                    : "We're waiting for payment confirmation — this usually takes a few seconds."}
                </p>
              </div>
            )}
            {canManageBilling && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <CreditCard className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Manage billing</p>
                      <p className="text-xs text-muted-foreground">
                        View invoices, update your payment method, or cancel any agent — all through Dodo&apos;s secure billing portal.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handlePortal} disabled={portaling}>
                    {portaling ? "Opening..." : "Manage billing"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {!dataReady ? (
        <Card variant="brand">
          <CardContent className="py-6 text-sm text-muted-foreground">Loading your agents...</CardContent>
        </Card>
      ) : (
        <>
          <Card variant="brand">
            <CardHeader>
              <CardTitle className="text-base">Your agents</CardTitle>
              <CardDescription>Each row is its own subscription with its own renewal date.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {entitlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents yet — buy one below to get started.</p>
              ) : (
                entitlements.map((entitlement) => (
                  // Overlapping rows for the same agent are legal (e.g. a
                  // TRIAL row and an AGENT row both covering the same agent
                  // mid-conversion), so `agent` alone isn't a unique key.
                  <AgentEntitlementRow
                    key={`${entitlement.agent}-${entitlement.source}-${entitlement.currentPeriodEnd}`}
                    entitlement={entitlement}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {unownedAgents.length > 0 && (
            <Card variant="brand">
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
                    onResumed={onEntitlementsChanged}
                    disabled={!isOwner}
                    disabledReason="Only the organization owner can manage billing"
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
