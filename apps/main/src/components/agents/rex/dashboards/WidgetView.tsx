"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, Check } from "lucide-react"

import type { ChartSpec, ChartYKey, DashboardWidget, WidgetResult } from "@/lib/api/rexDashboards"
import { cn } from "@/lib/utils"

/**
 * Palette slots, resolved through CSS variables so light and dark each get their own validated
 * steps (see --rex-s* in globals.css). Assigned in fixed order; never cycled past 8.
 */
export const SERIES_SLOTS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const

/** Hex colours older dashboards saved, in their old order: each maps onto the same slot. */
const LEGACY_HEX = [
  "#1dbc87", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
]

export function seriesColor(stored: string | undefined, index: number): string {
  if (stored && /^s[1-8]$/.test(stored)) return `var(--rex-${stored})`
  const legacy = stored ? LEGACY_HEX.indexOf(stored.toLowerCase()) : -1
  if (legacy >= 0) return `var(--rex-s${(legacy % 8) + 1})`
  if (stored && /^#[0-9a-f]{3,8}$/i.test(stored)) return stored
  return `var(--rex-s${(index % 8) + 1})`
}

// A fixed locale, not the runtime default: the server (shared links render there) and the viewer's
// browser must produce the same text, or React discards the server HTML. K/M/B is Rex's convention.
const LOCALE = "en-US"
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 })
const full = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-03" → "Mar 26", "2026-03-05" → "Mar 5"; anything else unchanged. */
export function prettyPeriod(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v)
  let m = s.match(/^(\d{4})-(\d{2})$/)
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]!.slice(2)}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
  return s
}

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

