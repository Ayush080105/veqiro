"use client"

import * as React from "react"
import { Upload, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  FormRow,
  CountedTextarea,
  StringListInput,
} from "@/components/chat/ActionForm/fields"
import { useLexSources } from "@/lib/api/lex"
import type {
  LexUploadSourceRequest,
  LexAnalyzeContractRequest,
  LexQueryDocumentRequest,
  LexDraftDocumentRequest,
  LexExplainRequest,
  LexLegalResearchRequest,
  LexComplianceCheckRequest,
} from "@/lib/types/agents"

const DOC_TYPES = ["contract", "agreement", "policy", "nda", "tos", "other"]

export function LexUploadSourceForm({
  value,
  onChange,
}: {
  value: LexUploadSourceRequest
  onChange: (patch: Partial<LexUploadSourceRequest>) => void
}) {
  const filename = value.file?.name ?? ""

  return (
    <>
      <FormRow label="Document" required hint="PDF only — max 25 MB.">
        <label className="flex cursor-pointer items-center gap-2 border border-dashed border-border bg-muted/30 p-3 text-xs hover:bg-muted">
          <Upload className="size-3.5 text-muted-foreground" />
          <span className="flex-1 truncate">
            {filename || "Click to choose a PDF"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              onChange({
                file: f,
                document_name:
                  value.document_name || f.name.replace(/\.pdf$/i, ""),
              })
            }}
          />
        </label>
      </FormRow>
      <FormRow label="Document name" required>
        <Input
          value={value.document_name}
          placeholder="e.g. Acme MSA 2026"
          onChange={(e) => onChange({ document_name: e.target.value })}
        />
      </FormRow>
      <FormRow label="Document type">
        <div className="flex flex-wrap gap-1.5">
          {DOC_TYPES.map((t) => (
            <Button
              key={t}
              type="button"
              variant={
                (value.document_type ?? "contract") === t ? "default" : "outline"
              }
              size="sm"
              onClick={() => onChange({ document_type: t })}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </FormRow>
    </>
  )
}

function SourcePicker({
  value,
  onChange,
  required,
  hint,
}: {
  value: string
  onChange: (sourceId: string) => void
  required?: boolean
  hint?: string
}) {
  const { data: sources, isLoading, error } = useLexSources()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border border-border bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading documents…
      </div>
    )
  }
  if (error) {
    return (
      <div className="border border-destructive/30 bg-destructive/10 px-2 py-2 text-[11px] text-destructive">
        Failed to load documents.
      </div>
    )
  }
  if (!sources || sources.length === 0) {
    return (
      <div className="border border-border bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
        No documents yet — upload one first.
      </div>
    )
  }
  return (
    <>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-background px-2 py-1.5 text-xs"
      >
        <option value="">Select a document…</option>
        {sources.map((s) => (
          <option key={s.id} value={s.sourceId}>
            {s.name} · {s.pageCount}p
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </>
  )
}

export function LexAnalyzeContractForm({
  value,
  onChange,
}: {
  value: LexAnalyzeContractRequest
  onChange: (patch: Partial<LexAnalyzeContractRequest>) => void
}) {
  return (
    <>
      <FormRow label="Document" hint="Pick from your uploaded documents.">
        <SourcePicker
          value={value.source_id ?? ""}
          onChange={(sourceId) => onChange({ source_id: sourceId })}
        />
      </FormRow>
      <FormRow
        label="Or paste contract text"
        hint="Use this if the contract isn't uploaded yet."
      >
        <CountedTextarea
          value={value.contract_text}
          rows={8}
          onChange={(v) => onChange({ contract_text: v })}
          placeholder="Paste the contract text here…"
        />
      </FormRow>
      <FormRow label="Analysis focus" hint="Areas Lex should pay extra attention to.">
        <StringListInput
          value={value.analysis_focus ?? []}
          onChange={(next) => onChange({ analysis_focus: next })}
          placeholder="e.g. liability cap, IP assignment"
        />
      </FormRow>
    </>
  )
}

export function LexQueryDocumentForm({
  value,
  onChange,
}: {
  value: LexQueryDocumentRequest
  onChange: (patch: Partial<LexQueryDocumentRequest>) => void
}) {
  return (
    <>
      <FormRow label="Document" required>
        <SourcePicker
          required
          value={value.sourceId}
          onChange={(sourceId) => onChange({ sourceId })}
        />
      </FormRow>
      <FormRow label="Question" required>
        <CountedTextarea
          value={value.query}
          rows={4}
          onChange={(v) => onChange({ query: v })}
          placeholder="e.g. What are the termination conditions and notice periods?"
        />
      </FormRow>
      <FormRow label="Top results" hint="Number of source chunks to retrieve.">
        <Input
          type="number"
          min={1}
          max={20}
          value={value.topK ?? 5}
          onChange={(e) =>
            onChange({ topK: Math.max(1, Math.min(20, Number(e.target.value) || 5)) })
          }
        />
      </FormRow>
    </>
  )
}

export function LexDraftDocumentForm({
  value,
  onChange,
}: {
  value: LexDraftDocumentRequest
  onChange: (patch: Partial<LexDraftDocumentRequest>) => void
}) {
  return (
    <>
      <FormRow label="Document type" required>
        <Input
          value={value.document_type}
          placeholder="e.g. mutual NDA"
          onChange={(e) => onChange({ document_type: e.target.value })}
        />
      </FormRow>
      <FormRow label="Requirements" required>
        <CountedTextarea
          value={value.requirements}
          rows={5}
          onChange={(v) => onChange({ requirements: v })}
          placeholder="What must this document cover?"
        />
      </FormRow>
      <FormRow label="Jurisdiction">
        <Input
          value={value.jurisdiction ?? ""}
          placeholder="e.g. Delaware, USA"
          onChange={(e) => onChange({ jurisdiction: e.target.value })}
        />
      </FormRow>
      <FormRow label="Additional clauses">
        <StringListInput
          value={value.additional_clauses ?? []}
          onChange={(next) => onChange({ additional_clauses: next })}
          placeholder="e.g. non-solicit, arbitration"
        />
      </FormRow>
    </>
  )
}

export function LexExplainForm({
  value,
  onChange,
}: {
  value: LexExplainRequest
  onChange: (patch: Partial<LexExplainRequest>) => void
}) {
  return (
    <>
      <FormRow label="Legal text" required>
        <CountedTextarea
          value={value.text}
          rows={6}
          onChange={(v) => onChange({ text: v })}
          placeholder="Paste the clause or passage you want explained."
        />
      </FormRow>
      <FormRow label="Context" hint="Optional background so the explanation fits your situation.">
        <CountedTextarea
          value={value.context ?? ""}
          rows={3}
          onChange={(v) => onChange({ context: v })}
        />
      </FormRow>
    </>
  )
}

export function LexLegalResearchForm({
  value,
  onChange,
}: {
  value: LexLegalResearchRequest
  onChange: (patch: Partial<LexLegalResearchRequest>) => void
}) {
  return (
    <>
      <FormRow label="Question" required>
        <CountedTextarea
          value={value.query}
          rows={4}
          onChange={(v) => onChange({ query: v })}
          placeholder="e.g. What are the GDPR requirements for valid consent?"
        />
      </FormRow>
      <FormRow label="Jurisdiction">
        <Input
          value={value.jurisdiction ?? ""}
          placeholder="e.g. EU, United States, California"
          onChange={(e) => onChange({ jurisdiction: e.target.value })}
        />
      </FormRow>
      <FormRow label="Legal areas" hint="Optional tags to focus the research.">
        <StringListInput
          value={value.legal_areas ?? []}
          onChange={(next) => onChange({ legal_areas: next })}
          placeholder="e.g. data_privacy, consent"
        />
      </FormRow>
    </>
  )
}

export function LexComplianceCheckForm({
  value,
  onChange,
}: {
  value: LexComplianceCheckRequest
  onChange: (patch: Partial<LexComplianceCheckRequest>) => void
}) {
  return (
    <>
      <FormRow label="What are you checking?" required>
        <CountedTextarea
          value={value.description}
          rows={5}
          onChange={(v) => onChange({ description: v })}
          placeholder="e.g. We store EU user emails on US servers with no consent flow."
        />
      </FormRow>
      <FormRow label="Frameworks" required hint="e.g. GDPR, CCPA, SOC2, HIPAA">
        <StringListInput
          value={value.frameworks}
          onChange={(next) => onChange({ frameworks: next })}
          placeholder="Add a framework and press Enter"
        />
      </FormRow>
      <FormRow label="Business context" hint="Optional — helps Lex calibrate recommendations.">
        <CountedTextarea
          value={value.business_context ?? ""}
          rows={3}
          onChange={(v) => onChange({ business_context: v })}
        />
      </FormRow>
    </>
  )
}

