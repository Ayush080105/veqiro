"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarPlus,
  Copy,
  Download,
  FileSearch,
  Loader2,
  Mail,
  MessageCircleQuestion,
  Quote,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

import { AgentCard } from "@/components/ui/agent-card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  addLexReminders,
  exportLexDocument,
  invalidateLexMemory,
  recordLexActivity,
  updateLexObligation,
  useLexSourceDetail,
} from "@/lib/api/lex"
import type {
  AgentActionId,
  LexAnalyzeContractResult,
  LexFinding,
  LexKeyDate,
  LexObligation,
  LexSeverity,
  LexVersionComparison,
} from "@/lib/types/agents"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
export type ContractReview = LexAnalyzeContractResult["analysis"]

export const LEX_DISCLAIMER =
  "Lex provides AI-generated legal information and document analysis. It does not replace advice from a qualified lawyer."

// ── Severity ─────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<LexSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Review",
  low: "Informational",
}

const SEVERITY_DOT: Record<LexSeverity, string> = {
  critical: "bg-destructive",
  high: "bg-[color:var(--vq-yellow)]",
  medium: "bg-foreground/40",
  low: "bg-foreground/20",
}

export function SeverityTag({ severity, className }: { severity: LexSeverity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium",
        severity === "critical" && "border-destructive/30 bg-destructive/10 text-destructive",
        severity === "high" && "bg-[color:var(--vq-yellow)]/18 text-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", SEVERITY_DOT[severity])} aria-hidden />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBase64(b64: string, mime: string, filename: string) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  downloadBlob(new Blob([bytes], { type: mime }), filename)
}

export function isVerdictReview(review: ContractReview | null | undefined): review is ContractReview & { verdict: NonNullable<ContractReview["verdict"]> } {
  return Boolean(review?.verdict)
}

function seriousIssues(review: ContractReview) {
  return (review.issues ?? []).filter((i) => i.severity === "critical" || i.severity === "high")
}

function fileSafe(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "contract"
}

// ── Calendar export ──────────────────────────────────────────────────────────

const ICS_RRULE: Record<string, string> = {
  monthly: "FREQ=MONTHLY",
  quarterly: "FREQ=MONTHLY;INTERVAL=3",
  half_yearly: "FREQ=MONTHLY;INTERVAL=6",
  yearly: "FREQ=YEARLY",
}

function icsEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

/** A calendar file with an all-day event and a one-day-before alert for each dated item. */
export function buildIcs(documentName: string, items: Array<{ description: string; dueDate: string; recurrence?: string; section?: string }>) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const events = items.map((item, i) => {
    const day = item.dueDate.slice(0, 10).replace(/-/g, "")
    const rrule = item.recurrence && ICS_RRULE[item.recurrence] ? `RRULE:${ICS_RRULE[item.recurrence]}\r\n` : ""
    return (
      "BEGIN:VEVENT\r\n" +
      `UID:lex-${day}-${i}-${fileSafe(documentName)}@veqiro\r\n` +
      `DTSTAMP:${stamp}\r\n` +
      `DTSTART;VALUE=DATE:${day}\r\n` +
      rrule +
      `SUMMARY:${icsEscape(`${item.description} — ${documentName}`)}\r\n` +
      `DESCRIPTION:${icsEscape(`From ${documentName}${item.section ? `, section ${item.section}` : ""}. Tracked by Lex.`)}\r\n` +
      "BEGIN:VALARM\r\nTRIGGER:-P1D\r\nACTION:DISPLAY\r\nDESCRIPTION:Contract date tomorrow\r\nEND:VALARM\r\n" +
      "END:VEVENT\r\n"
    )
  })
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Veqiro//Lex//EN\r\nCALSCALE:GREGORIAN\r\n${events.join("")}END:VCALENDAR\r\n`
}

// ── One-page review export ───────────────────────────────────────────────────

