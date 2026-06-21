"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Newspaper, RefreshCw } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { useDashboardSummary, ALL_SLUGS, type Range } from "@/lib/api/dashboard"
import { CrewLeaderboard } from "@/components/dashboard/CrewLeaderboard"
import { ContentPipeline } from "@/components/dashboard/ContentPipeline"
import { IntegrationHealth } from "@/components/dashboard/IntegrationHealth"
import { BrandSnapshot } from "@/components/dashboard/BrandSnapshot"
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

      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border-[3px] border-foreground bg-card p-4 shadow-[6px_6px_0_var(--destructive)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-widest text-destructive">
              dashboard data unavailable
            </div>
            <p className="m-0 mt-1 font-body text-sm leading-snug text-muted-foreground">
              We could not refresh your dashboard summary. Your workspace is still available.
            </p>
          </div>
          <Button
            type="button"
            variant="brand-dark"
            size="brand-sm"
            onClick={() => refetch()}
            className="self-start sm:self-auto"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}


      {showSkeletons ? (
        <div className="h-[72px] rounded-md border-[3px] border-foreground bg-[#D5CCBA] shadow-[5px_5px_0_var(--vq-green)] animate-pulse" />
      ) : (
        <div className="relative">
          <Link
            href="/workspace/briefing"
            className="flex items-center gap-3.5 rounded-md border-[3px] border-foreground bg-card p-4 px-5 no-underline shadow-[5px_5px_0_var(--vq-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:flex-col max-sm:items-start"
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-md border-[2.5px] border-foreground bg-foreground text-primary-foreground"
              style={{ transform: "rotate(-4deg)" }}
            >
              <Newspaper className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-head text-[15px] tracking-tight text-foreground">
                Today&apos;s briefing
              </div>
              <p className="m-0 mt-0.5 line-clamp-2 font-body text-[13px] leading-snug text-muted-foreground max-sm:line-clamp-none">
                {metrics && metrics.messagesWeek > 0
                  ? [
                      `Your crew handled ${metrics.messagesWeek} conversation${metrics.messagesWeek !== 1 ? "s" : ""} this week`,
                      metrics.contentPublishedWeek > 0
                        ? ` and published ${metrics.contentPublishedWeek} post${metrics.contentPublishedWeek !== 1 ? "s" : ""}`
                        : "",
                      ". Open to see emails, calendar and agent activity ->",
                    ].join("")
                  : "No agent activity yet this week. Generate a briefing to see your inbox and calendar summary."}
              </p>
            </div>
            <Button variant="brand-dark" size="brand-sm">
              {"Read ->"}
            </Button>
          </Link>
        </div>
      )}

      <section className="flex flex-col gap-3">
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
          <IntegrationHealth />
          <BrandSnapshot />
        </div>
      </div>

      {showSkeletons ? <ContentPipelineSkeleton /> : <ContentPipeline data={pipeline} />}

    </div>
  )
}
