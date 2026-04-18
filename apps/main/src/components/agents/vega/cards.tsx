"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Copy,
  Inbox,
  Reply,
  CalendarDays,
  CalendarPlus,
  Sunrise,
  ExternalLink,
  AlertTriangle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type {
  VegaProcessInboxResult,
  VegaDraftReplyResult,
  VegaCalendarSummaryResult,
  VegaCreateEventResult,
  VegaExecutiveBriefingResult,
} from "@/lib/types/agents"

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

function priority(p: "urgent" | "high" | "medium" | "low") {
  return p === "urgent"
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : p === "high"
      ? "bg-chart-3/15 text-chart-3 border-chart-3/30"
      : p === "medium"
        ? "bg-chart-1/15 text-chart-1 border-chart-1/30"
        : "bg-muted text-muted-foreground border-border"
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

// ─── Inbox triage card ──────────────────────────────────────────────────────

export function InboxTriageCard({ result }: { result: VegaProcessInboxResult }) {
  const s = result.stats
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Inbox className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Inbox triage</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {s.total_processed} processed
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center sm:grid-cols-6">
        <Stat label="Urgent" value={s.urgent} tone="destructive" />
        <Stat label="High" value={s.high} tone="chart-3" />
        <Stat label="Medium" value={s.medium} tone="chart-1" />
        <Stat label="Low" value={s.low} tone="muted" />
        <Stat label="Drafts" value={s.drafts_created} tone="chart-2" />
        <Stat label="Labeled" value={s.labels_applied} tone="chart-2" />
      </div>
      <div className="flex flex-col gap-1">
        {result.processed.map((e) => (
          <Collapsible key={e.email_id}>
            <div className="border border-border bg-muted/20 p-2">
              <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
                <span
                  className={cn(
                    "shrink-0 border px-1.5 py-0.5 text-[10px] uppercase",
                    priority(e.priority)
                  )}
                >
                  {e.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{e.subject}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {e.from_name}
                  </p>
                </div>
                {e.draft_created && (
                  <Badge variant="outline" className="text-[10px]">
                    draft
                  </Badge>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 flex flex-col gap-1 text-[11px]">
                  <p className="leading-relaxed">{e.summary}</p>
                  <p className="rounded border border-border bg-background px-2 py-1 italic">
                    Suggested: {e.suggested_action}
                  </p>
                  {e.label_applied && (
                    <p className="text-[10px] text-muted-foreground">
                      Label: {e.label_applied}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => copy(e.email_id, "Email ID copied")}
                    >
                      <Copy data-icon="inline-start" /> Copy ID
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </Card>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "destructive" | "chart-3" | "chart-2" | "chart-1" | "muted"
}) {
  const cls =
    tone === "destructive"
      ? "text-destructive"
      : tone === "chart-3"
        ? "text-chart-3"
        : tone === "chart-2"
          ? "text-chart-2"
          : tone === "chart-1"
            ? "text-chart-1"
            : "text-muted-foreground"
  return (
    <div className="border border-border bg-muted/20 p-1.5">
      <p className={cn("text-sm font-semibold leading-none", cls)}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

// ─── Draft reply card ───────────────────────────────────────────────────────

export function DraftReplyCard({ result }: { result: VegaDraftReplyResult }) {
  const d = result.draft
  const full = `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Reply className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Draft reply</p>
        {d.saved && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            saved in Gmail
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1 border border-border bg-muted/20 p-2 text-[11px]">
        <p>
          <span className="text-muted-foreground">To:</span> {d.to}
        </p>
        <p>
          <span className="text-muted-foreground">Subject:</span> {d.subject}
        </p>
        <hr className="border-border" />
        <p className="whitespace-pre-wrap leading-relaxed">{d.body}</p>
      </div>
      {result.suggested_follow_up && (
        <p className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] italic">
          Follow-up: {result.suggested_follow_up}
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="outline" size="xs" onClick={() => copy(full)}>
          <Copy data-icon="inline-start" /> Copy
        </Button>
      </div>
    </Card>
  )
}

// ─── Calendar summary card ──────────────────────────────────────────────────

export function CalendarCard({ result }: { result: VegaCalendarSummaryResult }) {
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Calendar</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {result.events.length} events
        </Badge>
      </div>
      {result.conflicts.length > 0 && (
        <div className="flex flex-col gap-1 border border-destructive/30 bg-destructive/10 p-2">
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-destructive">
            <AlertTriangle className="size-3" /> Conflicts
          </p>
          {result.conflicts.map((c, i) => (
            <p key={i} className="text-[11px] leading-relaxed">
              {c.event_a} ⟷ {c.event_b} ({c.overlap_minutes}m overlap)
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {result.events.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-2 border border-border bg-muted/20 p-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{e.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {fmtDate(e.start)} → {fmtDate(e.end)}
              </p>
              {e.attendees && e.attendees.length > 0 && (
                <p className="truncate text-[10px] text-muted-foreground">
                  {e.attendees.join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {Object.keys(result.daily_summary).length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Daily summary
          </p>
          {Object.entries(result.daily_summary).map(([day, s]) => (
            <p key={day} className="text-[11px] leading-relaxed">
              <strong>{day}:</strong> {s}
            </p>
          ))}
        </div>
      )}
      {result.free_slots.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Free slots
          </p>
          <div className="flex flex-wrap gap-1">
            {result.free_slots.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {fmtDate(s.start)} – {fmtDate(s.end)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Event created card ─────────────────────────────────────────────────────

export function EventCreatedCard({ result }: { result: VegaCreateEventResult }) {
  const e = result.event
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">
          {result.created ? "Event created" : "Event proposed"}
        </p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {e.status}
        </Badge>
      </div>
      <div className="flex flex-col gap-1 border border-border bg-muted/20 p-2">
        <p className="text-xs font-medium">{e.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {fmtDate(e.start)} → {fmtDate(e.end)}
        </p>
        {e.attendees && e.attendees.length > 0 && (
          <p className="text-[11px]">With: {e.attendees.join(", ")}</p>
        )}
        {e.meet_link && (
          <a
            href={e.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-chart-1 hover:underline"
          >
            <ExternalLink className="size-3" /> Google Meet
          </a>
        )}
      </div>
      {result.conflicts.length > 0 && (
        <div className="border border-chart-3/30 bg-chart-3/10 p-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-chart-3">
            Conflicts detected
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ─── Executive briefing card ────────────────────────────────────────────────

export function ExecutiveBriefingCard({
  result,
}: {
  result: VegaExecutiveBriefingResult
}) {
  const b = result.briefing
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Sunrise className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Executive briefing</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          priority {b.priority_score}/10
        </Badge>
      </div>
      <p className="text-xs font-medium">{b.good_morning}</p>
      {b.urgent_actions.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-destructive">
            Urgent actions
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {b.urgent_actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {b.today_schedule.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <div className="flex flex-col gap-0.5">
            {b.today_schedule.map((t, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="w-16 shrink-0 text-muted-foreground">
                  {t.time}
                </span>
                <span className="flex-1">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {b.upcoming_this_week.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            This week
          </p>
          <div className="flex flex-col gap-0.5">
            {b.upcoming_this_week.map((u, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="w-16 shrink-0 text-muted-foreground">
                  {u.day}
                </span>
                <span className="flex-1">{u.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {b.email_summary && (
        <p className="text-[11px] leading-relaxed">
          <strong>Email:</strong> {b.email_summary}
        </p>
      )}
      {b.focus_recommendation && (
        <p className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] italic">
          Focus: {b.focus_recommendation}
        </p>
      )}
      {b.free_time_today && (
        <p className="text-[10px] text-muted-foreground">
          Free time today: {b.free_time_today}
        </p>
      )}
    </Card>
  )
}
