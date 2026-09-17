"use client"

import * as React from "react"
import { Upload, Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { FieldGroup } from "@/components/ui/field"
import { CountedTextarea, StringListInput } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import { useLexSources, useLexVersionCandidates } from "@/lib/api/lex"
import type { ActionStage } from "@/components/chat/ActionDialog"
import type { LexAnalyzeContractResult, LexFinding } from "@/lib/types/agents"
import {
  LEX_DRAFT_TYPES,
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
  type LexStampLetterheadValues,
  type LexDraftReplyValues,
} from "@/lib/schemas/agents/lex"
import { SeverityTag } from "./review"

const UPLOAD_TYPES = [
  { value: "contract", label: "Contract" },
  { value: "nda", label: "NDA" },
  { value: "vendor_agreement", label: "Vendor agreement" },
  { value: "employment_agreement", label: "Employment" },
  { value: "legal_notice", label: "Legal notice" },
  { value: "policy", label: "Policy" },
  { value: "other", label: "Other" },
]

// ─── Progress while a review runs ────────────────────────────────────────────

/** Shown in the dialog while a long Lex call runs, so ~90 seconds never reads as a hang. */
export function LexProgress({ submitting, stage }: { submitting?: boolean; stage?: ActionStage | null }) {
  if (!submitting) return null
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-[var(--vq-r-sm)] border border-border bg-muted/40 px-3 py-2.5 text-xs">
      <Loader2 className="size-3.5 shrink-0 animate-spin" />
      <span>{stage?.label ?? "Working…"}</span>
    </div>
  )
}

// ─── Upload source ──────────────────────────────────────────────────────────

export function LexUploadSourceForm({
  value,
  onChange,
  submitting,
  stage,
}: {
  value: LexUploadSourceValues
  onChange: (patch: Partial<LexUploadSourceValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
}) {
  const form = useAgentForm({
    schema: lexUploadSourceSchema,
    defaultValue: value,
    onChange,
  })
  const { data: candidates = [] } = useLexVersionCandidates(value.document_name ?? "")

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
                    form.setValue("document_name", f.name.replace(/\.pdf$/i, ""), { shouldValidate: true })
                  }
                }}
              />
            </label>
          )
        }}
      </RhfField>

      <RhfField control={form.control} name="document_name" label="Document name" required>
        {({ field, invalid, id }) => (
          <Input {...field} id={id} placeholder="e.g. Acme MSA 2026" aria-invalid={invalid} />
        )}
      </RhfField>

      {candidates.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[var(--vq-r-sm)] border border-border bg-muted/30 p-2.5">
          <span className="text-xs font-medium">Is this a new version of an earlier document?</span>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={value.previous_version_id === c.id ? "default" : "outline"}
                onClick={() => onChange({ previous_version_id: c.id })}
              >
                {c.name}
                {c.version > 1 ? ` · v${c.version}` : ""}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={!value.previous_version_id ? "default" : "outline"}
              onClick={() => onChange({ previous_version_id: "" })}
            >
              No, it&apos;s new
            </Button>
          </div>
          {value.previous_version_id && (
            <span className="text-[11px] text-muted-foreground">Lex will compare the two and show what changed.</span>
          )}
        </div>
      )}

      <RhfField control={form.control} name="document_type" label="Document type">
        {({ field }) => (
          <div className="flex flex-wrap gap-1.5">
            {UPLOAD_TYPES.map((t) => (
              <Button
                key={t.value}
                type="button"
                variant={(field.value ?? "contract") === t.value ? "default" : "outline"}
                size="sm"
                onClick={() => field.onChange(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </RhfField>

      <label className="flex items-center justify-between gap-3 rounded-[var(--vq-r-sm)] border border-border px-3 py-2.5">
        <span className="flex flex-col">
          <span className="text-xs font-medium">Review it now</span>
          <span className="text-[11px] text-muted-foreground">Get the verdict, top issues and key dates (about a minute).</span>
        </span>
        <Switch checked={value.review_now ?? true} onCheckedChange={(v: boolean) => onChange({ review_now: v })} />
      </label>

      {(value.review_now ?? true) && (
        <RhfField
          control={form.control}
          name="perspective"
          label="Which side are you on?"
          description="Optional — Lex works it out from your company name and the document."
        >
          {({ field, id }) => (
            <Input {...field} id={id} value={field.value ?? ""} placeholder="e.g. the service provider, the vendor, the employee" />
          )}
        </RhfField>
      )}

      <LexProgress submitting={submitting} stage={stage} />
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
          {s.name} · {s.pageCount}p{s.latestReview ? ` · ${s.latestReview.headline}` : ""}
        </option>
      ))}
    </select>
  )
}

// ─── Analyze contract ───────────────────────────────────────────────────────

export function LexAnalyzeContractForm({
  value,
  onChange,
  submitting,
  stage,
}: {
  value: LexAnalyzeContractValues
  onChange: (patch: Partial<LexAnalyzeContractValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
}) {
  const form = useAgentForm({
    schema: lexAnalyzeContractSchema,
    defaultValue: value,
    onChange,
  })
  const [pasteOpen, setPasteOpen] = React.useState(Boolean(value.contract_text))

  return (
    <FieldGroup>
      <RhfField control={form.control} name="source_id" label="Document" description="Pick from your uploaded documents.">
        {({ field }) => <SourcePicker value={field.value ?? ""} onChange={field.onChange} />}
      </RhfField>

      <RhfField
        control={form.control}
        name="perspective"
        label="Which side are you on?"
        description="Optional — Lex works it out from your company name and the document."
      >
        {({ field, id }) => (
          <Input {...field} id={id} value={field.value ?? ""} placeholder="e.g. the service provider, the vendor, the employee" />
        )}
      </RhfField>

      <RhfField control={form.control} name="analysis_focus" label="Anything to look at closely?" description="Optional.">
        {({ field }) => (
          <StringListInput value={field.value ?? []} onChange={field.onChange} placeholder="e.g. liability cap, IP ownership" />
        )}
      </RhfField>

      {pasteOpen ? (
        <RhfField control={form.control} name="contract_text" label="Or paste contract text">
          {({ field }) => (
            <CountedTextarea value={field.value ?? ""} rows={8} onChange={field.onChange} placeholder="Paste the contract text here…" />
          )}
        </RhfField>
      ) : (
        <button type="button" className="self-start text-[11px] underline" onClick={() => setPasteOpen(true)}>
          Paste contract text instead
        </button>
      )}

      <LexProgress submitting={submitting} stage={stage} />
    </FieldGroup>
  )
}

// ─── Query document ─────────────────────────────────────────────────────────

const QUESTION_PROMPTS = [
  "Can I sign this?",
  "What am I missing?",
  "What should I negotiate?",
  "What dates do I need to remember?",
  "Is this different from our usual terms?",
]

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
      <RhfField control={form.control} name="source_id" label="Document" required>
        {({ field }) => <SourcePicker required value={field.value} onChange={field.onChange} />}
      </RhfField>

      <RhfField control={form.control} name="query" label="Question" required>
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={3}
            onChange={field.onChange}
            placeholder="e.g. What is the termination notice period?"
          />
        )}
      </RhfField>

      <div className="flex flex-wrap gap-1.5">
        {QUESTION_PROMPTS.map((q) => (
          <Button key={q} type="button" size="sm" variant="outline" onClick={() => form.setValue("query", q, { shouldValidate: true })}>
            {q}
          </Button>
        ))}
      </div>
    </FieldGroup>
  )
}

