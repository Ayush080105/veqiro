"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Download,
  FileText,
  FileSearch,
  ShieldAlert,
  BookOpen,
  FilePlus,
  Scale,
  ClipboardCheck,
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
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { exportLexDocument } from "@/lib/api/lex"
import type {
  LexUploadSourceResult,
  LexAnalyzeContractResult,
  LexQueryDocumentResult,
  LexDraftDocumentResult,
  LexExplainResult,
  LexLegalResearchResult,
  LexComplianceCheckResult,
  LexStampLetterheadResult,
  AgentActionId,
} from "@/lib/types/agents"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
type ContractAnalysis = LexAnalyzeContractResult["analysis"]

const lexSurfaceCls =
  "rounded-[var(--vq-r-sm)] border border-border/60 bg-background/65 p-3"
const lexLabelCls = "text-xs font-semibold text-foreground"
const lexBodyCls = "text-sm leading-relaxed text-foreground"

function LexSurface({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(lexSurfaceCls, className)}>{children}</div>
}

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
        <p className="text-sm leading-relaxed text-muted-foreground">
          This Lex result could not be rendered because the saved response is missing the expected fields.
        </p>
        <pre className="max-h-48 overflow-auto rounded-[var(--vq-r-sm)] border border-border/60 bg-background/65 p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Upload-source card ──────────────────────────────────────────────────────

