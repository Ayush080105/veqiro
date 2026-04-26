"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { TrendingUp, TrendingDown, Minus, Database, X, BarChart2 } from "lucide-react"
import { getSnapshot, listDatasets } from "@/lib/api/rex"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import type { RexSnapshot, RexDatasetRecord } from "@/lib/types/agents"

function fmtCurrency(n?: number | null) {
  if (n == null) return "—"
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtRunway(months?: number | null) {
  if (months == null) return "Profitable"
  return `${months.toFixed(1)} mo`
}

// ── Inline sparkline (no recharts dep) ───────────────────────────────────────

function MiniSparkline({ points, color = "var(--chart-1)" }: { points: Array<{ value: number }>; color?: string }) {
  if (points.length < 2) return null
  const w = 260
  const h = 72
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const y = (v: number) => h - 4 - ((v - min) / range) * (h - 8)
  const x = (i: number) => i * step
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={3} fill={color} />
    </svg>
  )
}

// ── Drill-down modal ──────────────────────────────────────────────────────────

function DrillDownModal({
  metric,
  label,
  onClose,
}: {
  metric: string
  label: string
  onClose: () => void
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: ["rex", "datasets"],
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  React.useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [onClose])

  // Find matching dataset by metricKey
  const ds = datasets
    .filter((d) => d.metricKey === metric)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]

  const points = ds
    ? (ds.points as Array<{ date: string; value: number }>).slice(-24)
    : []

  const trend =
    points.length >= 2
      ? points[points.length - 1].value > points[0].value
        ? "up"
        : points[points.length - 1].value < points[0].value
          ? "down"
          : "flat"
      : null

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendColor =
    trend === "up" ? "#1DBC87" : trend === "down" ? "#ef4444" : "#888"

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.35)" }}
      />
      <div
        className="fixed z-50"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 360,
          background: "#FFF9ED",
          border: "3px solid #111",
          boxShadow: "8px 8px 0 #111",
          padding: 20,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="size-4" />
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#111",
              }}
            >
              {label}
            </span>
            {trend && (
              <TrendIcon className="size-3.5" style={{ color: trendColor }} />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#fff",
              border: "2px solid #111",
              borderRadius: 999,
              padding: 4,
              cursor: "pointer",
              boxShadow: "2px 2px 0 #111",
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Chart or empty state */}
        {points.length >= 2 ? (
          <div className="flex flex-col gap-3">
            <div
              style={{
                border: "2px solid #111",
                borderRadius: 6,
                padding: "10px 12px",
                background: "#fff",
              }}
            >
              <MiniSparkline points={points} color="var(--chart-1, #6366f1)" />
            </div>

            {/* Latest value */}
            <div className="flex items-baseline gap-2">
              <span
                style={{
                  fontFamily: "var(--font-head, sans-serif)",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#111",
                  lineHeight: 1,
                }}
              >
                {metric === "mrr" || metric === "cash" || metric === "burn" || metric === "revenue"
                  ? fmtCurrency(points[points.length - 1].value)
                  : points[points.length - 1].value.toLocaleString()}
              </span>
              {trend && (
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 11,
                    color: trendColor,
                  }}
                >
                  {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} vs {points[0].date.slice(0, 7)}
                </span>
              )}
            </div>

            {/* Last 6 data points table */}
            <div
              style={{
                border: "2px solid #111",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <table className="w-full text-[10px]">
                <thead>
                  <tr style={{ background: "#111", color: "#FFF9ED" }}>
                    <th className="px-2 py-1 text-left" style={{ fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.1em" }}>DATE</th>
                    <th className="px-2 py-1 text-right" style={{ fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.1em" }}>VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {points.slice(-6).reverse().map((p, i) => (
                    <tr key={i} style={{ borderBottom: i < 5 ? "1px solid #e5e5e5" : undefined }}>
                      <td className="px-2 py-1 text-muted-foreground">{p.date}</td>
                      <td className="px-2 py-1 text-right font-medium">
                        {metric === "mrr" || metric === "cash" || metric === "burn" || metric === "revenue"
                          ? fmtCurrency(p.value)
                          : p.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                color: "#888",
              }}
            >
              {points.length} data points · {ds?.name ?? metric} · {ds?.period ?? "monthly"}
            </p>
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-3 py-8 text-center"
            style={{
              border: "2px dashed #ccc",
              borderRadius: 6,
              background: "#fff",
            }}
          >
            <Database className="size-8 text-muted-foreground" />
            <p className="text-[12px] font-medium">No data for {label}</p>
            <p className="text-[11px] text-muted-foreground">
              Upload a CSV in the Data tab to see the historical trend here.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── KPI tile button ───────────────────────────────────────────────────────────

function KpiTileBtn({
  label,
  value,
  onClick,
  className,
}: {
  label: string
  value: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={onClick ? `View ${label} trend` : undefined}
      className={cn(
        "flex flex-col items-center gap-0 border border-border bg-background/60 px-3 py-1.5 text-center transition-colors",
        onClick ? "hover:bg-muted cursor-pointer" : "cursor-default",
        className
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold leading-tight">{value}</span>
    </button>
  )
}

// ── Main strip ────────────────────────────────────────────────────────────────

export function KpiStrip({ onOpenDataTab }: { onOpenDataTab?: () => void }) {
  const [drillMetric, setDrillMetric] = React.useState<{ key: string; label: string } | null>(null)

  const { data: snapshot } = useQuery<RexSnapshot>({
    queryKey: ["rex", "snapshot"],
    queryFn: getSnapshot,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (!snapshot) return null

  if (!snapshot.ready) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <Database className="size-3.5 shrink-0" />
        <span>Connect data to see live numbers</span>
        {onOpenDataTab && (
          <button
            type="button"
            onClick={onOpenDataTab}
            className="ml-1 underline hover:text-foreground"
          >
            Open Data tab
          </button>
        )}
      </div>
    )
  }

  const d = snapshot.data ?? {}

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border bg-muted/20 px-3 py-1.5 overflow-x-auto">
        <KpiTileBtn
          label="MRR"
          value={fmtCurrency(d.mrr)}
          onClick={() => setDrillMetric({ key: "mrr", label: "MRR" })}
        />
        <KpiTileBtn
          label="Cash"
          value={fmtCurrency(d.cash)}
          onClick={() => setDrillMetric({ key: "cash", label: "Cash" })}
        />
        <KpiTileBtn
          label="Runway"
          value={fmtRunway(d.runway_months)}
          onClick={d.runway_months != null ? () => setDrillMetric({ key: "burn", label: "Burn" }) : undefined}
        />
        {d.runway_months != null && (
          <StatusPill
            level={d.runway_months > 12 ? "ok" : d.runway_months > 6 ? "warn" : "danger"}
            className="ml-1"
          >
            {d.runway_months > 12 ? "healthy" : d.runway_months > 6 ? "watch" : "critical"}
          </StatusPill>
        )}
      </div>

      {drillMetric && (
        <DrillDownModal
          metric={drillMetric.key}
          label={drillMetric.label}
          onClose={() => setDrillMetric(null)}
        />
      )}
    </>
  )
}
