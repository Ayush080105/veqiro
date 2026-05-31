"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  LineChart as LineChartIcon,
  Wallet,
  FileText,
  Hourglass,
  Coins,
  GitBranch,
  CalendarRange,
  Mail,
  Copy,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Pin,
  ArrowRight,
  Send,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/ui/agent-card"
import { InfoSection } from "@/components/ui/info-section"
import { KpiTile } from "@/components/ui/kpi-tile"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { createPin, sharePin } from "@/lib/api/rex"
import { PINS_KEY } from "@/components/agents/rex/today-panel"
import { ScenarioSliders } from "@/components/agents/rex/scenario-sliders"
import type {
  RexAnalyzeMetricsResult,
  RexForecastResult,
  RexFinancialAnalysisResult,
  RexBriefingResult,
  RexRunwayResult,
  RexUnitEconomicsResult,
  RexScenarioResult,
  RexWeeklyDigestResult,
  RexInvestorUpdateResult,
  RexVarianceResult,
  RexBoardDeckResult,
  DataPoint,
  AgentActionId,
} from "@/lib/types/agents"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void

// ─── Confidence footer ───────────────────────────────────────────────────────

function ConfidenceFooter({
  level,
  dataPoints,
  note,
}: {
  level?: "high" | "medium" | "low"
  dataPoints?: number
  note?: string
}) {
  if (!level && !dataPoints && !note) return null
  const dot = level === "high" ? "#1DBC87" : level === "medium" ? "#f59e0b" : level === "low" ? "#ef4444" : "#888"
  const label = level ? `${level} confidence` : null
  return (
    <div className="flex items-center gap-1.5 border-t border-border pt-2 mt-1">
      {level && (
        <span
          className="inline-block size-1.5 rounded-full shrink-0"
          style={{ background: dot }}
        />
      )}
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {[label, dataPoints ? `${dataPoints} data pts` : null, note].filter(Boolean).join(" · ")}
      </span>
    </div>
  )
}

// ─── Pin button ──────────────────────────────────────────────────────────────

function PinButton({ kind, payload }: { kind: string; payload: unknown }) {
  const qc = useQueryClient()
  const [pinId, setPinId] = React.useState<string | null>(null)
  const [shareUrl, setShareUrl] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const pinMut = useMutation({
    mutationFn: () => createPin({ kind, payload }),
    onSuccess: (data) => {
      setPinId((data as { id: string }).id)
      void qc.invalidateQueries({ queryKey: PINS_KEY })
    },
  })

  const shareMut = useMutation({
    mutationFn: () => {
      if (!pinId) throw new Error("Pin first")
      return sharePin(pinId, true)
    },
    onSuccess: (data) => {
      if (data.shareToken) {
        setShareUrl(`${window.location.origin}/share/rex/${data.shareToken}`)
      }
    },
  })

  const copyShare = () => {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (pinId && shareUrl) {
    return (
      <button
        type="button"
        onClick={copyShare}
        title={shareUrl}
        className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
      >
        <Pin className="size-2.5" />
        {copied ? "Link copied!" : "Copy share link"}
      </button>
    )
  }

  if (pinId) {
    return (
      <div className="flex items-center gap-1">
        <span className="border border-border bg-muted px-1.5 py-0.5 text-[10px]">Pinned</span>
        <button
          type="button"
          onClick={() => shareMut.mutate()}
          disabled={shareMut.isPending}
          className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
        >
          <Send className="size-2.5" />
          {shareMut.isPending ? "..." : "Share"}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      title="Pin to Today"
      onClick={() => pinMut.mutate()}
      disabled={pinMut.isPending}
      className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
    >
      <Pin className="size-2.5" />
      Pin
    </button>
  )
}

// ─── Follow-up action button ─────────────────────────────────────────────────

function FollowUpBtn({
  label,
  icon: Icon = ArrowRight,
  onClick,
}: {
  label: string
  icon?: React.ElementType
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
    >
      <Icon className="size-2.5" />
      {label}
    </button>
  )
}

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

export function MetricsAnalysisCard({
  result,
  onFollowUpAction,
}: {
  result: RexAnalyzeMetricsResult
  onFollowUpAction?: FollowUp
}) {
  const { analysis, charts_data } = result
  const firstMetricKey = Object.keys(charts_data)[0]
  const firstMetricData = firstMetricKey ? charts_data[firstMetricKey] : []
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
            <PinButton kind="analyze-metrics" payload={result} />
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
          <InfoSection label="anomalies" bullets={analysis.anomalies.map((a) =>
            typeof a === "string" ? a : `${a.date}: ${a.direction} (${a.severity})${a.root_cause_hypothesis ? ` — ${a.root_cause_hypothesis}` : ""}`
          )} tone="danger" />
        )}
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {firstMetricKey && (
              <FollowUpBtn
                label="Forecast this metric"
                onClick={() => onFollowUpAction("rex:forecast", {
                  metric_name: firstMetricKey,
                  historical_data: firstMetricData,
                  horizon_days: 90,
                })}
              />
            )}
            <FollowUpBtn
              label="Financial analysis"
              icon={Wallet}
              onClick={() => onFollowUpAction("rex:financial-analysis", {
                revenue_data: (charts_data.revenue ?? charts_data.mrr ?? firstMetricData) as DataPoint[],
              })}
            />
          </div>
        )}
        <ConfidenceFooter
          level={result.confidence_level}
          dataPoints={result.data_points_analyzed}
          note="REX analysis"
        />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Forecast card ───────────────────────────────────────────────────────────

