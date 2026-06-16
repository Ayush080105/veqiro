"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import {
  fetchPostMeetingFollowUp,
  fetchRescheduleDraft,
  patchCalendarEvent,
  sendFollowUpEmail,
} from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarClock, RotateCcw, Send, Sparkles, Users, Video, X } from "lucide-react"
import { toast } from "sonner"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtDateTime(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }
  const d = new Date(iso)
  return `${d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} - ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`
}

function durationLabel(event: CalendarEvent): string {
  if (event.allDay) return "All day"
  const mins = Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000)
  if (!Number.isFinite(mins) || mins <= 0) return ""
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value.split(":")
  const h = Number.isFinite(Number(hStr)) ? Math.min(23, Math.max(0, parseInt(hStr, 10))) : 0
  const rawMinute = Number.isFinite(Number(mStr)) ? parseInt(mStr, 10) : 0
  const m = Math.min(55, Math.max(0, Math.floor(rawMinute / 5) * 5))
  const pad = (n: number) => String(n).padStart(2, "0")
  const sel: React.CSSProperties = {
    appearance: "none",
    padding: "5px 10px",
    border: "1.5px solid #111",
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    background: "#fff",
    outline: "none",
    cursor: "pointer",
    textAlign: "center",
    minWidth: 48,
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <select value={h} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)} style={sel}>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {pad(i)}
          </option>
        ))}
      </select>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>:</span>
      <select value={m} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)} style={sel}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i * 5}>
            {pad(i * 5)}
          </option>
        ))}
      </select>
    </div>
  )
}