const short = (v: unknown) => formatValue(v, {}, true)
/** Derived figures (averages) don't need cents once they're in the hundreds. */
const approx = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : Math.abs(n) >= 100 ? whole.format(n) : full.format(n))
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${short(Math.abs(n))}`
const pct = (n: number) => `${Math.round(n * 100)}%`
const label = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : prettyPeriod(v))

// ── Shared chart chrome ─────────────────────────────────────────────────────

const axisTick = { fontSize: 10, fill: "var(--muted-foreground)" }
const tooltipProps = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "var(--vq-shadow)",
  },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 2 },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
}
const legendProps = {
  wrapperStyle: { fontSize: 10 },
  iconSize: 8,
  // Legend text stays in text ink; the swatch beside it carries identity.
  formatter: (value: string) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>,
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const set = () => setReduced(mq.matches)
    set()
    mq.addEventListener("change", set)
    return () => mq.removeEventListener("change", set)
  }, [])
  return reduced
}

function useAnim() {
  const reduced = useReducedMotion()
  return { isAnimationActive: !reduced, animationDuration: 500, animationEasing: "ease-out" as const }
}

interface Resolved {
  chart: ChartSpec
  data: Record<string, unknown>[]
  xKey: string
  ys: ChartYKey[]
}

function resolve(widget: DashboardWidget, result: WidgetResult): Resolved {
  const chart = widget.spec.chart ?? {}
  const data = result.rows
  const xKey = chart.xKey && result.columns.includes(chart.xKey) ? chart.xKey : result.columns[0]!
  const yKeys = (chart.yKeys ?? []).filter((y) => result.columns.includes(y.key))
  const ys: ChartYKey[] = yKeys.length
    ? yKeys
    : result.columns.filter((c) => c !== xKey && num(data[0]?.[c]) !== null).map((key) => ({ key }))
  return { chart, data, xKey, ys }
}

/** Keep the first `keep` rows; sum the rest into one "Other" row. */
function foldOther(rows: Record<string, unknown>[], xKey: string, yKey: string, keep: number) {
  if (rows.length <= keep + 1) return rows
  const rest = rows.slice(keep).reduce((s, r) => s + (num(r[yKey]) ?? 0), 0)
  return [...rows.slice(0, keep), { [xKey]: "Other", [yKey]: rest, __other: true }]
}

// ── KPI ─────────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 100
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const)
  const last = pts[pts.length - 1]!
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full overflow-visible" aria-hidden>
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.55}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--rex-s1)" stroke="var(--card)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiBody({ widget, result }: { widget: DashboardWidget; result: WidgetResult }) {
  const kpi = widget.spec.kpi ?? {}
  const rows = result.rows
  const key = kpi.valueKey && result.columns.includes(kpi.valueKey) ? kpi.valueKey : result.columns[0]
  const periodKey = kpi.periodKey && result.columns.includes(kpi.periodKey) ? kpi.periodKey : null
  const trend = periodKey !== null && rows.length > 1
  const row = trend ? rows[rows.length - 1]! : rows[0] ?? {}
  const value = key ? row[key] : undefined
  const current = num(value)
  const prevRow = trend ? rows[rows.length - 2] : undefined
  const compare = trend ? num(prevRow?.[key!]) : kpi.compareKey ? num(row[kpi.compareKey]) : null
  const delta = compare !== null && compare !== 0 && current !== null ? (current - compare) / Math.abs(compare) : null
  const goodWhenUp = kpi.goodDirection !== "down"
  const good = delta !== null && (delta === 0 ? null : (delta > 0) === goodWhenUp)
  const series = trend && key ? rows.map((r) => num(r[key])).filter((v): v is number => v !== null) : []
  const vs = trend ? label(prevRow?.[periodKey!]) : "previous"

  return (
    <div className="flex h-full items-end gap-3">
      <div className="min-w-0 flex-1 self-center">
        <div className="truncate text-2xl font-semibold tracking-[-0.02em] sm:text-3xl" title={formatValue(value, kpi)}>
          {formatValue(value, kpi, true)}
        </div>
        {delta !== null && (
          <div className="mt-0.5 flex items-center gap-1 text-xs">
            <span
              className="font-medium"
              style={{ color: good === null ? "var(--muted-foreground)" : good ? "var(--rex-good-text)" : "var(--rex-bad-text)" }}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {Math.abs(delta * 100).toFixed(1)}%
            </span>
            <span className="truncate text-muted-foreground">vs {vs}</span>
          </div>
        )}
      </div>
      {series.length > 1 && (
        <div className="w-[38%] shrink-0 pb-1">
          <Sparkline values={series} />
        </div>
      )}
    </div>
  )
}

// ── Table (also every chart's accessible twin) ─────────────────────────────

export function TableBody({ result }: { result: WidgetResult }) {
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

// ── Custom forms (HTML, so labels never clip) ───────────────────────────────

function FunnelBody({ r }: { r: Resolved }) {
  const y = r.ys[0]?.key
  if (!y) return null
  const rows = r.data.map((d) => ({ name: label(d[r.xKey]), v: num(d[y]) ?? 0 }))
  const max = Math.max(...rows.map((d) => d.v), 1)
  return (
    <ol className="flex h-full flex-col justify-around gap-0.5 overflow-auto" aria-label="Funnel">
      {rows.map((d, i) => {
        const prev = rows[i - 1]
        const conv = prev && prev.v > 0 ? d.v / prev.v : null
        const t = rows.length > 1 ? i / (rows.length - 1) : 0
        return (
          <li key={i} className="flex min-h-0 flex-col">
            {conv !== null && (
              <span className="pl-30 text-[10px] leading-tight text-muted-foreground">↓ {pct(conv)} carried on</span>
            )}
            <div className="flex items-center gap-2" title={`${d.name}: ${formatValue(d.v)}`}>
              <span className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground">{d.name}</span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className="h-5 rounded-r-[4px] transition-[width] duration-(--vq-dur-sheet) ease-spring"
                  style={{
                    width: `${Math.max((d.v / max) * 100, 1.5)}%`,
                    background: `color-mix(in oklab, var(--rex-ord-hi) ${Math.round((1 - t) * 100)}%, var(--rex-ord-lo))`,
                  }}
                />
                <span className="shrink-0 text-xs font-medium">{short(d.v)}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ProgressBody({ r }: { r: Resolved }) {
  const y = r.ys[0]?.key
  const t = r.chart.targetKey
  if (!y || !t) return null
  return (
    <ul className="flex h-full flex-col justify-around gap-2 overflow-auto">
      {r.data.map((d, i) => {
        const actual = num(d[y]) ?? 0
        const target = num(d[t]) ?? 0
        const share = target > 0 ? actual / target : 0
        const hit = target > 0 && actual >= target
        return (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium">{label(d[r.xKey])}</span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                {short(actual)} / {short(target)}
                <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: hit ? "var(--rex-good-text)" : "var(--foreground)" }}>
                  {hit && <Check className="size-3" aria-hidden />}
                  {pct(share)}
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--rex-track)" }}
              role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={actual} aria-label={label(d[r.xKey])}>
              <div
                className="h-full rounded-full transition-[width] duration-(--vq-dur-sheet) ease-spring"
                style={{ width: `${Math.min(share, 1) * 100}%`, background: "var(--rex-s1)" }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function HeatmapBody({ r }: { r: Resolved }) {
  const y = r.ys[0]?.key
  const g = r.chart.groupKey
  const [hover, setHover] = React.useState<{ x: string; g: string; v: number | null; left: number; top: number } | null>(null)
  if (!y || !g) return null
  const xs: string[] = []
  const gs: string[] = []
  const cells = new Map<string, number | null>()
  for (const d of r.data) {
    const x = label(d[r.xKey])
    const k = label(d[g])
    if (!xs.includes(x)) xs.push(x)
    if (!gs.includes(k)) gs.push(k)
    cells.set(`${k}\u0000${x}`, num(d[y]))
  }
  const vals = [...cells.values()].filter((v): v is number => v !== null)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const fill = (v: number | null) =>
    v === null
      ? "transparent"
      : `color-mix(in oklab, var(--rex-seq-hi) ${Math.round(((v - min) / span) * 100)}%, var(--rex-seq-lo))`

  return (
    <div className="relative flex h-full flex-col gap-1.5" onMouseLeave={() => setHover(null)}>
      <div
        className="grid min-h-0 flex-1 gap-0.5"
        style={{ gridTemplateColumns: `minmax(3.5rem, max-content) repeat(${xs.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gs.length}, minmax(0, 1fr)) auto` }}
      >
        {gs.map((k) => (
          <React.Fragment key={k}>
            <span className="self-center truncate pr-1 text-right text-[10px] text-muted-foreground">{k}</span>
            {xs.map((x) => {
              const v = cells.get(`${k}\u0000${x}`) ?? null
              return (
                <div
                  key={x}
                  className="min-h-2 rounded-[3px] border border-transparent hover:border-foreground/40"
                  style={{ background: fill(v), outline: v === null ? "1px solid var(--rex-grid)" : undefined, outlineOffset: -1 }}
                  onMouseEnter={(e) => {
                    const box = e.currentTarget.getBoundingClientRect()
                    const root = e.currentTarget.closest(".relative")!.getBoundingClientRect()
                    setHover({ x, g: k, v, left: box.left - root.left + box.width / 2, top: box.top - root.top })
                  }}
                />
              )
            })}
          </React.Fragment>
        ))}
        <span />
        {xs.map((x, i) => (
          <span key={x} className="truncate text-center text-[10px] text-muted-foreground">
            {xs.length > 12 && i % 2 ? "" : x}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground" aria-hidden>
        {short(min)}
        <span className="h-1.5 w-20 rounded-full" style={{ background: "linear-gradient(to right, var(--rex-seq-lo), var(--rex-seq-hi))" }} />
        {short(max)}
      </div>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-[var(--vq-shadow)]"
          style={{ left: hover.left, top: hover.top - 4 }}
        >
          <span className="text-muted-foreground">{hover.g} · {hover.x}</span>{" "}
          <span className="font-medium">{formatValue(hover.v)}</span>
        </div>
      )}
    </div>
  )
}

interface TreemapCellProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  value?: number
  depth?: number
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name, value, depth }: TreemapCellProps) {
  if (depth !== 1) return null
  const fits = width > 56 && height > 30
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill="color-mix(in oklab, var(--rex-s1) 16%, var(--card))" stroke="var(--card)" strokeWidth={3} />
      <rect x={x + 1.5} y={y + 1.5} width={3} height={Math.max(height - 3, 0)} rx={1.5} fill="var(--rex-s1)" />
      {fits && (
        <>
          <text x={x + 12} y={y + 18} fill="var(--foreground)" fontSize={11} fontWeight={500}>
            {String(name).length * 6.5 > width - 16 ? `${String(name).slice(0, Math.max(1, Math.floor((width - 24) / 6.5)))}…` : name}
          </text>
          {height > 44 && (
            <text x={x + 12} y={y + 33} fill="var(--muted-foreground)" fontSize={10}>{short(value)}</text>
          )}
        </>
      )}
    </g>
  )
}

interface WaterfallStep {
  name: string
  range: [number, number]
  delta: number
  label: string
  kind: "pos" | "neg" | "total"
}

/** Each row is a signed change from the running total; a closing (or net) bar is appended. */
function waterfallSteps(data: Record<string, unknown>[], xKey: string, key: string, baseFirst: boolean): WaterfallStep[] {
  const steps: WaterfallStep[] = []
  let running = 0
  data.forEach((d, i) => {
    const v = num(d[key]) ?? 0
    if (i === 0 && baseFirst) {
      running = v
      steps.push({ name: label(d[xKey]), range: [0, v], delta: v, label: short(v), kind: "total" })
      return
    }
    const start = running
    running += v
    steps.push({ name: label(d[xKey]), range: [Math.min(start, running), Math.max(start, running)], delta: v, label: signed(v), kind: v >= 0 ? "pos" : "neg" })
  })
  steps.push({ name: baseFirst ? "Closing" : "Net", range: [Math.min(0, running), Math.max(0, running)], delta: running,
    label: baseFirst ? short(running) : signed(running), kind: "total" })
  return steps
}

// ── Charts ──────────────────────────────────────────────────────────────────

function ChartBody({ widget, result }: { widget: DashboardWidget; result: WidgetResult }) {
  const anim = useAnim()
  const r = resolve(widget, result)
  const { chart, data, xKey, ys } = r
  const type = chart.type ?? "bar"
  const legend = ys.length > 1 ? <Legend {...legendProps} /> : null
  const common = { data, margin: { top: 14, right: 12, bottom: 0, left: -8 } }
  const grid = <CartesianGrid stroke="var(--rex-grid)" vertical={false} />
  const xAxis = <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--rex-grid)" }} minTickGap={12} tickFormatter={prettyPeriod} />
  const yAxis = <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={short} width={48} />
  const tooltip = <Tooltip {...tooltipProps} formatter={(v) => formatValue(v)} labelFormatter={prettyPeriod} />
  const first = ys[0]?.key
  const avg = chart.reference === "average" && first
    ? data.reduce((s, d) => s + (num(d[first]) ?? 0), 0) / Math.max(data.length, 1)
    : null
  const reference = avg !== null ? (
    <ReferenceLine y={avg} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.7}
      label={{ value: `Avg ${approx(avg)}`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10 }} />
  ) : null

  if (type === "funnel") return <FunnelBody r={r} />
  if (type === "progress") return <ProgressBody r={r} />
  if (type === "heatmap") return <HeatmapBody r={r} />

  if (type === "treemap" && first) {
    const rows = foldOther(
      [...data].filter((d) => (num(d[first]) ?? 0) > 0).sort((a, b) => (num(b[first]) ?? 0) - (num(a[first]) ?? 0)),
      xKey, first, 14,
    ).map((d) => ({ name: label(d[xKey]), value: num(d[first]) ?? 0 }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={rows} dataKey="value" nameKey="name" content={<TreemapCell />} {...anim}>
          <Tooltip {...tooltipProps} formatter={(v) => formatValue(v)} />
        </Treemap>
      </ResponsiveContainer>
    )
  }

  if (type === "pie") {
    const key = first ?? result.columns[1] ?? xKey
    const rows = foldOther([...data].sort((a, b) => (num(b[key]) ?? 0) - (num(a[key]) ?? 0)), xKey, key, 5)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey={key} nameKey={xKey} innerRadius="52%" outerRadius="82%" stroke="var(--card)" strokeWidth={2} {...anim}>
            {rows.map((d, i) => <Cell key={i} fill={d.__other ? "var(--rex-ghost)" : seriesColor(undefined, i)} />)}
          </Pie>
          <Tooltip {...tooltipProps} formatter={(v) => formatValue(v)} />
          <Legend {...legendProps} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          {grid}
          <XAxis dataKey={xKey} type="number" tick={axisTick} tickFormatter={short} name={xKey} tickLine={false} axisLine={{ stroke: "var(--rex-grid)" }} />
          <YAxis dataKey={first} type="number" tick={axisTick} tickFormatter={short} tickLine={false} axisLine={false} width={48} />
          <Tooltip {...tooltipProps} formatter={(v) => formatValue(v)} />
          <Scatter data={data} fill={seriesColor(ys[0]?.color, 0)} stroke="var(--card)" strokeWidth={2} {...anim} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (type === "ranked" && first) {
    const rows = foldOther(
      [...data].sort((a, b) => (num(b[first]) ?? 0) - (num(a[first]) ?? 0)), xKey, first, 10,
    )
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} width={96}
            tickFormatter={(v: string) => (String(v).length > 16 ? `${String(v).slice(0, 15)}…` : v)} />
          {tooltip}
          <Bar dataKey={first} name={ys[0]?.label ?? first} radius={[0, 4, 4, 0]} maxBarSize={18} {...anim}>
            {rows.map((d, i) => <Cell key={i} fill={d.__other ? "var(--rex-ghost)" : seriesColor(ys[0]?.color, 0)} />)}
            <LabelList dataKey={first} position="right" formatter={short} style={{ fontSize: 10, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === "waterfall" && first) {
    const steps = waterfallSteps(data, xKey, first, !!chart.baseFirst)
    const fills = { pos: "var(--rex-pos)", neg: "var(--rex-neg)", total: "var(--rex-total)" }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={steps} margin={{ top: 16, right: 12, bottom: 0, left: -8 }}>
          {grid}
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--rex-grid)" }} interval="preserveStartEnd" minTickGap={6}
            tickFormatter={(v: string) => (String(v).length > 10 ? `${String(v).slice(0, 9)}…` : v)} />
          {yAxis}
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
          <Tooltip {...tooltipProps} formatter={(_v, _n, item) => (item?.payload as { label: string }).label} />
          <Bar dataKey="range" radius={4} maxBarSize={28} {...anim}>
            {steps.map((s, i) => <Cell key={i} fill={fills[s.kind]} />)}
            <LabelList dataKey="label" position="top" style={{ fontSize: 10, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          {grid}{xAxis}{yAxis}{tooltip}{legend}{reference}
          {ys.map((y, i) => (
            <Line key={y.key} type="monotone" dataKey={y.key} name={y.label ?? y.key}
              stroke={y.ghost ? "var(--rex-ghost)" : seriesColor(y.color, i)} strokeWidth={y.ghost ? 1.5 : 2}
              dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} {...anim}>
              {ys.length === 1 && <LabelList dataKey={y.key} content={<EndLabel count={data.length} />} />}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          {grid}{xAxis}{yAxis}{tooltip}{legend}{reference}
          {ys.map((y, i) => (
            <Area key={y.key} type="monotone" dataKey={y.key} name={y.label ?? y.key}
              stroke={y.ghost ? "var(--rex-ghost)" : seriesColor(y.color, i)}
              fill={y.ghost ? "transparent" : seriesColor(y.color, i)} fillOpacity={0.1} strokeWidth={2}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              stackId={chart.stacked ? "s" : undefined} {...anim}>
              {ys.length === 1 && <LabelList dataKey={y.key} content={<EndLabel count={data.length} />} />}
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (type === "combo") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart {...common}>
          {grid}{xAxis}{yAxis}{tooltip}{legend}{reference}
          {ys.map((y, i) =>
            (y.as ?? (i === 0 ? "bar" : "line")) === "bar" ? (
              <Bar key={y.key} dataKey={y.key} name={y.label ?? y.key} radius={[4, 4, 0, 0]} maxBarSize={24}
                fill={y.ghost ? "var(--rex-ghost)" : seriesColor(y.color, i)} {...anim} />
            ) : (
              <Line key={y.key} type="monotone" dataKey={y.key} name={y.label ?? y.key}
                stroke={y.ghost ? "var(--rex-ghost)" : seriesColor(y.color, i)} strokeWidth={y.ghost ? 1.5 : 2}
                dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} {...anim} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  // bar (default)
  const stacked = !!chart.stacked || !!chart.normalize
  const labelled = ys.length === 1 && data.length <= 8
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart {...common} stackOffset={chart.normalize ? "expand" : undefined}>
        {grid}{xAxis}
        {chart.normalize
          ? <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => pct(v)} width={48} />
          : yAxis}
        {tooltip}{legend}{!stacked && reference}
        {ys.map((y, i) => (
          <Bar key={y.key} dataKey={y.key} name={y.label ?? y.key}
            fill={y.ghost ? "var(--rex-ghost)" : seriesColor(y.color, i)}
            // Stacked segments: a surface-coloured edge is the 2px gap; only the top segment is rounded.
            radius={stacked ? (i === ys.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            stroke={stacked ? "var(--card)" : undefined} strokeWidth={stacked ? 1 : 0}
            stackId={stacked ? "s" : undefined} maxBarSize={24} {...anim}>
            {labelled && <LabelList dataKey={y.key} position="top" formatter={short} style={{ fontSize: 10, fill: "var(--muted-foreground)" }} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** The value at the end of a single-series line: the one number worth labelling. */
function EndLabel(props: { x?: number | string; y?: number | string; value?: unknown; index?: number; count: number }) {
  const { x, y, value, index, count } = props
  if (index !== count - 1 || typeof x !== "number" || typeof y !== "number") return null
  return (
    <text x={x} y={y - 8} textAnchor="end" fontSize={10} fontWeight={500} fill="var(--foreground)">
      {short(value)}
    </text>
  )
}

// ── Insight: one true sentence, computed from the tile's own result ─────────

const looksLikePeriod = (v: unknown) =>
  typeof v === "string" && /^(\d{4}([-/]\d{1,2}([-/]\d{1,2})?)?|\d{4}-?Q[1-4]|Q[1-4][ -]?\d{4}|[A-Za-z]{3,9}[ -]?\d{2,4})$/.test(v.trim())

function pearson(xs: number[], ys: number[]) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my)
    sxx += (xs[i]! - mx) ** 2
    syy += (ys[i]! - my) ** 2
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0
}

export function widgetInsight(widget: DashboardWidget, result?: WidgetResult): string | null {
  if (!result || result.error || !result.rows.length) return null
  const rows = result.rows

  if (widget.kind === "kpi") {
    const kpi = widget.spec.kpi ?? {}
    const key = kpi.valueKey ?? result.columns[0]
    if (!key || !kpi.periodKey || rows.length < 3) return null
    const vals = rows.map((r) => num(r[key])).filter((v): v is number => v !== null)
    const last = vals[vals.length - 1]
    if (last === undefined) return null
    const n = vals.length
    if (last === Math.max(...vals)) return `Highest in ${n} periods`
    if (last === Math.min(...vals)) return `Lowest in ${n} periods`
    const avg = vals.reduce((a, b) => a + b, 0) / n
    return avg ? `${pct(Math.abs(last - avg) / Math.abs(avg))} ${last >= avg ? "above" : "below"} the ${n}-period average` : null
  }
  if (widget.kind !== "chart") return null

  const r = resolve(widget, result)
  const y = r.ys[0]?.key
  if (!y) return null
  const vals = r.data.map((d) => num(d[y]) ?? 0)
  const names = r.data.map((d) => label(d[r.xKey]))
  const total = vals.reduce((a, b) => a + b, 0)
  const top = vals.indexOf(Math.max(...vals))
  const type = r.chart.type ?? "bar"

  switch (type) {
    case "funnel": {
      if (vals.length < 2 || !vals[0]) return null
      let worst = 1
      let worstAt = 1
      for (let i = 1; i < vals.length; i++) {
        const c = vals[i - 1] ? vals[i]! / vals[i - 1]! : 1
        if (c < worst) {
          worst = c
          worstAt = i
        }
      }
      return `${pct(vals[vals.length - 1]! / vals[0]!)} make it through · biggest drop ${names[worstAt - 1]} → ${names[worstAt]} (−${pct(1 - worst)})`
    }
    case "waterfall": {
      const steps = r.chart.baseFirst ? vals.slice(1) : vals
      const stepNames = r.chart.baseFirst ? names.slice(1) : names
      if (!steps.length) return null
      const net = steps.reduce((a, b) => a + b, 0)
      const big = steps.reduce((bi, v, i) => (Math.abs(v) > Math.abs(steps[bi]!) ? i : bi), 0)
      return `Net ${signed(net)} · biggest mover ${stepNames[big]} (${signed(steps[big]!)})`
    }
    case "progress": {
      const t = r.chart.targetKey
      if (!t) return null
      const shares = r.data.map((d) => ((num(d[t]) ?? 0) > 0 ? (num(d[y]) ?? 0) / num(d[t])! : 0))
      const hit = shares.filter((s) => s >= 1).length
      const low = shares.indexOf(Math.min(...shares))
      return `${hit} of ${shares.length} at or above target · lowest ${names[low]} at ${pct(shares[low]!)}`
    }
    case "heatmap": {
      const g = r.chart.groupKey
      if (!g) return null
      return `Highest: ${label(r.data[top]?.[g])} in ${names[top]} (${short(vals[top])})`
    }
    case "scatter": {
      const xs = r.data.map((d) => num(d[r.xKey]))
      if (xs.some((v) => v === null) || xs.length < 4) return null
      const c = pearson(xs as number[], vals)
      const strength = Math.abs(c) >= 0.7 ? "Strong" : Math.abs(c) >= 0.4 ? "Moderate" : "Weak"
      return `${strength} ${c >= 0 ? "positive" : "negative"} relationship (r = ${c.toFixed(2)})`
    }
    case "ranked": {
      const sorted = [...vals].sort((a, b) => b - a)
      const n = Math.min(3, sorted.length)
      return total > 0 && sorted.length > 3
        ? `Top ${n} make up ${pct(sorted.slice(0, n).reduce((a, b) => a + b, 0) / total)} of the total`
        : `Leader: ${names[top]} (${short(vals[top])})`
    }
    case "pie":
    case "treemap":
      return total > 0 ? `Largest: ${names[top]}, ${pct(vals[top]! / total)} of the total` : null
    default: {
      if (vals.length < 2) return null
      if (looksLikePeriod(r.data[0]?.[r.xKey])) {
        const a = vals[0]!
        const b = vals[vals.length - 1]!
        const change = a ? (b - a) / Math.abs(a) : null
        const peak = `peak ${short(vals[top])} in ${names[top]}`
        return change === null
          ? peak.charAt(0).toUpperCase() + peak.slice(1)
          : `${change >= 0 ? "Up" : "Down"} ${pct(Math.abs(change))} from ${names[0]} to ${names[names.length - 1]} · ${peak}`
      }
      return total > 0 && vals.every((v) => v >= 0)
        ? `${names[top]} leads with ${pct(vals[top]! / total)} of the total`
        : `${names[top]} is highest (${short(vals[top])})`
    }
  }
}

/** Whether a tile has a chart that the table view can stand in for. */
export const hasTableTwin = (w: DashboardWidget) => w.kind === "chart"

/** One tile's content. The frame (title, menu, drag handle, insight) belongs to the canvas. */
export function WidgetBody({ widget, result, asTable }: { widget: DashboardWidget; result?: WidgetResult; asTable?: boolean }) {
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
  if (widget.kind === "table" || asTable) return <TableBody result={result} />
  return <ChartBody widget={widget} result={result} />
}
