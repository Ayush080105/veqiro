"use client"

import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AGENTS } from "@/lib/config/agents"
import { ALL_SLUGS, type Range, type RangeKind } from "@/lib/api/dashboard"
import type { AgentSlug } from "@/lib/types"

type Props = {
  range: Range
  agents: AgentSlug[]
  onRangeChange: (range: Range) => void
  onAgentsChange: (agents: AgentSlug[]) => void
}

function formatRangeLabel(range: Range): string {
  if (range.kind !== "custom") return ""
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${fmt(range.from)} – ${fmt(range.to)}`
}

export function DashboardFilters({
  range,
  agents,
  onRangeChange,
  onAgentsChange,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const allSelected = agents.length === ALL_SLUGS.length

  // base-ui ToggleGroup uses string[] for value; empty array = nothing selected
  const toggleGroupValue: string[] =
    range.kind === "custom" ? [] : [range.kind]

  const toggleAgent = (slug: AgentSlug) => {
    onAgentsChange(
      agents.includes(slug)
        ? agents.filter((a) => a !== slug)
        : [...agents, slug],
    )
  }

  const toggleAll = () => {
    onAgentsChange(allSelected ? [] : [...ALL_SLUGS])
  }

  // base-ui onValueChange receives string[] not string
  const onToggleGroupChange = (values: string[]) => {
    const value = values[0]
    if (value === "24h" || value === "7d" || value === "30d") {
      onRangeChange({ kind: value as RangeKind })
    }
  }

  const onCustomSelect = (picked: DateRange | undefined) => {
    // First click sets `from`; popover stays open until `to` is selected too.
    if (picked?.from && picked.to) {
      onRangeChange({ kind: "custom", from: picked.from, to: picked.to })
      setPickerOpen(false)
    }
  }

  const clearCustom = () => onRangeChange({ kind: "7d" })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[3px] border-[#111] bg-[#FFF9ED] p-3 shadow-[5px_5px_0_#111]">
      {/* Left: agent chips + hint */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          data-active={allSelected}
          className="rounded-full border-2 border-[#111] px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors data-[active=true]:bg-[#111] data-[active=true]:text-[#EFE7D6] data-[active=false]:bg-white"
        >
          All
        </button>
        {AGENTS.map((a) => {
          const active = agents.includes(a.id)
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAgent(a.id)}
              data-active={active}
              className="rounded-full border-2 border-[#111] px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors data-[active=true]:text-[#111] data-[active=false]:bg-white data-[active=false]:text-[#555]"
              style={active ? { background: a.color } : undefined}
            >
              {a.name}
            </button>
          )
        })}
        <span className="ml-1 text-[10px] font-mono tracking-wider text-[#777]">
          agent filter applies to assistant activity. post counts show all agents.
        </span>
      </div>

      {/* Right: range toggle + custom date picker */}
      <div className="flex items-center gap-2">
        {/* base-ui ToggleGroup: value is string[], multiple defaults to false (single-select) */}
        <ToggleGroup
          value={toggleGroupValue}
          onValueChange={onToggleGroupChange}
          className="rounded-full border-2 border-[#111] bg-white"
        >
          <ToggleGroupItem
            value="24h"
            className="px-3 py-1 text-xs font-mono uppercase"
          >
            24h
          </ToggleGroupItem>
          <ToggleGroupItem
            value="7d"
            className="px-3 py-1 text-xs font-mono uppercase"
          >
            7d
          </ToggleGroupItem>
          <ToggleGroupItem
            value="30d"
            className="px-3 py-1 text-xs font-mono uppercase"
          >
            30d
          </ToggleGroupItem>
        </ToggleGroup>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="flex items-center gap-1" />
            }
          >
            <CalendarIcon className="mr-1 size-3.5" />
            {range.kind === "custom" ? formatRangeLabel(range) : "Custom"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={
                range.kind === "custom"
                  ? { from: range.from, to: range.to }
                  : undefined
              }
              onSelect={onCustomSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        {range.kind === "custom" && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Clear custom range"
            onClick={clearCustom}
            className="size-7 p-0"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
