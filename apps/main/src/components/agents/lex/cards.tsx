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
  Mail,
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

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

function sevLevel(level: "low" | "medium" | "high" | "critical") {
  return level === "critical" || level === "high" ? "danger" : level === "medium" ? "warn" : "info"
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

// ─── Upload-source card ──────────────────────────────────────────────────────

export function DocumentIngestCard({ result }: { result: LexUploadSourceResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileText />}
        title="Document uploaded"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {result.pageCount} pages · {result.chunksCreated} chunks
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[11px] font-medium">{result.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.typeDetected && (
            <Badge variant="outline" className="text-[10px]">
              type: {result.typeDetected}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="cursor-pointer font-mono text-[10px]"
            onClick={() => copyText(result.sourceId, "Source ID copied")}
          >
            {result.sourceId}
          </Badge>
          <a
            href={result.r2Url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[10px] underline hover:no-underline"
          >
            Open PDF
          </a>
        </div>
        <div className="flex flex-col gap-1.5">
          <Kicker prefix="//">summary</Kicker>
          <p className="text-[11px] leading-relaxed">{result.summary}</p>
        </div>
        {result.keyTopics?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">key topics</Kicker>
            <div className="flex flex-wrap gap-1">
              {result.keyTopics.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
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
            <Badge variant="secondary" className="text-[10px]">
              {result.tokens_used} tokens
            </Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{result.answer}</p>
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
  const a = result.analysis
  const riskLevel = sevLevel(a.risk_level as "low" | "medium" | "high" | "critical")

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

        {onFollowUpAction && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            <Button
              variant="chat-action"
              onClick={() => {
                const highRisks = a.risks
                  ?.filter((r) => r.severity === "high" || r.severity === "critical")
                  .map((r) => `${r.clause}: ${r.risk}`)
                  .slice(0, 3)
                  .join("\n") ?? ""
                onFollowUpAction("vega:compose-email", {
                  subject: `Contract review: ${a.document_type ?? "document"} — ${a.risk_level} risk`,
                  instructions: highRisks
                    ? `Alert team about these contract risks:\n${highRisks}`
                    : a.executive_summary ?? "",
                })
              }}
            >
              <Mail className="size-3" /> Email team about risks · Vega
            </Button>
          </div>
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
        <div className="max-h-96 overflow-y-auto rounded border border-border bg-white dark:bg-card px-5 py-4 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)]">
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
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
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

export function LegalResearchCard({ result }: { result: LexLegalResearchResult }) {
  const hasRefs = (result.references?.length ?? 0) + (result.relevant_cases?.length ?? 0) > 0

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Scale />}
        title="Legal research"
        badge={
          <Badge variant="secondary" className="text-[10px] capitalize">
            {result.confidence_level} confidence
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[11px] leading-relaxed">{result.answer}</p>

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

        {hasRefs && (
          <Collapsible>
            <CollapsibleTrigger className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground hover:text-foreground">
              References & cases
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 list-disc pl-4 text-[11px] leading-relaxed">
                {[...(result.references ?? []), ...(result.relevant_cases ?? [])].map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {result.jurisdiction_notes && (
          <p className="text-[10px] italic text-muted-foreground">{result.jurisdiction_notes}</p>
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