export function reviewAsDocument(review: ContractReview, documentName: string) {
  const issues = review.issues ?? []
  const dates = review.key_dates ?? []
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  const lines = [
    "LEX CONTRACT REVIEW",
    "",
    `Contract: ${documentName}`,
    `Reviewed: ${today}`,
    review.perspective ? `Reviewed for: ${review.perspective}` : "",
    "",
    "VERDICT",
    review.verdict?.headline ?? "",
    review.verdict?.summary ?? "",
    "",
    "IMPORTANT ISSUES",
    ...issues.slice(0, 6).map((i, n) => `${n + 1}. ${i.title}${i.section ? ` — Section ${i.section}` : ""} (${SEVERITY_LABEL[i.severity]})`),
    "",
    "RECOMMENDED CHANGES",
    ...issues.filter((i) => i.send_back).slice(0, 6).map((i, n) => `${n + 1}. ${i.title}: ${i.send_back}`),
  ]
  if (dates.length) {
    lines.push("", "IMPORTANT DATES", ...dates.slice(0, 8).map((d) => `- ${d.when}: ${d.what}${d.section ? ` (Section ${d.section})` : ""}`))
  }
  lines.push("", "DISCLAIMER", "AI-generated review for informational purposes. Review with qualified legal counsel where appropriate.")
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n")
}

async function exportReview(review: ContractReview, documentName: string, sourceRowId?: string | null) {
  const data = await exportLexDocument({
    document: reviewAsDocument(review, documentName),
    format: "pdf",
    documentType: "Contract Review",
  })
  downloadBase64(data.file_b64, data.mime_type, `lex-review-${fileSafe(documentName)}.pdf`)
  void recordLexActivity({ action: "exported_review", sourceRowId, detail: documentName })
}

// ── Finding ──────────────────────────────────────────────────────────────────

