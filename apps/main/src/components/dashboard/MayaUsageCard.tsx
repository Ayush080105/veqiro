"use client"

import Link from "next/link"
import { AlertTriangle, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { authClient } from "@/lib/auth-client"
import { useMayaUsage } from "@/lib/api/billing"
import { isNoMayaSubscription } from "@/components/billing/entitlement-errors"
import { UsageBar } from "@/components/billing/UsageBar"
import { MayaUsageCardSkeleton } from "@/components/dashboard/MayaUsageCardSkeleton"

const DAY_MS = 24 * 60 * 60 * 1000

function ShellHeader() {
  return (
    <div className="mb-3">
      <div className="font-head text-2xl text-foreground">Credits</div>
      <p className="m-0 mt-1 text-xs text-muted-foreground">Maya image and video usage.</p>
    </div>
  )
}

function daysLeftInPeriod(periodEnd: string): number {
  const diffMs = new Date(periodEnd).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / DAY_MS))
}

export function MayaUsageCard() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data, isPending, error, refetch } = useMayaUsage(organizationId)

  if (isPending) return <MayaUsageCardSkeleton />

  const isNoSubscription = isNoMayaSubscription(error)

  if (isNoSubscription || (!error && !data)) {
    return (
      <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        <ShellHeader />
        <DashboardEmptyState
          icon={Sparkles}
          title="No active usage period"
          description="Start a trial or subscribe to see Maya image and video credits here."
          action={{ label: "View plans", href: "/settings/billing" }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        <ShellHeader />
        <DashboardEmptyState
          icon={AlertTriangle}
          title="Usage could not load"
          description="Maya credits are unchanged; refresh this card to try again."
          action={{ label: "Retry", onClick: () => void refetch() }}
          tone="danger"
        />
      </div>
    )
  }

  if (!data) return null

  const remaining = daysLeftInPeriod(data.periodEnd)
  const atLimit = data.credits.remaining === 0
  const nearLimit = !atLimit && data.credits.limit > 0 && data.credits.used / data.credits.limit >= 0.8

  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <ShellHeader />

      <div className="flex flex-col gap-4">
        <UsageBar label="Credits" icon={Sparkles} resource={data.credits} />
        <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          <span>Image: 2 credits/image</span>
          <span>Video: 4 credits/second</span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3.5">
          <span className="text-[11px] text-muted-foreground">
            {remaining} day{remaining === 1 ? "" : "s"} left in period
          </span>
          {(atLimit || nearLimit) && (
            <Button asChild variant="brand-ghost" size="brand-sm">
              <Link href="/settings/billing">Upgrade</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
