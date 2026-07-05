"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, ExternalLink } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { TimeSelect } from "@/components/ui/time-select"
import { useIntegrations } from "@/lib/api/integrations"
import { schedulePost, scheduleCarousel } from "@/lib/api/assistants"
import { normalizePlatform, PostTypeToggle } from "./publish-dialog"
import type { PublishDialogProps, CampaignPublishDialogProps } from "./publish-dialog"

function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function defaultScheduleDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number)
  const combined = new Date(date)
  combined.setHours(h ?? 9, m ?? 0, 0, 0)
  return combined
}

function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: Date
  time: string
  onDateChange: (d: Date) => void
  onTimeChange: (t: string) => void
}) {
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "1.5px solid #111",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    background: "#fff",
    outline: "none",
  }
  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date</label>
        <Popover>
          <PopoverTrigger style={{ ...inputStyle, cursor: "pointer", textAlign: "left", fontWeight: 600, width: "100%" }}>
            {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" style={{ width: "auto", padding: 0, border: "2px solid #111", borderRadius: 8, boxShadow: "4px 4px 0 #111" }}>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { if (d) onDateChange(new Date(toLocalDateKey(d) + "T00:00:00")) }}
              disabled={(d) => d < new Date(new Date().toDateString())}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Time</label>
        <TimeSelect value={time} onChange={onTimeChange} />
      </div>
    </div>
  )
}

export function CampaignScheduleDialog({ imageUrls, photoCount, caption, hashtags }: CampaignPublishDialogProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [open, setOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [date, setDate] = useState<Date>(defaultScheduleDate)
  const [time, setTime] = useState("09:00")

  const { data: accounts = [], isLoading: loading, isError, error } = useIntegrations()

  const eligible = useMemo(
    () => accounts.filter((a) => String(a.platform ?? "").toUpperCase() === "INSTAGRAM"),
    [accounts]
  )

  const handleSchedule = async (accountId: string) => {
    if (!organizationId) {
      toast.error("No active organization selected")
      return
    }
    const scheduledAt = combineDateAndTime(date, time)
    if (scheduledAt.getTime() <= Date.now()) {
      toast.error("Pick a time in the future")
      return
    }
    setScheduling(true)
    try {
      const fullCaption = [caption, hashtags?.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")]
        .filter(Boolean)
        .join("\n\n")
      await scheduleCarousel(organizationId, {
        socialAccountId: accountId,
        caption: fullCaption,
        hashtags: [],
        imageUrls,
        scheduledAt: scheduledAt.toISOString(),
      })
      toast.success(`Campaign scheduled for ${scheduledAt.toLocaleString()}`)
      setOpen(false)
    } catch (err) {
      toast.error(`Schedule failed: ${(err as Error).message}`)
    } finally {
      setScheduling(false)
    }
  }

  return (
    <>
      <Button variant="chat-action" onClick={() => setOpen(true)} disabled={!imageUrls.length}>
        <CalendarClock className="size-3" /> Schedule Carousel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign for Instagram</DialogTitle>
            <DialogDescription>
              All {photoCount} photos will be published as a single carousel post at the chosen time.
            </DialogDescription>
          </DialogHeader>

          <DateTimePicker date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading accounts…</p>
          ) : isError ? (
            <p className="text-xs text-destructive">
              Couldn&apos;t load accounts: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          ) : eligible.length === 0 ? (
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-muted-foreground">No Instagram account connected yet.</p>
              <a
                href="/settings/integrations"
                className="inline-flex items-center gap-1 text-foreground hover:underline"
              >
                Connect Instagram <ExternalLink className="size-3" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {eligible.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSchedule(a.id)}
                  disabled={scheduling}
                  className="flex items-center justify-between rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5 text-left text-xs hover:bg-[#EFE7D6] transition-colors disabled:opacity-60"
                >
                  <span className="font-medium">{a.accountName ?? a.providerAccountId}</span>
                  <span className="text-muted-foreground">
                    {scheduling ? "Scheduling…" : "Schedule"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="chat-utility" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ScheduleDialog({ platform, caption, hashtags, image, video }: PublishDialogProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [open, setOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [postType, setPostType] = useState<"post" | "reel">("reel")
  const [date, setDate] = useState<Date>(defaultScheduleDate)
  const [time, setTime] = useState("09:00")

  const { data: accounts = [], isLoading: loading, isError, error } = useIntegrations()

  const normalizedPlatform = normalizePlatform(platform)
  const platformLabel = normalizedPlatform ?? "this platform"
  const target = normalizedPlatform?.toUpperCase()
  const eligible = useMemo(
    () => accounts.filter((a) => String(a.platform ?? "").toUpperCase() === target),
    [accounts, target]
  )

  const handleSchedule = async (accountId: string) => {
    if (!organizationId) {
      toast.error("No active organization selected")
      return
    }
    const scheduledAt = combineDateAndTime(date, time)
    if (scheduledAt.getTime() <= Date.now()) {
      toast.error("Pick a time in the future")
      return
    }
    setScheduling(true)
    try {
      await schedulePost(organizationId, {
        socialAccountId: accountId,
        caption,
        hashtags,
        imageUrl: video ? undefined : image?.image_url,
        imageBase64: video ? undefined : image?.image_url ? undefined : image?.image_base64,
        videoUrl: video?.video_url,
        videoBase64: video?.video_url ? undefined : video?.video_base64,
        postType: video ? postType : undefined,
        scheduledAt: scheduledAt.toISOString(),
      })
      toast.success(`Post scheduled for ${scheduledAt.toLocaleString()}`)
      setOpen(false)
    } catch (err) {
      toast.error(`Schedule failed: ${(err as Error).message}`)
    } finally {
      setScheduling(false)
    }
  }

  return (
    <>
      <Button variant="chat-action" onClick={() => setOpen(true)} disabled={!normalizedPlatform}>
        <CalendarClock className="size-3" /> Schedule
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule for {platformLabel}</DialogTitle>
            <DialogDescription>
              Pick a date and time, then choose the connected {platformLabel} account to publish from.
            </DialogDescription>
          </DialogHeader>

          {video && normalizedPlatform === "instagram" && (
            <PostTypeToggle value={postType} onChange={setPostType} />
          )}

          <DateTimePicker date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading accounts…</p>
          ) : isError ? (
            <p className="text-xs text-destructive">
              Couldn&apos;t load accounts: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          ) : eligible.length === 0 ? (
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-muted-foreground">
                No {platformLabel} account connected yet.
              </p>
              <a
                href="/settings/integrations"
                className="inline-flex items-center gap-1 text-foreground hover:underline"
              >
                Connect {platformLabel} <ExternalLink className="size-3" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {eligible.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSchedule(a.id)}
                  disabled={scheduling}
                  className="flex items-center justify-between rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5 text-left text-xs hover:bg-[#EFE7D6] transition-colors disabled:opacity-60"
                >
                  <span className="font-medium">{a.accountName ?? a.providerAccountId}</span>
                  <span className="text-muted-foreground">
                    {scheduling ? "Scheduling…" : "Schedule"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="chat-utility" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
