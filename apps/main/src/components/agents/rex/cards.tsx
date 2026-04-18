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
import { Card } from "@/components/ui/card"
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

// ─── Health badge ────────────────────────────────────────────────────────────

function HealthBadge({ level }: { level: "red" | "amber" | "green" }) {
  const cls =
    level === "green"
      ? "bg-chart-2/15 text-chart-2 border-chart-2/30"
      : level === "amber"
        ? "bg-chart-3/15 text-chart-3 border-chart-3/30"
        : "bg-destructive/15 text-destructive border-destructive/30"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
        cls
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {level}
    </span>
  )
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
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <LineChartIcon className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Metrics analysis</p>
        <div className="ml-auto flex items-center gap-1.5">
          <TrendIcon className={cn("size-3.5", trendColor)} />
          <HealthBadge level={analysis.health_indicator} />
        </div>
      </div>
      <p className="text-[11px] leading-relaxed">{analysis.summary}</p>
      {Object.keys(charts_data).length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(charts_data).map(([name, data]) => (
            <div
              key={name}
              className="border border-border bg-muted/20 p-2"
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {name}
              </p>
              <Sparkline data={data} />
            </div>
          ))}
        </div>
      )}
      {analysis.insights.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Insights
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {analysis.insights.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {analysis.anomalies.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-destructive">
            <AlertTriangle className="size-3" /> Anomalies
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {analysis.anomalies.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
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
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Forecast</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          confidence {Math.round(result.confidence * 100)}%
        </Badge>
      </div>
      <div className="border border-border bg-muted/20 p-2">
        <Sparkline data={points} band={band} height={80} />
      </div>
      <p className="text-[11px] leading-relaxed">{result.summary}</p>
      <p className="text-[10px] italic text-muted-foreground">
        Method: {result.methodology}
      </p>
    </Card>
  )
}

// ─── KPI tile ────────────────────────────────────────────────────────────────

function KPITile({
  label,
  value,
  suffix,
}: {
  label: string
  value: string | number
  suffix?: string
}) {
  return (
    <div className="border border-border bg-muted/20 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold">
        {value}
        {suffix && <span className="text-[10px] text-muted-foreground"> {suffix}</span>}
      </p>
    </div>
  )
}

function fmtCurrency(n?: number) {
  if (n == null) return "—"
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

// ─── Financial health card ───────────────────────────────────────────────────

export function FinancialHealthCard({ result }: { result: RexFinancialAnalysisResult }) {
  const m = result.metrics
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Wallet className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Financial health</p>
        <div className="ml-auto">
          <HealthBadge level={result.health_indicator} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <KPITile label="MRR" value={fmtCurrency(m.mrr)} />
        <KPITile label="ARR" value={fmtCurrency(m.arr)} />
        <KPITile
          label="Growth"
          value={m.growth_rate_pct != null ? m.growth_rate_pct.toFixed(1) : "—"}
          suffix="%"
        />
        <KPITile
          label="Churn"
          value={m.churn_rate_pct != null ? m.churn_rate_pct.toFixed(1) : "—"}
          suffix="%"
        />
        <KPITile label="Net burn" value={fmtCurrency(m.net_burn ?? m.burn_rate)} />
        <KPITile
          label="Runway"
          value={m.runway_months != null ? m.runway_months.toFixed(1) : "—"}
          suffix="mo"
        />
      </div>
      <p className="text-[11px] leading-relaxed">{result.narrative}</p>
      {result.recommendations.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Recommendations
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ─── Briefing card ───────────────────────────────────────────────────────────

export function BriefingCard({ result }: { result: RexBriefingResult }) {
  const b = result.briefing
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <FileText className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Daily briefing</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {b.date}
        </Badge>
      </div>
      <p className="text-xs font-medium">{b.headline}</p>
      <div className="flex flex-col gap-2">
        {Object.entries(b.sections).map(([title, body]) => (
          <div
            key={title}
            className="border-l-2 border-border pl-2"
          >
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
