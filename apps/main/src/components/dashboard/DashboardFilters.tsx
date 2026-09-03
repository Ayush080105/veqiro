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
  return `${fmt(range.from)} - ${fmt(range.to)}`
}

function formatDateChip(date: Date | undefined): string {
  if (!date) return "Select date"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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

function isSameCalendarDay(a: Date | undefined, b: Date | undefined): boolean {
  if (!a || !b) return false
  return a.toDateString() === b.toDateString()
}

export function DashboardFilters({
  range,
  agents,
  onRangeChange,
  onAgentsChange,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)
  const today = new Date()
  // End of the current month — limits navigation but shows the full month grid
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

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
    if (picked?.from && picked.to && isSameCalendarDay(picked.from, picked.to)) {
      setDraftRange({ from: picked.from, to: undefined })
      return
    }

    setDraftRange(picked)
  }

  const onCalendarOpenChange = (open: boolean) => {
    setCalendarOpen(open)
    if (open) {
      setDraftRange(
        range.kind === "custom" ? { from: range.from, to: range.to } : undefined,
      )
    }
  }

  const clearCustom = () => {
    setDraftRange(undefined)
    onRangeChange({ kind: "7d" })
  }

  const applyCustom = () => {
    if (!draftRange?.from || !draftRange.to) return
    const from = draftRange.from <= draftRange.to ? draftRange.from : draftRange.to
    const to = draftRange.from <= draftRange.to ? draftRange.to : draftRange.from
    onRangeChange({ kind: "custom", from, to })
    setCalendarOpen(false)
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <ToggleGroup
        value={toggleGroupValue}
        onValueChange={onToggleGroupChange}
        aria-label="Dashboard date range"
        className="h-11 overflow-hidden rounded-full border border-[var(--vq-line-2)] bg-white p-0 shadow-[var(--vq-shadow-sm)]"
      >
        <ToggleGroupItem
          value="24h"
          className="h-full min-w-12 rounded-none border-0 bg-white px-3 py-0 font-mono text-xs uppercase text-[#111] hover:bg-[#FFF9ED] data-[state=on]:bg-[#FFF9ED] data-[state=on]:text-[#111] data-[state=on]:shadow-none"
        >
          24h
        </ToggleGroupItem>
        <ToggleGroupItem
          value="7d"
          className="h-full min-w-12 rounded-none border-0 border-l border-[var(--vq-line-2)] bg-white px-3 py-0 font-mono text-xs uppercase text-[#111] hover:bg-[#FFF9ED] data-[state=on]:bg-[#FFF9ED] data-[state=on]:text-[#111] data-[state=on]:shadow-none"
        >
          7d
        </ToggleGroupItem>
        <ToggleGroupItem
          value="30d"
          className="h-full min-w-12 rounded-none border-0 border-l border-[var(--vq-line-2)] bg-white px-3 py-0 font-mono text-xs uppercase text-[#111] hover:bg-[#FFF9ED] data-[state=on]:bg-[#FFF9ED] data-[state=on]:text-[#111] data-[state=on]:shadow-none"
        >
          30d
        </ToggleGroupItem>
      </ToggleGroup>

      <Popover open={calendarOpen} onOpenChange={onCalendarOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 rounded-full border border-[var(--vq-line-2)] bg-white px-3 font-mono text-xs uppercase shadow-[var(--vq-shadow-sm)] hover:bg-[#FFF9ED]"
            />
          }
        >
          <CalendarIcon className="mr-1 size-3.5" />
          {range.kind === "custom" ? formatRangeLabel(range) : "Custom"}
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(calc(100vw-1rem),21.5rem)] overflow-hidden rounded-md border border-[var(--vq-line-2)] bg-white p-0 shadow-[var(--vq-shadow)]"
          align="end"
          sideOffset={8}
        >
          <div className="border-b border-[var(--vq-line-2)] bg-[#FFF9ED] px-3 py-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-md border border-[var(--vq-line-2)] bg-white px-2.5 py-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
                  Start
                </div>
                <div className="mt-1 truncate font-mono text-xs text-[#111]">
                  {formatDateChip(draftRange?.from)}
                </div>
              </div>
              <div className="min-w-0 rounded-md border border-[var(--vq-line-2)] bg-white px-2.5 py-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
                  End
                </div>
                <div className="mt-1 truncate font-mono text-xs text-[#111]">
                  {formatDateChip(
                    isSameCalendarDay(draftRange?.from, draftRange?.to)
                      ? undefined
                      : draftRange?.to,
                  )}
                </div>
              </div>
            </div>
            <p className="m-0 mt-2 font-mono text-[9px] uppercase tracking-wider text-[#666]">
              Choose start and end, then apply.
            </p>
          </div>
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={onCustomSelect}
            disabled={{ after: today }}
            endMonth={endOfMonth}
            defaultMonth={range.kind === "custom" ? range.from : today}
            numberOfMonths={1}
            fixedWeeks
            className="relative w-full bg-white px-3 py-2.5 [--cell-size:1.95rem]"
            classNames={{
              root: "relative w-full",
              months: "flex w-full flex-col",
              month: "w-full gap-1.5",
              month_caption:
                "flex h-9 w-full items-center justify-center px-10 font-mono text-sm uppercase tracking-wider text-[#111]",
              caption_label: "font-mono text-[13px] font-semibold text-[#111]",
              nav: "absolute inset-x-3 top-2.5 flex items-center justify-between",
              button_previous:
                "size-7 rounded-md border border-[var(--vq-line-2)] bg-white p-0 text-[#111] shadow-[var(--vq-shadow-sm)] hover:bg-[#FFF9ED]",
              button_next:
                "size-7 rounded-md border border-[var(--vq-line-2)] bg-white p-0 text-[#111] shadow-[var(--vq-shadow-sm)] hover:bg-[#FFF9ED] disabled:opacity-35",
              month_grid: "w-full",
              weeks: "w-full",
              weekdays: "grid grid-cols-7 gap-0.5",
              weekday:
                "grid h-6 place-items-center rounded-sm font-mono text-[10px] uppercase tracking-wider text-[#555]",
              week: "mt-0.5 grid grid-cols-7 gap-0.5",
              day: "relative grid aspect-square min-w-0 place-items-center rounded-sm p-0 text-center",
              outside: "text-[#777] opacity-20",
              today:
                "font-bold text-[#111] after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-[#111]",
              disabled: "pointer-events-none",
              range_start: "rounded-l-md bg-[#F5C518]",
              range_middle: "rounded-none bg-[#F5C518]/40",
              range_end: "rounded-r-md bg-[#F5C518]",
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t border-[var(--vq-line-2)] bg-[#FFF9ED] px-3 py-2.5">
            <Button
              type="button"
              variant="outline"
              size="brand-sm"
              onClick={() => setDraftRange(undefined)}
              className="h-9 border border-[var(--vq-line-2)] bg-white px-3 text-[11px] shadow-[var(--vq-shadow-sm)]"
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="brand-dark"
              size="brand-sm"
              disabled={!draftRange?.from || !draftRange.to}
              onClick={applyCustom}
              className="h-9 px-4 text-[11px] disabled:border-[#111] disabled:bg-[#888] disabled:text-white disabled:shadow-none disabled:opacity-65"
            >
              Apply range
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {range.kind === "custom" && (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Clear custom range"
          onClick={clearCustom}
          className="size-10 rounded-full p-0"
        >
          <X className="size-3.5" />
        </Button>
      )}

      <Popover open={agentsOpen} onOpenChange={setAgentsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 rounded-full border border-[var(--vq-line-2)] bg-white px-3 font-mono text-xs uppercase shadow-[var(--vq-shadow-sm)] hover:bg-[#FFF9ED]"
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
              className="flex min-h-11 items-center justify-between border-b border-[var(--vq-line)] px-3 py-2 text-left font-mono text-xs uppercase tracking-wider hover:bg-[#FFF9ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-[#FFF9ED]">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleAgent(a.id)}
                      />
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full border border-[var(--vq-line-2)]"
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
            <p className="border-t border-[var(--vq-line)] px-3 py-2 font-mono text-[10px] leading-snug text-[#777]">
              Applies to assistant activity. Post counts show all agents.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
