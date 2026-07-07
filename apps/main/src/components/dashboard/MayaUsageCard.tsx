"use client"

import Link from "next/link"
import { ImageIcon, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useMayaUsage } from "@/lib/api/billing"
import { ApiError } from "@/lib/api/client"
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
  const { data, isPending, error } = useMayaUsage(organizationId)

  if (isPending) {
    return <MayaUsageCardSkeleton />
  }

  const isNoSubscription = error instanceof ApiError && error.message === "no-subscription"

  if (!data || isNoSubscription) {
    return (
      <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
        <ShellHeader />
        <div className="px-3.5 py-4 bg-white border-2 border-dashed border-foreground rounded-xl font-body text-[13px] text-foreground flex flex-col gap-3 items-start">
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

  const remaining = daysLeftInPeriod(data.periodEnd)
  const atLimit = data.images.remaining === 0 || data.videoSeconds.remaining === 0
  const imagesNear = data.images.limit > 0 && data.images.used / data.images.limit >= 0.8
  const videoNear =
    data.videoSeconds.limit > 0 && data.videoSeconds.used / data.videoSeconds.limit >= 0.8
  const nearLimit = !atLimit && (imagesNear || videoNear)

  return (
    <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
      <ShellHeader />

      <div className="flex flex-col gap-4">
        <UsageBar label="Images" icon={ImageIcon} resource={data.images} />
        <UsageBar label="Video" icon={Video} resource={data.videoSeconds} unit="sec" />

        <div className="flex items-center justify-between gap-2 pt-3.5 border-t-2 border-foreground/10">
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
