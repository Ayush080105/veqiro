"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import { fetchMeetingPrep } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { X, Video, Users, Sparkles } from "lucide-react"
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

  const { data: prep, isLoading: prepLoading, isError: prepError } = useQuery({
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
          <p className="text-xs text-destructive">Failed to generate prep brief. Try again.</p>
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
    </div>
  )
}
