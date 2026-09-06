"use client"

import { cn } from "@/lib/utils"

interface CharCountProps {
  value: string
  min?: number
  max?: number
  hint?: string
}

// Live character counter shown beneath a textarea. Renders below-min state in
// amber and above-max state in red. Stays out of the way once the field is in
// the green band.
export function CharCount({ value, min, max, hint }: CharCountProps) {
  const len = value.trim().length
  const tooShort = typeof min === "number" && len < min
  const tooLong = typeof max === "number" && len > max
  const fine = !tooShort && !tooLong

  const colorClass = tooLong ? "text-destructive" : tooShort ? "text-amber-700" : "text-chart-2"

  let label: string
  if (tooLong && typeof max === "number") {
    label = `${len} / ${max} max — trim`
  } else if (typeof min === "number" && typeof max === "number") {
    label = `${len} chars (${min} min · ${max} max)`
  } else if (typeof min === "number") {
    label = `${len} / ${min} min`
  } else if (typeof max === "number") {
    label = `${len} / ${max} max`
  } else {
    label = `${len} chars`
  }

  return (
    <div className={cn("mt-1.5 flex items-center justify-between font-mono text-[11px]", colorClass)}>
      <span>{label}</span>
      {hint && !fine && (
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}
