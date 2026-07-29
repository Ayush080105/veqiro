"use client"

import { Badge } from "@/components/ui/badge"
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

  let barColor = "var(--primary)"
  if (isExhausted) barColor = "var(--destructive)"
  else if (isNearLimit) barColor = "#f59e0b"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {resource.remaining}{unit ? ` ${unit}` : ""} remaining
          {isExhausted && (
            <Badge variant="destructive" className="ml-2 text-[10px]">Exhausted</Badge>
          )}
          {!isExhausted && isNearLimit && (
            <Badge variant="secondary" className="ml-2 text-[10px]">Running low</Badge>
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
