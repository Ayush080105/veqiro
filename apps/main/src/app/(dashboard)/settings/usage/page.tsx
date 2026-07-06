"use client"

import Link from "next/link"
import { authClient, useSession } from "@/lib/auth-client"
import { useBillingStatus, useMayaUsage, type MayaUsageTier } from "@/lib/api/billing"
import { ApiError } from "@/lib/api/client"
import { PageHeader } from "@/components/ui/page-header"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UsageBar } from "@/components/billing/UsageBar"
import { ImageIcon, Video } from "lucide-react"

type AugmentedSession = {
  activeOrganization?: { id?: string } | null
}

const TIER_LABELS: Record<MayaUsageTier, string> = {
  TRIAL:          "7-day trial",
  MONTHLY_CUSTOM: "Monthly · Maya",
  MONTHLY_CREW:   "Monthly · Crew",
  ANNUAL_CREW:    "Annual · Crew",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function UsagePage() {
  const { data: session } = useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const augmented = session as (AugmentedSession & typeof session) | null
  const organizationId = activeOrg?.id ?? augmented?.activeOrganization?.id

  const { data, isLoading, error, refetch } = useMayaUsage(organizationId)
  const { data: billing } = useBillingStatus(organizationId)
  const sub = billing?.subscription
  const atLimit = data && (data.images.remaining === 0 || data.videoSeconds.remaining === 0)
  const isNoSubscription = error instanceof ApiError && error.message === "no-subscription"

  const billingCycleLabel =
    !sub ? null
    : sub.status === "TRIALING" ? `Trial · ${sub.daysRemaining ?? 0} days left`
    : sub.status === "ACTIVE" ? (sub.plan === "ANNUAL" ? "Annual plan" : "Monthly plan")
    : sub.status === "PAST_DUE" ? "Payment failed"
    : sub.status === "CANCELLED" ? "Cancelled"
    : sub.status === "EXPIRED" ? "Expired"
    : null

  const billingCycleDate = sub?.status === "TRIALING" ? sub.trialEndsAt : sub?.currentPeriodEnd

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="usage"
        subtitle="Maya image and video generation for the current billing period."
        sticker={{ label: "maya limits", rot: 4, color: "var(--vq-green)" }}
      />

      <SettingsNav />

      {isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading usage data…
          </CardContent>
        </Card>
      )}

      {!isLoading && isNoSubscription && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active usage period. Start your trial or subscribe to see your limits.
          </CardContent>
        </Card>
      )}

      {!isLoading && error && !isNoSubscription && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <p>We couldn&apos;t load your usage. Please try again.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && !data && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active usage period. Start your trial or subscribe to see your limits.
          </CardContent>
        </Card>
      )}

      {data && !error && (
        <Card>
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
                      <> · {sub?.status === "TRIALING" ? "Ends" : "Renews"} {formatDate(billingCycleDate)}</>
                    )}
                  </p>
                )}
              </div>
              <Badge variant="secondary">{TIER_LABELS[data.tier]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <UsageBar
              label="Images generated"
              icon={ImageIcon}
              resource={data.images}
            />
            <UsageBar
              label="Video generated"
              icon={Video}
              resource={data.videoSeconds}
              unit="sec"
            />

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
    </div>
  )
}
