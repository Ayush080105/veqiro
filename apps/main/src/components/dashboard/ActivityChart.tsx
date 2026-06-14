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
import type { DashboardSummary, Range } from "@/lib/api/dashboard"
import { AGENTS } from "@/lib/config/agents"
import type { AgentSlug } from "@/lib/types"

const SLUGS: AgentSlug[] = ["vega", "lex", "sage", "scout", "rex", "maya"]

// Derive chart hex colors from AGENTS config — single source of truth.
// SVG stroke/fill require resolved hex values, not CSS var references.
const CHART_HEX: Record<string, string> = {
  "var(--vq-red)":    "#F06464",
  "var(--vq-green)":  "#1DBC87",
  "var(--vq-yellow)": "#F5C518",
  "var(--vq-pink)":   "#F79FD4",
  "var(--vq-violet)": "#8A8AF0",
  "var(--vq-blue)":   "#6FCDE8",
}

const COLORS = Object.fromEntries(
  AGENTS.map((a) => [a.id, CHART_HEX[a.color] ?? a.color]),
) as Record<AgentSlug, string>

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  if (h === 0) return "12 AM"
  if (h === 12) return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function rangeTitle(range: Range): string {
  switch (range.kind) {
    case "24h":    return "your crew today"
    case "7d":     return "your crew this week"
    case "30d":    return "your crew this month"
    case "custom": return "your crew in range"
  }
}

export function ActivityChart({
  data,
  range = { kind: "7d" },
}: {
  data: DashboardSummary["activityChart"]
  range?: Range
}) {
  const hasData = data.some((row) => SLUGS.some((s) => (row[s] ?? 0) > 0))
  const title = rangeTitle(range)
  const is24h = range.kind === "24h"
  const tickFormatter = is24h ? formatHour : formatDate
  const labelFormatter = (v: unknown) =>
    typeof v === "string" ? (is24h ? formatHour(v) : formatDate(v)) : ""

  return (
    <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5 relative">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5 mb-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            [ activity chart ]
          </div>
          <div className="font-display text-[28px] tracking-tight text-foreground mt-0.5">
            {title}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-w-[680px]">
          {AGENTS.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-foreground rounded-full bg-white font-mono text-[10px] uppercase tracking-[0.1em] text-foreground"
            >
              <span
                className="size-2.5 rounded-full border border-foreground shrink-0"
                style={{ background: COLORS[a.id as AgentSlug] }}
              />
              {a.name}
            </span>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="w-full min-w-0 h-[280px] overflow-hidden">
          <ResponsiveContainer width="100%" height={280} minWidth={240}>
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#11111118" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={tickFormatter}
                tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "#555" }}
                tickLine={false}
                axisLine={{ stroke: "#111", strokeWidth: 1.5 }}
                interval={is24h ? 3 : "preserveStartEnd"}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "#555" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2.5px solid #111",
                  borderRadius: 10,
                  boxShadow: "3px 3px 0 #111",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
                labelFormatter={labelFormatter}
              />
              {SLUGS.map((slug) => (
                <Area
                  key={slug}
                  type="monotone"
                  dataKey={slug}
                  stackId="a"
                  name={slug}
                  stroke={COLORS[slug]}
                  strokeWidth={1.5}
                  fill={COLORS[slug]}
                  fillOpacity={0.8}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[180px] grid place-items-center bg-white border-2 border-dashed border-foreground rounded-xl font-mono text-xs text-muted-foreground tracking-[0.1em]">
          {"// no activity yet - start chatting with your crew"}
        </div>
      )}
    </div>
  )
}