export function ForecastCard({
  result,
  onFollowUpAction,
}: {
  result: RexForecastResult
  onFollowUpAction?: FollowUp
}) {
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
        right={<PinButton kind="forecast" payload={result} />}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="border border-border bg-muted/20 p-2">
          <Sparkline data={points} band={band} height={80} />
        </div>
        <p className="text-[11px] leading-relaxed">{result.summary}</p>
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Model a scenario"
              icon={GitBranch}
              onClick={() => onFollowUpAction("rex:scenario", {})}
            />
            <FollowUpBtn
              label="Share forecast · Maya"
              icon={ArrowRight}
              onClick={() => onFollowUpAction("maya:draft-content" as AgentActionId, {
                topic: result.summary,
                platform: "linkedin",
                additional_context: `${Math.round((result.confidence ?? 0) * 100)}% confidence. Method: ${result.methodology ?? ""}`,
              })}
            />
          </div>
        )}
        <ConfidenceFooter
          level={result.confidence >= 0.75 ? "high" : result.confidence >= 0.6 ? "medium" : "low"}
          note={`${result.methodology} · ${Math.round(result.confidence * 100)}% confidence`}
        />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Financial health card ───────────────────────────────────────────────────

export function FinancialHealthCard({
  result,
  onFollowUpAction,
}: {
  result: RexFinancialAnalysisResult
  onFollowUpAction?: FollowUp
}) {
  const m = result.metrics
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Wallet />}
        title="Financial health"
        right={
          <div className="flex items-center gap-1.5">
            <StatusPill level={healthLevel(result.health_indicator)}>
              {result.health_indicator}
            </StatusPill>
            <PinButton kind="financial-analysis" payload={result} />
          </div>
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
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Share growth update · Maya"
              icon={ArrowRight}
              onClick={() => onFollowUpAction("maya:draft-content" as AgentActionId, {
                topic: "Our latest financial milestone",
                platform: "linkedin",
                additional_context: result.narrative ?? "",
              })}
            />
            <FollowUpBtn
              label="Generate investor update"
              icon={Mail}
              onClick={() => onFollowUpAction("rex:investor-update", {
                period: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
                metrics: {
                  mrr: m.mrr,
                  arr: m.arr,
                  growth_rate_pct: m.growth_rate_pct,
                  churn_rate_pct: m.churn_rate_pct,
                  net_burn: m.net_burn ?? m.burn_rate,
                },
              })}
            />
            <FollowUpBtn
              label="Calculate runway"
              icon={Hourglass}
              onClick={() => onFollowUpAction("rex:runway", {
                monthly_burn: Math.max(1, Math.abs(m.net_burn ?? m.burn_rate ?? 0)),
                monthly_revenue: m.mrr ?? 0,
                growth_rate_pct: m.growth_rate_pct ?? 0,
              })}
            />
          </div>
        )}
        <ConfidenceFooter
          level={result.confidence_level}
          dataPoints={result.data_points_analyzed}
          note="REX financial analysis"
        />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Briefing card ───────────────────────────────────────────────────────────

