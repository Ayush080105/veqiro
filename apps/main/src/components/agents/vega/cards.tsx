"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Inbox,
  Reply,
  CalendarDays,
  CalendarPlus,
  Sunrise,
  ExternalLink,
  Mail,
  PenLine,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/ui/agent-card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CopyButton } from "@/components/ui/copy-button"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import { KpiTile } from "@/components/ui/kpi-tile"
import { StatusPill } from "@/components/ui/status-pill"
import type {
  VegaProcessInboxResult,
  VegaDraftReplyResult,
  VegaCalendarSummaryResult,
  VegaCreateEventResult,
  VegaExecutiveBriefingResult,
  VegaComposeEmailResult,
  AgentActionId,
} from "@/lib/types/agents"

import { Button } from "@/components/ui/button"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void

function priorityLevel(p: "urgent" | "high" | "medium" | "low") {
  return p === "urgent" ? "danger" : p === "high" ? "warn" : p === "medium" ? "info" : "info"
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

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

// ─── Inbox triage card ──────────────────────────────────────────────────────

export function InboxTriageCard({
  result,
  onFollowUpAction,
}: {
  result: VegaProcessInboxResult
  onFollowUpAction?: FollowUp
}) {
  const s = result.stats
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Inbox />}
        title="Inbox triage"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {s.total_processed} processed
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          <KpiTile label="Urgent" value={s.urgent} />
          <KpiTile label="High" value={s.high} />
          <KpiTile label="Medium" value={s.medium} />
          <KpiTile label="Low" value={s.low} tone="muted" />
          <KpiTile label="Drafts" value={s.drafts_created} />
          <KpiTile label="Labeled" value={s.labels_applied} />
        </div>
        <div className="flex flex-col gap-1">
          {result.processed.map((e) => (
            <Collapsible key={e.email_id}>
              <div className="border border-border bg-muted/20 p-2">
                <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
                  <StatusPill level={priorityLevel(e.priority)}>{e.priority}</StatusPill>
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
                    <div className="flex items-center justify-between gap-2">
                      <CopyButton
                        text={e.email_id}
                        label="Copy ID"
                        successLabel="Email ID copied"
                      />
                      {onFollowUpAction && (e.priority === "urgent" || e.priority === "high") && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => onFollowUpAction("maya:draft-content", {
                            topic: e.subject,
                            platform: "linkedin",
                            additional_context: [e.summary, e.suggested_action].filter(Boolean).join("\n"),
                          })}
                        >
                          <PenLine data-icon="inline-start" /> Draft post · Maya
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Draft reply card ───────────────────────────────────────────────────────

export function DraftReplyCard({ result }: { result: VegaDraftReplyResult }) {
  const d = result.draft
  const fullText = `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Reply />}
        title="Draft reply"
        badge={
          d.saved ? (
            <Badge variant="secondary" className="text-[10px]">
              saved in Gmail
            </Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
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
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton text={fullText} />
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Calendar summary card ──────────────────────────────────────────────────

export function CalendarCard({ result }: { result: VegaCalendarSummaryResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<CalendarDays />}
        title="Calendar"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {result.events.length} events
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        {result.conflicts.length > 0 && (
          <div className="flex flex-col gap-1 border border-destructive/30 bg-destructive/10 p-2">
            <Kicker prefix="//" className="text-destructive">
              conflicts
            </Kicker>
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
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">daily summary</Kicker>
            {Object.entries(result.daily_summary).map(([day, s]) => (
              <p key={day} className="text-[11px] leading-relaxed">
                <strong>{day}:</strong> {s}
              </p>
            ))}
          </div>
        )}
        {result.free_slots.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">free slots</Kicker>
            <div className="flex flex-wrap gap-1">
              {result.free_slots.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {fmtDate(s.start)} – {fmtDate(s.end)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Event created card ─────────────────────────────────────────────────────

export function EventCreatedCard({ result }: { result: VegaCreateEventResult }) {
  const e = result.event
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<CalendarPlus />}
        title={result.created ? "Event created" : "Event proposed"}
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {e.status}
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
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
          <InfoSection label="conflicts detected" bullets={result.conflicts} tone="danger" />
        )}
      </AgentCard.Body>
    </AgentCard>
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
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Sunrise />}
        title="Executive briefing"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            priority {b.priority_score}/10
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-xs font-medium">{b.good_morning}</p>
        {b.urgent_actions.length > 0 && (
          <InfoSection label="urgent actions" bullets={b.urgent_actions} tone="danger" />
        )}
        {b.today_schedule.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">today</Kicker>
            <div className="flex flex-col gap-0.5">
              {b.today_schedule.map((t, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="w-16 shrink-0 text-muted-foreground">{t.time}</span>
                  <span className="flex-1">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {b.upcoming_this_week.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">this week</Kicker>
            <div className="flex flex-col gap-0.5">
              {b.upcoming_this_week.map((u, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="w-16 shrink-0 text-muted-foreground">{u.day}</span>
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
        {typeof (b as Record<string, unknown>).financial_status === "string" && (
          <p className="rounded border border-border bg-muted/20 px-2 py-1.5 text-[11px] leading-relaxed">
            <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Rex ·
            </span>
            {(b as unknown as Record<string, string>).financial_status}
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
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Compose email card ─────────────────────────────────────────────────────

export function ComposeEmailCard({ result }: { result: VegaComposeEmailResult }) {
  const d = result.draft
  const fullText = `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`
  const draftId = d.draft_id ?? result.draft_id
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Mail />}
        title="Composed email"
        badge={
          draftId ? (
            <Badge variant="secondary" className="text-[10px]">
              saved in Gmail
            </Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
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
        {result.errors && result.errors.length > 0 && (
          <div className="border border-destructive/30 bg-destructive/10 p-2">
            <InfoSection label="errors" bullets={result.errors} tone="danger" />
          </div>
        )}
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton text={fullText} />
      </AgentCard.Footer>
    </AgentCard>
  )
}

// silence import-only hint
void copyText
