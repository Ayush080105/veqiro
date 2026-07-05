"use client"

import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import { useMayaUsage, type MayaUsageTier, type UsageResource } from "@/lib/api/billing"
import { PageHeader } from "@/components/ui/page-header"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

function UsageBar({
  label,
  icon: Icon,
  resource,
  unit,
}: {
  label: string
  icon: typeof ImageIcon
  resource: UsageResource
  unit?: string
}) {
  const pct = resource.limit === 0 ? 0 : Math.min(100, Math.round((resource.used / resource.limit) * 100))
  const isNearLimit = pct >= 80
  const isExhausted = resource.remaining === 0

  let barColor = "var(--primary)"
  if (isExhausted) barColor = "var(--destructive)"
  else if (isNearLimit) barColor = "#f59e0b"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {resource.used}{unit ? ` ${unit}` : ""} / {resource.limit}{unit ? ` ${unit}` : ""}
          {isExhausted && (
            <Badge variant="destructive" className="ml-2 text-[10px]">Exhausted</Badge>
          )}
          {!isExhausted && isNearLimit && (
            <Badge variant="secondary" className="ml-2 text-[10px]">Running low</Badge>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {resource.remaining}{unit ? ` ${unit}` : ""} remaining this period
      </p>
    </div>
  )
}

export default function UsagePage() {
  const { data: session } = useSession()
  const augmented = session as (AugmentedSession & typeof session) | null
  const organizationId = augmented?.activeOrganization?.id

  const { data, isLoading } = useMayaUsage(organizationId)
  const atLimit = data && (data.images.remaining === 0 || data.videoSeconds.remaining === 0)

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

      {!isLoading && !data && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active usage period. Start your trial or subscribe to see your limits.
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Maya · Current period</CardTitle>
                <CardDescription>
                  {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
                </CardDescription>
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
