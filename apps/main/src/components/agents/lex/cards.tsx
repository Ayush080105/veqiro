"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Copy,
  Download,
  FileText,
  FileSearch,
  ShieldAlert,
  BookOpen,
  FilePlus,
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
  LexIngestDocumentResult,
  LexAnalyzeContractResult,
  LexDraftDocumentResult,
  LexExplainResult,
} from "@/lib/types/agents"

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="rounded border border-chart-3/30 bg-chart-3/10 p-2 text-[10px] italic text-chart-3">
      {text}
    </p>
  )
}

function sev(level: "low" | "medium" | "high") {
  return level === "high"
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : level === "medium"
      ? "bg-chart-3/15 text-chart-3 border-chart-3/30"
      : "bg-muted text-muted-foreground border-border"
}

// ─── Ingest card ─────────────────────────────────────────────────────────────

export function DocumentIngestCard({ result }: { result: LexIngestDocumentResult }) {
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <FileText className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Document ingested</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {result.page_count} pages · {result.chunks_created} chunks
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          type: {result.document_type_detected}
        </Badge>
        <Badge
          variant="outline"
          className="text-[10px] font-mono cursor-pointer"
          onClick={() => copy(result.source_id, "Source ID copied")}
        >
          {result.source_id}
        </Badge>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <p className="text-[11px] leading-relaxed">{result.summary}</p>
      </div>
      {result.key_topics.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Key topics
          </p>
          <div className="flex flex-wrap gap-1">
            {result.key_topics.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Contract analysis card ──────────────────────────────────────────────────

export function ContractAnalysisCard({ result }: { result: LexAnalyzeContractResult }) {
  const a = result.analysis
  const riskCls =
    a.risk_level === "high"
      ? "bg-destructive/10 border-destructive/30 text-destructive"
      : a.risk_level === "medium"
        ? "bg-chart-3/10 border-chart-3/30 text-chart-3"
        : "bg-chart-2/10 border-chart-2/30 text-chart-2"

  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <FileSearch className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Contract analysis</p>
      </div>
      <div className={cn("flex items-center gap-2 border p-2", riskCls)}>
        <ShieldAlert className="size-3.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide">Risk level</p>
          <p className="text-xs font-semibold capitalize">{a.risk_level}</p>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed">{a.summary}</p>

      {a.risks.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Risks
          </p>
          <div className="flex flex-col gap-1">
            {a.risks.map((r, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 border border-border bg-muted/20 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-[11px] font-medium">{r.clause}</p>
                  <span
                    className={cn(
                      "border px-1.5 py-0.5 text-[10px] uppercase",
                      sev(r.severity)
                    )}
                  >
                    {r.severity}
                  </span>
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
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Unusual clauses
            </p>
            <ul className="list-disc pl-4 text-[11px] leading-relaxed">
              {a.unusual_clauses.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {a.missing_protections.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Missing protections
            </p>
            <ul className="list-disc pl-4 text-[11px] leading-relaxed">
              {a.missing_protections.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {Object.keys(a.key_terms).length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
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
    </Card>
  )
}

// ─── Draft document card ─────────────────────────────────────────────────────

export function DraftDocumentCard({ result }: { result: LexDraftDocumentResult }) {
  const download = () => {
    const blob = new Blob([result.document], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "lex-draft.txt"
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <FilePlus className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Drafted document</p>
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap border border-border bg-muted/20 p-2 font-mono text-[11px] leading-relaxed">
        {result.document}
      </pre>
      {result.review_notes.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Review notes
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.review_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-1.5">
        <Button variant="outline" size="xs" onClick={() => copy(result.document)}>
          <Copy data-icon="inline-start" /> Copy
        </Button>
        <Button variant="outline" size="xs" onClick={download}>
          <Download data-icon="inline-start" /> Download
        </Button>
      </div>
      <Disclaimer text={result.disclaimer} />
    </Card>
  )
}

// ─── Explainer card ──────────────────────────────────────────────────────────

export function ExplainerCard({ result }: { result: LexExplainResult }) {
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <BookOpen className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Plain-English explanation</p>
      </div>
      <p className="whitespace-pre-wrap text-[11px] leading-relaxed">
        {result.explanation}
      </p>
      {Object.keys(result.key_terms).length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Key terms
          </p>
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
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Practical implications
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.practical_implications.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
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
    </Card>
  )
}
