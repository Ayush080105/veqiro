"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { createCalendarEvent } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { X, Plus, Trash2, Video } from "lucide-react"
import { toast } from "sonner"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

interface EventCreateFormProps {
  onCreated: (event: CalendarEvent) => void
  onCancel: () => void
  prefill?: {
    title?: string
    attendees?: string[]
    description?: string
  }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "1.5px solid #111",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  color: "#555",
  marginBottom: 4,
  display: "block",
}

export function EventCreateForm({
  onCreated,
  onCancel,
  prefill,
}: EventCreateFormProps) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().slice(0, 10)

  const [title, setTitle] = useState(prefill?.title ?? "")
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("11:00")
  const [attendeeInput, setAttendeeInput] = useState("")
  const [attendees, setAttendees] = useState<string[]>(prefill?.attendees ?? [])
  const [description, setDescription] = useState(prefill?.description ?? "")
  const [addMeet, setAddMeet] = useState(true)

  const { mutate, isPending } = useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: (event) => {
      toast.success("Event created")
      onCreated(event)
    },
    onError: () => {
      toast.error("Failed to create event")
    },
  })

  const addAttendee = () => {
    const email = attendeeInput.trim()
    if (email && !attendees.includes(email)) {
      setAttendees((prev) => [...prev, email])
      setAttendeeInput("")
    }
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (endTime <= startTime) {
      toast.error("End time must be after start time")
      return
    }
    mutate({
      title: title.trim(),
      start: new Date(`${date}T${startTime}:00`).toISOString(),
      end: new Date(`${date}T${endTime}:00`).toISOString(),
      attendees,
      description,
      addGoogleMeet: addMeet,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold">New Event</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Title</label>
        <input
          style={inputStyle}
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          style={inputStyle}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label style={labelStyle}>Start</label>
          <input
            type="time"
            style={inputStyle}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label style={labelStyle}>End</label>
          <input
            type="time"
            style={inputStyle}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#888" }}>
        All times in: {tz}
      </span>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Attendees</label>
        <div className="flex gap-1.5">
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="email@example.com"
            value={attendeeInput}
            onChange={(e) => setAttendeeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addAttendee()
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={addAttendee}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {attendees.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {attendees.map((email) => (
              <div key={email} className="flex items-center justify-between gap-1">
                <span
                  className="text-xs truncate"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {email}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  onClick={() =>
                    setAttendees((prev) => prev.filter((e) => e !== email))
                  }
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          placeholder="Optional notes or agenda"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={addMeet}
          onChange={(e) => setAddMeet(e.target.checked)}
          style={{ accentColor: "#1DBC87" }}
        />
        <Video className="size-3.5 text-green-600" />
        <span className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
          Add Google Meet
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isPending}
          size="sm"
          style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111", flex: 1 }}
        >
          {isPending ? "Creating…" : "Create Event"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
