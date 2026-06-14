import * as React from "react"

import { cn } from "@/lib/utils"
import { Sticker } from "@/components/ui/sticker"

/** Legacy sticker prop shape kept for migration ergonomics. */
type LegacySticker = { label: string; rot?: number; color?: string }
type StickerProp = React.ReactNode | LegacySticker

interface PageHeaderProps {
  title: React.ReactNode
  kicker?: string
  subtitle?: React.ReactNode
  /** Optional sticker. Pass a ReactNode (e.g. <Sticker .../>) or { label, rot, color }. */
  sticker?: StickerProp
  /** Right-aligned actions (buttons, etc.). */
  right?: React.ReactNode
  /** Container class overrides. */
  className?: string
  /** Title display size. "lg" = page hero, "md" = section. */
  size?: "md" | "lg"
}

const COLOR_TO_TONE: Record<string, React.ComponentProps<typeof Sticker>["tone"]> = {
  "var(--vq-yellow)": "yellow",
  "var(--vq-red)": "red",
  "var(--vq-green)": "green",
  "var(--vq-violet)": "violet",
  "var(--vq-blue)": "blue",
  "var(--vq-pink)": "pink",
  "#F5C518": "yellow",
  "#F06464": "red",
  "#1DBC87": "green",
  "#8A8AF0": "violet",
  "#6FCDE8": "blue",
  "#F79FD4": "pink",
}

function isLegacySticker(s: StickerProp): s is LegacySticker {
  return (
    typeof s === "object" &&
    s !== null &&
    !React.isValidElement(s) &&
    "label" in (s as Record<string, unknown>)
  )
}

function renderSticker(s: StickerProp): React.ReactNode {
  if (s == null) return null
  if (!isLegacySticker(s)) return s
  const tone = (s.color ? COLOR_TO_TONE[s.color] : undefined) ?? "yellow"
  return (
    <Sticker rotate={s.rot ?? -4} tone={tone}>
      {s.label}
    </Sticker>
  )
}

export function PageHeader({
  title,
  kicker,
  subtitle,
  sticker,
  right,
  className,
  size = "lg",
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {kicker && (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-muted-foreground">
            [ {kicker} ]
          </span>
        )}
        <h1
          className={cn(
            "m-0 font-display leading-[0.95] tracking-tight text-foreground",
            size === "lg" && "text-[clamp(2.125rem,4vw,3.25rem)]",
            size === "md" && "text-[clamp(1.625rem,3vw,2.25rem)]"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {(sticker || right) && (
        <div className="flex w-full shrink-0 flex-wrap items-start gap-3 sm:w-auto">
          {renderSticker(sticker)}
          {right}
        </div>
      )}
    </header>
  )
}
