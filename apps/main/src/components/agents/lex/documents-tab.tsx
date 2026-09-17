"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  CalendarPlus,
  ExternalLink,
  FileSearch,
  FileText,
  Loader2,
  MessageCircleQuestion,
  Search,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import {
  compareLexVersion,
  invalidateLexMemory,
  useDeleteLexSource,
  useLexBrief,
  useLexPreferences,
  useLexSettings,
  useLexSourceDetail,
  useLexSources,
  useLexSourceSearch,
  useSaveLexPreferences,
  useSaveLexSettings,
} from "@/lib/api/lex"
import type { AgentActionId, LexSource } from "@/lib/types/agents"
import { FindingItem, FullReviewSheet, LEX_DISCLAIMER, RemindersDialog, SeverityTag, VersionChanges, isVerdictReview } from "./review"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void

// ── Filters ──────────────────────────────────────────────────────────────────

const TYPE_FILTERS: Array<{ id: string; label: string; match: (t: string) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "contracts", label: "Contracts", match: (t) => /contract|service|agreement|mou|lease|loan|partnership|shareholder|settlement/.test(t) && !/nda|vendor|employment/.test(t) },
  { id: "nda", label: "NDAs", match: (t) => /nda|non.?disclosure|confidential/.test(t) },
  { id: "vendor", label: "Vendor", match: (t) => /vendor|supplier|procure/.test(t) },
  { id: "employment", label: "Employment", match: (t) => /employ|offer/.test(t) },
  { id: "notice", label: "Legal notices", match: (t) => /notice/.test(t) },
  { id: "policy", label: "Policies", match: (t) => /policy|terms/.test(t) },
  { id: "other", label: "Other", match: (t) => t === "other" || !t },
]

type StatusId = "any" | "active" | "expiring" | "expired" | "needs_review"
const STATUS_FILTERS: Array<{ id: StatusId; label: string }> = [
  { id: "any", label: "Any status" },
  { id: "active", label: "Active" },
  { id: "expiring", label: "Expiring soon" },
  { id: "expired", label: "Expired" },
  { id: "needs_review", label: "Needs review" },
]

const DAY = 86_400_000

function documentStatus(s: LexSource, now = Date.now()): Exclude<StatusId, "any" | "active"> | "active" {
  const expiry = s.expiryDate ? new Date(s.expiryDate).getTime() : null
  if (expiry !== null && expiry < now) return "expired"
  if (expiry !== null && expiry - now <= 60 * DAY) return "expiring"
  if (!s.lastReviewedAt && !s.latestReview) return "needs_review"
  return "active"
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  needs_review: "Needs review",
}

