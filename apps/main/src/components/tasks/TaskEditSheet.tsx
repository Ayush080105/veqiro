"use client"

import { useState, useEffect } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { type Task, useUpdateTask } from "@/lib/api/tasks"
import { FONT } from "@/lib/fonts"
import { toast } from "sonner"

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

function buildCron(frequency: string, hour: string, day: string): string {
  if (frequency === "daily") return `0 ${hour} * * *`
  if (frequency === "weekly") return `0 ${hour} * * ${day}`
  if (frequency === "monthly") return `0 ${hour} 1 * *`
  return `0 ${hour} * * *`
}

function parseCronToSimple(cron: string): { frequency: string; hour: string; day: string } | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [min, hour, dom, , dow] = parts
  if (min !== "0") return null
  if (dom === "1" && dow === "*") return { frequency: "monthly", hour: hour!, day: "1" }
  if (dom === "*" && dow !== "*") return { frequency: "weekly", hour: hour!, day: dow! }
  if (dom === "*" && dow === "*") return { frequency: "daily", hour: hour!, day: "1" }
  return null
}

function describeExpression(expr: string): string {
  try {
    return cronstrue.toString(expr, { verbose: true })
  } catch {
    return "Invalid expression"
  }
}

interface Props {
  task: Task | null
  open: boolean
  onClose: () => void
}

export function TaskEditSheet({ task, open, onClose }: Props) {
  const updateTask = useUpdateTask()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isEnabled, setIsEnabled] = useState(true)
  const [frequency, setFrequency] = useState("daily")
  const [hour, setHour] = useState("9")
  const [day, setDay] = useState("1")

  useEffect(() => {
    if (!task) return
    setName(task.name)
    setDescription(task.description ?? "")
    setIsEnabled(task.isEnabled)
    const cron = task.cronExpression ?? ""
    const parsed = cron ? parseCronToSimple(cron) : null
    if (parsed) {
      setFrequency(parsed.frequency)
      setHour(parsed.hour)
      setDay(parsed.day)
    } else {
      setFrequency("daily")
      setHour("9")
      setDay("1")
    }
  }, [task])

  const cronExpression = buildCron(frequency, hour, day)

  const handleSave = () => {
    if (!task) return
    updateTask.mutate(
      { id: task.id, name, description: description || null, cronExpression, isEnabled },
      {
        onSuccess: () => {
          toast.success("Task updated")
          onClose()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (!task) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto" style={{ maxWidth: 480 }}>
        <SheetHeader className="px-6 pt-6 pb-4 border-b-2 border-foreground">
          <SheetTitle style={{ fontFamily: FONT.head, fontSize: 18 }}>Edit Task</SheetTitle>
          <SheetDescription style={{ fontFamily: FONT.mono, fontSize: 11 }}>
            {task.isDefault ? "Default task — schedule can be changed, but it cannot be deleted." : "Custom task"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-5 flex-1">
          <div className="flex flex-col gap-1.5">
            <Label style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>NAME</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Task name"
              disabled={task.isDefault}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>DESCRIPTION</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={task.isDefault}
            />
          </div>

          <div className="flex items-center justify-between py-2 border-y-2 border-foreground/10">
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>ENABLED</span>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="flex flex-col gap-3">
            <Label style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1 }}>SCHEDULE</Label>

            <div className="flex flex-col gap-1.5">
              <Label style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, color: "#555" }}>FREQUENCY</Label>
              <Select value={frequency} onValueChange={(v) => v && setFrequency(v)}>
                <SelectTrigger className="border-2 border-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <p style={{ fontFamily: FONT.mono, fontSize: 10, color: "#555" }}>
              {describeExpression(cronExpression)}
            </p>
          </div>
        </div>

        <SheetFooter className="flex-row px-6 pb-6 pt-4 border-t-2 border-foreground gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-2 border-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTask.isPending || !name.trim()}
            className="flex-1"
            style={{ background: "#111", color: "#fff", border: "2px solid #111", boxShadow: "2px 2px 0 #555" }}
          >
            {updateTask.isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
