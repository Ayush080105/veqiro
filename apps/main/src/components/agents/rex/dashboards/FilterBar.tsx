"use client"

import { X } from "lucide-react"

import { DATE_PRESETS, type DashboardFilter, type FilterState } from "@/lib/api/rexDashboards"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const ALL = "__all__"

/** Viewer filters, shared by the editor and the public page. */
export function FilterBar({
  filters,
  state,
  onChange,
}: {
  filters: DashboardFilter[]
  state: FilterState
  onChange: (next: FilterState) => void
}) {
  if (!filters.length) return null
  const active = Object.values(state).some(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => {
        const options = f.type === "date_range"
          ? DATE_PRESETS
          : (f.options ?? []).map((o) => ({ value: o, label: o }))
        const label = (v: string | undefined) =>
          v ? (options.find((o) => o.value === v)?.label ?? v) : (f.type === "date_range" ? "All time" : "All")
        return (
          <Select
            key={f.id}
            value={state[f.id] ?? ALL}
            onValueChange={(v) => {
              const next = { ...state }
              if (!v || v === ALL) delete next[f.id]
              else next[f.id] = v
              onChange(next)
            }}
          >
            <SelectTrigger size="sm" className="h-8 min-w-[140px] text-xs" aria-label={f.label}>
              <SelectValue>{(v: string) => `${f.label}: ${label(v === ALL ? undefined : v)}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.type === "date_range" ? "All time" : "All"}</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
      {active && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange({})}>
          <X className="size-3" /> Clear
        </Button>
      )}
    </div>
  )
}
