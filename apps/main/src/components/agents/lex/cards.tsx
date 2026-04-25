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
import type {
  LexUploadSourceResult,
  LexAnalyzeContractResult,
  LexQueryDocumentResult,
  LexDraftDocumentResult,
  LexExplainResult,
  LexLegalResearchResult,
  LexComplianceCheckResult,
} from "@/lib/types/agents"

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="rounded border border-chart-3/30 bg-chart-3/10 p-2 text-[10px] italic text-chart-3">
      {text}
    </p>
  )
}

function sevLevel(level: "low" | "medium" | "high") {
  return level === "high" ? "danger" : level === "medium" ? "warn" : "info"
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
        {result.keyTopics.length > 0 && (
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
        {result.sources.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
              Show {result.sources.length} source chunk
              {result.sources.length === 1 ? "" : "s"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 flex flex-col gap-1">
                {result.sources.map((s, i) => (
                  <div
                    key={i}
                    className="border border-border bg-muted/20 p-2 text-[11px] leading-relaxed"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        chunk {i + 1}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        relevance {s.score.toFixed(2)}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap">{s.content}</p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Contract analysis card ──────────────────────────────────────────────────

export function ContractAnalysisCard({ result }: { result: LexAnalyzeContractResult }) {
  const a = result.analysis
  const riskLevel =
    a.risk_level === "high" ? "danger" : a.risk_level === "medium" ? "warn" : "ok"

  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<FileSearch />} title="Contract analysis" />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 rounded border border-border bg-muted/20 p-2">
          <div className="flex flex-col">
            <Kicker prefix="//">risk level</Kicker>
            <p className="text-xs font-semibold capitalize">{a.risk_level}</p>
          </div>
          <StatusPill level={riskLevel}>{a.risk_level}</StatusPill>
        </div>
        <p className="text-[11px] leading-relaxed">{a.summary}</p>

        {a.risks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">risks</Kicker>
            <div className="flex flex-col gap-1">
              {a.risks.map((r, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 border border-border bg-muted/20 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-[11px] font-medium">{r.clause}</p>
                    <StatusPill level={sevLevel(r.severity)}>{r.severity}</StatusPill>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {r.risk}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {a.unusual_clauses.length > 0 && (
            <InfoSection label="unusual clauses" bullets={a.unusual_clauses} />
          )}
          {a.missing_protections.length > 0 && (
            <InfoSection
              label="missing protections"
              bullets={a.missing_protections}
              tone="danger"
            />
          )}
        </div>

        {Object.keys(a.key_terms).length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
              Show key terms
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

        <p className="text-[11px] leading-relaxed">
          <strong>Overall:</strong> {a.overall_assessment}
        </p>
        <Disclaimer text={result.disclaimer} />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Draft document card ─────────────────────────────────────────────────────

export function DraftDocumentCard({ result }: { result: LexDraftDocumentResult }) {
  const download = () => {
    const blob = new Blob([result.document], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "lex-draft.md"
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<FilePlus />} title="Drafted document" />
      <AgentCard.Body className="flex flex-col gap-3">
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap border border-border bg-muted/20 p-2 font-mono text-[11px] leading-relaxed">
          {result.document}
        </pre>
        {result.review_notes.length > 0 && (
          <InfoSection label="review notes" bullets={result.review_notes} />
        )}
        <Disclaimer text={result.disclaimer} />
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton text={result.document} />
        <Button variant="outline" size="xs" onClick={download}>
          <Download data-icon="inline-start" /> Download
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
        <p className="whitespace-pre-wrap text-[11px] leading-relaxed">
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
        <p className="text-[11px] leading-relaxed">{result.summary}</p>

        {result.applicable_laws.length > 0 && (
          <InfoSection label="applicable laws" bullets={result.applicable_laws} />
        )}
        {result.key_requirements.length > 0 && (
          <InfoSection label="key requirements" bullets={result.key_requirements} />
        )}
        {result.practical_guidance.length > 0 && (
          <InfoSection label="practical guidance" bullets={result.practical_guidance} />
        )}

        {result.relevant_cases.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
              Show relevant cases ({result.relevant_cases.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 list-disc pl-4 text-[11px] leading-relaxed">
                {result.relevant_cases.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {result.jurisdiction_notes && (
          <p className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] italic">
            Jurisdiction: {result.jurisdiction_notes}
          </p>
        )}
        <Disclaimer text={result.disclaimer} />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Compliance check card ───────────────────────────────────────────────────

export function ComplianceCheckCard({ result }: { result: LexComplianceCheckResult }) {
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

        <Disclaimer text={result.disclaimer} />
      </AgentCard.Body>
    </AgentCard>
  )
}
