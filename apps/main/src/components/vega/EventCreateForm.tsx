"use client"

import React, { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { createCalendarEvent } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { X, Plus, Trash2, Video } from "lucide-react"
import { toast } from "sonner"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

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
  const defaultDate = toLocalDateKey(tomorrow)

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
        <Popover>
          <PopoverTrigger asChild>
            <button style={{ ...inputStyle, cursor: "pointer", textAlign: "left", fontWeight: 600 }}>
              {date
                ? new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                  })
                : "Select date"}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" style={{ width: "auto", padding: 0, border: "2px solid #111", borderRadius: 8, boxShadow: "4px 4px 0 #111" }}>
            <Calendar
              mode="single"
              selected={date ? new Date(date + "T00:00:00") : undefined}
              onSelect={(d) => { if (d) setDate(toLocalDateKey(d)) }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1">
          <label style={labelStyle}>Start</label>
          <TimeSelect value={startTime} onChange={setStartTime} />
        </div>
        <div className="flex flex-col gap-1">
          <label style={labelStyle}>End</label>
          <TimeSelect value={endTime} onChange={setEndTime} />
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