/** Plain-language searches that map onto structured filters instead of text search. */
function interpretSearch(q: string): { text: string; status?: StatusId; typeId?: string } {
  const lower = q.toLowerCase()
  const out: { text: string; status?: StatusId; typeId?: string } = { text: q }
  if (/expir|renew/.test(lower)) {
    out.status = "expiring"
    out.text = ""
  }
  if (/not reviewed|needs review|unreviewed/.test(lower)) {
    out.status = "needs_review"
    out.text = ""
  }
  const type = TYPE_FILTERS.find((t) => t.id !== "all" && t.id !== "other" && new RegExp(`\\b${t.label.toLowerCase().replace(/s$/, "")}`).test(lower))
  if (type) {
    out.typeId = type.id
    out.text = out.text.replace(new RegExp(`${type.label.replace(/s$/, "")}s?`, "i"), "").replace(/\b(all|with|contracts?|agreements?)\b/gi, "").trim()
  }
  return out
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

// ── Preferences ──────────────────────────────────────────────────────────────

const CATEGORY_LABEL = { commercial: "Commercial", legal: "Legal", style: "Contract style" } as const

function PreferencesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: prefs = [], isLoading } = useLexPreferences(open)
  const save = useSaveLexPreferences()
  const { data: settings } = useLexSettings(open)
  const saveSettings = useSaveLexSettings()
  const { data: brief } = useLexBrief(open)
  const [values, setValues] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (prefs.length) setValues(Object.fromEntries(prefs.map((p) => [p.key, p.value])))
  }, [prefs])

  const submit = async () => {
    try {
      await save.mutateAsync(values)
      toast.success("Preferences saved — Lex will check new contracts against them")
    } catch {
      toast.error("Couldn't save preferences.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-head text-xl">Your preferences</SheetTitle>
          <SheetDescription>Your usual positions. Lex flags contracts that fall outside them.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading…</div>
          ) : (
            (["commercial", "legal", "style"] as const).map((cat) => (
              <fieldset key={cat} className="flex flex-col gap-2.5">
                <legend className="mb-1"><Kicker size="sm" tone="default">{CATEGORY_LABEL[cat]}</Kicker></legend>
                {prefs.filter((p) => p.category === cat).map((p) => (
                  <label key={p.key} htmlFor={`lex-pref-${p.key}`} className="flex flex-col gap-1">
                    <span className="text-xs font-medium">{p.label}</span>
                    <Input
                      id={`lex-pref-${p.key}`}
                      value={values[p.key] ?? ""}
                      placeholder={p.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
                    />
                  </label>
                ))}
              </fieldset>
            ))
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-xs font-medium">Weekly Legal Brief</span>
                <span className="text-[11px] text-muted-foreground">A short Monday email: what needs attention and what&apos;s coming up.</span>
              </span>
              <Switch
                checked={settings?.weeklyBrief ?? false}
                onCheckedChange={(v: boolean) => saveSettings.mutate({ weeklyBrief: v })}
              />
            </label>
            {brief && (
              <p className="rounded-[var(--vq-r-sm)] bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
                This week: {brief.clear ? "nothing urgent needs your attention." : `${brief.attentionCount} to look at, ${brief.upcomingCount} upcoming ${brief.upcomingCount === 1 ? "date" : "dates"}, ${brief.reviewedThisWeek} reviewed.`}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" data-icon="inline-start" />}Save preferences
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Document detail ──────────────────────────────────────────────────────────

function DocumentSheet({
  sourceRowId,
  onOpenChange,
  onFollowUpAction,
  onDelete,
}: {
  sourceRowId: string | null
  onOpenChange: (v: boolean) => void
  onFollowUpAction: FollowUp
  onDelete: (s: LexSource) => void
}) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useLexSourceDetail(sourceRowId)
  const [fullOpen, setFullOpen] = React.useState(false)
  const [remindersOpen, setRemindersOpen] = React.useState(false)
  const [comparing, setComparing] = React.useState(false)
  const source = data?.source
  const review = data?.review ?? null
  const verdict = isVerdictReview(review) ? review : null
  const hasPrevious = Boolean(source?.previousVersionId)

  const act = (id: AgentActionId, prefill?: Record<string, unknown>) => {
    onOpenChange(false)
    onFollowUpAction(id, prefill)
  }

  const runCompare = async () => {
    if (!sourceRowId) return
    setComparing(true)
    try {
      await compareLexVersion(sourceRowId, Boolean(data?.versionComparison))
      invalidateLexMemory(queryClient)
    } catch {
      toast.error("Couldn't compare versions. Try again.")
    } finally {
      setComparing(false)
    }
  }

  const facts = source
    ? [
        ["Counterparty", source.counterparty],
        ["Status", STATUS_LABEL[documentStatus(source)]],
        ["Expires", source.expiryDate ? fmtDate(source.expiryDate) : null],
        ["Renewal", source.renewalDate ? fmtDate(source.renewalDate) : null],
        ["Notice by", source.noticeDeadline ? fmtDate(source.noticeDeadline) : null],
        ["Version", source.version && source.version > 1 ? `v${source.version}` : null],
      ].filter(([, v]) => v) as Array<[string, string]>
    : []

  return (
    <Sheet open={Boolean(sourceRowId)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-head text-xl">{source?.name ?? "Document"}</SheetTitle>
          <SheetDescription>
            {source ? `${source.pageCount} pages · uploaded ${fmtDate(source.createdAt)}${source.lastReviewedAt ? ` · reviewed ${fmtDate(source.lastReviewedAt)}` : ""}` : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !data || !source ? (
          <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading document…</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            {/* Before you sign */}
            <section className="flex flex-col gap-2">
              <Kicker size="sm" tone="default">Before you sign</Kicker>
              {verdict ? (
                <div className="flex flex-col gap-1.5 rounded-[var(--vq-r-sm)] border border-border p-3">
                  <p className="font-head text-lg leading-tight">{verdict.verdict.headline}</p>
                  <p className="text-[12px] leading-relaxed">{verdict.verdict.summary}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Button variant="chat-utility" onClick={() => setFullOpen(true)}><FileSearch /> Full review</Button>
                    {(verdict.issues ?? []).some((i) => i.send_back) && (
                      <Button variant="chat-action" onClick={() => act("lex:draft-reply", { analysis: verdict, source_row_id: source.id, document_name: source.name })}>
                        Draft changes
                      </Button>
                    )}
                    <Button variant="chat-utility" onClick={() => act("lex:analyze-contract", { source_id: source.sourceId })}>Review again</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--vq-r-sm)] border border-dashed border-border p-3">
                  <span className="text-[12px] text-muted-foreground">Not reviewed yet.</span>
                  <Button size="sm" onClick={() => act("lex:analyze-contract", { source_id: source.sourceId })}>
                    <FileSearch data-icon="inline-start" /> Can I sign this?
                  </Button>
                </div>
              )}
            </section>

            {facts.length > 0 && (
              <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--vq-r-sm)] border border-border sm:grid-cols-3">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 border-b border-r border-border/70 px-2.5 py-2">
                    <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
                    <dd className="text-[12px] font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {/* Version changes */}
            {hasPrevious && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Kicker size="sm" tone="default">Changes from the previous version</Kicker>
                  <Button variant="ghost" size="sm" onClick={runCompare} disabled={comparing}>
                    {comparing && <Loader2 className="animate-spin" data-icon="inline-start" />}
                    {data.versionComparison ? "Compare again" : "Compare"}
                  </Button>
                </div>
                {data.versionComparison ? (
                  <VersionChanges comparison={data.versionComparison} />
                ) : (
                  <p className="text-[12px] text-muted-foreground">{comparing ? "Comparing…" : "Lex is comparing the versions — check back in a minute."}</p>
                )}
              </section>
            )}

            {/* Top findings */}
            {data.findings.length > 0 && verdict && (
              <section className="flex flex-col gap-3">
                <Kicker size="sm" tone="default">Findings</Kicker>
                {(verdict.issues ?? []).slice(0, 3).map((f, i) => (
                  <FindingItem key={i} finding={f} onAsk={(q) => act("lex:ask-about", { sourceId: source.sourceId, prompt: q })} />
                ))}
                {(verdict.issues ?? []).length > 3 && (
                  <Button variant="outline" size="sm" className="self-start" onClick={() => setFullOpen(true)}>
                    See all {(verdict.issues ?? []).length} findings
                  </Button>
                )}
              </section>
            )}

            {/* Dates */}
            {data.obligations.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Kicker size="sm" tone="default">Important dates</Kicker>
                  <Button variant="ghost" size="sm" onClick={() => setRemindersOpen(true)}>
                    <CalendarPlus data-icon="inline-start" /> Add to reminders
                  </Button>
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-[var(--vq-r-sm)] border border-border">
                  {data.obligations.slice(0, 6).map((o) => (
                    <li key={o.id} className={cn("flex items-start justify-between gap-3 px-3 py-2 text-[12px]", o.status !== "open" && "text-muted-foreground line-through")}>
                      <span>{o.description}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {o.dueDate ? fmtDate(o.dueDate) : o.whenText}
                        {o.reminderOn ? " · tracked" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Versions */}
            {data.versions.length > 1 && (
              <section className="flex flex-col gap-2">
                <Kicker size="sm" tone="default">Version history</Kicker>
                <ol className="flex flex-col gap-1">
                  {data.versions.map((v) => (
                    <li key={v.id} className={cn("flex justify-between gap-2 text-[12px]", v.id === source.id && "font-medium")}>
                      <span>v{v.version} · {v.name}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtDate(v.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Activity */}
            {data.activity.length > 0 && (
              <section className="flex flex-col gap-2">
                <Kicker size="sm" tone="default">Activity</Kicker>
                <ol className="flex flex-col gap-2">
                  {data.activity.slice(0, 12).map((a) => (
                    <li key={a.id} className="flex flex-col text-[12px]">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span>
                        <span className="font-medium">{a.actor === "lex" ? "Lex" : a.actorName ?? "You"}</span> — {a.action.charAt(0).toLowerCase() + a.action.slice(1)}
                        {a.detail ? <span className="text-muted-foreground"> · {a.detail}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <p className="text-[10px] text-muted-foreground">{LEX_DISCLAIMER}</p>
          </div>
        )}

        {source && (
          <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => act("lex:ask-about", { sourceId: source.sourceId, prompt: "" })}>
              <MessageCircleQuestion data-icon="inline-start" /> Ask Lex
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={source.r2Url} target="_blank" rel="noreferrer"><ExternalLink data-icon="inline-start" /> Open PDF</a>
            </Button>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => onDelete(source)}>
              <Trash2 data-icon="inline-start" /> Delete
            </Button>
          </div>
        )}

        {verdict && source && (
          <FullReviewSheet
            open={fullOpen}
            onOpenChange={setFullOpen}
            review={verdict}
            documentName={source.name}
            sourceRowId={source.id}
            onFollowUpAction={(id, prefill) => act(id, prefill)}
            onAddReminders={() => {
              setFullOpen(false)
              setRemindersOpen(true)
            }}
          />
        )}
        {source && (
          <RemindersDialog
            open={remindersOpen}
            onOpenChange={setRemindersOpen}
            sourceRowId={source.id}
            documentName={source.name}
            keyDates={verdict?.key_dates ?? []}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function LexDocumentsTab({
  onUpload,
  onFollowUpAction,
  openDocumentId,
  onOpenDocumentChange,
}: {
  onUpload: () => void
  onFollowUpAction: FollowUp
  openDocumentId: string | null
  onOpenDocumentChange: (id: string | null) => void
}) {
  const { data: sources, isLoading, error } = useLexSources()
  const deleteMut = useDeleteLexSource()
  const [confirming, setConfirming] = React.useState<LexSource | null>(null)
  const [query, setQuery] = React.useState("")
  const [typeId, setTypeId] = React.useState("all")
  const [status, setStatus] = React.useState<StatusId>("any")
  const [prefsOpen, setPrefsOpen] = React.useState(false)

  const interpreted = interpretSearch(query)
  const { data: searched, isFetching: searching } = useLexSourceSearch(interpreted.text)

  const visible = React.useMemo(() => {
    const base = interpreted.text.trim().length >= 2 ? searched ?? [] : sources ?? []
    const effectiveType = interpreted.typeId ?? typeId
    const effectiveStatus = interpreted.status ?? status
    const typeFilter = TYPE_FILTERS.find((t) => t.id === effectiveType) ?? TYPE_FILTERS[0]
    return base.filter((s) => {
      const t = `${s.typeDetected ?? ""} ${s.type ?? ""} ${s.name}`.toLowerCase()
      if (effectiveType !== "all" && !typeFilter.match(t)) return false
      if (effectiveStatus !== "any" && documentStatus(s) !== effectiveStatus) return false
      return true
    })
  }, [sources, searched, interpreted.text, interpreted.typeId, interpreted.status, typeId, status])

  const handleDelete = async () => {
    if (!confirming) return
    const target = confirming
    setConfirming(null)
    onOpenDocumentChange(null)
    try {
      await deleteMut.mutateAsync(target.id)
      toast.success(`Deleted "${target.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading documents…
      </div>
    )
  }

  if (error) {
    return <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">Failed to load documents.</div>
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-border bg-muted/30">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-head text-xl">Give Lex something to watch.</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Upload your legal documents and Lex can review contracts, remember important dates, and flag changes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onUpload} size="sm"><Upload data-icon="inline-start" /> Upload a contract</Button>
          <Button onClick={() => setPrefsOpen(true)} size="sm" variant="outline"><Settings2 data-icon="inline-start" /> Your preferences</Button>
        </div>
        <PreferencesSheet open={prefsOpen} onOpenChange={setPrefsOpen} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Documents</p>
          <p className="text-xs text-muted-foreground">
            {sources.length} {sources.length === 1 ? "document" : "documents"} · Lex remembers their dates and findings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPrefsOpen(true)} size="sm" variant="outline"><Settings2 data-icon="inline-start" /> Your preferences</Button>
          <Button onClick={onUpload} size="sm"><Upload data-icon="inline-start" /> Upload</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="lex-document-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search — e.g. "unlimited liability", "vendor contracts expiring soon"'
          className="pl-8"
          aria-label="Search documents"
        />
        {searching && <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TYPE_FILTERS.map((t) => (
          <Button key={t.id} size="xs" variant={(interpreted.typeId ?? typeId) === t.id ? "default" : "outline"} onClick={() => setTypeId(t.id)}>
            {t.label}
          </Button>
        ))}
        <select
          aria-label="Status"
          value={interpreted.status ?? status}
          onChange={(e) => setStatus(e.target.value as StatusId)}
          className="ml-auto h-6 border border-border bg-background px-1.5 text-xs"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-[var(--vq-r-sm)] border border-border bg-background">
        {visible.map((s) => {
          const st = documentStatus(s)
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onOpenDocumentChange(s.id)} className="flex w-full flex-col gap-1.5 px-3 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{s.name}</span>
                    {s.version && s.version > 1 && <Badge variant="outline" className="text-[10px]">v{s.version}</Badge>}
                    {s.hasUnseenChanges && <Badge className="text-[10px]">New version changes</Badge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {s.latestReview
                      ? `${s.latestReview.headline}${s.latestReview.issueCount ? ` · ${s.latestReview.issueCount} to review` : ""}`
                      : "Not reviewed yet"}
                    {s.counterparty ? ` · ${s.counterparty}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                  {s.riskLevel && (s.riskLevel === "critical" || s.riskLevel === "high") && <SeverityTag severity={s.riskLevel} />}
                  {s.nextDate && (
                    <span className="text-muted-foreground">
                      Next: {s.nextDate.description} · {fmtDate(s.nextDate.dueDate)}
                    </span>
                  )}
                  <Badge variant={st === "expired" ? "destructive" : "outline"} className="text-[10px]">{STATUS_LABEL[st]}</Badge>
                </span>
              </button>
            </li>
          )
        })}
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">No documents match.</li>
        )}
      </ul>

      <DocumentSheet
        sourceRowId={openDocumentId}
        onOpenChange={(v) => !v && onOpenDocumentChange(null)}
        onFollowUpAction={onFollowUpAction}
        onDelete={(s) => setConfirming(s)}
      />
      <PreferencesSheet open={prefsOpen} onOpenChange={setPrefsOpen} />

      <AlertDialog open={!!confirming} onOpenChange={(v) => !v && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming ? `"${confirming.name}", its review, dates and history will be removed. This cannot be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
