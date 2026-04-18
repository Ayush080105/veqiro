"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  FormRow,
  CountedTextarea,
  StringListInput,
  fileToBase64,
} from "@/components/chat/ActionForm/fields"
import type {
  LexIngestDocumentRequest,
  LexAnalyzeContractRequest,
  LexDraftDocumentRequest,
  LexExplainRequest,
} from "@/lib/types/agents"

const DOC_TYPES = ["contract", "agreement", "policy", "nda", "tos", "other"]

export function LexIngestDocumentForm({
  value,
  onChange,
}: {
  value: LexIngestDocumentRequest
  onChange: (patch: Partial<LexIngestDocumentRequest>) => void
}) {
  const [filename, setFilename] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)

  const pick = async (file: File) => {
    setLoading(true)
    try {
      const b64 = await fileToBase64(file)
      setFilename(file.name)
      onChange({
        pdf_base64: b64,
        document_name: value.document_name || file.name.replace(/\.pdf$/i, ""),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <FormRow label="Document" required hint="PDF only — max ~20 MB.">
        <label className="flex cursor-pointer items-center gap-2 border border-dashed border-border bg-muted/30 p-3 text-xs hover:bg-muted">
          <Upload className="size-3.5 text-muted-foreground" />
          <span className="flex-1 truncate">
            {loading
              ? "Reading file…"
              : filename || value.pdf_base64
                ? filename || "PDF ready"
                : "Click to choose a PDF"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pick(f)
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

export function LexAnalyzeContractForm({
  value,
  onChange,
}: {
  value: LexAnalyzeContractRequest
  onChange: (patch: Partial<LexAnalyzeContractRequest>) => void
}) {
  return (
    <>
      <FormRow label="Source ID" hint="Optional — from a prior Ingest Document result.">
        <Input
          value={value.source_id ?? ""}
          placeholder="e.g. src_abc123"
          onChange={(e) => onChange({ source_id: e.target.value })}
        />
      </FormRow>
      <FormRow label="Contract text" required>
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
