"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  FileSearch,
  ShieldAlert,
  BookOpen,
  FilePlus,
  Scale,
  ClipboardCheck,
  Mail,
  MessageCircleQuestion,
  PenLine,
  Loader2,
  Stamp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentCard } from "@/components/ui/agent-card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { CopyButton } from "@/components/ui/copy-button"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { exportLexDocument, recordLexActivity } from "@/lib/api/lex"
import { ContractReviewCard, LEX_DISCLAIMER, isVerdictReview } from "./review"
import type {
  LexUploadSourceResult,
  LexAnalyzeContractResult,
  LexQueryDocumentResult,
  LexDraftDocumentResult,
  LexExplainResult,
  LexLegalResearchResult,
  LexComplianceCheckResult,
  LexStampLetterheadResult,
  LexDraftReplyResult,
  AgentActionId,
} from "@/lib/types/agents"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
type ContractAnalysis = LexAnalyzeContractResult["analysis"]

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

function sevLevel(level?: string | null): React.ComponentProps<typeof StatusPill>["level"] {
  const normalized = level?.toLowerCase()
  return normalized === "critical" || normalized === "high" ? "danger" : normalized === "medium" ? "warn" : "info"
}

function actionLevel(action: string): React.ComponentProps<typeof StatusPill>["level"] {
  if (action === "sign") return "ok"
  if (action === "negotiate") return "warn"
  if (action === "reject") return "danger"
  return "info"
}