export function EventSidePanel({
  event,
  onClose,
  onChanged,
}: {
  event: CalendarEvent
  onClose: () => void
  onChanged?: () => void
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const isPastEvent = !event.allDay && new Date() > new Date(event.end)

  const [followUpEnabled, setFollowUpEnabled] = useState(false)
  const [followUpBody, setFollowUpBody] = useState("")
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState(() => toLocalDateKey(new Date(event.start)))
  const [rescheduleStartTime, setRescheduleStartTime] = useState(() => new Date(event.start).toTimeString().slice(0, 5))
  const [rescheduleEndTime, setRescheduleEndTime] = useState(() => new Date(event.end).toTimeString().slice(0, 5))
  const [rescheduleEmailBody, setRescheduleEmailBody] = useState("")
  const [rescheduleDraftEnabled, setRescheduleDraftEnabled] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)

  useEffect(() => {
    const start = event.allDay ? new Date() : new Date(event.start)
    const end = event.allDay ? new Date(start.getTime() + 60 * 60 * 1000) : new Date(event.end)
    setShowReschedule(false)
    setRescheduleDate(toLocalDateKey(start))
    setRescheduleStartTime(start.toTimeString().slice(0, 5))
    setRescheduleEndTime(end.toTimeString().slice(0, 5))
    setRescheduleEmailBody("")
    setRescheduleDraftEnabled(false)
    setFollowUpEnabled(false)
    setFollowUpBody("")
  }, [event.id, event.start, event.end, event.allDay])

  const newStart = showReschedule
    ? new Date(`${rescheduleDate}T${rescheduleStartTime}:00`).toISOString()
    : ""
  const newEnd = showReschedule
    ? new Date(`${rescheduleDate}T${rescheduleEndTime}:00`).toISOString()
    : ""

  const followUp = useQuery({
    queryKey: qk.vegaPostMeetingFollowup(
      event.id,
      `${event.title}:${event.description}:${event.attendees.join(",")}`
    ),
    queryFn: () =>
      fetchPostMeetingFollowUp({
        eventTitle: event.title,
        attendeeEmails: event.attendees,
        description: event.description,
        notes: "",
      }),
    enabled: followUpEnabled,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (followUp.data) setFollowUpBody(followUp.data.followUp.body)
  }, [followUp.data])

  const rescheduleDraft = useQuery({
    queryKey: qk.vegaRescheduleDraft(event.id, newStart, newEnd),
    queryFn: () =>
      fetchRescheduleDraft({
        eventTitle: event.title,
        attendeeEmails: event.attendees,
        originalStart: event.start,
        newStart,
        newEnd,
      }),
    enabled: rescheduleDraftEnabled,
    staleTime: 0,
  })

  useEffect(() => {
    if (rescheduleDraft.data) setRescheduleEmailBody(rescheduleDraft.data.email.body)
  }, [rescheduleDraft.data])

  const sendMutation = useMutation({
    mutationFn: sendFollowUpEmail,
    onSuccess: () => {
      toast.success("Follow-up sent")
      setFollowUpEnabled(false)
    },
    onError: () => toast.error("Failed to send follow-up"),
  })

  const handleConfirmReschedule = async () => {
    if (!newStart || !newEnd) {
      toast.error("Please set a new date and time")
      return
    }
    if (new Date(newEnd) <= new Date(newStart)) {
      toast.error("End time must be after start time")
      return
    }
    setRescheduling(true)
    try {
      await patchCalendarEvent(event.id, { start: newStart, end: newEnd })
      if (rescheduleDraft.data) {
        await sendFollowUpEmail({
          to: rescheduleDraft.data.email.to,
          subject: rescheduleDraft.data.email.subject,
          body: rescheduleEmailBody,
        })
        toast.success("Event rescheduled and email sent")
      } else {
        toast.success("Event rescheduled")
      }
      setShowReschedule(false)
      setRescheduleDraftEnabled(false)
      onChanged?.()
    } catch {
      toast.error("Failed to reschedule event")
    } finally {
      setRescheduling(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{fmtDateTime(event.start)}</p>
          <p className="text-xs text-muted-foreground">{durationLabel(event)}</p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#888" }}>
            All times in: {tz}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {event.meetLink && (
          <Badge style={{ background: "#EEF9F6", color: "#1DBC87", border: "1px solid #1DBC87" }}>
            <Video className="mr-1 size-3" />
            Google Meet
          </Badge>
        )}
        {event.recurring && <Badge variant="outline">Recurring</Badge>}
        {event.allDay && <Badge variant="outline">All day</Badge>}
        {event.status && <Badge variant="outline">{event.status}</Badge>}
      </div>

      {event.attendees.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" />
            Attendees ({event.attendees.length})
          </div>
          {event.attendees.map((email) => (
            <div key={email} className="truncate pl-5 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
              {email}
            </div>
          ))}
        </div>
      )}

      {event.description && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Description</p>
          <p className="text-xs leading-relaxed">{event.description}</p>
        </div>
      )}

      {event.location && <p className="text-xs text-muted-foreground">Location: {event.location}</p>}
      {event.organizer && <p className="text-xs text-muted-foreground">Organizer: {event.organizer}</p>}

      {event.meetLink && (
        <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-green-700 hover:underline">
          <Video className="size-3.5" />
          Join Google Meet
        </a>
      )}
      {event.htmlLink && (
        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">
          Open in Google Calendar
        </a>
      )}

      {!event.allDay && (
        <div className="flex flex-col gap-2">
          {!showReschedule ? (
            <Button variant="outline" size="sm" className="w-full justify-start" style={{ border: "2px solid #111" }} onClick={() => setShowReschedule(true)}>
              <CalendarClock className="size-3.5" />
              Reschedule
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg bg-white p-3" style={{ border: "1.5px solid #111" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  New time
                </span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowReschedule(false)}>
                  Cancel
                </Button>
              </div>

              <Popover>
                <PopoverTrigger
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "1.5px solid #111",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {new Date(`${rescheduleDate}T00:00:00`).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" style={{ width: "auto", padding: 0, border: "2px solid #111", borderRadius: 8, boxShadow: "4px 4px 0 #111" }}>
                  <Calendar
                    mode="single"
                    selected={new Date(`${rescheduleDate}T00:00:00`)}
                    onSelect={(date) => {
                      if (!date) return
                      setRescheduleDate(toLocalDateKey(date))
                      setRescheduleDraftEnabled(false)
                    }}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    Start
                  </span>
                  <TimeSelect
                    value={rescheduleStartTime}
                    onChange={(value) => {
                      setRescheduleStartTime(value)
                      setRescheduleDraftEnabled(false)
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    End
                  </span>
                  <TimeSelect
                    value={rescheduleEndTime}
                    onChange={(value) => {
                      setRescheduleEndTime(value)
                      setRescheduleDraftEnabled(false)
                    }}
                  />
                </div>
              </div>

              {!rescheduleDraftEnabled && (
                <Button variant="outline" size="sm" style={{ border: "2px solid #111", justifyContent: "start" }} onClick={() => setRescheduleDraftEnabled(true)}>
                  <Sparkles className="size-3.5" />
                  Draft Rescheduling Email
                </Button>
              )}

              {rescheduleDraftEnabled && rescheduleDraft.isLoading && (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              )}

              {rescheduleDraftEnabled && rescheduleDraft.isError && (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs text-destructive">Failed to generate email.</p>
                  <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={() => rescheduleDraft.refetch()}>
                    Retry
                  </Button>
                </div>
              )}

              {rescheduleDraftEnabled && rescheduleDraft.data && (
                <textarea
                  value={rescheduleEmailBody}
                  onChange={(e) => setRescheduleEmailBody(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 90,
                    padding: "6px 8px",
                    border: "1.5px solid #111",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background: "#fff",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              )}

              <Button size="sm" onClick={handleConfirmReschedule} disabled={rescheduling} style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}>
                <CalendarClock className="size-3.5" />
                {rescheduling ? "Rescheduling..." : rescheduleDraft.data ? "Confirm & Send" : "Confirm Reschedule"}
              </Button>
            </div>
          )}
        </div>
      )}

      {isPastEvent && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
            After the meeting
          </div>

          {!followUpEnabled && (
            <Button variant="outline" size="sm" className="w-full justify-start" style={{ border: "2px solid #111" }} onClick={() => setFollowUpEnabled(true)}>
              <Send className="size-3.5" />
              Generate Follow-up Email
            </Button>
          )}

          {followUpEnabled && followUp.isLoading && (
            <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )}

          {followUpEnabled && followUp.isError && (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-destructive">Failed to generate follow-up.</p>
              <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={() => followUp.refetch()}>
                <RotateCcw className="size-3" />
                Retry
              </Button>
            </div>
          )}

          {followUpEnabled && followUp.data && (
            <div className="flex flex-col gap-3 rounded-lg p-3" style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}>
              {followUp.data.actionItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    Action Items
                  </p>
                  {followUp.data.actionItems.map((item, index) => (
                    <div key={index} className="pl-2 text-xs">
                      - {item}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  Email Draft
                </p>
                <textarea
                  value={followUpBody}
                  onChange={(e) => setFollowUpBody(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 100,
                    padding: "6px 8px",
                    border: "1.5px solid #111",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background: "#fff",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </div>

              <Button
                size="sm"
                onClick={() =>
                  sendMutation.mutate({
                    to: followUp.data.followUp.to,
                    subject: followUp.data.followUp.subject,
                    body: followUpBody,
                  })
                }
                disabled={sendMutation.isPending}
                style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
              >
                <Send className="size-3.5" />
                {sendMutation.isPending ? "Sending..." : "Send Follow-up"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
