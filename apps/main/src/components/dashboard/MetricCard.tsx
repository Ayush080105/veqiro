import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { FONT } from "@/components/veqiro/shared"

interface MetricCardProps {
  label: string
  value: string
  change?: string
  trend?: "up" | "down" | "neutral"
}

const TREND_COLORS: Record<"up" | "down" | "neutral", string> = {
  up: "var(--vq-green)",
  down: "var(--vq-red)",
  neutral: "var(--vq-yellow)",
}

export function MetricCard({ label, value, change, trend }: MetricCardProps) {
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
          fontSize: 44,
          lineHeight: 1,
          color: "#111",
          margin: 0,
          letterSpacing: -1,
        }}
      >
        {value}
      </p>
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
