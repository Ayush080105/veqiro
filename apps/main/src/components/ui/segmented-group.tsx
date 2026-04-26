"use client"

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface SegmentedOption<V extends string = string> {
  value: V
  label: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

interface SegmentedGroupProps<V extends string = string> {
  options: SegmentedOption<V>[]
  value: V
  onValueChange: (next: V) => void
  /** Optional label rendered above the group (kicker style). */
  label?: string
  size?: "sm" | "default"
  className?: string
  itemClassName?: string
}

export function SegmentedGroup<V extends string = string>({
  options,
  value,
  onValueChange,
  label,
  size = "default",
  className,
  itemClassName,
}: SegmentedGroupProps<V>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label variant="kicker">{label}</Label>}
      <ToggleGroup
        value={[value]}
        onValueChange={(next) => {
          // Single-select behavior: pick the most-recently-selected value, ignoring
          // the deselect path (clicking the active item should not produce empty state).
          const arr = Array.isArray(next) ? next : [next]
          const v = (arr.find((x) => x !== value) ?? arr[0]) as V | undefined
          if (v && v !== value) onValueChange(v)
        }}
        variant="outline"
        size={size}
        className="w-fit"
      >
        {options.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            aria-label={typeof opt.label === "string" ? opt.label : opt.value}
            className={cn(
              "data-[pressed=true]:border-foreground data-[pressed=true]:bg-foreground data-[pressed=true]:text-primary-foreground",
              itemClassName
            )}
          >
            {opt.icon && <span aria-hidden>{opt.icon}</span>}
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