// ─── Draft document ─────────────────────────────────────────────────────────

const DRAFT_QUESTIONS: Record<string, { purpose: string; commercial: string; protect: string }> = {
  NDA: { purpose: "e.g. Evaluating a manufacturing partnership", commercial: "Not usually needed", protect: "e.g. Designs, supplier pricing, customer lists" },
  "Service Agreement": { purpose: "e.g. Monthly social media management", commercial: "e.g. ₹60,000 per month, invoiced monthly, Net 15", protect: "e.g. Deliverable quality, IP in the work, termination" },
  "Vendor Agreement": { purpose: "e.g. Supply of cotton fabric", commercial: "e.g. Price per metre, delivery in 21 days, Net 30", protect: "e.g. Quality rejection rights, late-delivery penalties" },
  "Employment Agreement": { purpose: "e.g. Senior designer, full-time, Bengaluru", commercial: "e.g. ₹12 LPA, 3-month probation, 30-day notice", protect: "e.g. Confidentiality, IP created at work" },
  "Consultancy Agreement": { purpose: "e.g. Brand strategy engagement", commercial: "e.g. ₹2,00,000 fixed fee, 50% upfront", protect: "e.g. IP ownership, non-solicitation" },
  "Legal Notice": { purpose: "e.g. Recovering ₹3,40,000 in unpaid invoices", commercial: "e.g. Amount due, invoice numbers, due dates", protect: "e.g. Deadline to pay, next steps if unpaid" },
  "Privacy Policy": { purpose: "e.g. D2C clothing store collecting names, phones and addresses", commercial: "Not usually needed", protect: "e.g. Consent, data sharing with couriers, grievance officer" },
  "Website Terms": { purpose: "e.g. Online store selling apparel across India", commercial: "e.g. Returns within 7 days, COD available", protect: "e.g. Limitation of liability, returns, IP in content" },
}

