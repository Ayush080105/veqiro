"use client"

import * as React from "react"
import Image from "next/image"
import { FilePlus, FileSearch, MessageCircleQuestion, ShieldCheck, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kicker } from "@/components/ui/kicker"
import { cn } from "@/lib/utils"
import { useLexWatch } from "@/lib/api/lex"
import type { AgentActionId, LexWatchItem } from "@/lib/types/agents"

const SEVERITY_DOT: Record<LexWatchItem["severity"], string> = {
  critical: "bg-destructive",
  high: "bg-[color:var(--vq-yellow)]",
  medium: "bg-foreground/40",
  info: "bg-foreground/20",
}

function relative(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

const ACTIONS: Array<{ id: AgentActionId; title: string; hint: string; icon: React.ReactNode }> = [
  { id: "lex:upload-source", title: "Review a contract", hint: "Can I sign this?", icon: <FileSearch className="size-4" /> },
  { id: "lex:draft-document", title: "Create a document", hint: "Draft an NDA, agreement, notice…", icon: <FilePlus className="size-4" /> },
  { id: "lex:query-document", title: "Ask about your documents", hint: "Find clauses, dates and obligations.", icon: <MessageCircleQuestion className="size-4" /> },
]

const PROMPTS = ["What needs my attention?", "What's due this month?", "What am I missing in my latest contract?"]

/** Lex's home: the three core jobs, a calm Legal Watch summary, and what was reviewed recently. */
export function LexHome({
  photo,
  onAction,
  onPrompt,
  onOpenDocument,
  onViewAll,
  embedded = false,
}: {
  photo?: string
  onAction: (actionId: AgentActionId) => void
  onPrompt: (prompt: string) => void
  onOpenDocument: (sourceRowId: string) => void
  onViewAll: () => void
  /**
   * Rendered inside the workspace overview rather than standing in for an
   * empty chat page. Drops the portrait header and the "Ask Lex" prompts,
   * because the workspace shell already names the employee and the chat dock
   * already offers those prompts — shown together they read as the same thing
   * said three times.
   */
  embedded?: boolean
}) {
  const { data: watch, isLoading } = useLexWatch()
  const hasDocuments = (watch?.documents ?? 0) > 0
  const attention = (watch?.items ?? []).filter((i) => i.severity !== "info")

  return (
    <div
      className={
        embedded
          ? "flex flex-col"
          : "flex flex-1 justify-center overflow-y-auto bg-background px-4 py-8 sm:px-6"
      }
    >
      <div className={embedded ? "flex w-full flex-col gap-6" : "flex w-full max-w-160 flex-col gap-6"}>
        {/* The workspace header already says who this is and what they do;
            repeating it here made three introductions on one screen. */}
        {!embedded && (
          <header className="flex items-center gap-4">
            {photo && (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--vq-r)] border border-border shadow-(--vq-shadow-sm)">
                <Image src={photo} alt="Lex" fill sizes="56px" className="object-cover" />
              </div>
            )}
            <div>
              <h2 className="font-head text-3xl leading-tight">{hasDocuments || isLoading ? "Your legal work, watched." : "Meet Lex"}</h2>
              <p className="text-sm text-muted-foreground">
                {hasDocuments || isLoading
                  ? "Review. Remember. Warn. Act."
                  : "Give me a contract, legal document, or question. I'll tell you what matters and what you can do next."}
              </p>
            </div>
          </header>
        )}

        <section aria-label="What can I help with?" className="grid gap-2 sm:grid-cols-3">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAction(a.id)}
              className="flex flex-col items-start gap-1.5 rounded-[var(--vq-r-sm)] border border-border bg-card p-3.5 text-left shadow-(--vq-shadow-sm) transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-sm font-medium">{a.icon}{a.title}</span>
              <span className="text-xs text-muted-foreground">{a.hint}</span>
            </button>
          ))}
        </section>

        <section aria-labelledby="legal-watch" className="flex flex-col gap-3 rounded-[var(--vq-r-sm)] border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 id="legal-watch" className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" /> Legal Watch
            </h3>
            {hasDocuments && (
              <Button variant="ghost" size="sm" onClick={onViewAll}>View all</Button>
            )}
          </div>

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Checking your documents…</p>
          ) : !hasDocuments ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Give Lex something to watch.</p>
                <p className="text-xs text-muted-foreground">
                  Upload your legal documents and Lex can review contracts, remember important dates, and flag changes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onAction("lex:upload-source")}>
                  <Upload data-icon="inline-start" /> Upload a contract
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPrompt("Find the contracts in my Google Drive")}>
                  Find documents in Drive
                </Button>
              </div>
            </div>
          ) : attention.length === 0 ? (
            <div>
              <p className="text-sm font-medium">You&apos;re clear.</p>
              <p className="text-xs text-muted-foreground">
                Lex is watching {watch!.monitored} {watch!.monitored === 1 ? "document" : "documents"}. Nothing currently needs your attention.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {watch!.monitored} {watch!.monitored === 1 ? "document" : "documents"} monitored ·{" "}
                <span className="font-medium text-foreground">
                  {attention.length} {attention.length === 1 ? "thing needs" : "things need"} your attention
                </span>
              </p>
              <ul className="flex flex-col">
                {attention.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDocument(item.sourceRowId)}
                      className="flex w-full items-start gap-2.5 rounded-[var(--vq-r-sm)] px-1.5 py-2 text-left hover:bg-muted"
                    >
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.documentName}</span>
                        <span className="block text-xs text-muted-foreground">{item.title}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {(watch?.recentlyReviewed.length ?? 0) > 0 && (
          <section aria-labelledby="recently-reviewed" className="flex flex-col gap-2">
            <Kicker id="recently-reviewed" size="sm" tone="default">Recently reviewed</Kicker>
            <ul className="flex flex-col divide-y divide-border rounded-[var(--vq-r-sm)] border border-border bg-card">
              {watch!.recentlyReviewed.map((d) => (
                <li key={d.sourceRowId}>
                  <button type="button" onClick={() => onOpenDocument(d.sourceRowId)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.seriousCount > 0 ? `${d.seriousCount} ${d.seriousCount === 1 ? "issue" : "issues"} to review` : "No critical issues"}
                        {d.headline ? ` · ${d.headline}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relative(d.reviewedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Ask Lex" className="flex flex-col gap-2">
          {/* The chat dock offers these same prompts, so in the workspace they
              would be the second copy on screen. The disclaimer below is not
              conditional — it has to show wherever Lex's output does. */}
          {!embedded && (
            <>
              <Kicker size="sm" tone="default">Ask Lex</Kicker>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAction("lex:upload-source")}
                  className="rounded-[var(--vq-r-sm)] border border-border bg-card px-3 py-2 text-[13px] shadow-(--vq-shadow-sm) hover:bg-muted"
                >
                  Can I sign this?
                </button>
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPrompt(p)}
                    className="rounded-[var(--vq-r-sm)] border border-border bg-card px-3 py-2 text-[13px] shadow-(--vq-shadow-sm) hover:bg-muted"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Lex provides AI-generated legal information and document analysis. It does not replace advice from a qualified lawyer.
          </p>
        </section>
      </div>
    </div>
  )
}