export function DocumentIngestCard({ result }: { result: LexUploadSourceResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileText />}
        title="Document uploaded"
        badge={
          <Badge variant="secondary" className="text-xs">
            {result.pageCount} pages · {result.chunksCreated} chunks
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-sm font-medium">{result.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.typeDetected && (
            <Badge variant="outline" className="text-xs">
              type: {result.typeDetected}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="cursor-pointer text-xs"
            onClick={() => copyText(result.sourceId, "Source ID copied")}
          >
            {result.sourceId}
          </Badge>
          <a
            href={result.r2Url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
          >
            Open PDF
          </a>
        </div>
        <LexSurface className="space-y-1.5">
          <p className={lexLabelCls}>Summary</p>
          <p className={lexBodyCls}>{result.summary}</p>
        </LexSurface>
        {result.keyTopics?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className={lexLabelCls}>Key topics</p>
            <div className="flex flex-wrap gap-1">
              {result.keyTopics.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
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
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileSearch />}
        title="Document answer"
        badge={
          typeof result.tokens_used === "number" ? (
            <Badge variant="secondary" className="text-xs">
              {result.tokens_used} tokens
            </Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</p>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Contract analysis card ──────────────────────────────────────────────────

export function ContractAnalysisCard({
  result,
  onFollowUpAction,
}: {
  result: LexAnalyzeContractResult
  onFollowUpAction?: FollowUp
}) {
  const a = getContractAnalysis(result)

  if (!a) {
    return <InvalidLexResultCard title="Contract analysis unavailable" result={result} />
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
          <LexSurface className="space-y-2 p-2.5">
            {a.document_type && (
              <p className="text-sm font-semibold">{a.document_type}</p>
            )}
            {a.parties?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {a.parties.map((p) => (
                  <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {a.effective_date && <span>Effective: {a.effective_date}</span>}
              {a.governing_law && <span>Law: {a.governing_law}</span>}
              {a.jurisdiction && <span>Jurisdiction: {a.jurisdiction}</span>}
            </div>
          </LexSurface>
        )}

        {/* Risk overview */}
        <LexSurface className="space-y-2 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <p className={lexLabelCls}>Risk level</p>
              <p className="text-sm font-medium capitalize">{a.risk_level}</p>
            </div>
            <div className="flex items-center gap-2">
              {typeof a.risk_score === "number" && (
                <Badge variant="outline" className="text-xs">
                  score {a.risk_score}/10
                </Badge>
              )}
              <StatusPill level={riskLevel}>{a.risk_level}</StatusPill>
            </div>
          </div>
          {a.score_breakdown && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border pt-1.5">
              <span className={lexLabelCls}>Breakdown</span>
              {a.score_breakdown.critical > 0 && (
                <span className="text-xs">
                  <span className="font-semibold text-destructive">{a.score_breakdown.critical}</span>
                  <span className="text-muted-foreground"> critical</span>
                </span>
              )}
              {a.score_breakdown.high > 0 && (
                <span className="text-xs">
                  <span className="font-semibold">{a.score_breakdown.high}</span>
                  <span className="text-muted-foreground"> high</span>
                </span>
              )}
              {a.score_breakdown.medium > 0 && (
                <span className="text-xs">
                  <span className="font-semibold">{a.score_breakdown.medium}</span>
                  <span className="text-muted-foreground"> medium</span>
                </span>
              )}
              {a.score_breakdown.low > 0 && (
                <span className="text-xs">
                  <span className="font-semibold">{a.score_breakdown.low}</span>
                  <span className="text-muted-foreground"> low</span>
                </span>
              )}
            </div>
          )}
        </LexSurface>

        {/* Executive summary */}
        {a.executive_summary && (
          <p className={lexBodyCls}>{a.executive_summary}</p>
        )}

        {/* Risks */}
        {a.risks?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className={lexLabelCls}>Risks ({a.risks.length})</p>
            <div className="flex flex-col gap-1.5">
              {a.risks.map((r, i) => (
                <LexSurface
                  key={i}
                  className="flex flex-col gap-1.5 p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-sm font-semibold">{r.clause}</p>
                    <StatusPill level={sevLevel(r.severity)}>{r.severity}</StatusPill>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{r.risk}</p>
                  {r.recommendation && (
                    <p className="border-t border-border/60 pt-1.5 text-sm leading-relaxed">
                      <span className="font-medium">Fix: </span>
                      {r.recommendation}
                    </p>
                  )}
                  {(r.confidence || r.basis) && (
                    <div className="flex flex-col gap-0.5 border-t border-border pt-1.5">
                      {r.confidence && (
                        <div className="flex items-center gap-1.5">
                          <span className={lexLabelCls}>Confidence</span>
                          <Badge variant="outline" className="text-xs capitalize">{r.confidence}</Badge>
                        </div>
                      )}
                      {r.basis && (
                        <p className="text-xs italic leading-relaxed text-muted-foreground">{r.basis}</p>
                      )}
                    </div>
                  )}
                </LexSurface>
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
                <LexSurface key={i} className="flex flex-col gap-1 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-sm font-semibold">{n.clause}</p>
                    <StatusPill level={sevLevel(n.priority as "low" | "medium" | "high")}>{n.priority}</StatusPill>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{n.issue}</p>
                  {n.suggested_change && (
                    <p className="border-t border-border/60 pt-1.5 text-sm leading-relaxed text-foreground">
                      {n.suggested_change}
                    </p>
                  )}
                </LexSurface>
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
                <LexSurface key={i} className="p-2.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {c.section && <span className="mr-1 text-muted-foreground">§{c.section}</span>}
                      {c.title}
                    </p>
                    <StatusPill level={sevLevel(c.risk_level as "low" | "medium" | "high" | "critical")}>
                      {c.risk_level}
                    </StatusPill>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{c.summary}</p>
                  {c.notes && c.notes !== "Standard — no issues" && (
                    <p className="mt-1 border-t border-border/60 pt-1 text-sm leading-relaxed">
                      {c.notes}
                    </p>
                  )}
                </LexSurface>
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
                      <p className={lexLabelCls}>{party.party}</p>
                      <div className="flex flex-col gap-1">
                        {party.items.map((item, i) => (
                          <LexSurface key={i} className="flex flex-col gap-1 p-2.5">
                            <p className="text-sm font-medium">{item.action}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {item.deadline && (
                                <span className="text-xs text-muted-foreground">
                                  <span className="font-medium">By:</span> {item.deadline}
                                </span>
                              )}
                              {item.condition && (
                                <span className="text-xs text-muted-foreground">
                                  <span className="font-medium">If:</span> {item.condition}
                                </span>
                              )}
                              {item.consequence && (
                                <span className="text-xs text-muted-foreground">
                                  <span className="font-medium">Consequence:</span> {item.consequence}
                                </span>
                              )}
                            </div>
                          </LexSurface>
                        ))}
                      </div>
                    </div>
                  ))
                : Object.entries(a.obligations).map(([party, items]) => (
                    <div key={party} className="flex flex-col gap-1">
                      <p className={lexLabelCls}>{party}</p>
                      <ul className="list-disc pl-4 text-sm leading-relaxed">
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
              <Badge variant="outline" className="text-xs">may cause disputes</Badge>
            }
          >
            <div className="flex flex-col gap-1.5">
              {a.ambiguous_clauses.map((ac, i) => (
                <LexSurface key={i} className="flex flex-col gap-1 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-sm font-semibold">&ldquo;{ac.clause}&rdquo;</p>
                    {ac.section && (
                      <span className="text-xs text-muted-foreground">§{ac.section}</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ac.issue}</p>
                  <p className="border-t border-border/60 pt-1.5 text-xs italic leading-relaxed">
                    <span className="font-medium not-italic">Courts: </span>
                    {ac.interpretation}
                  </p>
                </LexSurface>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Key terms */}
        {Object.keys(a.key_terms ?? {}).length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs font-semibold text-foreground hover:text-foreground">
              Show key terms ({Object.keys(a.key_terms).length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 overflow-hidden rounded-[var(--vq-r-sm)] border border-border/60">
                {Object.entries(a.key_terms).map(([term, def]) => (
                  <div
                    key={term}
                    className="grid grid-cols-3 gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-0"
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
          <p className={lexBodyCls}>
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

  const docTitle =
    result.document
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? "Legal Document"

  const handleExport = async (format: "docx" | "pdf") => {
    setDownloading(format)
    try {
      const data = await exportLexDocument({
        document: result.document,
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
      <AgentCard.Header icon={<FilePlus />} title="Drafted document" />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="max-h-96 overflow-y-auto rounded-[var(--vq-r-sm)] border border-border/60 bg-background/65 px-5 py-4">
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
          >
            {result.document}
          </div>
        </div>
        {result.review_notes.length > 0 && (
          <InfoSection label="review notes" bullets={result.review_notes} />
        )}
      </AgentCard.Body>
      <AgentCard.Footer>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={withLetterhead}
            onChange={(e) => setWithLetterhead(e.target.checked)}
            className="h-3 w-3"
          />
          Include letterhead
        </label>
        <CopyButton text={result.document} />
        <Button
          variant="chat-utility"
          onClick={() => handleExport("docx")}
          disabled={downloading !== null}
        >
          {downloading === "docx" ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          DOCX
        </Button>
        <Button
          variant="chat-utility"
          onClick={() => handleExport("pdf")}
          disabled={downloading !== null}
        >
          {downloading === "pdf" ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
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
            <p className={lexLabelCls}>Key terms</p>
            <div className="overflow-hidden rounded-[var(--vq-r-sm)] border border-border/60">
              {Object.entries(result.key_terms).map(([term, def]) => (
                <div
                  key={term}
                  className="grid grid-cols-3 gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-0"
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
              <Badge key={c} variant="outline" className="text-xs">
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

export function LegalResearchCard({ result }: { result: LexLegalResearchResult }) {
  const hasRefs = (result.references?.length ?? 0) + (result.relevant_cases?.length ?? 0) > 0

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Scale />}
        title="Legal research"
        badge={
          <Badge variant="secondary" className="text-xs capitalize">
            {result.confidence_level} confidence
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className={lexBodyCls}>{result.answer}</p>

        {result.sections?.map((section, i) => {
          if (!section.items?.length) return null
          if (section.type === "ordered") {
            return <InfoSection key={i} label={section.title} ordered={section.items} />
          }
          if (section.type === "narrative") {
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <p className={lexLabelCls}>{section.title}</p>
                <p className={lexBodyCls}>{section.items[0]}</p>
              </div>
            )
          }
          return <InfoSection key={i} label={section.title} bullets={section.items} />
        })}

        {hasRefs && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs font-semibold text-foreground hover:text-foreground">
              References & cases
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 list-disc pl-4 text-sm leading-relaxed">
                {[...(result.references ?? []), ...(result.relevant_cases ?? [])].map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {result.jurisdiction_notes && (
          <p className="text-xs italic text-muted-foreground">{result.jurisdiction_notes}</p>
        )}
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
        <LexSurface className="flex items-center gap-2 p-2.5">
          <div className="min-w-0 flex-1">
            <p className={lexLabelCls}>Overall status</p>
            <p className="text-sm font-semibold">{result.overall_status}</p>
          </div>
          <StatusPill level={statusLevel}>{result.overall_status}</StatusPill>
          <Badge variant="outline" className="text-xs">
            {result.estimated_effort}
          </Badge>
        </LexSurface>

        {result.framework_results.length > 0 && (
          <div className="flex flex-col gap-1">
            {result.framework_results.map((f, i) => (
              <CollapsibleSection
                key={i}
                title={f.framework}
                badge={
                  <Badge variant="outline" className="text-xs">
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
          <div className="rounded-[var(--vq-r-sm)] border border-destructive/30 bg-destructive/10 p-3">
            <div className="mb-1 flex items-center gap-1">
              <ShieldAlert className="size-3 text-destructive" />
              <p className={cn(lexLabelCls, "text-destructive")}>Critical gaps</p>
            </div>
            <ul className="list-disc pl-4 text-sm leading-relaxed">
              {result.critical_gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {result.remediation_steps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className={lexLabelCls}>Remediation steps</p>
            <div className="flex flex-col gap-1">
              {result.remediation_steps.map((s, i) => (
                <LexSurface
                  key={i}
                  className="flex items-start gap-2 p-2.5"
                >
                  <StatusPill level={sevLevel(s.priority)}>{s.priority}</StatusPill>
                  <p className="flex-1 text-sm leading-relaxed">{s.action}</p>
                </LexSurface>
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
        <p className="text-xs text-muted-foreground">
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
