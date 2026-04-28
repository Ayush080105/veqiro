"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { listDatasets } from "@/lib/api/rex"
import type { RexDatasetRecord } from "@/lib/types/agents"
import { cn } from "@/lib/utils"

interface DataPoint { date: string; value: number }

function lastTwo(points: DataPoint[]): { current: number | null; previous: number | null } {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const current = sorted.length ? sorted[sorted.length - 1]!.value : null
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2]!.value : null
  return { current, previous }
}

function pickDataset(datasets: RexDatasetRecord[], metricKey: string): DataPoint[] {
  const ds = datasets
    .filter((d) => d.metricKey === metricKey)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  return (ds?.points as DataPoint[] | undefined) ?? []
}

function changePct(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function fmtMonths(n: number | null): string {
  if (n == null) return "—"
  if (!isFinite(n)) return "Profitable"
  return `${n.toFixed(1)} mo`
}

function fmtPct(n: number | null, sign = false): string {
  if (n == null) return "—"
  return `${sign && n > 0 ? "+" : ""}${n.toFixed(1)}%`
}

function trendOf(curr: number | null, prev: number | null): "up" | "down" | "flat" | null {
  if (curr == null || prev == null) return null
  if (curr > prev * 1.005) return "up"
  if (curr < prev * 0.995) return "down"
  return "flat"
}

function MagicTile({
  label,
  value,
  trend,
  level,
  onClick,
}: {
  label: string
  value: string
  trend?: "up" | "down" | "flat" | null
  level?: "good" | "warn" | "bad" | null
  onClick?: () => void
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendColor =
    trend === "up" ? "#1DBC87" : trend === "down" ? "#ef4444" : "#888"
  const dot =
    level === "good" ? "#1DBC87" : level === "warn" ? "#f59e0b" : level === "bad" ? "#ef4444" : null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 border border-border bg-background/60 px-3 py-2 text-left transition-colors",
        onClick ? "hover:bg-muted cursor-pointer" : "cursor-default",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        {dot && (
          <span className="inline-block size-1.5 rounded-full" style={{ background: dot }} />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[14px] font-semibold leading-tight">{value}</span>
        {trend && (
          <TrendIcon className="size-3" style={{ color: trendColor }} />
        )}
      </div>
    </button>
  )
}

/**
 * Magic Numbers — condensed single-glance company health card. Renders below KpiStrip.
 * Uses saved RexDataset rows to derive the 5 core founder metrics.
 */
export function MagicNumbers({
  organizationId,
  onDrillDown,
}: {
  organizationId: string
  onDrillDown?: (metricKey: string) => void
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: ["rex", "datasets", organizationId, "magic"],
    queryFn: listDatasets,
    enabled: !!organizationId,
    staleTime: 30_000,
  })

  const mrrPts = pickDataset(datasets, "mrr")
  const revPts = pickDataset(datasets, "revenue")
  const cashPts = pickDataset(datasets, "cash")
  const burnPts = pickDataset(datasets, "burn")
  const expPts = pickDataset(datasets, "expenses")
  const churnPts = pickDataset(datasets, "churn_rate")
  const cacPts = pickDataset(datasets, "cac")

  // Pick "headline" series for revenue: prefer MRR, then revenue
  const headlineRev = mrrPts.length ? mrrPts : revPts
  const headlineExp = burnPts.length ? burnPts : expPts

  const mrr = lastTwo(headlineRev)
  const cash = lastTwo(cashPts)
  const burn = lastTwo(headlineExp)
  const churn = lastTwo(churnPts)
  const cac = lastTwo(cacPts)

  // Hide entirely if no data is uploaded for any metric
  const hasAny = headlineRev.length > 0 || cashPts.length > 0 || headlineExp.length > 0 || churnPts.length > 0
  if (!hasAny) return null

  // Runway = cash / (burn - mrr) in months. Profitable when net <= 0.
  const runway = (() => {
    if (cash.current == null || burn.current == null) return null
    const net = burn.current - (mrr.current ?? 0)
    if (net <= 0) return Infinity
    return cash.current / net
  })()
  const prevRunway = (() => {
    if (cash.previous == null || burn.previous == null) return null
    const net = burn.previous - (mrr.previous ?? 0)
    if (net <= 0) return Infinity
    return cash.previous / net
  })()
  const runwayLevel: "good" | "warn" | "bad" | null =
    runway == null
      ? null
      : runway === Infinity || runway > 12
        ? "good"
        : runway > 6
          ? "warn"
          : "bad"
  const runwayTrend = trendOf(
    runway === Infinity ? 99 : runway,
    prevRunway === Infinity ? 99 : prevRunway,
  )

  // CAC payback = CAC / ARPU. ARPU ≈ MRR / customers — we don't have customer count here,
  // so approximate as CAC / MRR-per-mo when both exist.
  const arpu = (() => {
    const subs = pickDataset(datasets, "subscribers")
    const subLast = lastTwo(subs).current
    if (subLast && mrr.current && subLast > 0) return mrr.current / subLast
    return null
  })()
  const cacPayback = cac.current && arpu ? cac.current / arpu : null
  const cacPaybackLevel: "good" | "warn" | "bad" | null =
    cacPayback == null ? null : cacPayback < 12 ? "good" : cacPayback < 18 ? "warn" : "bad"

  // MoM churn: latest churn value, expressed as %
  const churnPct = churn.current != null
    ? (churn.current > 1 ? churn.current : churn.current * 100)
    : null
  const churnLevel: "good" | "warn" | "bad" | null =
    churnPct == null ? null : churnPct < 2 ? "good" : churnPct < 4 ? "warn" : "bad"

  // MoM revenue growth %
  const revGrowth = changePct(mrr.current, mrr.previous)
  const revGrowthLevel: "good" | "warn" | "bad" | null =
    revGrowth == null ? null : revGrowth >= 5 ? "good" : revGrowth >= 0 ? "warn" : "bad"

  // NRR ≈ current MRR / previous MRR (without expansion data, this is a proxy)
  const nrr = mrr.current != null && mrr.previous && mrr.previous > 0
    ? (mrr.current / mrr.previous) * 100
    : null
  const nrrLevel: "good" | "warn" | "bad" | null =
    nrr == null ? null : nrr >= 100 ? "good" : nrr >= 90 ? "warn" : "bad"

  return (
    <div className="flex flex-col gap-1.5 border-b border-border bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Magic numbers
        </span>
        <span className="text-[10px] text-muted-foreground">— company health at a glance</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        <MagicTile
          label="Runway"
          value={runway == null ? "—" : fmtMonths(runway === Infinity ? Infinity : runway)}
          trend={runwayTrend}
          level={runwayLevel}
          onClick={onDrillDown && cashPts.length > 0 ? () => onDrillDown("cash") : undefined}
        />
        <MagicTile
          label="NRR (proxy)"
          value={nrr == null ? "—" : `${nrr.toFixed(0)}%`}
          level={nrrLevel}
          onClick={onDrillDown && mrrPts.length > 0 ? () => onDrillDown("mrr") : undefined}
        />
        <MagicTile
          label="CAC payback"
          value={cacPayback == null ? "—" : `${cacPayback.toFixed(1)} mo`}
          level={cacPaybackLevel}
          onClick={onDrillDown && cacPts.length > 0 ? () => onDrillDown("cac") : undefined}
        />
        <MagicTile
          label="MoM churn"
          value={churnPct == null ? "—" : fmtPct(churnPct)}
          level={churnLevel}
          onClick={onDrillDown && churnPts.length > 0 ? () => onDrillDown("churn_rate") : undefined}
        />
        <MagicTile
          label="MoM growth"
          value={revGrowth == null ? "—" : fmtPct(revGrowth, true)}
          trend={trendOf(mrr.current, mrr.previous)}
          level={revGrowthLevel}
          onClick={onDrillDown && headlineRev.length > 0 ? () => onDrillDown(mrrPts.length ? "mrr" : "revenue") : undefined}
        />
      </div>
    </div>
  )
}
