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
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${fmt(range.from)} - ${fmt(range.to)}`
}

function formatDateChip(date: Date | undefined): string {
  if (!date) return "Select date"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function agentButtonLabel(agents: AgentSlug[]): string {
  if (agents.length === ALL_SLUGS.length) return "All agents"
  if (agents.length === 0) return "No agents"
  if (agents.length === 1) return AGENTS.find((x) => x.id === agents[0])?.name ?? "1 agent"
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
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const allSelected = agents.length === ALL_SLUGS.length
  const toggleGroupValue: string[] = range.kind === "custom" ? [] : [range.kind]

  const toggleAgent = (slug: AgentSlug) => {
    onAgentsChange(agents.includes(slug) ? agents.filter((a) => a !== slug) : [...agents, slug])
  }

  const onToggleGroupChange = (values: string[]) => {
    const value = values[0]
    if (value === "24h" || value === "7d" || value === "30d") onRangeChange({ kind: value as RangeKind })
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
    if (open) setDraftRange(range.kind === "custom" ? { from: range.from, to: range.to } : undefined)
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
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <ToggleGroup
        value={toggleGroupValue}
        onValueChange={onToggleGroupChange}
        aria-label="Dashboard date range"
        className="h-9 overflow-hidden rounded-[var(--vq-r-sm)] border border-border bg-card p-0"
      >
        {(["24h", "7d", "30d"] as const).map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="h-full min-w-11 rounded-none border-0 border-l border-border bg-card px-3 py-0 text-xs font-medium text-muted-foreground first:border-l-0 hover:bg-muted data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-none"
          >
            {value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover open={calendarOpen} onOpenChange={onCalendarOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-[var(--vq-r-sm)] border-border bg-card px-3 text-xs font-medium shadow-none hover:bg-muted"
            />
          }
        >
          <CalendarIcon className="mr-1 size-3.5" />
          {range.kind === "custom" ? formatRangeLabel(range) : "Custom"}
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(calc(100vw-1rem),21.5rem)] overflow-hidden rounded-[var(--vq-r)] border border-border bg-popover p-0 shadow-[var(--vq-shadow-lg)]"
          align="end"
          sideOffset={8}
        >
          <div className="border-b border-border bg-popover px-3 py-2.5">
            <div className="grid grid-cols-2 gap-2">
              {([
                ["Start", draftRange?.from],
                ["End", isSameCalendarDay(draftRange?.from, draftRange?.to) ? undefined : draftRange?.to],
              ] as Array<[string, Date | undefined]>).map(([label, date]) => (
                <div key={label} className="min-w-0 rounded-[var(--vq-r-sm)] border border-border bg-card px-2.5 py-2">
                  <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
                  <div className="mt-1 truncate text-xs text-foreground">{formatDateChip(date)}</div>
                </div>
              ))}
            </div>
            <p className="m-0 mt-2 text-[11px] text-muted-foreground">Choose start and end, then apply.</p>
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
            className="relative w-full bg-popover px-3 py-2.5 [--cell-size:1.95rem]"
            classNames={{
              root: "relative w-full",
              months: "flex w-full flex-col",
              month: "w-full gap-1.5",
              month_caption: "flex h-9 w-full items-center justify-center px-10 text-sm font-semibold text-foreground",
              caption_label: "text-sm font-semibold text-foreground",
              nav: "absolute inset-x-3 top-2.5 flex items-center justify-between",
              button_previous: "size-7 rounded-[var(--vq-r-sm)] border border-border bg-card p-0 text-foreground hover:bg-muted",
              button_next: "size-7 rounded-[var(--vq-r-sm)] border border-border bg-card p-0 text-foreground hover:bg-muted disabled:opacity-35",
              month_grid: "w-full",
              weeks: "w-full",
              weekdays: "grid grid-cols-7 gap-0.5",
              weekday: "grid h-6 place-items-center rounded-sm text-[11px] font-medium text-muted-foreground",
              week: "mt-0.5 grid grid-cols-7 gap-0.5",
              day: "relative grid aspect-square min-w-0 place-items-center rounded-sm p-0 text-center",
              outside: "text-muted-foreground opacity-20",
              today: "font-bold text-foreground after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground",
              disabled: "pointer-events-none",
              range_start: "rounded-l-md bg-accent",
              range_middle: "rounded-none bg-accent/40",
              range_end: "rounded-r-md bg-accent",
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border bg-popover px-3 py-2.5">
            <Button type="button" variant="outline" size="brand-sm" onClick={() => setDraftRange(undefined)} className="h-9 border-border bg-card px-3 text-[11px] shadow-none">
              Clear
            </Button>
            <Button type="button" variant="brand-dark" size="brand-sm" disabled={!draftRange?.from || !draftRange.to} onClick={applyCustom} className="h-9 px-4 text-[11px] disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:opacity-65">
              Apply range
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {range.kind === "custom" && (
        <Button variant="ghost" size="sm" aria-label="Clear custom range" onClick={clearCustom} className="size-9 rounded-[var(--vq-r-sm)] p-0">
          <X className="size-3.5" />
        </Button>
      )}

      <Popover open={agentsOpen} onOpenChange={setAgentsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-[var(--vq-r-sm)] border-border bg-card px-3 text-xs font-medium shadow-none hover:bg-muted"
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
              onClick={() => onAgentsChange(allSelected ? [] : [...ALL_SLUGS])}
              className="flex min-h-11 items-center justify-between border-b border-border px-3 py-2 text-left text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{allSelected ? "Clear all" : "Select all"}</span>
              <span className="text-muted-foreground">{agents.length}/{ALL_SLUGS.length}</span>
            </button>
            <ul className="flex flex-col py-1">
              {AGENTS.map((a) => (
                <li key={a.id}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted">
                    <Checkbox checked={agents.includes(a.id)} onCheckedChange={() => toggleAgent(a.id)} />
                    <span aria-hidden className="size-2 shrink-0 rounded-full border border-border" style={{ background: a.color }} />
                    <span className="flex-1 font-medium">{a.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              Applies to assistant activity. Post counts show all agents.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