function actionLabel(action: string) {
  return action.replace(/_/g, " ")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isContractAnalysis(value: unknown): value is ContractAnalysis {
  return isRecord(value) && typeof value.risk_level === "string"
}

function getContractAnalysis(result: unknown): ContractAnalysis | null {
  if (isRecord(result) && isContractAnalysis(result.analysis)) {
    return result.analysis
  }

  if (isContractAnalysis(result)) {
    return result
  }

  return null
}

function InvalidLexResultCard({ title, result }: { title: string; result: unknown }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<ShieldAlert />}
        title={title}
        badge={<StatusPill level="warn">unavailable</StatusPill>}
      />
      <AgentCard.Body className="flex flex-col gap-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          This Lex result could not be rendered because the saved response is missing the expected fields.
        </p>
        <pre className="max-h-48 overflow-auto rounded border border-border bg-muted/20 p-2 text-[10px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Upload-source card ──────────────────────────────────────────────────────

type UploadResult = LexUploadSourceResult & {
  // Messages saved before the DTO fix carried the raw AI payload instead.
  source_id?: string
  page_count?: number
  key_topics?: string[]
  document_type_detected?: string
}

const ASK_PROMPTS = ["What am I missing?", "What should I negotiate?", "What dates do I need to remember?"]

export function DocumentIngestCard({
  result,
  input,
  onFollowUpAction,
}: {
  result: UploadResult
  input?: { documentName?: string; document_name?: string }
  onFollowUpAction?: FollowUp
}) {
  const sourceId = result.sourceId ?? result.source_id
  const name = result.name ?? input?.documentName ?? input?.document_name ?? "Document"
  const pages = result.pageCount ?? result.page_count
  const topics = result.keyTopics ?? result.key_topics ?? []
  const type = result.typeDetected ?? result.document_type_detected

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileText />}
        title={name}
        badge={
          pages ? (
            <Badge variant="secondary" className="text-[10px]">
              {pages} {pages === 1 ? "page" : "pages"}
            </Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {type && (
            <Badge variant="outline" className="text-[10px] capitalize">
              {type.replace(/_/g, " ")}
            </Badge>
          )}
          {result.r2Url && (
            <a href={result.r2Url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[10px] underline hover:no-underline">
              Open PDF <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {result.summary && <p className="text-[12px] leading-relaxed">{result.summary}</p>}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topics.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
        {onFollowUpAction && sourceId && (
          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            <Kicker size="sm" tone="default">Try asking Lex</Kicker>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="chat-action" onClick={() => onFollowUpAction("lex:analyze-contract", { source_id: sourceId })}>
                <FileSearch /> Can I sign this?
              </Button>
              {ASK_PROMPTS.map((p) => (
                <Button key={p} variant="chat-utility" onClick={() => onFollowUpAction("lex:ask-about", { sourceId, prompt: p })}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Query-document card ─────────────────────────────────────────────────────

export function QueryDocumentCard({ result }: { result: LexQueryDocumentResult }) {
  const citations = result.citations ?? []
  const found = result.found ?? true
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<FileSearch />} title="From your document" />
      <AgentCard.Body className="flex flex-col gap-2.5">
        {found && result.short_answer && <p className="font-head text-lg leading-tight">{result.short_answer}</p>}
        <p className={cn("whitespace-pre-wrap text-[12px] leading-relaxed", !found && "text-muted-foreground")}>{result.answer}</p>
        {citations.map((c, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-[var(--vq-r-sm)] border border-border bg-muted/20 p-2.5">
            <blockquote className="font-serif text-[12px] leading-relaxed text-foreground/80">&ldquo;{c.quote}&rdquo;</blockquote>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">Source: {c.section ? `Section ${c.section}` : "document"}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] underline"
                onClick={() => copyText(`${c.section ? `Section ${c.section}: ` : ""}"${c.quote}"`, "Citation copied")}
              >
                <Copy className="size-3" /> Copy citation
              </button>
            </div>
          </div>
        ))}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Contract analysis card ──────────────────────────────────────────────────

export function ContractAnalysisCard({
  result,
  input,
  onFollowUpAction,
}: {
  result: LexAnalyzeContractResult & { source?: { sourceRowId: string | null; sourceName: string; sourceId: string } | null }
  input?: { sourceRowId?: string | null; sourceName?: string; sourceId?: string | null }
  onFollowUpAction?: FollowUp
}) {
  const a = getContractAnalysis(result)

  if (!a) {
    return <InvalidLexResultCard title="Contract analysis unavailable" result={result} />
  }

  if (isVerdictReview(a)) {
    const source = {
      sourceRowId: input?.sourceRowId ?? result.source?.sourceRowId ?? null,
      sourceName: input?.sourceName ?? result.source?.sourceName,
      sourceId: input?.sourceId ?? result.source?.sourceId ?? null,
    }
    return <ContractReviewCard review={a} input={source} onFollowUpAction={onFollowUpAction} />
  }

  const riskLevel = sevLevel(a.risk_level)

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileSearch />}
        title="Contract analysis"
        badge={
          a.recommended_action ? (
            <StatusPill level={actionLevel(a.recommended_action)} className="capitalize">
              {actionLabel(a.recommended_action)}
            </StatusPill>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">

        {/* Document metadata */}
        {(a.document_type || a.parties?.length > 0) && (
          <div className="flex flex-col gap-1.5 rounded border border-border bg-muted/20 p-2">
            {a.document_type && (
              <p className="text-[11px] font-semibold">{a.document_type}</p>
            )}
            {a.parties?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {a.parties.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
              {a.effective_date && <span>Effective: {a.effective_date}</span>}
              {a.governing_law && <span>Law: {a.governing_law}</span>}
              {a.jurisdiction && <span>Jurisdiction: {a.jurisdiction}</span>}
            </div>
          </div>
        )}

        {/* Risk overview */}
        <div className="flex flex-col gap-1.5 rounded border border-border bg-muted/20 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <Kicker prefix="//">risk level</Kicker>
              <p className="text-xs font-medium capitalize">{a.risk_level}</p>
            </div>
            <div className="flex items-center gap-2">
              {typeof a.risk_score === "number" && (
                <Badge variant="outline" className="text-[10px]">
                  score {a.risk_score}/10
                </Badge>
              )}
              <StatusPill level={riskLevel}>{a.risk_level}</StatusPill>
            </div>
          </div>
          {a.score_breakdown && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border pt-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">breakdown</span>
              {a.score_breakdown.critical > 0 && (
                <span className="text-[10px]">
                  <span className="font-semibold text-destructive">{a.score_breakdown.critical}</span>
                  <span className="text-muted-foreground"> critical</span>
                </span>
              )}
              {a.score_breakdown.high > 0 && (
                <span className="text-[10px]">
                  <span className="font-semibold">{a.score_breakdown.high}</span>
                  <span className="text-muted-foreground"> high</span>
                </span>
              )}
              {a.score_breakdown.medium > 0 && (
                <span className="text-[10px]">
                  <span className="font-semibold">{a.score_breakdown.medium}</span>
                  <span className="text-muted-foreground"> medium</span>
                </span>
              )}
              {a.score_breakdown.low > 0 && (
                <span className="text-[10px]">
                  <span className="font-semibold">{a.score_breakdown.low}</span>
                  <span className="text-muted-foreground"> low</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Executive summary */}
        {a.executive_summary && (
          <p className="text-[11px] leading-relaxed">{a.executive_summary}</p>
        )}

        {/* Risks */}
        {a.risks?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">risks ({a.risks.length})</Kicker>
            <div className="flex flex-col gap-1.5">
              {a.risks.map((r, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 border border-border bg-muted/20 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-[11px] font-semibold">{r.clause}</p>
                    <StatusPill level={sevLevel(r.severity)}>{r.severity}</StatusPill>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{r.risk}</p>
                  {r.recommendation && (
                    <p className="border-t border-border pt-1.5 text-[11px] leading-relaxed">
                      <span className="font-medium">Fix: </span>
                      {r.recommendation}
                    </p>
                  )}
                  {(r.confidence || r.basis) && (
                    <div className="flex flex-col gap-0.5 border-t border-border pt-1.5">
                      {r.confidence && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">confidence</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{r.confidence}</Badge>
                        </div>
                      )}
                      {r.basis && (
                        <p className="text-[10px] italic leading-relaxed text-muted-foreground">{r.basis}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Negotiation points */}
        {a.negotiation_points?.length > 0 && (
          <CollapsibleSection
            title={`negotiation points (${a.negotiation_points.length})`}
            defaultOpen
          >
            <div className="flex flex-col gap-1.5">
              {a.negotiation_points.map((n, i) => (
                <div key={i} className="flex flex-col gap-1 border border-border bg-muted/20 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-[11px] font-semibold">{n.clause}</p>
                    <StatusPill level={sevLevel(n.priority as "low" | "medium" | "high")}>{n.priority}</StatusPill>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{n.issue}</p>
                  {n.suggested_change && (
                    <p className="border-t border-border pt-1.5 font-mono text-[10px] leading-relaxed text-foreground">
                      {n.suggested_change}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Unusual clauses + missing protections */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {a.unusual_clauses?.length > 0 && (
            <InfoSection label="unusual clauses" bullets={a.unusual_clauses} />
          )}
          {a.missing_protections?.length > 0 && (
            <InfoSection label="missing protections" bullets={a.missing_protections} tone="danger" />
          )}
        </div>

        {/* Clause breakdown */}
        {a.clause_breakdown?.length > 0 && (
          <CollapsibleSection title={`clause breakdown (${a.clause_breakdown.length} sections)`}>
            <div className="flex flex-col gap-1">
              {a.clause_breakdown.map((c, i) => (
                <div key={i} className="border border-border bg-muted/20 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold">
                      {c.section && <span className="mr-1 text-muted-foreground">§{c.section}</span>}
                      {c.title}
                    </p>
                    <StatusPill level={sevLevel(c.risk_level as "low" | "medium" | "high" | "critical")}>
                      {c.risk_level}
                    </StatusPill>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{c.summary}</p>
                  {c.notes && c.notes !== "Standard — no issues" && (
                    <p className="mt-1 border-t border-border pt-1 text-[11px] leading-relaxed">
                      {c.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Obligations */}
        {(a.obligations_structured?.length || (a.obligations && Object.keys(a.obligations).length > 0)) && (
          <CollapsibleSection title="obligations by party">
            <div className="flex flex-col gap-2">
              {a.obligations_structured?.length
                ? a.obligations_structured.map((party) => (
                    <div key={party.party} className="flex flex-col gap-1.5">
                      <Kicker prefix="//">{party.party}</Kicker>
                      <div className="flex flex-col gap-1">
                        {party.items.map((item, i) => (
                          <div key={i} className="flex flex-col gap-0.5 border border-border bg-muted/20 p-2">
                            <p className="text-[11px] font-medium">{item.action}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {item.deadline && (
                                <span className="text-[10px] text-muted-foreground">
                                  <span className="font-medium">By:</span> {item.deadline}
                                </span>
                              )}
                              {item.condition && (
                                <span className="text-[10px] text-muted-foreground">
                                  <span className="font-medium">If:</span> {item.condition}
                                </span>
                              )}
                              {item.consequence && (
                                <span className="text-[10px] text-muted-foreground">
                                  <span className="font-medium">Consequence:</span> {item.consequence}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                : Object.entries(a.obligations).map(([party, items]) => (
                    <div key={party} className="flex flex-col gap-1">
                      <Kicker prefix="//">{party}</Kicker>
                      <ul className="list-disc pl-4 text-[11px] leading-relaxed">
                        {items.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  ))
              }
            </div>
          </CollapsibleSection>
        )}

        {/* Ambiguous clauses */}
        {a.ambiguous_clauses && a.ambiguous_clauses.length > 0 && (
          <CollapsibleSection
            title={`ambiguous language (${a.ambiguous_clauses.length})`}
            badge={
              <Badge variant="outline" className="text-[10px]">may cause disputes</Badge>
            }
          >
            <div className="flex flex-col gap-1.5">
              {a.ambiguous_clauses.map((ac, i) => (
                <div key={i} className="flex flex-col gap-1 border border-border bg-muted/20 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 font-mono text-[11px] font-semibold">&ldquo;{ac.clause}&rdquo;</p>
                    {ac.section && (
                      <span className="font-mono text-[10px] text-muted-foreground">§{ac.section}</span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{ac.issue}</p>
                  <p className="border-t border-border pt-1.5 text-[10px] italic leading-relaxed">
                    <span className="font-medium not-italic">Courts: </span>
                    {ac.interpretation}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Key terms */}
        {Object.keys(a.key_terms ?? {}).length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground hover:text-foreground">
              Show key terms ({Object.keys(a.key_terms).length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 border border-border">
                {Object.entries(a.key_terms).map(([term, def]) => (
                  <div
                    key={term}
                    className="grid grid-cols-3 gap-2 border-b border-border px-2 py-1 text-[11px] last:border-0"
                  >
                    <span className="font-medium">{term}</span>
                    <span className="col-span-2 text-muted-foreground">{def}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Overall assessment */}
        {a.overall_assessment && (
          <p className="text-[11px] leading-relaxed">
            <strong>Overall:</strong> {a.overall_assessment}
          </p>
        )}

      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Draft document card ─────────────────────────────────────────────────────

export function DraftDocumentCard({ result }: { result: LexDraftDocumentResult }) {
  const [downloading, setDownloading] = React.useState<"docx" | "pdf" | null>(null)
  const [withLetterhead, setWithLetterhead] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(result.document)

  const docTitle =
    result.document_type ||
    (result.document.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "Legal Document")

  const handleExport = async (format: "docx" | "pdf") => {
    setDownloading(format)
    try {
      const data = await exportLexDocument({
        document: text,
        format,
        documentType: docTitle,
        includeLetterhead: withLetterhead,
      })
      const binary = atob(data.file_b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: data.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = data.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Export failed. Please try again.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FilePlus />}
        title={docTitle}
        badge={result.jurisdiction ? <Badge variant="outline" className="text-[10px]">{result.jurisdiction}</Badge> : undefined}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        {editing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            aria-label="Edit document"
            className="w-full rounded border border-border bg-white px-4 py-3 text-sm leading-relaxed dark:bg-card"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
          />
        ) : (
          <div className="max-h-96 overflow-y-auto rounded border border-border bg-white dark:bg-card px-5 py-4 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)]">
            <div
              className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
              style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
            >
              {text}
            </div>
          </div>
        )}
        {result.review_notes.length > 0 && (
          <InfoSection label="before you use it" bullets={result.review_notes} />
        )}
        <p className="text-[10px] leading-relaxed text-muted-foreground">{LEX_DISCLAIMER}</p>
      </AgentCard.Body>
      <AgentCard.Footer>
        <Button variant="chat-utility" onClick={() => setEditing((v) => !v)}>
          <PenLine data-icon="inline-start" />
          {editing ? "Done editing" : "Edit"}
        </Button>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={withLetterhead}
            onChange={(e) => setWithLetterhead(e.target.checked)}
            className="h-3 w-3"
          />
          Include letterhead
        </label>
        <CopyButton text={text} />
        <Button variant="chat-utility" onClick={() => handleExport("docx")} disabled={downloading !== null}>
          {downloading === "docx" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          DOCX
        </Button>
        <Button variant="chat-utility" onClick={() => handleExport("pdf")} disabled={downloading !== null}>
          {downloading === "pdf" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          PDF
        </Button>
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Explainer card ──────────────────────────────────────────────────────────

export function ExplainerCard({ result }: { result: LexExplainResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<BookOpen />} title="Plain-English explanation" />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {result.explanation}
        </p>
        {Object.keys(result.key_terms).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">key terms</Kicker>
            <div className="border border-border">
              {Object.entries(result.key_terms).map(([term, def]) => (
                <div
                  key={term}
                  className="grid grid-cols-3 gap-2 border-b border-border px-2 py-1 text-[11px] last:border-0"
                >
                  <span className="font-medium">{term}</span>
                  <span className="col-span-2 text-muted-foreground">{def}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {result.practical_implications.length > 0 && (
          <InfoSection
            label="practical implications"
            bullets={result.practical_implications}
          />
        )}
        {result.related_concepts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.related_concepts.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px]">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Legal research card ─────────────────────────────────────────────────────

const SOURCE_KIND_LABEL: Record<string, string> = {
  statute: "Statute",
  case_law: "Case law",
  government_guidance: "Government",
  commentary: "Commentary",
}

export function LegalResearchCard({ result }: { result: LexLegalResearchResult }) {
  const sources = result.sources ?? []
  const legacyRefs = [...(result.references ?? []), ...(result.relevant_cases ?? [])]

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Scale />}
        title="Legal research"
        badge={
          result.jurisdiction ? (
            <Badge variant="outline" className="text-[10px]">{result.jurisdiction}</Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className={cn("whitespace-pre-wrap text-[12px] leading-relaxed", result.failed && "text-muted-foreground")}>{result.answer}</p>

        {result.sections?.map((section, i) => {
          if (!section.items?.length) return null
          if (section.type === "ordered") {
            return <InfoSection key={i} label={section.title} ordered={section.items} />
          }
          if (section.type === "narrative") {
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <Kicker prefix="//">{section.title}</Kicker>
                <p className="text-[11px] leading-relaxed">{section.items[0]}</p>
              </div>
            )
          }
          return <InfoSection key={i} label={section.title} bullets={section.items} />
        })}

        {(result.references?.length ?? 0) > 0 && sources.length > 0 && (
          <InfoSection label="laws that apply" bullets={result.references} />
        )}

        {sources.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker size="sm" tone="default">Sources</Kicker>
            <ol className="flex flex-col gap-1.5">
              {sources.map((src, i) => (
                <li key={src.url} className="flex items-start gap-2 text-[11.5px]">
                  <span className="mt-px font-mono text-[10px] text-muted-foreground">[{i + 1}]</span>
                  <span className="min-w-0 flex-1">
                    <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-2 hover:decoration-foreground">
                      {src.title || src.url}
                    </a>
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      {SOURCE_KIND_LABEL[src.kind ?? "commentary"]}
                      {src.date ? ` · ${src.date}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {sources.length === 0 && legacyRefs.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground hover:text-foreground">
              References & cases
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 list-disc pl-4 text-[11px] leading-relaxed">
                {legacyRefs.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {result.jurisdiction_notes && (
          <p className="text-[10px] italic text-muted-foreground">{result.jurisdiction_notes}</p>
        )}
        <p className="text-[10px] leading-relaxed text-muted-foreground">{LEX_DISCLAIMER}</p>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Compliance check card ───────────────────────────────────────────────────

export function ComplianceCheckCard({
  result,
  onFollowUpAction,
}: {
  result: LexComplianceCheckResult
  onFollowUpAction?: FollowUp
}) {
  const status = result.overall_status.toLowerCase()
  const statusLevel: React.ComponentProps<typeof StatusPill>["level"] =
    status.includes("non") || status.includes("fail")
      ? "danger"
      : status.includes("partial") || status.includes("gap")
        ? "warn"
        : "ok"

  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<ClipboardCheck />} title="Compliance check" />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded border border-border bg-muted/20 p-2">
          <div className="min-w-0 flex-1">
            <Kicker prefix="//">overall status</Kicker>
            <p className="text-xs font-semibold">{result.overall_status}</p>
          </div>
          <StatusPill level={statusLevel}>{result.overall_status}</StatusPill>
          <Badge variant="outline" className="text-[10px]">
            {result.estimated_effort}
          </Badge>
        </div>

        {result.framework_results.length > 0 && (
          <div className="flex flex-col gap-1">
            {result.framework_results.map((f, i) => (
              <CollapsibleSection
                key={i}
                title={f.framework}
                badge={
                  <Badge variant="outline" className="text-[10px]">
                    {f.status}
                  </Badge>
                }
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {f.gaps.length > 0 && (
                    <InfoSection label="gaps" bullets={f.gaps} tone="danger" />
                  )}
                  {f.requirements.length > 0 && (
                    <InfoSection label="requirements" bullets={f.requirements} />
                  )}
                </div>
              </CollapsibleSection>
            ))}
          </div>
        )}

        {result.critical_gaps.length > 0 && (
          <div className="border border-destructive/30 bg-destructive/10 p-2">
            <div className="mb-1 flex items-center gap-1">
              <ShieldAlert className="size-3 text-destructive" />
              <Kicker prefix="//" className={cn("text-destructive")}>
                critical gaps
              </Kicker>
            </div>
            <ul className="list-disc pl-4 text-[11px] leading-relaxed">
              {result.critical_gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {result.remediation_steps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">remediation steps</Kicker>
            <div className="flex flex-col gap-1">
              {result.remediation_steps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 border border-border bg-muted/20 p-2"
                >
                  <StatusPill level={sevLevel(s.priority)}>{s.priority}</StatusPill>
                  <p className="flex-1 text-[11px] leading-relaxed">{s.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            <Button
              variant="chat-action"
              onClick={() => {
                const topFramework = result.framework_results[0]?.framework ?? "compliance"
                onFollowUpAction("maya:draft-content", {
                  topic: `Our commitment to ${topFramework} compliance`,
                  platform: "linkedin",
                  additional_context: result.critical_gaps?.slice(0, 3).join("; ") ?? "",
                })
              }}
            >
              <PenLine className="size-3" /> Draft awareness post · Maya
            </Button>
          </div>
        )}

      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Stamp letterhead card ───────────────────────────────────────────────────

export function StampLetterheadCard({ result }: { result: LexStampLetterheadResult }) {
  const handleDownload = () => {
    const binary = atob(result.file_b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: result.mime_type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Stamp />} title="Letterhead applied" />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[11px] text-muted-foreground">
          Your letterhead has been stamped on every page of{" "}
          <span className="font-medium text-foreground">{result.filename}</span>.
        </p>
      </AgentCard.Body>
      <AgentCard.Footer>
        <Button variant="chat-utility" onClick={handleDownload}>
          <Download data-icon="inline-start" />
          Download
        </Button>
      </AgentCard.Footer>
    </AgentCard>
  )
}


// ─── Draft reply (negotiation email) card ────────────────────────────────────

export function DraftReplyCard({ result }: { result: LexDraftReplyResult }) {
  const [downloading, setDownloading] = React.useState(false)
  const fullEmail = `Subject: ${result.subject}\n\n${result.email}`

  const downloadChanges = async () => {
    setDownloading(true)
    try {
      const data = await exportLexDocument({ document: result.changes_document, format: "docx", documentType: "Proposed changes" })
      const binary = atob(data.file_b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mime_type }))
      const a = document.createElement("a")
      a.href = url
      a.download = data.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Export failed. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Mail />}
        title={result.counterparty ? `Reply to ${result.counterparty}` : "Negotiation email"}
        badge={<Badge variant="secondary" className="text-[10px]">{result.changes.length} {result.changes.length === 1 ? "change" : "changes"}</Badge>}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-[var(--vq-r-sm)] border border-border bg-white p-3 dark:bg-card">
          <p className="text-[12px] font-semibold">{result.subject}</p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed">{result.email}</p>
        </div>
        {result.changes.length > 0 && (
          <CollapsibleSection title={`proposed wording (${result.changes.length})`}>
            <div className="flex flex-col gap-2">
              {result.changes.map((c, i) => (
                <div key={i} className="flex flex-col gap-1 border-b border-border/60 pb-2 text-[11.5px] last:border-b-0">
                  <span className="font-medium">{c.section ? `Clause ${c.section}` : "New clause"}</span>
                  <span className="text-muted-foreground line-through">{c.current}</span>
                  <span>{c.proposed}</span>
                  {c.reason && <span className="text-[10.5px] text-muted-foreground">{c.reason}</span>}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
        <p className="text-[10px] leading-relaxed text-muted-foreground">{LEX_DISCLAIMER}</p>
      </AgentCard.Body>
      <AgentCard.Footer>
        <Button
          variant="chat-action"
          onClick={() => {
            copyText(fullEmail, "Email copied")
            void recordLexActivity({ action: "copied_reply", detail: result.subject })
          }}
        >
          <Copy /> Copy email
        </Button>
        <Button variant="chat-utility" onClick={downloadChanges} disabled={downloading}>
          {downloading ? <Loader2 className="animate-spin" /> : <Download />} Changes as DOCX
        </Button>
        <Button variant="chat-utility" asChild>
          <a href={`mailto:?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(result.email)}`}>
            <MessageCircleQuestion /> Open in email
          </a>
        </Button>
      </AgentCard.Footer>
    </AgentCard>
  )
}
