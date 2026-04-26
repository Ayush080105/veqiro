import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const tileVariants = cva(
  "flex flex-col gap-1.5",
  {
    variants: {
      tone: {
        default: "bg-card text-foreground",
        muted: "bg-muted/40 text-foreground",
        accent: "bg-accent text-foreground",
        ink: "bg-primary text-primary-foreground",
      },
      shape: {
        default: "rounded-none border border-foreground/10 p-3",
        brand:
          "rounded-md border-[3px] border-foreground p-4 shadow-[3px_3px_0_var(--foreground)]",
      },
    },
    defaultVariants: {
      tone: "default",
      shape: "default",
    },
  }
)

const TREND_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const

interface KpiTileProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tileVariants> {
  label: string
  value: React.ReactNode
  suffix?: React.ReactNode
  /** Optional change indicator. */
  delta?: {
    value: React.ReactNode
    trend?: keyof typeof TREND_ICON
  }
  /** Optional sparkline values. Drawn with the trend's accent color. */
  sparkline?: number[]
}

const TREND_VAR = {
  up: "var(--vq-green)",
  down: "var(--destructive)",
  flat: "var(--accent)",
} as const

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null
  const w = 120
  const h = 28
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
      height="28"
      className="block"
    >
      <path d={area} fill={color} fillOpacity={0.22} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function KpiTile({
  label,
  value,
  suffix,
  delta,
  sparkline,
  tone,
  shape,
  className,
  ...rest
}: KpiTileProps) {
  const TrendIcon = delta?.trend ? TREND_ICON[delta.trend] : null
  const accentColor = TREND_VAR[delta?.trend ?? "flat"]
  return (
    <div className={cn(tileVariants({ tone, shape }), className)} {...rest}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-display tracking-tight",
            shape === "brand" ? "text-[clamp(1.5rem,3vw,2rem)]" : "text-xl"
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="font-mono text-xs opacity-70">{suffix}</span>
        )}
      </div>
      {sparkline && sparkline.length > 0 && (
        <Sparkline values={sparkline} color={accentColor} />
      )}
      {delta && (
        <div className="flex items-center gap-1 font-mono text-[11px] opacity-80 [&>svg]:size-3">
          {TrendIcon && <TrendIcon />}
          <span>{delta.value}</span>
        </div>
      )}
    </div>
  )
}
