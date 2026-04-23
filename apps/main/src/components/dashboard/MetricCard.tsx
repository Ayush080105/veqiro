import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { FONT } from "@/components/veqiro/shared"

interface MetricCardProps {
  label: string
  value: string
  change?: string
  trend?: "up" | "down" | "neutral"
  sparkline?: number[]
}

const TREND_COLORS: Record<"up" | "down" | "neutral", string> = {
  up: "var(--vq-green)",
  down: "var(--vq-red)",
  neutral: "var(--vq-yellow)",
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null
  const w = 120
  const h = 32
  const max = Math.max(1, ...values)
  const stepX = values.length > 1 ? w / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = h - (v / max) * h
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const path = `M ${points.join(" L ")}`
  const area = `${path} L ${w},${h} L 0,${h} Z`
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height="32"
      style={{ display: "block" }}
    >
      <path d={area} fill={color} fillOpacity={0.25} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function MetricCard({ label, value, change, trend, sparkline }: MetricCardProps) {
  const accent = TREND_COLORS[trend ?? "neutral"]
  const Icon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus

  return (
    <div
      style={{
        background: "#fff",
        border: "3px solid #111",
        borderRadius: 14,
        boxShadow: `6px 6px 0 ${accent}`,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: FONT.display,
          fontSize: 40,
          lineHeight: 1,
          color: "#111",
          margin: 0,
          letterSpacing: -1,
        }}
      >
        {value}
      </p>
      {sparkline && sparkline.length > 0 && (
        <div style={{ marginTop: 2, marginBottom: 2 }}>
          <Sparkline values={sparkline} color={accent} />
        </div>
      )}
      {change && trend && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: accent,
            border: "2px solid #111",
            borderRadius: 999,
            alignSelf: "flex-start",
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: "#111",
          }}
        >
          <Icon className="size-3" />
          {change}
        </div>
      )}
    </div>
  )
}
