"use client"

import { useState } from "react"
import Link from "next/link"
import { Bot, AlertTriangle } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { useDashboardSummary, ALL_SLUGS, type Range } from "@/lib/api/dashboard"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { ActivityChart } from "@/components/dashboard/ActivityChart"
import { CrewLeaderboard } from "@/components/dashboard/CrewLeaderboard"
import { ContentPipeline } from "@/components/dashboard/ContentPipeline"
import { IntegrationHealth } from "@/components/dashboard/IntegrationHealth"
import { BrandSnapshot } from "@/components/dashboard/BrandSnapshot"
import { Button as VqButton, FONT, Sticker } from "@/components/veqiro/shared"
import { DashboardFilters } from "@/components/dashboard/DashboardFilters"
import { DashboardProgressBar } from "@/components/dashboard/DashboardProgressBar"
import { MetricCardSkeleton } from "@/components/dashboard/MetricCardSkeleton"
import { ActivityChartSkeleton } from "@/components/dashboard/ActivityChartSkeleton"
import { CrewLeaderboardSkeleton } from "@/components/dashboard/CrewLeaderboardSkeleton"
import { ContentPipelineSkeleton } from "@/components/dashboard/ContentPipelineSkeleton"
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

const sectionLabel: React.CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: 3,
  textTransform: "uppercase",
  color: "#555",
}

function trendFromDelta(current: number, prev: number): "up" | "down" | "neutral" {
  if (current > prev) return "up"
  if (current < prev) return "down"
  return "neutral"
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
    <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40 }}>
      <DashboardProgressBar active={showProgressBar} />

      {/* Hero + inline filters */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "absolute", top: -10, right: 10 }}>
          <Sticker rot={6} color="#F5C518">
            your day
          </Sticker>
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ ...sectionLabel, marginBottom: 8 }}>[ {formatDate(today)} ]</div>
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(44px, 5vw, 68px)",
              lineHeight: 0.95,
              letterSpacing: -1,
              color: "#111",
              margin: 0,
            }}
          >
            {getGreeting().toLowerCase()}, {name.toLowerCase()}.
          </h1>
          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 16,
              color: "#333",
              margin: "10px 0 0",
            }}
          >
            Here&apos;s what your team is working on.
          </p>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <DashboardFilters
            range={range}
            agents={agents}
            onRangeChange={setRange}
            onAgentsChange={setAgents}
          />
        </div>
      </div>

      {/* Needs attention banner (conditional) */}
      {attention.length > 0 && (
        <div
          style={{
            background: "#111",
            color: "#EFE7D6",
            border: "3px solid #111",
            borderRadius: 14,
            boxShadow: "6px 6px 0 #F06464",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle className="size-5" style={{ color: "#F5C518" }} />
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#F5C518",
              }}
            >
              needs attention
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {attention.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  padding: "6px 12px",
                  background: a.severity === "critical" ? "#F06464" : "#F5C518",
                  color: "#111",
                  border: "2px solid #EFE7D6",
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                {a.message}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Metrics strip */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={sectionLabel}>[ at a glance ]</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {showSkeletons ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                label="Messages"
                value={metrics ? formatNumber(metrics.messagesWeek) : "—"}
                change={metrics ? formatDelta(metrics.messagesWeek, metrics.messagesPrevWeek) : undefined}
                trend={metrics ? trendFromDelta(metrics.messagesWeek, metrics.messagesPrevWeek) : undefined}
                sparkline={metrics?.messagesSparkline}
              />
              <MetricCard
                label="Posts published"
                value={metrics ? formatNumber(metrics.contentPublishedWeek) : "—"}
                change={
                  metrics
                    ? formatDelta(metrics.contentPublishedWeek, metrics.contentPublishedPrevWeek)
                    : undefined
                }
                trend={
                  metrics
                    ? trendFromDelta(metrics.contentPublishedWeek, metrics.contentPublishedPrevWeek)
                    : undefined
                }
              />
              <MetricCard
                label="Hours saved · est."
                value={metrics ? `${metrics.hoursSavedEstimate}h` : "—"}
                change={metrics && metrics.hoursSavedEstimate > 0 ? "this window" : undefined}
                trend={metrics && metrics.hoursSavedEstimate > 0 ? "up" : "neutral"}
              />
            </>
          )}
        </div>
      </div>

      {/* Activity chart */}
      {showSkeletons ? <ActivityChartSkeleton /> : <ActivityChart data={activity} />}

      {/* Crew leaderboard + workspace snapshot (integrations + brand) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        {showSkeletons ? <CrewLeaderboardSkeleton /> : <CrewLeaderboard data={leaderboard} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <IntegrationHealth />
          <BrandSnapshot />
        </div>
      </div>

      {/* Content pipeline */}
      {showSkeletons ? <ContentPipelineSkeleton /> : <ContentPipeline data={pipeline} />}

      {/* Daily briefing — compact footer */}
      <Link
        href="/workspace/briefing"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 14,
          boxShadow: "5px 5px 0 #1DBC87",
          padding: "16px 20px",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: -16, left: 18 }}>
          <Sticker rot={-4} color="#1DBC87">
            daily brief
          </Sticker>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#111",
            color: "#EFE7D6",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: "2.5px solid #111",
            transform: "rotate(-4deg)",
          }}
        >
          <Bot className="size-4" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.head,
              fontSize: 15,
              color: "#111",
              letterSpacing: -0.2,
            }}
          >
            Today&apos;s briefing
          </div>
          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 13,
              lineHeight: 1.45,
              color: "#555",
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {metrics && metrics.messagesWeek > 0
              ? `Your crew handled ${metrics.messagesWeek} conversations and published ${metrics.contentPublishedWeek} posts this week. Read Vega's full rundown →`
              : "Your crew hasn't clocked in yet this week. Vega will write up a briefing once there's activity."}
          </p>
        </div>
        <VqButton variant="dark">Read →</VqButton>
      </Link>
    </div>
  )
}
