"use client"

import { useState } from "react"
import { CalendarIcon, ChevronDown, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
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

function agentButtonLabel(agents: AgentSlug[]): string {
  if (agents.length === ALL_SLUGS.length) return "All agents"
  if (agents.length === 0) return "No agents"
  if (agents.length === 1) {
    const a = AGENTS.find((x) => x.id === agents[0])
    return a?.name ?? "1 agent"
  }
  return `${agents.length} agents`
}

export function DashboardFilters({
  range,
  agents,
  onRangeChange,
  onAgentsChange,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)

  const allSelected = agents.length === ALL_SLUGS.length
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
      setCalendarOpen(false)
    }
  }

  const clearCustom = () => onRangeChange({ kind: "7d" })

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Range: 24h / 7d / 30d */}
      <ToggleGroup
        value={toggleGroupValue}
        onValueChange={onToggleGroupChange}
        className="rounded-full border-2 border-[#111] bg-white shadow-[2px_2px_0_#111]"
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

      {/* Custom date range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-2 border-[#111] bg-white px-3 text-xs font-mono uppercase shadow-[2px_2px_0_#111] hover:bg-[#FFF9ED]"
            />
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
          className="size-7 rounded-full p-0"
        >
          <X className="size-3.5" />
        </Button>
      )}

      {/* Agents multi-select */}
      <Popover open={agentsOpen} onOpenChange={setAgentsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-2 border-[#111] bg-white px-3 text-xs font-mono uppercase shadow-[2px_2px_0_#111] hover:bg-[#FFF9ED]"
            />
          }
        >
          {agentButtonLabel(agents)}
          <ChevronDown className="ml-1 size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="end">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center justify-between border-b border-[#11111122] px-3 py-2 text-left text-xs font-mono uppercase tracking-wider hover:bg-[#FFF9ED]"
            >
              <span>{allSelected ? "Clear all" : "Select all"}</span>
              <span className="text-[#777]">
                {agents.length}/{ALL_SLUGS.length}
              </span>
            </button>
            <ul className="flex flex-col py-1">
              {AGENTS.map((a) => {
                const checked = agents.includes(a.id)
                return (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-[#FFF9ED]">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleAgent(a.id)}
                      />
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full border border-[#111]"
                        style={{ background: a.color }}
                      />
                      <span className="flex-1 font-mono uppercase tracking-wider">
                        {a.name}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-[#11111122] px-3 py-2 text-[10px] font-mono leading-snug text-[#777]">
              Applies to assistant activity. Post counts show all agents.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
