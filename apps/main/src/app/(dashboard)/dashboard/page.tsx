"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Bot, AlertTriangle } from "lucide-react"

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

// Recharts is ~100KB. Defer it until the dashboard actually renders so it
// doesn't block initial bundle parse — the skeleton fills the same spot in
// the meantime so layout doesn't shift.
const ActivityChart = dynamic(
  () =>
    import("@/components/dashboard/ActivityChart").then((m) => ({
      default: m.ActivityChart,
    })),
  { loading: () => <ActivityChartSkeleton />, ssr: false },
)
import { Button } from "@/components/ui/button"
import { KpiTile } from "@/components/ui/kpi-tile"
import { PageHeader } from "@/components/ui/page-header"
import { Sticker } from "@/components/ui/sticker"
import type { AgentSlug } from "@/lib/types"

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
  const { data: summary, isPending, isFetching } = useDashboardSummary({ range, agents })
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
  const attention = summary?.attention ?? []

  return (
    <div className="flex flex-col gap-8 pb-10">
      <DashboardProgressBar active={showProgressBar} />

      {/* Hero */}
      <PageHeader
        kicker={formatDate(today)}
        title={`${getGreeting().toLowerCase()}, ${name.toLowerCase()}.`}
        subtitle="Here's what your team is working on."
        sticker={<Sticker rotate={6} tone="yellow">your day</Sticker>}
        right={
          <DashboardFilters
            range={range}
            agents={agents}
            onRangeChange={setRange}
            onAgentsChange={setAgents}
          />
        }
      />

      {/* Needs attention banner (conditional) */}
      {attention.length > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-md border-[3px] border-foreground bg-foreground p-4 text-primary-foreground shadow-[6px_6px_0_var(--destructive)]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-5 text-accent" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
              needs attention
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attention.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className={`rounded-full border-2 border-background px-3 py-1.5 font-mono text-xs text-foreground no-underline ${
                  a.severity === "critical" ? "bg-destructive" : "bg-accent"
                }`}
              >
                {a.message}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Metrics strip */}
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
                value={metrics ? formatNumber(metrics.messagesWeek) : "—"}
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
                value={metrics ? formatNumber(metrics.contentPublishedWeek) : "—"}
                delta={
                  metrics
                    ? {
                        value: formatDelta(
                          metrics.contentPublishedWeek,
                          metrics.contentPublishedPrevWeek
                        ),
                        trend: trendFromDelta(
                          metrics.contentPublishedWeek,
                          metrics.contentPublishedPrevWeek
                        ),
                      }
                    : undefined
                }
              />
              <KpiTile
                shape="brand"
                label="Hours saved · est."
                value={metrics ? `${metrics.hoursSavedEstimate}h` : "—"}
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

      {/* Activity chart */}
      {showSkeletons ? <ActivityChartSkeleton /> : <ActivityChart data={activity} />}

      {/* Crew leaderboard + workspace snapshot */}
      <div className="grid gap-4 [grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)]">
        {showSkeletons ? <CrewLeaderboardSkeleton /> : <CrewLeaderboard data={leaderboard} />}
        <div className="flex min-w-0 flex-col gap-4">
          <IntegrationHealth />
          <BrandSnapshot />
        </div>
      </div>

      {/* Content pipeline */}
      {showSkeletons ? <ContentPipelineSkeleton /> : <ContentPipeline data={pipeline} />}

      {/* Daily briefing — compact footer */}
      <Link
        href="/workspace/briefing"
        className="relative flex items-center gap-3.5 rounded-md border-[3px] border-foreground bg-card p-4 px-5 no-underline shadow-[5px_5px_0_var(--vq-green)]"
      >
        <div className="absolute -top-4 left-5">
          <Sticker rotate={-4} tone="green">
            daily brief
          </Sticker>
        </div>
        <span
          className="grid size-10 shrink-0 place-items-center rounded-md border-[2.5px] border-foreground bg-foreground text-primary-foreground"
          style={{ transform: "rotate(-4deg)" }}
        >
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-head text-[15px] tracking-tight text-foreground">
            Today&apos;s briefing
          </div>
          <p className="m-0 mt-0.5 line-clamp-2 font-body text-[13px] leading-snug text-muted-foreground">
            {metrics && metrics.messagesWeek > 0
              ? `Your crew handled ${metrics.messagesWeek} conversations and published ${metrics.contentPublishedWeek} posts this week. Read Vega's full rundown →`
              : "Your crew hasn't clocked in yet this week. Vega will write up a briefing once there's activity."}
          </p>
        </div>
        <Button variant="brand-dark" size="brand-sm">Read →</Button>
      </Link>
    </div>
  )
}
