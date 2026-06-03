"use client"

import React, { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import { fetchPostMeetingFollowUp, sendFollowUpEmail, fetchRescheduleDraft, patchCalendarEvent } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { X, Video, Users, Sparkles, Send, RotateCcw, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  )
}

function durationLabel(start: string, end: string): string {
  const mins = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  )
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value.split(":")
  const h = parseInt(hStr, 10)
  const m = Math.round(parseInt(mStr, 10) / 5) * 5 % 60
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
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
      </select>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "#111" }}>:</span>
      <select value={m} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)} style={sel}>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{pad(i * 5)}</option>)}
      </select>
    </div>
  )
}

export function EventSidePanel({
  event,
  onClose,
}: {
  event: CalendarEvent
  onClose: () => void
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const isPastEvent = new Date() > new Date(event.end)
  const [followUpEnabled, setFollowUpEnabled] = useState(false)
  const [followUpBody, setFollowUpBody] = useState("")

  const {
    data: followUpData,
    isLoading: followUpLoading,
    isError: followUpError,
    refetch: refetchFollowUp,
  } = useQuery({
    queryKey: qk.vegaPostMeetingFollowup(event.id),
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

  const sendMutation = useMutation({
    mutationFn: sendFollowUpEmail,
    onSuccess: () => {
      toast.success("Follow-up sent")
      setFollowUpEnabled(false)
    },
    onError: () => toast.error("Failed to send follow-up"),
  })

  // Sync body from fetched data (without useEffect — ref comparison pattern)
  const prevFollowUpDataRef = React.useRef<typeof followUpData>(undefined)
  if (followUpData !== prevFollowUpDataRef.current) {
    prevFollowUpDataRef.current = followUpData
    if (followUpData) setFollowUpBody(followUpData.followUp.body)
  }

  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState(() => toLocalDateKey(new Date(event.start)))
  const [rescheduleStartTime, setRescheduleStartTime] = useState(
    new Date(event.start).toTimeString().slice(0, 5)
  )
  const [rescheduleEndTime, setRescheduleEndTime] = useState(
    new Date(event.end).toTimeString().slice(0, 5)
  )
  const [rescheduleEmailBody, setRescheduleEmailBody] = useState("")
  const [rescheduleDraftEnabled, setRescheduleDraftEnabled] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)

  const newStart = showReschedule
    ? new Date(`${rescheduleDate}T${rescheduleStartTime}:00`).toISOString()
    : ""
  const newEnd = showReschedule
    ? new Date(`${rescheduleDate}T${rescheduleEndTime}:00`).toISOString()
    : ""

  const {
    data: rescheduleData,
    isLoading: rescheduleLoading,
    isError: rescheduleError,
    refetch: refetchRescheduleDraft,
  } = useQuery({
    queryKey: qk.vegaRescheduleDraft(event.id),
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

  const prevRescheduleDataRef = React.useRef<typeof rescheduleData>(undefined)
  if (rescheduleData !== prevRescheduleDataRef.current) {
    prevRescheduleDataRef.current = rescheduleData
    if (rescheduleData) setRescheduleEmailBody(rescheduleData.email.body)
  }

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
      if (rescheduleData) {
        await sendFollowUpEmail({
          to: rescheduleData.email.to,
          subject: rescheduleData.email.subject,
          body: rescheduleEmailBody,
        })
        toast.success("Event rescheduled and email sent")
      } else {
        toast.success("Event rescheduled")
      }
      setShowReschedule(false)
      setRescheduleDraftEnabled(false)
    } catch {
      toast.error("Failed to reschedule event")
    } finally {
      setRescheduling(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{fmtDateTime(event.start)}</p>
          <p className="text-xs text-muted-foreground">
            {durationLabel(event.start, event.end)}
          </p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#888" }}>
            All times in: {tz}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {event.meetLink && (
          <Badge
            style={{
              background: "#EEF9F6",
              color: "#1DBC87",
              border: "1px solid #1DBC87",
            }}
          >
            <Video className="size-3 mr-1" />
            Google Meet
          </Badge>
        )}
        {event.recurring && <Badge variant="outline">Recurring</Badge>}
      </div>

      {/* Attendees */}
      {event.attendees.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" />
            Attendees ({event.attendees.length})
          </div>
          {event.attendees.map((email) => (
            <div
              key={email}
              className="text-xs text-foreground pl-5 truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {email}
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Description</p>
          <p className="text-xs text-foreground leading-relaxed">{event.description}</p>
        </div>
      )}

      {/* Join link */}
      {event.meetLink && (
        <a
          href={event.meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-green-600 hover:underline"
        >
          <Video className="size-3.5" />
          Join Google Meet
        </a>
      )}

      {/* Reschedule section */}
      <div className="flex flex-col gap-2">
        {!showReschedule ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            style={{ border: "2px solid #111", justifyContent: "start" }}
            onClick={() => setShowReschedule(true)}
          >
            <CalendarClock className="size-3.5" />
            Reschedule
          </Button>
        ) : (
          <div
            className="flex flex-col gap-3 rounded-lg p-3"
            style={{ border: "1.5px solid #111", background: "#fff" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                New time
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => {
                  setShowReschedule(false)
                  setRescheduleDraftEnabled(false)
                }}
              >
                Cancel
              </Button>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "1.5px solid #111",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    background: "#fff",
                    outline: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {rescheduleDate
                    ? new Date(rescheduleDate + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                      })
                    : "Select date"}
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" style={{ width: "auto", padding: 0, border: "2px solid #111", borderRadius: 8, boxShadow: "4px 4px 0 #111" }}>
                <Calendar
                  mode="single"
                  selected={rescheduleDate ? new Date(rescheduleDate + "T00:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setRescheduleDate(toLocalDateKey(date))
                      setRescheduleDraftEnabled(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            <div className="flex gap-3">
              {(["Start", "End"] as const).map((label) => (
                <div key={label} className="flex flex-col gap-1">
                  <span
                    className="text-[9px] uppercase tracking-wider text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {label}
                  </span>
                  <TimeSelect
                    value={label === "Start" ? rescheduleStartTime : rescheduleEndTime}
                    onChange={(v) => {
                      if (label === "Start") setRescheduleStartTime(v)
                      else setRescheduleEndTime(v)
                      setRescheduleDraftEnabled(false)
                    }}
                  />
                </div>
              ))}
            </div>

            {!rescheduleDraftEnabled && (
              <Button
                variant="outline"
                size="sm"
                style={{ border: "2px solid #111", justifyContent: "start" }}
                onClick={() => setRescheduleDraftEnabled(true)}
              >
                <Sparkles className="size-3.5" />
                Draft Rescheduling Email
              </Button>
            )}

            {rescheduleDraftEnabled && rescheduleLoading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            )}

            {rescheduleDraftEnabled && rescheduleError && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-destructive flex-1">Failed to generate email.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2 shrink-0"
                  onClick={() => refetchRescheduleDraft()}
                >
                  Retry
                </Button>
              </div>
            )}

            {rescheduleDraftEnabled && rescheduleData && (
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
                  boxSizing: "border-box",
                }}
              />
            )}

            <Button
              size="sm"
              onClick={handleConfirmReschedule}
              disabled={rescheduling}
              style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            >
              <CalendarClock className="size-3.5" />
              {rescheduling
                ? "Rescheduling…"
                : rescheduleData
                ? "Confirm & Send"
                : "Confirm Reschedule"}
            </Button>
          </div>
        )}
      </div>

      {isPastEvent && (
        <div className="flex flex-col gap-2">
          <div
            className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            After the meeting
          </div>

          {!followUpEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              style={{ border: "2px solid #111", justifyContent: "start" }}
              onClick={() => setFollowUpEnabled(true)}
            >
              <Send className="size-3.5" />
              Generate Follow-up Email
            </Button>
          )}

          {followUpEnabled && followUpLoading && (
            <div
              className="flex flex-col gap-2 rounded-lg p-3"
              style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}
            >
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )}

          {followUpEnabled && followUpError && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-destructive flex-1">Failed to generate follow-up.</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2 shrink-0"
                onClick={() => refetchFollowUp()}
              >
                <RotateCcw className="size-3" />
                Retry
              </Button>
            </div>
          )}

          {followUpEnabled && followUpData && (
            <div
              className="flex flex-col gap-3 rounded-lg p-3"
              style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}
            >
              {followUpData.actionItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Action Items
                  </p>
                  {followUpData.actionItems.map((item, i) => (
                    <div key={i} className="text-xs text-foreground pl-2">
                      · {item}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
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
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <Button
                size="sm"
                onClick={() =>
                  sendMutation.mutate({
                    to: followUpData.followUp.to,
                    subject: followUpData.followUp.subject,
                    body: followUpBody,
                  })
                }
                disabled={sendMutation.isPending}
                style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
              >
                <Send className="size-3.5" />
                {sendMutation.isPending ? "Sending…" : "Send Follow-up"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
