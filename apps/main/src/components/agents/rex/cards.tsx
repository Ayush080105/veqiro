"use client"

import * as React from "react"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  LineChart as LineChartIcon,
  Wallet,
  FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/ui/agent-card"
import { InfoSection } from "@/components/ui/info-section"
import { KpiTile } from "@/components/ui/kpi-tile"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import type {
  RexAnalyzeMetricsResult,
  RexForecastResult,
  RexFinancialAnalysisResult,
  RexBriefingResult,
  DataPoint,
} from "@/lib/types/agents"

// ─── Tiny SVG sparkline (no recharts dependency) ────────────────────────────

function Sparkline({
  data,
  band,
  color = "var(--chart-1)",
  height = 56,
}: {
  data: DataPoint[]
  band?: Array<{ lower: number; upper: number }>
  color?: string
  height?: number
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center text-[10px] text-muted-foreground">
        Not enough points to chart.
      </div>
    )
  }
  const w = 240
  const h = height
  const values = data.map((d) => d.value)
  const lows = band?.map((b) => b.lower) ?? []
  const highs = band?.map((b) => b.upper) ?? []
  const min = Math.min(...values, ...lows)
  const max = Math.max(...values, ...highs)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const y = (v: number) => h - 4 - ((v - min) / range) * (h - 8)
  const x = (i: number) => i * step

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ")

  const bandPath =
    band && band.length === data.length
      ? [
          ...band.map((b, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(b.upper)}`),
          ...band
            .slice()
            .reverse()
            .map((b, i) => `L${x(band.length - 1 - i)},${y(b.lower)}`),
          "Z",
        ].join(" ")
      : null

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {bandPath && <path d={bandPath} fill={color} fillOpacity={0.15} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

// ─── Health badge → StatusPill ───────────────────────────────────────────────

function healthLevel(level: "red" | "amber" | "green") {
  return level === "green" ? "ok" : level === "amber" ? "warn" : "danger"
}

function fmtCurrency(n?: number) {
  if (n == null) return "—"
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

// ─── Metrics analysis card ───────────────────────────────────────────────────

export function MetricsAnalysisCard({ result }: { result: RexAnalyzeMetricsResult }) {
  const { analysis, charts_data } = result
  const TrendIcon =
    analysis.trend === "up"
      ? TrendingUp
      : analysis.trend === "down"
        ? TrendingDown
        : Minus
  const trendColor =
    analysis.trend === "up"
      ? "text-chart-2"
      : analysis.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground"

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<LineChartIcon />}
        title="Metrics analysis"
        right={
          <div className="flex items-center gap-1.5">
            <TrendIcon className={cn("size-3.5", trendColor)} />
            <StatusPill level={healthLevel(analysis.health_indicator)}>
              {analysis.health_indicator}
            </StatusPill>
          </div>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[11px] leading-relaxed">{analysis.summary}</p>
        {Object.keys(charts_data).length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(charts_data).map(([name, data]) => (
              <div key={name} className="border border-border bg-muted/20 p-2">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {name}
                </p>
                <Sparkline data={data} />
              </div>
            ))}
          </div>
        )}
        {analysis.insights.length > 0 && (
          <InfoSection label="insights" bullets={analysis.insights} />
        )}
        {analysis.anomalies.length > 0 && (
          <InfoSection label="anomalies" bullets={analysis.anomalies} tone="danger" />
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Forecast card ───────────────────────────────────────────────────────────

export function ForecastCard({ result }: { result: RexForecastResult }) {
  const points: DataPoint[] = result.forecast.map((f) => ({
    date: f.date,
    value: f.value,
  }))
  const band = result.forecast.map((f) => ({
    lower: f.lower_bound,
    upper: f.upper_bound,
  }))
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<TrendingUp />}
        title="Forecast"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            confidence {Math.round(result.confidence * 100)}%
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="border border-border bg-muted/20 p-2">
          <Sparkline data={points} band={band} height={80} />
        </div>
        <p className="text-[11px] leading-relaxed">{result.summary}</p>
        <p className="text-[10px] italic text-muted-foreground">
          Method: {result.methodology}
        </p>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Financial health card ───────────────────────────────────────────────────

export function FinancialHealthCard({ result }: { result: RexFinancialAnalysisResult }) {
  const m = result.metrics
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Wallet />}
        title="Financial health"
        right={
          <StatusPill level={healthLevel(result.health_indicator)}>
            {result.health_indicator}
          </StatusPill>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <KpiTile label="MRR" value={fmtCurrency(m.mrr)} />
          <KpiTile label="ARR" value={fmtCurrency(m.arr)} />
          <KpiTile
            label="Growth"
            value={m.growth_rate_pct != null ? m.growth_rate_pct.toFixed(1) : "—"}
            suffix="%"
          />
          <KpiTile
            label="Churn"
            value={m.churn_rate_pct != null ? m.churn_rate_pct.toFixed(1) : "—"}
            suffix="%"
          />
          <KpiTile label="Net burn" value={fmtCurrency(m.net_burn ?? m.burn_rate)} />
          <KpiTile
            label="Runway"
            value={m.runway_months != null ? m.runway_months.toFixed(1) : "—"}
            suffix="mo"
          />
        </div>
        <p className="text-[11px] leading-relaxed">{result.narrative}</p>
        {result.recommendations.length > 0 && (
          <InfoSection label="recommendations" bullets={result.recommendations} />
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Briefing card ───────────────────────────────────────────────────────────

export function BriefingCard({ result }: { result: RexBriefingResult }) {
  const b = result.briefing
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileText />}
        title="Daily briefing"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {b.date}
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-xs font-medium">{b.headline}</p>
        <div className="flex flex-col gap-2">
          {Object.entries(b.sections).map(([title, body]) => (
            <div key={title} className="border-l-2 border-border pl-2">
              <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {title}
              </p>
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── AlertTriangle is unused as of now but kept for future critical-state card ──
void AlertTriangle
