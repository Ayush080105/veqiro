"use client"

import { useState } from "react"
import cronstrue from "cronstrue"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateTask } from "@/lib/api/tasks"
import { FONT } from "@/lib/fonts"
import { toast } from "sonner"

const FREQUENCY_OPTIONS = [
  { value: "none", label: "No recurrence (one-off)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

const DAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00`,
}))

function buildCron(frequency: string, hour: string, day: string): string | null {
  if (frequency === "none") return null
  if (frequency === "daily") return `0 ${hour} * * *`
  if (frequency === "weekly") return `0 ${hour} * * ${day}`
  if (frequency === "monthly") return `0 ${hour} 1 * *`
  return null
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateTaskSheet({ open, onClose }: Props) {
  const createTask = useCreateTask()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState("none")
  const [hour, setHour] = useState("9")
  const [day, setDay] = useState("1")

  const reset = () => {
    setName("")
    setDescription("")
    setFrequency("none")
    setHour("9")
    setDay("1")
  }

  const cronExpression = buildCron(frequency, hour, day)

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Task name is required")
      return
    }
    createTask.mutate(
      { name: name.trim(), description: description.trim() || null, cronExpression },
      {
        onSuccess: () => {
          toast.success("Task created")
          reset()
          onClose()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const cronPreview = cronExpression
    ? (() => {
        try {
          return cronstrue.toString(cronExpression, { verbose: true })
        } catch {
          return null
        }
      })()
    : null

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto" style={{ maxWidth: 480 }}>
        <SheetHeader className="px-6 pt-6 pb-4 border-b-2 border-foreground">
          <SheetTitle style={{ fontFamily: FONT.head, fontSize: 18 }}>New Task</SheetTitle>
          <SheetDescription style={{ fontFamily: FONT.mono, fontSize: 11 }}>
            Create a custom task with an optional recurring schedule.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-5 flex-1">
          <div className="flex flex-col gap-1.5">
            <Label style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>NAME *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Review Q3 pipeline"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>DESCRIPTION</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this task"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Label style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>RECURRENCE</Label>

            <Select value={frequency} onValueChange={(v) => v && setFrequency(v)}>
              <SelectTrigger className="border-2 border-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {frequency !== "none" && (
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, color: "#555" }}>TIME (UTC)</Label>
                  <Select value={hour} onValueChange={(v) => v && setHour(v)}>
                    <SelectTrigger className="border-2 border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {frequency === "weekly" && (
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Label style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, color: "#555" }}>DAY</Label>
                    <Select value={day} onValueChange={(v) => v && setDay(v)}>
                      <SelectTrigger className="border-2 border-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {cronPreview && (
              <p style={{ fontFamily: FONT.mono, fontSize: 10, color: "#555" }}>
                {cronPreview}
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 pt-4 border-t-2 border-foreground gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} className="flex-1 border-2 border-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createTask.isPending || !name.trim()}
            className="flex-1"
            style={{ background: "#111", color: "#fff", border: "2px solid #111", boxShadow: "2px 2px 0 #555" }}
          >
            {createTask.isPending ? "Creating…" : "Create Task"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
