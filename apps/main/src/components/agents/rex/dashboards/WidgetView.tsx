"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle } from "lucide-react"

import type { ChartYKey, DashboardWidget, WidgetResult } from "@/lib/api/rexDashboards"
import { cn } from "@/lib/utils"

export const CHART_COLORS = [
  "#1DBC87", "#6366F1", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
]

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 })
const full = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v)
  return null
}

export function formatValue(v: unknown, opts: { format?: string; prefix?: string; suffix?: string } = {}, short = false) {
  const n = num(v)
  if (n === null) return v === null || v === undefined ? "—" : String(v)
  if (opts.format === "percent") {
    // Rates stored as fractions (0.035) read as 3.5%.
    const pct = Math.abs(n) <= 1 ? n * 100 : n
    return `${opts.prefix ?? ""}${full.format(Math.round(pct * 10) / 10)}%${opts.suffix ?? ""}`
  }
  const body = short && Math.abs(n) >= 10_000 ? compact.format(n) : full.format(n)
  return `${opts.prefix ?? ""}${body}${opts.suffix ?? ""}`
}

const axisTick = { fontSize: 10, fill: "var(--muted-foreground)" }
const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
}

function KpiBody({ widget, result }: { widget: DashboardWidget; result: WidgetResult }) {
  const kpi = widget.spec.kpi ?? {}
  const row = result.rows[0] ?? {}
  const key = kpi.valueKey && kpi.valueKey in row ? kpi.valueKey : result.columns[0]
  const value = key ? row[key] : undefined
  const compare = kpi.compareKey ? num(row[kpi.compareKey]) : null
  const current = num(value)
  const delta = compare && current !== null ? (current - compare) / Math.abs(compare) : null
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="truncate text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" title={formatValue(value, kpi)}>
        {formatValue(value, kpi, true)}
      </div>
      {delta !== null && (
        <div className={cn("mt-1 text-xs tabular-nums", delta >= 0 ? "text-[#1DBC87]" : "text-destructive")}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}% vs previous
        </div>
      )}
    </div>
  )
}

function TableBody({ result }: { result: WidgetResult }) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border">
            {result.columns.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap text-muted-foreground">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {result.columns.map((c) => (
                <td key={c} className={cn("px-2 py-1.5 whitespace-nowrap", num(row[c]) !== null && "text-right tabular-nums")}>
                  {formatValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartBody({ widget, result }: { widget: DashboardWidget; result: WidgetResult }) {
  const chart = widget.spec.chart ?? {}
  const type = chart.type ?? "bar"
  const data = result.rows
  const xKey = chart.xKey && result.columns.includes(chart.xKey) ? chart.xKey : result.columns[0]!
  const yKeys = (chart.yKeys ?? []).filter((y) => result.columns.includes(y.key))
  const ys: ChartYKey[] = yKeys.length ? yKeys : result.columns.filter((c) => c !== xKey && num(data[0]?.[c]) !== null).map((key) => ({ key }))
  const color = (i: number, c?: string) => c || CHART_COLORS[i % CHART_COLORS.length]
  const tickFmt = (v: unknown) => formatValue(v, {}, true)
  const legend = ys.length > 1 ? <Legend wrapperStyle={{ fontSize: 10 }} /> : null

  if (type === "pie") {
    const key = ys[0]?.key ?? result.columns[1] ?? xKey
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey={key} nameKey={xKey} innerRadius="45%" outerRadius="80%" paddingAngle={1}>
            {data.map((_, i) => <Cell key={i} fill={color(i)} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v) => formatValue(v)} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={xKey} tick={axisTick} tickFormatter={tickFmt} name={xKey} />
          <YAxis dataKey={ys[0]?.key} tick={axisTick} tickFormatter={tickFmt} />
          <Tooltip {...tooltipStyle} />
          <Scatter data={data} fill={color(0, ys[0]?.color)} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  const common = { data, margin: { top: 4, right: 8, bottom: 0, left: -8 } }
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
      <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={tickFmt} width={48} />
      <Tooltip {...tooltipStyle} formatter={(v) => formatValue(v)} />
      {legend}
    </>
  )

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          {axes}
          {ys.map((y, i) => (
            <Line key={y.key} type="monotone" dataKey={y.key} name={y.label ?? y.key} stroke={color(i, y.color)} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          {axes}
          {ys.map((y, i) => (
            <Area key={y.key} type="monotone" dataKey={y.key} name={y.label ?? y.key} stroke={color(i, y.color)}
              fill={color(i, y.color)} fillOpacity={0.15} strokeWidth={2} stackId={chart.stacked ? "s" : undefined} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart {...common}>
        {axes}
        {ys.map((y, i) => (
          <Bar key={y.key} dataKey={y.key} name={y.label ?? y.key} fill={color(i, y.color)} radius={[3, 3, 0, 0]}
            stackId={chart.stacked ? "s" : undefined} maxBarSize={48} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** One tile's content. The frame (title, menu, drag handle) belongs to the canvas. */
export function WidgetBody({ widget, result }: { widget: DashboardWidget; result?: WidgetResult }) {
  if (widget.kind === "text") {
    return <p className="h-full overflow-auto text-sm whitespace-pre-wrap text-muted-foreground">{widget.spec.text}</p>
  }
  if (!result) {
    return <div className="h-full animate-pulse rounded-md bg-muted/50" />
  }
  if (result.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <AlertTriangle className="size-4 text-amber-500" />
        <span>This tile&apos;s query no longer runs on the current data.</span>
      </div>
    )
  }
  if (!result.rows.length) {
    return <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No rows match</div>
  }
  if (widget.kind === "kpi") return <KpiBody widget={widget} result={result} />
  if (widget.kind === "table") return <TableBody result={result} />
  return <ChartBody widget={widget} result={result} />
}