export function BriefingCard({
  result,
  onFollowUpAction,
}: {
  result: RexBriefingResult
  onFollowUpAction?: FollowUp
}) {
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
        right={<PinButton kind="briefing" payload={result} />}
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
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Generate investor update"
              icon={Mail}
              onClick={() => onFollowUpAction("rex:investor-update", {})}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Runway card ─────────────────────────────────────────────────────────────

export function RunwayCard({
  result,
  onFollowUpAction,
}: {
  result: RexRunwayResult
  onFollowUpAction?: FollowUp
}) {
  const verdictLevel = result.verdict === "green" ? "ok" : result.verdict === "amber" ? "warn" : "danger"
  const runwayLabel =
    result.months_remaining != null
      ? `${result.months_remaining.toFixed(1)} mo`
      : "Profitable"

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Hourglass />}
        title="Runway analysis"
        right={
          <div className="flex items-center gap-1.5">
            <StatusPill level={verdictLevel}>{result.verdict}</StatusPill>
            <PinButton kind="runway" payload={result} />
          </div>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <KpiTile label="Runway" value={runwayLabel} />
          <KpiTile label="Cash" value={fmtCurrency(result.cash_on_hand)} />
          <KpiTile label="Burn/mo" value={fmtCurrency(result.monthly_burn)} />
          <KpiTile label="Revenue/mo" value={fmtCurrency(result.monthly_revenue)} />
        </div>
        {result.date_of_zero && result.date_of_zero !== "profitable" && (
          <p className="text-[11px] text-muted-foreground">
            Zero date: <span className="font-medium text-foreground">{result.date_of_zero}</span>
          </p>
        )}
        {result.scenarios?.length > 0 && (
          <div className="border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wide">Scenario</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Runway</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Zero date</th>
                </tr>
              </thead>
              <tbody>
                {result.scenarios.map((s, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-2 py-1 capitalize">{s.name}</td>
                    <td className="px-2 py-1 text-right">
                      {s.months != null ? `${s.months} mo` : "Profitable"}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{s.date_of_zero}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] leading-relaxed">{result.recommendation}</p>
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Model a scenario"
              icon={GitBranch}
              onClick={() => onFollowUpAction("rex:scenario", {
                base_metrics: {
                  mrr: result.monthly_revenue ?? 0,
                  burn: result.monthly_burn ?? 0,
                  cash: result.cash_on_hand ?? 0,
                  growth_rate: 0.05,
                },
                scenarios: [{ name: "", changes: {} }],
              })}
            />
            <FollowUpBtn
              label="Email board · Vega"
              icon={Mail}
              onClick={() => onFollowUpAction("vega:compose-email" as AgentActionId, {
                subject: `Runway update: ${result.months_remaining != null ? `${result.months_remaining} months` : "Profitable"}`,
                instructions: result.recommendation,
              })}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Unit economics card ─────────────────────────────────────────────────────

export function UnitEconomicsCard({
  result,
  onFollowUpAction,
}: {
  result: RexUnitEconomicsResult
  onFollowUpAction?: FollowUp
}) {
  const healthLevelLocal = (h: string) =>
    h === "green" ? "ok" : h === "amber" ? "warn" : "danger"

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Coins />}
        title="Unit economics"
        right={
          <div className="flex items-center gap-1.5">
            <StatusPill level={healthLevelLocal(result.health)}>{result.health}</StatusPill>
            <PinButton kind="unit-economics" payload={result} />
          </div>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <KpiTile label="CAC" value={fmtCurrency(result.cac)} />
          <KpiTile label="LTV" value={fmtCurrency(result.ltv)} />
          <KpiTile
            label="LTV:CAC"
            value={result.ltv_cac_ratio?.toFixed(1)}
            suffix="x"
          />
          <KpiTile
            label="Payback"
            value={result.payback_months?.toFixed(1)}
            suffix=" mo"
          />
          <KpiTile label="ARPU" value={fmtCurrency(result.arpu)} />
          <KpiTile
            label="Lifetime"
            value={result.lifetime_months?.toFixed(0)}
            suffix=" mo"
          />
        </div>
        <p className="text-[11px] leading-relaxed">{result.benchmark_context}</p>
        {result.recommendations?.length > 0 && (
          <InfoSection label="recommendations" bullets={result.recommendations} />
        )}
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Run financial analysis"
              icon={Wallet}
              onClick={() => onFollowUpAction("rex:financial-analysis", {})}
            />
            <FollowUpBtn
              label="Calculate runway"
              icon={Hourglass}
              onClick={() => onFollowUpAction("rex:runway", {})}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Scenario card ───────────────────────────────────────────────────────────

export function ScenarioCard({
  result,
  baseMetrics,
  onFollowUpAction,
}: {
  result: RexScenarioResult
  baseMetrics?: { mrr: number; burn: number; cash: number; growth_rate: number }
  onFollowUpAction?: FollowUp
}) {
  const derivedBase = baseMetrics ?? {
    mrr: (result.base_case?.arr_12mo as number | undefined ?? 0) / 12,
    burn: 0,
    cash: 0,
    growth_rate: 0,
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<GitBranch />}
        title="What-if scenarios"
        right={<PinButton kind="scenario" payload={result} />}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <ScenarioSliders initialResult={result} baseMetrics={derivedBase} />
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Model another scenario"
              onClick={() => onFollowUpAction("rex:scenario", {})}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Weekly digest card ───────────────────────────────────────────────────────

export function WeeklyDigestCard({
  result,
  onFollowUpAction,
}: {
  result: RexWeeklyDigestResult
  onFollowUpAction?: FollowUp
}) {
  const severityColor = (s: string) =>
    s === "high" ? "text-destructive" : s === "medium" ? "text-amber-500" : "text-muted-foreground"

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<CalendarRange />}
        title="Weekly CFO digest"
        badge={
          <Badge variant="secondary" className="text-[10px]">{result.period}</Badge>
        }
        right={<PinButton kind="weekly-digest" payload={result} />}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[12px] font-medium leading-snug">{result.headline}</p>

        {result.wow_changes?.length > 0 && (
          <div className="border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wide">Metric</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Current</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">WoW</th>
                </tr>
              </thead>
              <tbody>
                {result.wow_changes.map((c, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-2 py-1 capitalize">{c.metric}</td>
                    <td className="px-2 py-1 text-right">{c.current?.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">
                      <span className={cn("flex items-center justify-end gap-0.5", c.direction === "up" ? "text-chart-2" : "text-destructive")}>
                        {c.direction === "up" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                        {Math.abs(c.change_pct ?? 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.alerts?.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Alerts</p>
            {result.alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <XCircle className={cn("mt-0.5 size-3 shrink-0", severityColor(a.severity))} />
                <p className={cn("text-[11px]", severityColor(a.severity))}>{a.message}</p>
              </div>
            ))}
          </div>
        )}

        {result.green_flags?.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Green flags</p>
            {result.green_flags.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <CheckCircle className="mt-0.5 size-3 shrink-0 text-chart-2" />
                <p className="text-[11px]">{f.message}</p>
              </div>
            ))}
          </div>
        )}

        {result.focus_this_week?.length > 0 && (
          <InfoSection label="Focus this week" bullets={result.focus_this_week} />
        )}
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Generate investor update"
              icon={Mail}
              onClick={() => {
                const metricsFromWow = result.wow_changes?.reduce<Record<string, number>>((acc, c) => {
                  if (c.metric && c.current != null) acc[c.metric] = c.current
                  return acc
                }, {}) ?? {}
                onFollowUpAction("rex:investor-update", {
                  period: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
                  metrics: metricsFromWow,
                })
              }}
            />
            {result.headline && (
              <FollowUpBtn
                label="Share on LinkedIn · Maya"
                icon={ArrowRight}
                onClick={() => onFollowUpAction("maya:draft-content" as AgentActionId, {
                  topic: result.headline,
                  platform: "linkedin",
                  additional_context: result.focus_this_week?.slice(0, 2).join("; ") ?? "",
                })}
              />
            )}
          </div>
        )}
        <ConfidenceFooter
          level={result.confidence_level}
          dataPoints={result.metrics_count}
          note={result.generated_at ? `generated ${new Date(result.generated_at).toLocaleDateString()}` : "REX digest"}
        />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Investor update card ────────────────────────────────────────────────────

export function InvestorUpdateCard({
  result,
  onFollowUpAction,
}: {
  result: RexInvestorUpdateResult
  onFollowUpAction?: FollowUp
}) {
  const [copied, setCopied] = React.useState(false)

  const copy = () => {
    void navigator.clipboard.writeText(result.full_email_body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Mail />}
        title="Investor update"
        right={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
            >
              <Copy className="size-3" />
              {copied ? "Copied!" : "Copy email"}
            </button>
            <PinButton kind="investor-update" payload={result} />
          </div>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {result.subject_line}
        </p>
        <p className="text-[11px] leading-relaxed">{result.executive_summary}</p>

        {result.highlights_section?.length > 0 && (
          <InfoSection label="Highlights" bullets={result.highlights_section} />
        )}
        {result.challenges_section?.length > 0 && (
          <InfoSection label="Challenges" bullets={result.challenges_section} tone="danger" />
        )}
        {result.asks_section?.length > 0 && (
          <InfoSection label="Where you can help" bullets={result.asks_section} />
        )}

        <details className="text-[10px]">
          <summary className="cursor-pointer font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
            Full email body
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border border-border bg-muted/20 p-2 text-[10px] leading-relaxed">
            {result.full_email_body}
          </pre>
        </details>
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Send via Vega"
              icon={Send}
              onClick={() => onFollowUpAction("vega:compose-email" as AgentActionId, {
                subject: result.subject_line,
                instructions: `Send this investor update as-is:\n\n${result.full_email_body}`,
              })}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Variance card (C9) ─────────────────────────────────────────────────────

export function VarianceCard({
  result,
  onFollowUpAction,
}: {
  result: RexVarianceResult
  onFollowUpAction?: FollowUp
}) {
  const overallLevel =
    Math.abs(result.total_variance_pct) <= 10 ? "ok" : Math.abs(result.total_variance_pct) <= 25 ? "warn" : "danger"
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<AlertTriangle />}
        title="Variance — actual vs budget"
        right={
          <div className="flex items-center gap-1.5">
            <StatusPill level={overallLevel}>
              {result.total_variance_pct > 0 ? "+" : ""}
              {result.total_variance_pct.toFixed(1)}%
            </StatusPill>
            <PinButton kind="variance" payload={result} />
          </div>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[12px] font-medium leading-snug">{result.headline}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <KpiTile label="Total actual" value={fmtCurrency(result.total_actual)} />
          <KpiTile label="Total budget" value={fmtCurrency(result.total_budget)} />
          <KpiTile
            label="Variance"
            value={`${result.total_variance_pct > 0 ? "+" : ""}${result.total_variance_pct.toFixed(1)}`}
            suffix="%"
          />
        </div>
        {result.rows.length > 0 && (
          <div className="border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wide">Date</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Actual</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Budget</th>
                  <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Δ</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-2 py-1">{r.date}</td>
                    <td className="px-2 py-1 text-right font-mono">{fmtCurrency(r.actual)}</td>
                    <td className="px-2 py-1 text-right font-mono text-muted-foreground">{fmtCurrency(r.budget)}</td>
                    <td className={cn(
                      "px-2 py-1 text-right",
                      r.direction === "over" ? "text-destructive" : r.direction === "under" ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {r.variance_pct > 0 ? "+" : ""}
                      {r.variance_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] leading-relaxed">{result.narrative}</p>
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Run financial analysis"
              icon={Wallet}
              onClick={() => onFollowUpAction("rex:financial-analysis", {})}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Board deck card (C5) ───────────────────────────────────────────────────

export function BoardDeckCard({
  result,
  onFollowUpAction,
}: {
  result: RexBoardDeckResult
  onFollowUpAction?: FollowUp
}) {
  const [copied, setCopied] = React.useState(false)

  const copyHtml = () => {
    void navigator.clipboard.writeText(result.html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInNewTab = () => {
    const blob = new Blob([result.html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank", "noopener,noreferrer")
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileText />}
        title="Board deck"
        badge={
          <Badge variant="secondary" className="text-[10px]">{result.period}</Badge>
        }
        right={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyHtml}
              className="flex items-center gap-1 border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
            >
              <Copy className="size-3" />
              {copied ? "Copied!" : "Copy HTML"}
            </button>
            <button
              type="button"
              onClick={openInNewTab}
              className="flex items-center gap-1 border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
            >
              <ArrowRight className="size-3" /> Open
            </button>
            <PinButton kind="board-deck" payload={result} />
          </div>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[12px] font-medium leading-snug">{result.headline}</p>
        <div className="flex flex-col gap-2">
          {Object.entries(result.sections).map(([key, body]) => (
            <div key={key} className="border-l-2 border-border pl-2">
              <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {key.replace(/_/g, " ")}
              </p>
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{body || "—"}</p>
            </div>
          ))}
        </div>
        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FollowUpBtn
              label="Generate investor update"
              icon={Mail}
              onClick={() => onFollowUpAction("rex:investor-update", { period: result.period })}
            />
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── AlertTriangle is used by VarianceCard ──────────────────────────────────
void AlertTriangle
