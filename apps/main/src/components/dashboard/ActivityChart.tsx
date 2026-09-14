"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { MessageSquare } from "lucide-react"

import type { DashboardSummary, Range } from "@/lib/api/dashboard"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { AGENT_PHOTOS, AGENTS } from "@/lib/config/agents"
import type { AgentSlug } from "@/lib/types"

const SLUGS: AgentSlug[] = ["vega", "lex", "sage", "scout", "rex", "maya"]
const AGENT_META = Object.fromEntries(
  AGENTS.map((agent) => [agent.id, { name: agent.name, initials: agent.initials }]),
) as Record<AgentSlug, { name: string; initials: string }>

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatHour(iso: string): string {
  const h = new Date(iso).getHours()
  if (h === 0) return "12 AM"
  if (h === 12) return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function rangeTitle(range: Range): string {
  switch (range.kind) {
    case "24h":    return "Crew activity today"
    case "7d":     return "Crew activity this week"
    case "30d":    return "Crew activity this month"
    case "custom": return "Crew activity in range"
  }
}

type ChartRow = DashboardSummary["activityChart"][number] & { total: number }

function ActivityTooltip({
  active,
  payload,
  label,
  is24h,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
  label?: string | number
  is24h: boolean
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null

  return (
    <div className="min-w-48 rounded-[var(--vq-r-sm)] border border-border bg-popover p-3 text-xs shadow-[var(--vq-shadow-lg)]">
      <div className="mb-2 font-medium text-foreground">
        {typeof label === "string" ? (is24h ? formatHour(label) : formatDate(label)) : ""}
      </div>
      <div className="mb-2 flex justify-between gap-4 border-b border-border pb-2">
        <span className="text-muted-foreground">Total messages</span>
        <span className="font-head tabular-nums text-foreground">{row.total}</span>
      </div>
      <div className="grid gap-1.5">
        {SLUGS.map((slug) => (
          <div key={slug} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{AGENT_META[slug].name}</span>
            <span className="tabular-nums text-foreground">{row[slug] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ActivityChart({
  data,
  range = { kind: "7d" },
}: {
  data: DashboardSummary["activityChart"]
  range?: Range
}) {
  const hasData = data.some((row) => SLUGS.some((slug) => (row[slug] ?? 0) > 0))
  const is24h = range.kind === "24h"
  const tickFormatter = is24h ? formatHour : formatDate
  const chartData = data.map((row) => ({
    ...row,
    total: SLUGS.reduce((sum, slug) => sum + (row[slug] ?? 0), 0),
  }))
  const totalMessages = chartData.reduce((sum, row) => sum + row.total, 0)
  const peak = Math.max(1, ...chartData.map((row) => row.total))
  const agentTotals = SLUGS.map((slug) => ({
    slug,
    ...AGENT_META[slug],
    total: chartData.reduce((sum, row) => sum + (row[slug] ?? 0), 0),
    share: totalMessages > 0
      ? Math.round((chartData.reduce((sum, row) => sum + (row[slug] ?? 0), 0) / totalMessages) * 100)
      : 0,
  })).sort((a, b) => b.total - a.total)

  return (
    <section className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="m-0 font-head text-2xl text-foreground">{rangeTitle(range)}</h2>
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            Message volume over time with agent contribution on the right.
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-head text-3xl tabular-nums text-foreground">{totalMessages}</span>
          <span className="text-xs text-muted-foreground">messages</span>
        </div>
      </div>

      {hasData ? (
        <div className="grid items-center gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 self-center rounded-[var(--vq-r-sm)] border border-border bg-background/45 p-3">
            <div className="h-60 sm:h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={240}>
                <AreaChart data={chartData} margin={{ top: 10, right: 14, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={tickFormatter}
                    tick={{ fontFamily: "var(--font-body)", fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)", strokeWidth: 1 }}
                    interval={is24h ? 3 : "preserveStartEnd"}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, peak]}
                    tick={{ fontFamily: "var(--font-body)", fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<ActivityTooltip is24h={is24h} />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="messages"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    fill="var(--foreground)"
                    fillOpacity={0.08}
                    activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--foreground)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <aside className="min-w-0 rounded-[var(--vq-r-sm)] border border-border bg-background/45 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Agent mix</div>
                <div className="text-[11px] text-muted-foreground">Ranked by messages</div>
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {agentTotals.filter((agent) => agent.total > 0).length}/{SLUGS.length} active
              </div>
            </div>

            <div className="grid gap-2">
              {agentTotals.map((agent) => (
                <div
                  key={agent.slug}
                  className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--vq-r-sm)] border border-border bg-card px-2.5 py-2"
                >
                  <div className="relative size-8 overflow-hidden rounded-full border border-border bg-muted">
                    <span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-muted-foreground">
                      {agent.initials}
                    </span>
                    <img
                      src={AGENT_PHOTOS[agent.slug]}
                      alt={agent.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = "none"
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{agent.name}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{agent.share}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{
                          width: "100%",
                          transform: `scaleX(${agent.share / 100})`,
                          transformOrigin: "left",
                        }}
                      />
                    </div>
                  </div>

                  <div className="w-8 text-right font-head text-sm tabular-nums text-foreground">
                    {agent.total}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <DashboardEmptyState
          icon={MessageSquare}
          title="No agent activity yet"
          description="Start a conversation with any agent and this chart will show message volume by day."
          action={{ label: "Open assistants", href: "/assistants" }}
        />
      )}
    </section>
  )
}
