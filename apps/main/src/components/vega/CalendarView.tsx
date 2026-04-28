"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import { fetchCalendar } from "@/lib/api/vega-calendar"
import { EventSidePanel } from "./EventSidePanel"
import { EventCreateForm } from "./EventCreateForm"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Video,
  RotateCcw,
  CalendarDays,
} from "lucide-react"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

// ─── Event card within a day column ──────────────────────────────────────────

function EventCell({
  event,
  isSelected,
  onSelect,
}: {
  event: CalendarEvent
  isSelected: boolean
  onSelect: (e: CalendarEvent) => void
}) {
  return (
    <button
      onClick={() => onSelect(event)}
      className="w-full text-left"
      style={{
        padding: "5px 8px",
        border: isSelected ? "2px solid #111" : "1.5px solid #E5E5E5",
        borderRadius: 6,
        background: isSelected ? "#FFF9ED" : "#fff",
        boxShadow: isSelected ? "2px 2px 0 #111" : "none",
        cursor: "pointer",
      }}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight">{event.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {fmtTime(event.start)}
          </p>
        </div>
        {event.meetLink && <Video className="size-3 text-green-600 shrink-0 mt-0.5" />}
      </div>
      {event.attendees.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {event.attendees.slice(0, 2).join(", ")}
          {event.attendees.length > 2 && ` +${event.attendees.length - 2}`}
        </p>
      )}
    </button>
  )
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  date,
  events,
  selectedId,
  onSelect,
}: {
  date: Date
  events: CalendarEvent[]
  selectedId: string | null
  onSelect: (e: CalendarEvent) => void
}) {
  const isToday = isSameDay(date, new Date())
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div
      className="flex flex-col min-w-0 flex-1"
      style={{ borderRight: "1.5px solid #E5E5E5" }}
    >
      <div
        className="flex flex-col items-center py-2 shrink-0"
        style={{
          borderBottom: "1.5px solid #E5E5E5",
          background: isToday ? "#FFF9ED" : "transparent",
        }}
      >
        <span
          className="text-[9px] uppercase tracking-wider text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {date.toLocaleDateString("en-US", { weekday: "short" })}
        </span>
        <span
          className="text-xs font-semibold mt-0.5"
          style={{ color: isToday ? "#111" : "#666" }}
        >
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-1.5 flex-1 overflow-y-auto">
        {sorted.map((ev) => (
          <EventCell
            key={ev.id}
            event={ev}
            isSelected={selectedId === ev.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  initialPrefill?: {
    title?: string
    attendees?: string[]
    description?: string
  }
}

export function CalendarView({ initialPrefill }: CalendarViewProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(!!initialPrefill)
  const [createPrefill, setCreatePrefill] = useState(initialPrefill)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: qk.vegaCalendar(organizationId),
    queryFn: () => fetchCalendar(14),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of data?.events ?? []) {
      const day = ev.start.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(ev)
    }
    return map
  }, [data?.events])

  const handleEventCreated = (event: CalendarEvent) => {
    setShowCreateForm(false)
    setCreatePrefill(undefined)
    setSelectedEvent(event)
    queryClient.invalidateQueries({ queryKey: qk.vegaCalendar(organizationId) })
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-full rounded-none" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle className="size-8 text-destructive opacity-60" />
        <p className="text-sm font-medium">Could not load calendar</p>
        <p className="text-xs text-muted-foreground">
          Check your Google connection in Settings → Integrations
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Calendar grid */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ borderBottom: "2px solid #E5E5E5" }}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span
              className="text-xs font-semibold px-2"
              style={{ fontFamily: "var(--font-mono)", minWidth: 180 }}
            >
              {weekStart.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}{" "}
              –{" "}
              {addDays(weekStart, 6).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2 ml-1"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Today
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowCreateForm(true)
                setCreatePrefill(undefined)
                setSelectedEvent(null)
              }}
              style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            >
              <Plus className="size-3.5" />
              New Event
            </Button>
          </div>
        </div>

        {/* Week grid */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {weekDays.map((day) => {
            const key = day.toISOString().slice(0, 10)
            return (
              <DayColumn
                key={key}
                date={day}
                events={eventsByDay.get(key) ?? []}
                selectedId={selectedEvent?.id ?? null}
                onSelect={(ev) => {
                  setSelectedEvent(ev)
                  setShowCreateForm(false)
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div
        className="shrink-0 overflow-y-auto"
        style={{ width: 320, borderLeft: "2px solid #E5E5E5" }}
      >
        {showCreateForm ? (
          <EventCreateForm
            prefill={createPrefill}
            onCreated={handleEventCreated}
            onCancel={() => {
              setShowCreateForm(false)
              setCreatePrefill(undefined)
            }}
          />
        ) : selectedEvent ? (
          <EventSidePanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6">
            <CalendarDays className="size-10 opacity-20" />
            <p className="text-sm text-center">
              Select an event to see details, or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
