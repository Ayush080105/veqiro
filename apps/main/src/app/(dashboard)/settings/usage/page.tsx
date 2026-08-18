"use client"

import Link from "next/link"
import { authClient, useSession } from "@/lib/auth-client"
import { useBillingStatus, useMayaUsage, type MayaUsageTier } from "@/lib/api/billing"
import { isNoMayaSubscription } from "@/components/billing/entitlement-errors"
import { PageHeader } from "@/components/ui/page-header"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UsageBar } from "@/components/billing/UsageBar"
import { AgentPeriodList } from "@/components/billing/AgentPeriodList"
import { MayaTopUpButton } from "@/components/agents/maya/topup-dialog"
import { Info, Sparkles } from "lucide-react"
import { ValueReportCard } from "@/components/dashboard/ValueReportCard"

type AugmentedSession = {
  activeOrganization?: { id?: string } | null
}

// These two values are what the server sends (see maya.usage.service.ts's
// `displayTierFor`) — a display-only mapping of Maya's governing
// entitlement's source, kept for this badge. The underlying quota is read
// live from the entitlement (getQuotaForMayaEntitlement), never from this tier.
const TIER_LABELS: Record<MayaUsageTier, string> = {
  TRIAL:          "7-day trial",
  MONTHLY_CUSTOM: "Monthly · Maya",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

export default function UsagePage() {
  const { data: session } = useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const augmented = session as (AugmentedSession & typeof session) | null
  const organizationId = activeOrg?.id ?? augmented?.activeOrganization?.id

  const { data, isLoading, error, refetch } = useMayaUsage(organizationId)
  const { data: billing } = useBillingStatus(organizationId)
  const sub = billing?.subscription
  const atLimit = data && data.credits.remaining === 0
  const isNoSubscription = isNoMayaSubscription(error)

  // With staggered per-agent periods there is no single org-wide billing
  // cycle any more (see billing.controller.ts's deriveStatusFields, which
  // takes the MAX currentPeriodEnd across every entitlement — that can be a
  // *different* agent's renewal date, not Maya's). This card is Maya's
  // credits, so scope both the label and the date to Maya's own entitlement.
  const mayaEntitlement = sub?.entitlements.find((e) => e.agent === "MAYA")

  const billingCycleLabel =
    !mayaEntitlement ? null
    : mayaEntitlement.status === "TRIALING" ? `Trial · ${daysUntil(mayaEntitlement.currentPeriodEnd)} days left`
    : mayaEntitlement.status === "PAST_DUE" ? "Payment failed"
    : "Monthly · Maya"

  const billingCycleDate = mayaEntitlement?.currentPeriodEnd ?? null

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="usage"
        subtitle="Maya image and video generation for the current billing period."
        sticker={{ label: "maya limits", rot: 4, color: "var(--vq-green)" }}
      />

      <SettingsNav />

      {/* Cross-system work leads this page: it is the record a customer checks
          at renewal. Plan consumption (below) answers a different question —
          how much of what you bought is left — and is deliberately secondary. */}
      <ValueReportCard />

      {isLoading && (
        <Card variant="brand">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading usage data…
          </CardContent>
        </Card>
      )}

      {!isLoading && isNoSubscription && (
        <Card variant="brand">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active usage period. Start your trial or subscribe to see your limits.
          </CardContent>
        </Card>
      )}

      {!isLoading && error && !isNoSubscription && (
        <Card variant="brand">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <p>We couldn&apos;t load your usage. Please try again.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && !data && (
        <Card variant="brand">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active usage period. Start your trial or subscribe to see your limits.
          </CardContent>
        </Card>
      )}

      {data && !error && (
        <Card variant="brand">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Maya · Current period</CardTitle>
                <CardDescription>
                  {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
                </CardDescription>
                {billingCycleLabel && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {billingCycleLabel}
                    {billingCycleDate && (
                      <>
                        {" · "}
                        {mayaEntitlement?.cancelAtPeriodEnd
                          ? "Access until"
                          : mayaEntitlement?.status === "TRIALING"
                            ? "Ends"
                            : "Renews"}{" "}
                        {formatDate(billingCycleDate)}
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant="secondary">{TIER_LABELS[data.tier]}</Badge>
                {organizationId && <MayaTopUpButton organizationId={organizationId} />}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <UsageBar
              label="Credits used"
              icon={Sparkles}
              resource={data.credits}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" />
              1 image = 2 credits · 1 second of video = 4 credits
            </p>

            {atLimit && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You have reached your {data.tier === "TRIAL" ? "trial" : "plan"} limit.{" "}
                <Link href="/settings/billing" className="font-semibold underline underline-offset-2">
                  Upgrade your plan
                </Link>{" "}
                to generate more.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {organizationId && <AgentPeriodList organizationId={organizationId} />}
    </div>
  )
}
