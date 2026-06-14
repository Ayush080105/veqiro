"use client"

import Link from "next/link"
import { authClient, useSession } from "@/lib/auth-client"
import { useBillingStatus } from "@/lib/api/billing"

export function TrialBanner() {
  const { data: session } = useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const sessionActiveOrgId = (
    session as { activeOrganization?: { id?: string } | null } | null | undefined
  )?.activeOrganization?.id
  const { data: billing } = useBillingStatus(activeOrg?.id ?? sessionActiveOrgId)
  const sub = billing?.subscription

  if (!sub) return null
  if (sub.status !== "TRIALING") return null

  const days = sub.daysRemaining ?? 0

  return (
    <div className="ml-auto flex items-center gap-2.5 text-xs">
      <span className="text-muted-foreground hidden sm:inline">
        <strong className="text-foreground">{days}</strong> {days === 1 ? "day" : "days"} left
      </span>
      <Link
        href="/settings/billing"
        className="inline-flex items-center rounded-full bg-primary px-3 py-1 font-bold text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
      >
        Upgrade now →
      </Link>
    </div>
  )
}
