"use client"

import * as React from "react"
import { Upload, Loader2 } from "lucide-react"
import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { CountedTextarea, StringListInput } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import { useLexSources } from "@/lib/api/lex"
import {
  lexUploadSourceSchema,
  type LexUploadSourceValues,
  lexAnalyzeContractSchema,
  type LexAnalyzeContractValues,
  lexQueryDocumentSchema,
  type LexQueryDocumentValues,
  lexDraftDocumentSchema,
  type LexDraftDocumentValues,
  lexExplainSchema,
  type LexExplainValues,
  lexLegalResearchSchema,
  type LexLegalResearchValues,
  lexComplianceCheckSchema,
  type LexComplianceCheckValues,
} from "@/lib/schemas/agents/lex"

const DOC_TYPES = ["contract", "agreement", "policy", "nda", "tos", "other"]

// ─── Upload source ──────────────────────────────────────────────────────────

export function LexUploadSourceForm({
  value,
  onChange,
}: {
  value: LexUploadSourceValues
  onChange: (patch: Partial<LexUploadSourceValues>) => void
}) {
  const form = useAgentForm({
    schema: lexUploadSourceSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="file"
        label="Document"
        required
        description="PDF only — max 25 MB."
      >
        {({ field }) => {
          const file = field.value as File | null
          return (
            <label className="flex cursor-pointer items-center gap-2 border border-dashed border-border bg-muted/30 p-3 text-xs hover:bg-muted">
              <Upload className="size-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">
                {file?.name || "Click to choose a PDF"}
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  field.onChange(f)
                  if (!form.getValues("document_name")) {
                    form.setValue(
                      "document_name",
                      f.name.replace(/\.pdf$/i, ""),
                      { shouldValidate: true }
                    )
                  }
                }}
              />
            </label>
          )
        }}
      </RhfField>

      <RhfField
        control={form.control}
        name="document_name"
        label="Document name"
        required
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. Acme MSA 2026"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="document_type"
        label="Document type"
      >
        {({ field }) => (
          <div className="flex flex-wrap gap-1.5">
            {DOC_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                variant={
                  (field.value ?? "contract") === t ? "default" : "outline"
                }
                size="sm"
                onClick={() => field.onChange(t)}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Source picker (shared) ─────────────────────────────────────────────────

function SourcePicker({
  value,
  onChange,
  required,
}: {
  value: string
  onChange: (sourceId: string) => void
  required?: boolean
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
  )
}

// ─── Analyze contract ───────────────────────────────────────────────────────

export function LexAnalyzeContractForm({
  value,
  onChange,
}: {
  value: LexAnalyzeContractValues
  onChange: (patch: Partial<LexAnalyzeContractValues>) => void
}) {
  const form = useAgentForm({
    schema: lexAnalyzeContractSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="source_id"
        label="Document"
        description="Pick from your uploaded documents."
      >
        {({ field }) => (
          <SourcePicker value={field.value ?? ""} onChange={field.onChange} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="contract_text"
        label="Or paste contract text"
        description="Use this if the contract isn't uploaded yet."
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={8}
            onChange={field.onChange}
            placeholder="Paste the contract text here…"
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="analysis_focus"
        label="Analysis focus"
        description="Areas Lex should pay extra attention to."
      >
        {({ field }) => (
          <StringListInput
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="e.g. liability cap, IP assignment"
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Query document ─────────────────────────────────────────────────────────

export function LexQueryDocumentForm({
  value,
  onChange,
}: {
  value: LexQueryDocumentValues
  onChange: (patch: Partial<LexQueryDocumentValues>) => void
}) {
  const form = useAgentForm({
    schema: lexQueryDocumentSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="sourceId"
        label="Document"
        required
      >
        {({ field }) => (
          <SourcePicker required value={field.value} onChange={field.onChange} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="query"
        label="Question"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={4}
            onChange={field.onChange}
            placeholder="e.g. What are the termination conditions and notice periods?"
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="topK"
        label="Top results"
        description="Number of source chunks to retrieve."
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={20}
            value={field.value ?? 5}
            onChange={(e) =>
              field.onChange(
                Math.max(1, Math.min(20, Number(e.target.value) || 5))
              )
            }
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Draft document ─────────────────────────────────────────────────────────

export function LexDraftDocumentForm({
  value,
  onChange,
}: {
  value: LexDraftDocumentValues
  onChange: (patch: Partial<LexDraftDocumentValues>) => void
}) {
  const form = useAgentForm({
    schema: lexDraftDocumentSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="document_type"
        label="Document type"
        required
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. mutual NDA"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="requirements"
        label="Requirements"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={5}
            onChange={field.onChange}
            placeholder="What must this document cover?"
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="jurisdiction"
        label="Jurisdiction"
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="e.g. Delaware, USA"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="additional_clauses"
        label="Additional clauses"
      >
        {({ field }) => (
          <StringListInput
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="e.g. non-solicit, arbitration"
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Explain ────────────────────────────────────────────────────────────────

export function LexExplainForm({
  value,
  onChange,
}: {
  value: LexExplainValues
  onChange: (patch: Partial<LexExplainValues>) => void
}) {
  const form = useAgentForm({
    schema: lexExplainSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="text"
        label="Legal text"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={6}
            onChange={field.onChange}
            placeholder="Paste the clause or passage you want explained."
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="context"
        label="Context"
        description="Optional background so the explanation fits your situation."
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value ?? ""}
            rows={3}
            onChange={field.onChange}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Legal research ─────────────────────────────────────────────────────────

export function LexLegalResearchForm({
  value,
  onChange,
}: {
  value: LexLegalResearchValues
  onChange: (patch: Partial<LexLegalResearchValues>) => void
}) {
  const form = useAgentForm({
    schema: lexLegalResearchSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="query"
        label="Question"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={4}
            onChange={field.onChange}
            placeholder="e.g. What are the GDPR requirements for valid consent?"
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="jurisdiction"
        label="Jurisdiction"
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="e.g. EU, United States, California"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="legal_areas"
        label="Legal areas"
        description="Optional tags to focus the research."
      >
        {({ field }) => (
          <StringListInput
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="e.g. data_privacy, consent"
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Compliance check ───────────────────────────────────────────────────────

export function LexComplianceCheckForm({
  value,
  onChange,
}: {
  value: LexComplianceCheckValues
  onChange: (patch: Partial<LexComplianceCheckValues>) => void
}) {
  const form = useAgentForm({
    schema: lexComplianceCheckSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="description"
        label="What are you checking?"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={5}
            onChange={field.onChange}
            placeholder="e.g. We store EU user emails on US servers with no consent flow."
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="frameworks"
        label="Frameworks"
        required
        description="e.g. GDPR, CCPA, SOC2, HIPAA"
      >
        {({ field }) => (
          <StringListInput
            value={field.value}
            onChange={field.onChange}
            placeholder="Add a framework and press Enter"
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="business_context"
        label="Business context"
        description="Optional — helps Lex calibrate recommendations."
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value ?? ""}
            rows={3}
            onChange={field.onChange}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// silence ts unused — Controller is exported via barrel sometimes
void Controller
