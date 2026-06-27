"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import { fetchCalendar } from "@/lib/api/vega-calendar"
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"
import { getUpgradeRequiredReason } from "@/components/billing/upgrade-errors"
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

type CalendarMode = "week" | "day" | "month"
type CreatePrefill = {
  title?: string
  attendees?: string[]
  description?: string
  date?: string
  startTime?: string
  endTime?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 64

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function timeFromDate(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number)
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  d.setMinutes(d.getMinutes() + minutes)
  return timeFromDate(d)
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function fmtRange(start: Date, end: Date, mode: CalendarMode): string {
  if (mode === "day") {
    return start.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }
  if (mode === "month") {
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${addDays(end, -1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`
}

function eventDateKey(event: CalendarEvent): string {
  if (event.allDay && /^\d{4}-\d{2}-\d{2}$/.test(event.start)) return event.start
  return toLocalDateKey(new Date(event.start))
}

function isTimedEvent(event: CalendarEvent): boolean {
  return !event.allDay && !Number.isNaN(new Date(event.start).getTime())
}

function getVisibleRange(anchor: Date, mode: CalendarMode) {
  if (mode === "day") {
    const start = startOfDay(anchor)
    return { start, end: addDays(start, 1) }
  }
  if (mode === "month") {
    const monthStart = startOfMonth(anchor)
    const gridStart = startOfWeek(monthStart)
    return { start: gridStart, end: addDays(gridStart, 42), labelStart: monthStart }
  }
  const start = startOfWeek(anchor)
  return { start, end: addDays(start, 7) }
}

function groupEvents(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const key = eventDateKey(event)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(event)
  }
  return map
}

function laneForEvent(events: CalendarEvent[], event: CalendarEvent): number {
  const currentStart = new Date(event.start).getTime()
  const currentEnd = new Date(event.end).getTime()
  const previous = events
    .filter((candidate) => candidate.id !== event.id)
    .filter((candidate) => {
      const start = new Date(candidate.start).getTime()
      const end = new Date(candidate.end).getTime()
      return start < currentEnd && end > currentStart && start <= currentStart
    })
  return Math.min(previous.length, 2)
}

function CalendarEventBlock({
  event,
  dayEvents,
  selectedId,
  onSelect,
}: {
  event: CalendarEvent
  dayEvents: CalendarEvent[]
  selectedId: string | null
  onSelect: (event: CalendarEvent) => void
}) {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const top = Math.max(0, ((startMinutes - HOURS[0] * 60) / 60) * HOUR_HEIGHT)
  const height = Math.max(28, ((Math.max(endMinutes, startMinutes + 15) - startMinutes) / 60) * HOUR_HEIGHT)
  const lane = laneForEvent(dayEvents, event)
  const left = lane * 8 + 4
  const width = 92 - lane * 8

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onSelect(event)
      }}
      className="absolute text-left overflow-hidden"
      style={{
        top,
        height,
        left: `${left}%`,
        width: `${width}%`,
        border: selectedId === event.id ? "2px solid #111" : "1.5px solid #111",
        borderRadius: 7,
        background: selectedId === event.id ? "#FFF1C7" : "#F7FBFF",
        boxShadow: selectedId === event.id ? "2px 2px 0 #111" : "none",
        padding: "5px 7px",
        zIndex: 5 + lane,
      }}
    >
      <div className="flex items-start gap-1 min-w-0">
        <span className="h-2 w-2 rounded-full mt-1 shrink-0" style={{ background: "#1DBC87" }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight">{event.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {fmtTime(event.start)} - {fmtTime(event.end)}
          </p>
        </div>
        {event.meetLink && <Video className="size-3 text-green-700 shrink-0" />}
      </div>
    </button>
  )
}

function AllDayRow({
  days,
  eventsByDay,
  selectedId,
  onSelect,
}: {
  days: Date[]
  eventsByDay: Map<string, CalendarEvent[]>
  selectedId: string | null
  onSelect: (event: CalendarEvent) => void
}) {
  return (
    <div className="grid shrink-0" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(110px, 1fr))`, borderBottom: "1.5px solid #111" }}>
      <div className="px-2 py-2 text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        all-day
      </div>
      {days.map((day) => {
        const events = (eventsByDay.get(toLocalDateKey(day)) ?? []).filter((event) => event.allDay)
        return (
          <div key={toLocalDateKey(day)} className="min-h-10 p-1" style={{ borderLeft: "1.5px solid #E0DED2" }}>
            {events.slice(0, 2).map((event) => (
              <button
                key={event.id}
                onClick={() => onSelect(event)}
                className="mb-1 block w-full truncate text-left text-[11px] font-semibold"
                style={{
                  border: selectedId === event.id ? "2px solid #111" : "1px solid #111",
                  borderRadius: 999,
                  padding: "2px 7px",
                  background: "#E9F7F0",
                }}
              >
                {event.title}
              </button>
            ))}
            {events.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{events.length - 2} more</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TimeGrid({
  days,
  eventsByDay,
  selectedId,
  onSelect,
  onCreateSlot,
}: {
  days: Date[]
  eventsByDay: Map<string, CalendarEvent[]>
  selectedId: string | null
  onSelect: (event: CalendarEvent) => void
  onCreateSlot: (date: Date, hour: number, minute: number) => void
}) {
  const now = new Date()

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div
        className="grid min-w-[760px]"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(120px, 1fr))` }}
      >
        <div>
          {HOURS.map((hour) => (
            <div key={hour} className="pr-2 text-right text-[10px] text-muted-foreground" style={{ height: HOUR_HEIGHT, fontFamily: "var(--font-mono)" }}>
              {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const key = toLocalDateKey(day)
          const timedEvents = (eventsByDay.get(key) ?? [])
            .filter(isTimedEvent)
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          const today = isSameDay(day, now)
          const currentTop = ((now.getHours() * 60 + now.getMinutes() - HOURS[0] * 60) / 60) * HOUR_HEIGHT

          return (
            <div
              key={key}
              className="relative"
              style={{
                height: HOURS.length * HOUR_HEIGHT,
                borderLeft: "1.5px solid #E0DED2",
                background: today ? "#FFFBF0" : "#fff",
              }}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT, borderTop: "1px solid #ECE8DC" }}>
                  <button
                    aria-label={`Create event at ${hour}:00`}
                    className="absolute inset-x-0 top-0 h-1/2 hover:bg-black/5"
                    onClick={() => onCreateSlot(day, hour, 0)}
                  />
                  <button
                    aria-label={`Create event at ${hour}:30`}
                    className="absolute inset-x-0 bottom-0 h-1/2 hover:bg-black/5"
                    onClick={() => onCreateSlot(day, hour, 30)}
                  />
                </div>
              ))}
              {today && currentTop >= 0 && currentTop <= HOURS.length * HOUR_HEIGHT && (
                <div className="absolute left-0 right-0 z-20" style={{ top: currentTop }}>
                  <div className="h-[2px] bg-red-500" />
                </div>
              )}
              {timedEvents.map((event) => (
                <CalendarEventBlock
                  key={event.id}
                  event={event}
                  dayEvents={timedEvents}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthGrid({
  days,
  anchor,
  eventsByDay,
  selectedId,
  onSelect,
  onCreateDay,
}: {
  days: Date[]
  anchor: Date
  eventsByDay: Map<string, CalendarEvent[]>
  selectedId: string | null
  onSelect: (event: CalendarEvent) => void
  onCreateDay: (date: Date) => void
}) {
  return (
    <div className="grid flex-1 min-h-0 overflow-hidden" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
      {days.map((day) => {
        const key = toLocalDateKey(day)
        const events = (eventsByDay.get(key) ?? []).sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        )
        const muted = day.getMonth() !== anchor.getMonth()
        return (
          <button
            key={key}
            onClick={() => onCreateDay(day)}
            className="min-h-0 p-2 text-left"
            style={{
              borderLeft: "1px solid #E0DED2",
              borderTop: "1px solid #E0DED2",
              background: isSameDay(day, new Date()) ? "#FFFBF0" : muted ? "#F8F4E9" : "#fff",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: muted ? "#999" : "#111" }}>
                {day.getDate()}
              </span>
              {events.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{events.length - 3}</span>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {events.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(event)
                  }}
                  className="truncate text-[11px]"
                  style={{
                    border: selectedId === event.id ? "1.5px solid #111" : "1px solid #D3CEC0",
                    borderRadius: 5,
                    padding: "2px 5px",
                    background: event.allDay ? "#E9F7F0" : "#F7FBFF",
                  }}
                >
                  {!event.allDay && `${fmtTime(event.start)} `}
                  {event.title}
                </span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface CalendarViewProps {
  initialPrefill?: CreatePrefill
}

export function CalendarView({ initialPrefill }: CalendarViewProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const [mode, setMode] = useState<CalendarMode>("week")
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()))
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(!!initialPrefill)
  const [createPrefill, setCreatePrefill] = useState<CreatePrefill | undefined>(initialPrefill)

  const range = useMemo(() => getVisibleRange(anchorDate, mode), [anchorDate, mode])
  const queryRange = useMemo(
    () => ({
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      timeZone,
    }),
    [range.start, range.end, timeZone]
  )

  const calendarQueryKey = qk.vegaCalendar(organizationId, queryRange)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: calendarQueryKey,
    queryFn: () => fetchCalendar(queryRange),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  const days = useMemo(() => {
    if (mode === "day") return [startOfDay(anchorDate)]
    return Array.from({ length: mode === "month" ? 42 : 7 }, (_, i) =>
      addDays(range.start, i)
    )
  }, [anchorDate, mode, range.start])

  const eventsByDay = useMemo(() => groupEvents(data?.events ?? []), [data?.events])

  const visibleEvents = data?.events ?? []
  const todayEvents = eventsByDay.get(toLocalDateKey(new Date())) ?? []

  const move = (direction: -1 | 1) => {
    setSelectedEvent(null)
    setAnchorDate((date) => {
      if (mode === "month") return addMonths(date, direction)
      return addDays(date, direction * (mode === "week" ? 7 : 1))
    })
  }

  const openCreate = (prefill?: CreatePrefill) => {
    setSelectedEvent(null)
    setCreatePrefill(prefill)
    setShowCreateForm(true)
  }

  const handleEventCreated = (event: CalendarEvent) => {
    setShowCreateForm(false)
    setCreatePrefill(undefined)
    setSelectedEvent(event)
    queryClient.invalidateQueries({ queryKey: qk.vegaCalendar(organizationId) })
  }

  const handleEventChanged = () => {
    queryClient.invalidateQueries({ queryKey: qk.vegaCalendar(organizationId) })
    setSelectedEvent(null)
  }

  if (isLoading) {
    return (
      <div className="flex h-full gap-2 p-3">
        <Skeleton className="h-full w-48 rounded-lg" />
        <Skeleton className="h-full flex-1 rounded-lg" />
      </div>
    )
  }

  const upgradeReason = getUpgradeRequiredReason(error)
  if (upgradeReason) {
    return <UpgradeRequiredCard reason={upgradeReason} />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle className="size-8 text-destructive opacity-60" />
        <p className="text-sm font-medium">Could not load calendar</p>
        <p className="text-xs text-muted-foreground">
          Check your Google connection in Settings - Integrations.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-[#F4EDDD]">
      <aside className="hidden w-56 shrink-0 flex-col gap-3 border-r-2 border-black p-3 lg:flex">
        <Button
          size="sm"
          onClick={() => openCreate()}
          className="justify-start"
          style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
        >
          <Plus className="size-3.5" />
          Create
        </Button>
        <div className="rounded-lg border-2 border-black bg-white p-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
            Today
          </div>
          <div className="mt-1 text-3xl font-black leading-none">{new Date().getDate()}</div>
          <div className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long" })}
          </div>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <CalendarDays className="size-4" />
            My calendar
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{visibleEvents.length} visible events</span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#1DBC87]" />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {todayEvents.length} today
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-[#FFF9ED] px-3 py-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => move(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => move(1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAnchorDate(startOfDay(new Date()))
                setSelectedEvent(null)
              }}
              style={{ border: "1.5px solid #111" }}
            >
              Today
            </Button>
            <h2 className="ml-2 text-sm font-semibold md:text-base">
              {fmtRange(mode === "month" ? startOfMonth(anchorDate) : range.start, range.end, mode)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border-2 border-black bg-white p-0.5">
              {(["day", "week", "month"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                  style={{
                    background: mode === item ? "#111" : "transparent",
                    color: mode === item ? "#fff" : "#111",
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => openCreate()} className="lg:hidden">
              <Plus className="size-3.5" />
              New
            </Button>
          </div>
        </div>

        {mode !== "month" && (
          <div
            className="grid shrink-0 bg-white"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(110px, 1fr))`, borderBottom: "1.5px solid #111" }}
          >
            <div />
            {days.map((day) => (
              <button
                key={toLocalDateKey(day)}
                onClick={() => {
                  setAnchorDate(day)
                  setMode("day")
                }}
                className="px-2 py-2 text-center"
                style={{
                  borderLeft: "1.5px solid #E0DED2",
                  background: isSameDay(day, new Date()) ? "#FFF1C7" : "#fff",
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className="text-lg font-black">{day.getDate()}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {mode === "month" ? (
            <MonthGrid
              days={days}
              anchor={anchorDate}
              eventsByDay={eventsByDay}
              selectedId={selectedEvent?.id ?? null}
              onSelect={(event) => {
                setSelectedEvent(event)
                setShowCreateForm(false)
              }}
              onCreateDay={(date) =>
                openCreate({
                  date: toLocalDateKey(date),
                  startTime: "09:00",
                  endTime: "10:00",
                })
              }
            />
          ) : (
            <>
              <AllDayRow
                days={days}
                eventsByDay={eventsByDay}
                selectedId={selectedEvent?.id ?? null}
                onSelect={(event) => {
                  setSelectedEvent(event)
                  setShowCreateForm(false)
                }}
              />
              <TimeGrid
                days={days}
                eventsByDay={eventsByDay}
                selectedId={selectedEvent?.id ?? null}
                onSelect={(event) => {
                  setSelectedEvent(event)
                  setShowCreateForm(false)
                }}
                onCreateSlot={(date, hour, minute) => {
                  const startTime = `${pad(hour)}:${pad(minute)}`
                  openCreate({
                    date: toLocalDateKey(date),
                    startTime,
                    endTime: addMinutes(startTime, 60),
                  })
                }}
              />
            </>
          )}
        </div>
      </main>

      {(showCreateForm || selectedEvent) && (
        <section className="w-full max-w-[360px] shrink-0 overflow-y-auto border-l-2 border-black bg-[#FFF9ED] max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40">
          {showCreateForm ? (
            <EventCreateForm
              key={`${createPrefill?.date ?? "new"}:${createPrefill?.startTime ?? ""}`}
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
              onChanged={handleEventChanged}
            />
          ) : null}
        </section>
      )}
    </div>
  )
}