export function FindingItem({
  finding,
  onExplain,
  onAsk,
}: {
  finding: LexFinding
  onExplain?: (text: string) => void
  onAsk?: (question: string) => void
}) {
  const citation = finding.section ? `Section ${finding.section}` : ""
  return (
    <article className="flex flex-col gap-2.5 border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityTag severity={finding.severity} />
        <h4 className="text-[13px] font-semibold leading-snug">{finding.title}</h4>
        {citation && <span className="font-mono text-[10px] text-muted-foreground">{citation}</span>}
      </div>

      {finding.kind === "preference_mismatch" && finding.preference && (
        <p className="rounded-[var(--vq-r-sm)] bg-[color:var(--vq-yellow)]/15 px-2.5 py-1.5 text-[11px]">
          <span className="font-medium">Outside your usual terms.</span> Your preference: {finding.preference}
        </p>
      )}

      {finding.quote ? (
        <div className="flex flex-col gap-1">
          <Kicker size="sm" tone="default">What the contract says</Kicker>
          <blockquote className="border-l-2 border-border pl-2.5 font-serif text-[12.5px] leading-relaxed text-foreground/80">
            &ldquo;{finding.quote}&rdquo;
          </blockquote>
        </div>
      ) : finding.kind === "missing" ? (
        <p className="text-[11px] text-muted-foreground">Not in the contract.</p>
      ) : null}

      <div className="flex flex-col gap-1">
        <Kicker size="sm" tone="default">Why it matters</Kicker>
        <p className="text-[12px] leading-relaxed">{finding.what_it_means}</p>
      </div>

      {finding.send_back && (
        <div className="flex flex-col gap-1 rounded-[var(--vq-r-sm)] border border-border bg-muted/30 p-2.5">
          <Kicker size="sm" tone="default">What Lex suggests</Kicker>
          <p className="text-[12px] leading-relaxed">{finding.send_back}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {finding.send_back && (
          <Button variant="chat-utility" onClick={() => copy(finding.send_back, "Suggested wording copied")}>
            <Copy /> Use suggested wording
          </Button>
        )}
        {citation && finding.quote && (
          <Button variant="chat-utility" onClick={() => copy(`${citation}: "${finding.quote}"`, "Citation copied")}>
            <Quote /> Copy citation
          </Button>
        )}
        {onExplain && finding.quote && (
          <Button variant="chat-utility" onClick={() => onExplain(finding.quote)}>
            Explain
          </Button>
        )}
        {onAsk && (
          <Button variant="chat-utility" onClick={() => onAsk(`About "${finding.title}"${citation ? ` (${citation})` : ""}: what are my options?`)}>
            <MessageCircleQuestion /> Ask Lex
          </Button>
        )}
      </div>
    </article>
  )
}

// ── Reminders ────────────────────────────────────────────────────────────────

const OWNER_LABEL: Record<string, string> = { you: "You", counterparty: "Them", both: "Both" }

function formatDue(dueDate: string | null) {
  if (!dueDate) return null
  return new Date(dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export function RemindersDialog({
  open,
  onOpenChange,
  sourceRowId,
  documentName,
  keyDates,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sourceRowId?: string | null
  documentName: string
  keyDates: LexKeyDate[]
}) {
  const queryClient = useQueryClient()
  const { data: detail, isLoading } = useLexSourceDetail(open && sourceRowId ? sourceRowId : null)
  const obligations = detail?.obligations ?? []
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [startDate, setStartDate] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open && obligations.length) {
      setSelected(new Set(obligations.filter((o) => o.owner !== "counterparty" && o.status === "open").map((o) => o.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detail?.source.id])

  const needsStart = obligations.some((o) => selected.has(o.id) && !o.dueDate) && !detail?.review?.contract?.effective_date

  const save = async () => {
    setSaving(true)
    try {
      let saved: LexObligation[] = []
      if (sourceRowId && selected.size) {
        saved = await addLexReminders(sourceRowId, { obligationIds: [...selected], startDate: startDate || null })
        invalidateLexMemory(queryClient)
      }
      const dated = saved.length
        ? saved.filter((o) => selected.has(o.id) && o.dueDate).map((o) => ({ description: o.description, dueDate: o.dueDate!, recurrence: o.recurrence, section: o.section }))
        : keyDates.filter((d) => d.date).map((d) => ({ description: d.what, dueDate: d.date!, recurrence: d.recurrence, section: d.section }))
      if (dated.length) {
        downloadBlob(new Blob([buildIcs(documentName, dated)], { type: "text/calendar" }), `lex-dates-${fileSafe(documentName)}.ics`)
      }
      const undated = selected.size - dated.length
      toast.success(
        sourceRowId
          ? `Lex will watch ${selected.size} ${selected.size === 1 ? "date" : "dates"}${dated.length ? " — calendar file downloaded" : ""}`
          : "Calendar file downloaded",
        undated > 0 && sourceRowId ? { description: `${undated} ${undated === 1 ? "date needs" : "dates need"} a start date before they can go on a calendar.` } : undefined,
      )
      onOpenChange(false)
    } catch {
      toast.error("Couldn't save reminders. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add dates to reminders</DialogTitle>
          <DialogDescription>
            Lex keeps these in Legal Watch and gives you a calendar file for Google Calendar or Outlook.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {!sourceRowId ? (
            <p className="text-xs text-muted-foreground">
              This review was run on pasted text, so Lex can only export the dates the contract states outright.
            </p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading dates…
            </div>
          ) : obligations.length === 0 ? (
            <p className="text-xs text-muted-foreground">Lex didn&apos;t find any dates in this contract.</p>
          ) : (
            obligations.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-start gap-2.5 rounded-[var(--vq-r-sm)] border border-border p-2.5 hover:bg-muted/40">
                <Checkbox
                  checked={selected.has(o.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (v) next.add(o.id)
                      else next.delete(o.id)
                      return next
                    })
                  }
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-medium">{o.description}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDue(o.dueDate) ?? o.whenText} · {OWNER_LABEL[o.owner] ?? o.owner}
                    {o.section ? ` · Section ${o.section}` : ""}
                    {o.reminderOn ? " · already tracked" : ""}
                  </span>
                </span>
              </label>
            ))
          )}
          {needsStart && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-[var(--vq-r-sm)] bg-muted/40 p-2.5">
              <label htmlFor="lex-start-date" className="text-xs font-medium">When does the contract start?</label>
              <p className="text-[11px] text-muted-foreground">Some dates are relative to the start (e.g. “within 10 days of signing”).</p>
              <Input id="lex-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="max-w-48" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || (Boolean(sourceRowId) && selected.size === 0)}>
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <CalendarPlus data-icon="inline-start" />}
            {sourceRowId ? `Add ${selected.size || ""} to reminders` : "Download calendar file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Version changes ──────────────────────────────────────────────────────────

export function VersionChanges({ comparison }: { comparison: LexVersionComparison }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed">
        {comparison.previousName ? <>Compared with <span className="font-medium">{comparison.previousName}</span>. </> : null}
        {comparison.summary}
      </p>
      {comparison.changes.map((c, i) => (
        <article key={i} className="flex flex-col gap-1.5 border-b border-border pb-3 last:border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityTag severity={c.severity} />
            <h4 className="text-[13px] font-semibold">{c.topic}</h4>
            {c.section && <span className="font-mono text-[10px] text-muted-foreground">Section {c.section}</span>}
          </div>
          <p className="font-mono text-[11px]">
            <span className="text-muted-foreground line-through">{c.before || "—"}</span>
            <span className="mx-1.5">→</span>
            <span className="font-semibold">{c.after || "—"}</span>
          </p>
          {c.why_it_matters && <p className="text-[12px] leading-relaxed">{c.why_it_matters}</p>}
          {c.suggested_response && (
            <p className="rounded-[var(--vq-r-sm)] bg-muted/40 p-2 text-[11.5px]">
              <span className="font-medium">Suggested response: </span>
              {c.suggested_response}
            </p>
          )}
        </article>
      ))}
      {comparison.changes.length === 0 && <p className="text-xs text-muted-foreground">No material changes between the versions.</p>}
    </div>
  )
}

// ── Full review ──────────────────────────────────────────────────────────────

export function FullReviewSheet({
  open,
  onOpenChange,
  review,
  documentName,
  sourceRowId,
  onFollowUpAction,
  onAddReminders,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  review: ContractReview
  documentName: string
  sourceRowId?: string | null
  onFollowUpAction?: FollowUp
  onAddReminders: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: detail } = useLexSourceDetail(open && sourceRowId ? sourceRowId : null)
  const issues = review.issues ?? []
  const dates = review.key_dates ?? []
  const clauses = review.clauses ?? []
  const terms = Object.entries(review.key_terms ?? {})
  const obligations = detail?.obligations ?? []
  const comparison = detail?.versionComparison

  const ask = (prompt: string) => {
    onOpenChange(false)
    onFollowUpAction?.("lex:ask-about", { sourceId: detail?.source.sourceId, prompt })
  }
  const explain = (text: string) => {
    onOpenChange(false)
    onFollowUpAction?.("lex:explain", { text, context: `From ${documentName}` })
  }
  const handoff = (agent: "rex" | "scout" | "vega", prompt: string) => {
    onOpenChange(false)
    router.push(`/assistants/${agent}?prompt=${encodeURIComponent(prompt)}`)
  }
  const setStatus = async (o: LexObligation, status: LexObligation["status"]) => {
    try {
      await updateLexObligation(o.id, { status })
      invalidateLexMemory(queryClient)
    } catch {
      toast.error("Couldn't update that date.")
    }
  }

  const upcomingDates = obligations.filter((o) => o.dueDate && o.status === "open")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-head text-xl">{documentName}</SheetTitle>
          <SheetDescription>
            {review.verdict?.headline}
            {review.perspective ? ` · reviewed for ${review.perspective}` : ""}
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue={comparison && !comparison.failed ? "changes" : "issues"} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-3 flex-wrap justify-start">
            <TabsTrigger value="issues">Issues · {issues.length}</TabsTrigger>
            <TabsTrigger value="dates">Dates & obligations</TabsTrigger>
            {comparison && !comparison.failed && <TabsTrigger value="changes">Changes · {comparison.changes.length}</TabsTrigger>}
            <TabsTrigger value="clauses">Clauses</TabsTrigger>
            {terms.length > 0 && <TabsTrigger value="terms">Terms</TabsTrigger>}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="issues" className="flex flex-col gap-4">
              {issues.map((f, i) => (
                <FindingItem key={i} finding={f} onExplain={onFollowUpAction ? explain : undefined} onAsk={onFollowUpAction && detail ? ask : undefined} />
              ))}
              {issues.length === 0 && <p className="text-xs text-muted-foreground">No issues were detected in this review.</p>}
            </TabsContent>

            <TabsContent value="dates" className="flex flex-col gap-3">
              {sourceRowId && obligations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">Event</th>
                        <th className="py-2 pr-2 font-medium">When</th>
                        <th className="py-2 pr-2 font-medium">Owner</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obligations.map((o) => (
                        <tr key={o.id} className={cn("border-b border-border/60 align-top", o.status !== "open" && "text-muted-foreground")}>
                          <td className="py-2 pr-2">
                            {o.description}
                            {o.section && <span className="block font-mono text-[10px] text-muted-foreground">Section {o.section}</span>}
                          </td>
                          <td className="py-2 pr-2 tabular-nums">{formatDue(o.dueDate) ?? o.whenText}</td>
                          <td className="py-2 pr-2">{OWNER_LABEL[o.owner] ?? o.owner}</td>
                          <td className="py-2">
                            {o.status === "open" ? (
                              <div className="flex flex-col items-start gap-1">
                                <span>{o.reminderOn ? "Tracked" : "Upcoming"}</span>
                                <button type="button" className="text-[10px] underline" onClick={() => setStatus(o, "done")}>Mark done</button>
                              </div>
                            ) : (
                              <button type="button" className="text-[10px] underline" onClick={() => setStatus(o, "open")}>
                                {o.status === "done" ? "Done" : "Dismissed"} · reopen
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : dates.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {dates.map((d, i) => (
                    <li key={i} className="border-b border-border/60 pb-2 text-[12px]">
                      <span className="font-medium">{d.when}</span> — {d.what}
                      <span className="block text-[10px] text-muted-foreground">
                        {OWNER_LABEL[d.owner] ?? d.owner}{d.section ? ` · Section ${d.section}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No dates or recurring duties found.</p>
              )}
              {(obligations.length > 0 || dates.length > 0) && (
                <Button variant="outline" size="sm" className="self-start" onClick={onAddReminders}>
                  <CalendarPlus data-icon="inline-start" /> Add dates to reminders
                </Button>
              )}
            </TabsContent>

            {comparison && !comparison.failed && (
              <TabsContent value="changes">
                <VersionChanges comparison={comparison} />
              </TabsContent>
            )}

            <TabsContent value="clauses" className="flex flex-col gap-2">
              {clauses.map((c, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-1.5 shrink-0 rounded-full", SEVERITY_DOT[(c.risk_level as LexSeverity) ?? "low"] ?? SEVERITY_DOT.low)} aria-hidden />
                    <span className="text-[12px] font-medium">
                      {c.section && <span className="mr-1 font-mono text-[10px] text-muted-foreground">§{c.section}</span>}
                      {c.title}
                    </span>
                  </div>
                  <p className="pl-3.5 text-[11.5px] leading-relaxed text-muted-foreground">{c.summary}</p>
                </div>
              ))}
              {clauses.length === 0 && <p className="text-xs text-muted-foreground">No clause summary available.</p>}
            </TabsContent>

            {terms.length > 0 && (
              <TabsContent value="terms" className="flex flex-col">
                {terms.map(([term, meaning]) => (
                  <div key={term} className="grid grid-cols-3 gap-2 border-b border-border/60 py-2 text-[12px]">
                    <span className="font-medium">{term}</span>
                    <span className="col-span-2 text-muted-foreground">{meaning}</span>
                  </div>
                ))}
              </TabsContent>
            )}
          </div>
        </Tabs>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-3">
          <Kicker size="sm" tone="default">Hand off</Kicker>
          <div className="flex flex-wrap gap-1.5">
            {review.contract?.payment_terms && (
              <Button variant="chat-utility" onClick={() => handoff("rex", `Lex found these payment terms in "${documentName}": ${review.contract!.payment_terms}${review.contract?.value ? ` (${review.contract.value})` : ""}. Check whether our invoices and payments line up with them.`)}>
                Ask Rex to check payments
              </Button>
            )}
            {review.counterparty && (
              <Button variant="chat-utility" onClick={() => handoff("scout", `Research ${review.counterparty}: company background, reputation and any disputes or legal issues, before we sign "${documentName}".`)}>
                Ask Scout about {review.counterparty}
              </Button>
            )}
            {upcomingDates.length > 0 && (
              <Button variant="chat-utility" onClick={() => handoff("vega", `Add these contract dates from "${documentName}" to my calendar with a reminder the day before:\n${upcomingDates.map((o) => `- ${formatDue(o.dueDate)}: ${o.description}`).join("\n")}`)}>
                Ask Vega to calendar dates
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{LEX_DISCLAIMER}</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Verdict card ─────────────────────────────────────────────────────────────

const VERDICT_TONE: Record<string, string> = {
  sign: "bg-[color:var(--vq-green)]/12",
  negotiate: "bg-[color:var(--vq-yellow)]/15",
  reject: "bg-destructive/10",
  legal_review_required: "bg-muted/60",
}

export function ContractReviewCard({
  review,
  input,
  onFollowUpAction,
}: {
  review: ContractReview & { verdict: NonNullable<ContractReview["verdict"]> }
  input?: { sourceRowId?: string | null; sourceName?: string; sourceId?: string | null }
  onFollowUpAction?: FollowUp
}) {
  const [fullOpen, setFullOpen] = React.useState(false)
  const [remindersOpen, setRemindersOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const documentName = input?.sourceName || review.document_type || "Contract"
  const issues = review.issues ?? []
  const serious = seriousIssues(review)
  const top = (serious.length ? serious : issues).slice(0, 4)
  const critical = issues.filter((i) => i.severity === "critical").length
  const high = issues.filter((i) => i.severity === "high").length
  const changeCount = issues.filter((i) => i.send_back).length
  const dates = review.key_dates ?? []
  const facts = review.key_facts ?? []
  const sourceRowId = input?.sourceRowId ?? null

  if (review.failed) {
    return (
      <AgentCard size="sm">
        <AgentCard.Header icon={<ShieldAlert />} title={review.verdict.headline} />
        <AgentCard.Body className="flex flex-col gap-3">
          <p className="text-[12px] leading-relaxed">{review.verdict.summary}</p>
          {onFollowUpAction && input?.sourceId && (
            <Button variant="chat-action" className="self-start" onClick={() => onFollowUpAction("lex:analyze-contract", { source_id: input.sourceId })}>
              <FileSearch /> Run the review again
            </Button>
          )}
        </AgentCard.Body>
      </AgentCard>
    )
  }

  const doExport = async () => {
    setExporting(true)
    try {
      await exportReview(review, documentName, sourceRowId)
    } catch {
      toast.error("Export failed. Try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={serious.length ? <ShieldAlert /> : <ShieldCheck />}
        kicker="Before you sign"
        title={documentName}
      />
      <AgentCard.Body className="flex flex-col gap-3.5">
        <p className="-mt-1 text-[11px] text-muted-foreground">
          {review.document_type}
          {review.perspective ? ` · reviewed for ${review.perspective}` : ""}
        </p>

        {/* Verdict */}
        <div className={cn("flex flex-col gap-1.5 rounded-[var(--vq-r-sm)] border border-border p-3", VERDICT_TONE[review.verdict.action])}>
          <p className="font-head text-lg leading-tight">{review.verdict.headline}</p>
          {review.verdict.summary && <p className="text-[12px] leading-relaxed">{review.verdict.summary}</p>}
          <p className="text-[11px] font-medium">
            {critical + high > 0 ? (
              <>
                {critical + high} {critical + high === 1 ? "item needs" : "items need"} review
                {critical > 0 && ` · ${critical} critical`}
                {high > 0 && ` · ${high} high`}
              </>
            ) : (
              "No critical issues were detected in this review."
            )}
          </p>
        </div>

        {/* Top issues */}
        {top.length > 0 && (
          <ol className="flex flex-col gap-2.5">
            {top.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_DOT[f.severity])} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold leading-snug">
                    {f.title}
                    {f.section && <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground">§{f.section}</span>}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    {f.kind === "preference_mismatch" && f.preference ? `Outside your usual terms (${f.preference}). ` : ""}
                    {f.what_it_means}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* Snapshot */}
        {facts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker size="sm" tone="default">Contract snapshot</Kicker>
            <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--vq-r-sm)] border border-border sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="flex flex-col gap-0.5 border-b border-r border-border/70 px-2.5 py-2 last:border-r-0">
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{f.label}</dt>
                  <dd className="text-[12px] font-medium tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Next steps */}
        <div className="flex flex-col gap-2">
          <Kicker size="sm" tone="default">Recommended next steps</Kicker>
          <ol className="flex flex-col gap-2">
            {changeCount > 0 && onFollowUpAction && (
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--vq-r-sm)] border border-border px-2.5 py-2">
                <span className="text-[12px]">Request {changeCount} {changeCount === 1 ? "change" : "changes"}</span>
                <Button variant="chat-action" onClick={() => onFollowUpAction("lex:draft-reply", { analysis: review, source_row_id: sourceRowId, document_name: documentName })}>
                  <Mail /> Draft negotiation email
                </Button>
              </li>
            )}
            {dates.length > 0 && (
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--vq-r-sm)] border border-border px-2.5 py-2">
                <span className="text-[12px]">Track {dates.length} important {dates.length === 1 ? "date" : "dates"}</span>
                <Button variant="chat-utility" onClick={() => setRemindersOpen(true)}>
                  <CalendarPlus /> Add to reminders
                </Button>
              </li>
            )}
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--vq-r-sm)] border border-border px-2.5 py-2">
              <span className="text-[12px]">Share with counsel</span>
              <Button variant="chat-utility" onClick={doExport} disabled={exporting}>
                {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export 1-page review
              </Button>
            </li>
          </ol>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">{LEX_DISCLAIMER}</p>
      </AgentCard.Body>
      <AgentCard.Footer>
        <Button variant="chat-utility" onClick={() => setFullOpen(true)}>
          <FileSearch /> Full review
        </Button>
        {onFollowUpAction && input?.sourceId && (
          <Button variant="chat-utility" onClick={() => onFollowUpAction("lex:ask-about", { sourceId: input.sourceId, prompt: "" })}>
            <MessageCircleQuestion /> Ask Lex about this contract
          </Button>
        )}
      </AgentCard.Footer>

      <FullReviewSheet
        open={fullOpen}
        onOpenChange={setFullOpen}
        review={review}
        documentName={documentName}
        sourceRowId={sourceRowId}
        onFollowUpAction={onFollowUpAction}
        onAddReminders={() => {
          setFullOpen(false)
          setRemindersOpen(true)
        }}
      />
      <RemindersDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        sourceRowId={sourceRowId}
        documentName={documentName}
        keyDates={dates}
      />
    </AgentCard>
  )
}
