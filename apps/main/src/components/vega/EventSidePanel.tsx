"use client"

import React, { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import { fetchMeetingPrep, fetchPostMeetingFollowUp, sendFollowUpEmail } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { X, Video, Users, Sparkles, Send, RotateCcw } from "lucide-react"
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

export function EventSidePanel({
  event,
  onClose,
}: {
  event: CalendarEvent
  onClose: () => void
}) {
  const [prepEnabled, setPrepEnabled] = useState(false)

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

  const { data: prep, isLoading: prepLoading, isError: prepError, refetch: refetchPrep } = useQuery({
    queryKey: qk.vegaMeetingPrep(event.id),
    queryFn: () =>
      fetchMeetingPrep({
        eventTitle: event.title,
        attendeeEmails: event.attendees,
        description: event.description,
      }),
    enabled: prepEnabled,
    staleTime: 10 * 60 * 1000,
  })

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

      {/* Prep Brief */}
      <div className="flex flex-col gap-2">
        {!prepEnabled && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            style={{ border: "2px solid #111", justifyContent: "start" }}
            onClick={() => setPrepEnabled(true)}
          >
            <Sparkles className="size-3.5" />
            Generate Prep Brief
          </Button>
        )}

        {prepEnabled && prepLoading && (
          <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        )}

        {prepEnabled && prepError && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-destructive flex-1">Failed to generate prep brief.</p>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2 shrink-0" onClick={() => refetchPrep()}>
              Retry
            </Button>
          </div>
        )}

        {prepEnabled && prep && (
          <div
            className="flex flex-col gap-3 rounded-lg p-3"
            style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}
          >
            <p className="text-xs leading-relaxed text-foreground">{prep.summary}</p>

            {prep.keyPoints.length > 0 && (
              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Key Points
                </p>
                {prep.keyPoints.map((pt, i) => (
                  <div key={i} className="text-xs text-foreground pl-2">
                    · {pt}
                  </div>
                ))}
              </div>
            )}

            {prep.suggestedAgenda.length > 0 && (
              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Suggested Agenda
                </p>
                {prep.suggestedAgenda.map((item, i) => (
                  <div key={i} className="text-xs text-foreground pl-2">
                    {i + 1}. {item}
                  </div>
                ))}
              </div>
            )}

            {prep.attendeeContext && (
              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Attendee Context
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  {prep.attendeeContext}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post-meeting follow-up — shown only after the event has ended */}
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