export function LexDraftDocumentForm({
  value,
  onChange,
  submitting,
  stage,
}: {
  value: LexDraftDocumentValues
  onChange: (patch: Partial<LexDraftDocumentValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
}) {
  const form = useAgentForm({
    schema: lexDraftDocumentSchema,
    defaultValue: value,
    onChange,
  })
  const hints = DRAFT_QUESTIONS[value.document_type] ?? {
    purpose: "What is this document for?",
    commercial: "Money, payment timing, notice periods",
    protect: "What matters most to you",
  }

  return (
    <FieldGroup>
      <RhfField control={form.control} name="document_type" label="What do you need?" required>
        {({ field }) => (
          <div className="flex flex-wrap gap-1.5">
            {LEX_DRAFT_TYPES.map((t) => (
              <Button key={t} type="button" size="sm" variant={field.value === t ? "default" : "outline"} onClick={() => field.onChange(t)}>
                {t}
              </Button>
            ))}
          </div>
        )}
      </RhfField>

      {value.document_type === "Other" && (
        <RhfField control={form.control} name="other_type" label="Document type" required>
          {({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} placeholder="e.g. Shareholders' agreement" />}
        </RhfField>
      )}

      {value.document_type && (
        <>
          <RhfField control={form.control} name="parties" label="Parties" description="Who is it between?">
            {({ field, id }) => (
              <Input {...field} id={id} value={field.value ?? ""} placeholder="e.g. Klyvora Clothing Pvt Ltd and Sri Balaji Textiles, Tiruppur" />
            )}
          </RhfField>
          <RhfField control={form.control} name="purpose" label="Purpose">
            {({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} placeholder={hints.purpose} />}
          </RhfField>
          <RhfField control={form.control} name="duration" label="Duration">
            {({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} placeholder="e.g. 2 years from signing" />}
          </RhfField>
          <RhfField control={form.control} name="commercial_terms" label="Commercial terms">
            {({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} placeholder={hints.commercial} />}
          </RhfField>
          <RhfField control={form.control} name="protect" label="What should it protect?">
            {({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} placeholder={hints.protect} />}
          </RhfField>
          <RhfField control={form.control} name="requirements" label="Anything else?" description="Optional.">
            {({ field }) => <CountedTextarea value={field.value ?? ""} rows={2} onChange={field.onChange} />}
          </RhfField>
          <RhfField control={form.control} name="jurisdiction" label="Jurisdiction" description="Leave empty to use your company's location (India by default).">
            {({ field, invalid, id }) => (
              <Input {...field} id={id} value={field.value ?? ""} placeholder="India" aria-invalid={invalid} />
            )}
          </RhfField>
        </>
      )}

      <LexProgress submitting={submitting} stage={stage} />
    </FieldGroup>
  )
}

/** Turns the guided answers into the single requirements brief the drafting endpoint takes. */
export function composeDraftRequirements(v: LexDraftDocumentValues): string {
  const lines = [
    v.parties && `Parties: ${v.parties}`,
    v.purpose && `Purpose: ${v.purpose}`,
    v.duration && `Duration: ${v.duration}`,
    v.commercial_terms && `Commercial terms: ${v.commercial_terms}`,
    v.protect && `It must protect: ${v.protect}`,
    v.requirements && `Also: ${v.requirements}`,
  ].filter(Boolean)
  return lines.join("\n") || "Use sensible standard terms and mark details to fill in."
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
      <RhfField control={form.control} name="text" label="Legal text" required>
        {({ field }) => (
          <CountedTextarea value={field.value} rows={6} onChange={field.onChange} placeholder="Paste the clause or passage you want explained." />
        )}
      </RhfField>

      <RhfField control={form.control} name="context" label="Context" description="Optional background so the explanation fits your situation.">
        {({ field }) => <CountedTextarea value={field.value ?? ""} rows={3} onChange={field.onChange} />}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Legal research ─────────────────────────────────────────────────────────

export function LexLegalResearchForm({
  value,
  onChange,
  submitting,
  stage,
}: {
  value: LexLegalResearchValues
  onChange: (patch: Partial<LexLegalResearchValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
}) {
  const form = useAgentForm({
    schema: lexLegalResearchSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="query" label="Question" required>
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={4}
            onChange={field.onChange}
            placeholder="e.g. How do I convert an LLP into a private limited company?"
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="jurisdiction" label="Jurisdiction" description="Leave empty to use your company's location (India by default).">
        {({ field, invalid, id }) => (
          <Input {...field} id={id} value={field.value ?? ""} placeholder="e.g. Maharashtra, India" aria-invalid={invalid} />
        )}
      </RhfField>

      <LexProgress submitting={submitting} stage={stage} />
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
      <RhfField control={form.control} name="description" label="What are you doing?" required>
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={5}
            onChange={field.onChange}
            placeholder="e.g. We're launching an online clothing store in India and collect names, phone numbers and addresses at checkout."
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="business_context" label="About the business" description="Optional — industry, where customers are, what data you handle.">
        {({ field }) => <CountedTextarea value={field.value ?? ""} rows={2} onChange={field.onChange} />}
      </RhfField>

      <RhfField control={form.control} name="frameworks" label="Specific laws to check" description="Optional — leave empty and Lex works out which laws apply.">
        {({ field }) => (
          <StringListInput value={field.value ?? []} onChange={field.onChange} placeholder="e.g. DPDP Act, GST" />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Stamp letterhead ───────────────────────────────────────────────────────

export function LexStampLetterheadForm({
  value,
  onChange,
}: {
  value: LexStampLetterheadValues
  onChange: (patch: Partial<LexStampLetterheadValues>) => void
}) {
  const { data: sources, isLoading, error } = useLexSources()

  return (
    <FieldGroup>
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Document <span className="text-destructive">*</span>
        </span>
        <p className="text-[11px] text-muted-foreground">
          Your letterhead will be stamped on every page of the selected document.
        </p>
        {isLoading ? (
          <div className="flex items-center gap-2 border border-border bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Loading documents…
          </div>
        ) : error ? (
          <div className="border border-destructive/30 bg-destructive/10 px-2 py-2 text-[11px] text-destructive">
            Failed to load documents.
          </div>
        ) : !sources?.length ? (
          <div className="border border-border bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
            No documents yet — upload one first.
          </div>
        ) : (
          <select
            value={value.source_id ?? ""}
            onChange={(e) => {
              const src = sources.find((s) => s.sourceId === e.target.value)
              if (!src) return
              onChange({ source_id: src.sourceId, source_url: src.r2Url, source_name: src.name })
            }}
            className="w-full border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">Select a document…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.sourceId}>
                {s.name} · {s.pageCount}p
              </option>
            ))}
          </select>
        )}
      </div>
    </FieldGroup>
  )
}

// ─── Draft reply (negotiation email) ─────────────────────────────────────────

const TONES = ["firm but friendly", "formal", "collaborative"]

export function LexDraftReplyForm({
  value,
  onChange,
  submitting,
  stage,
}: {
  value: LexDraftReplyValues
  onChange: (patch: Partial<LexDraftReplyValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
}) {
  const analysis = value.analysis as LexAnalyzeContractResult["analysis"] | undefined
  const issues: LexFinding[] = (analysis?.issues ?? []).filter((i) => i.send_back)
  const all = analysis?.issues ?? []
  const selected = new Set(value.selected ?? all.map((_, i) => i).filter((i) => all[i].send_back && (all[i].severity === "critical" || all[i].severity === "high")))

  if (!analysis || issues.length === 0) {
    return <p className="text-xs text-muted-foreground">This review has no suggested changes to send. Run a review first.</p>
  }

  return (
    <FieldGroup>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Changes to request{analysis.counterparty ? ` from ${analysis.counterparty}` : ""}</span>
        {all.map((issue, i) =>
          issue.send_back ? (
            <label key={i} className="flex cursor-pointer items-start gap-2.5 rounded-[var(--vq-r-sm)] border border-border p-2.5 hover:bg-muted/40">
              <Checkbox
                checked={selected.has(i)}
                onCheckedChange={(v) => {
                  const next = new Set(selected)
                  if (v) next.add(i)
                  else next.delete(i)
                  onChange({ selected: [...next].sort((a, b) => a - b) })
                }}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                  {issue.title}
                  <SeverityTag severity={issue.severity} />
                </span>
                <span className="text-[11px] text-muted-foreground">{issue.send_back}</span>
              </span>
            </label>
          ) : null,
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Your name</span>
        <Input value={value.sender ?? ""} onChange={(e) => onChange({ sender: e.target.value })} placeholder="Signs off the email" />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Tone</span>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <Button key={t} type="button" size="sm" variant={(value.tone ?? TONES[0]) === t ? "default" : "outline"} onClick={() => onChange({ tone: t })} className="capitalize">
              {t}
            </Button>
          ))}
        </div>
      </div>

      <LexProgress submitting={submitting} stage={stage} />
    </FieldGroup>
  )
}
