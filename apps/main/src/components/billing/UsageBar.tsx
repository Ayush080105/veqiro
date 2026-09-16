"use client"

import { StatusPill } from "@/components/ui/status-pill"
import type { UsageResource } from "@/lib/api/billing"
import type { ImageIcon } from "lucide-react"

export function UsageBar({
  label,
  icon: Icon,
  resource,
  unit,
}: {
  label: string
  icon: typeof ImageIcon
  resource: UsageResource
  unit?: string
}) {
  const pct = resource.limit === 0 ? 0 : Math.min(100, Math.round((resource.used / resource.limit) * 100))
  const isNearLimit = pct >= 80
  const isExhausted = resource.remaining === 0
  const unitLabel = unit ? ` ${unit}` : ""

  let barColor = "var(--primary)"
  if (isExhausted) barColor = "var(--destructive)"
  else if (isNearLimit) barColor = "var(--foreground)"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {resource.used}{unitLabel} used / {resource.remaining}{unitLabel} remaining
          {isExhausted && (
            <StatusPill level="danger" icon={null} className="ml-2">Exhausted</StatusPill>
          )}
          {!isExhausted && isNearLimit && (
            <StatusPill level="warn" icon={null} className="ml-2">Running low</StatusPill>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}
