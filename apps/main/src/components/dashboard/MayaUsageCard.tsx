"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useMayaUsage } from "@/lib/api/billing"
import { isNoMayaSubscription } from "@/components/billing/entitlement-errors"
import { UsageBar } from "@/components/billing/UsageBar"
import { MayaUsageCardSkeleton } from "@/components/dashboard/MayaUsageCardSkeleton"

const DAY_MS = 24 * 60 * 60 * 1000

function ShellHeader() {
  return (
    <>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ maya - at a glance ]
      </div>
      <div className="font-display text-[26px] tracking-tight text-foreground mt-0.5 mb-3">
        credits
      </div>
    </>
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

  if (isPending) {
    return <MayaUsageCardSkeleton />
  }

  const isNoSubscription = isNoMayaSubscription(error)

  if (isNoSubscription || (!error && !data)) {
    return (
      <div className="flex flex-1 flex-col bg-card border border-[var(--vq-line-2)] rounded-2xl shadow-[var(--vq-shadow)] p-5">
        <ShellHeader />
        <div className="px-3.5 py-4 bg-white border border-dashed border-[var(--vq-line-2)] rounded-xl font-body text-[13px] text-foreground flex flex-col gap-3 items-start">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
            {"// no active usage period"}
          </span>
          <span>
            Start your trial or subscribe to see Maya&apos;s image and video limits.
          </span>
          <Button asChild variant="brand-dark" size="brand-sm">
            <Link href="/settings/billing">view plans -&gt;</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col bg-card border border-[var(--vq-line-2)] rounded-2xl shadow-[var(--vq-shadow)] p-5">
        <ShellHeader />
        <div className="px-3.5 py-4 bg-white border border-dashed border-[var(--vq-line-2)] rounded-xl font-body text-[13px] text-foreground flex flex-col gap-3 items-start">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
            {"// couldn't load usage"}
          </span>
          <span>We couldn&apos;t load Maya&apos;s usage right now.</span>
          <Button variant="brand-dark" size="brand-sm" onClick={() => refetch()}>
            retry
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const remaining = daysLeftInPeriod(data.periodEnd)
  const atLimit = data.credits.remaining === 0
  const nearLimit = !atLimit && data.credits.limit > 0 && data.credits.used / data.credits.limit >= 0.8

  return (
    <div className="flex flex-1 flex-col bg-card border border-[var(--vq-line-2)] rounded-2xl shadow-[var(--vq-shadow)] p-5">
      <ShellHeader />

      <div className="flex flex-1 flex-col gap-4">
        <UsageBar label="Credits" icon={Sparkles} resource={data.credits} />
        <div className="flex flex-col gap-0.5 font-mono text-[10px] tracking-[0.02em] text-muted-foreground">
          <span>Image: 2 credits/image</span>
          <span>Video: 4 credits/second</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3.5 border-t border-foreground/10">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {remaining} day{remaining === 1 ? "" : "s"} left in period
          </span>
          {(atLimit || nearLimit) && (
            <Button asChild variant="brand-ghost" size="brand-sm">
              <Link href="/settings/billing">upgrade →</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
