"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { RefreshCw } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { useDashboardSummary, ALL_SLUGS, type Range } from "@/lib/api/dashboard"
import { CrewLeaderboard } from "@/components/dashboard/CrewLeaderboard"
import { ContentPipeline } from "@/components/dashboard/ContentPipeline"
import { IntegrationHealth } from "@/components/dashboard/IntegrationHealth"
import { CommandCenter } from "@/components/dashboard/CommandCenter"
import { BrandSnapshot } from "@/components/dashboard/BrandSnapshot"
import { MayaUsageCard } from "@/components/dashboard/MayaUsageCard"
import { DashboardFilters } from "@/components/dashboard/DashboardFilters"
import { DashboardProgressBar } from "@/components/dashboard/DashboardProgressBar"
import { MetricCardSkeleton } from "@/components/dashboard/MetricCardSkeleton"
import { ActivityChartSkeleton } from "@/components/dashboard/ActivityChartSkeleton"
import { CrewLeaderboardSkeleton } from "@/components/dashboard/CrewLeaderboardSkeleton"
import { ContentPipelineSkeleton } from "@/components/dashboard/ContentPipelineSkeleton"
import { Button } from "@/components/ui/button"
import { KpiTile } from "@/components/ui/kpi-tile"
import { PageHeader } from "@/components/ui/page-header"
import type { AgentSlug } from "@/lib/types"

// Recharts is sizeable. Defer it until the dashboard renders; the skeleton
// occupies the same region so the page does not jump.
const ActivityChart = dynamic(
  () =>
    import("@/components/dashboard/ActivityChart").then((m) => ({
      default: m.ActivityChart,
    })),
  { loading: () => <ActivityChartSkeleton />, ssr: false },
)

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function trendFromDelta(current: number, prev: number): "up" | "down" | "flat" {
  if (current > prev) return "up"
  if (current < prev) return "down"
  return "flat"
}

function formatDelta(current: number, prev: number): string {
  const diff = current - prev
  if (diff === 0) return "stable"
  const sign = diff > 0 ? "+" : ""
  if (prev === 0) return `${sign}${diff}`
  const pct = Math.round((diff / Math.max(1, prev)) * 100)
  return `${sign}${pct}%`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession()
  const [range, setRange] = useState<Range>({ kind: "7d" })
  const [agents, setAgents] = useState<AgentSlug[]>([...ALL_SLUGS])
  const {
    data: summary,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useDashboardSummary({ range, agents })
  const showSkeletons = isPending && !summary
  const showProgressBar = isFetching && !isPending
  const name = session?.user?.name?.split(" ")[0] ?? "there"
  const today = new Date()

  const metrics = summary?.metrics
  const activity = summary?.activityChart ?? []
  const leaderboard = summary?.leaderboard ?? []
  const pipeline = summary?.contentPipeline ?? {
    byPlatform: { twitter: 0, linkedin: 0, instagram: 0 },
    byStatus: { draft: 0, scheduled: 0, published: 0, failed: 0 },
  }
  return (
    <div className="flex min-w-0 flex-col gap-8 pb-10">
      <DashboardProgressBar active={showProgressBar} />

      <PageHeader
        kicker={formatDate(today)}
        title={`${getGreeting().toLowerCase()}, ${name.toLowerCase()}.`}
        subtitle="Here's what your team is working on."
        
        right={
          <DashboardFilters
            range={range}
            agents={agents}
            onRangeChange={setRange}
            onAgentsChange={setAgents}
          />
        }
      />

      {/* The customer's own business leads the page; Veqiro's activity metrics
          follow below it. Rendered outside the isError branch above because it
          has an entirely separate data source and must survive a failed
          dashboard-summary fetch. */}
      <CommandCenter />

      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="font-body text-sm font-medium text-destructive">
              Dashboard data unavailable
            </div>
            <p className="m-0 mt-1 font-body text-sm leading-snug text-muted-foreground">
              We could not refresh your dashboard summary. Your workspace is still available.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="self-start sm:self-auto"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}


      <section className="flex flex-col gap-3" data-tour="dashboard-metrics">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          [ at a glance ]
        </span>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {showSkeletons ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <KpiTile
                shape="brand"
                label="Messages"
                value={metrics ? formatNumber(metrics.messagesWeek) : "-"}
                sparkline={metrics?.messagesSparkline}
                delta={
                  metrics
                    ? {
                        value: formatDelta(metrics.messagesWeek, metrics.messagesPrevWeek),
                        trend: trendFromDelta(metrics.messagesWeek, metrics.messagesPrevWeek),
                      }
                    : undefined
                }
              />
              <KpiTile
                shape="brand"
                label="Posts published"
                value={metrics ? formatNumber(metrics.contentPublishedWeek) : "-"}
                delta={
                  metrics
                    ? {
                        value: formatDelta(
                          metrics.contentPublishedWeek,
                          metrics.contentPublishedPrevWeek,
                        ),
                        trend: trendFromDelta(
                          metrics.contentPublishedWeek,
                          metrics.contentPublishedPrevWeek,
                        ),
                      }
                    : undefined
                }
              />
              <KpiTile
                shape="brand"
                label="Hours saved - est."
                value={metrics ? `${metrics.hoursSavedEstimate}h` : "-"}
                delta={
                  metrics && metrics.hoursSavedEstimate > 0
                    ? { value: "this window", trend: "up" }
                    : undefined
                }
              />
            </>
          )}
        </div>
      </section>

      {showSkeletons ? <ActivityChartSkeleton /> : <ActivityChart data={activity} range={range} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {showSkeletons ? <CrewLeaderboardSkeleton /> : <CrewLeaderboard data={leaderboard} range={range} />}
        <div className="flex min-w-0 flex-col gap-4">
          <MayaUsageCard />
          <IntegrationHealth />
          <BrandSnapshot />
        </div>
      </div>

      {showSkeletons ? <ContentPipelineSkeleton /> : <ContentPipeline data={pipeline} />}

    </div>
  )
}
