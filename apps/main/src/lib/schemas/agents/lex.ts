import { z } from "zod"

export const LEX_DOCUMENT_TYPES = [
  "contract",
  "policy",
  "compliance",
  "regulation",
  "case-study",
  "other",
] as const

export const LEX_RISK_LEVELS = ["low", "medium", "high"] as const

// `file` is local-only — we accept the File instance via z.any() since File is
// not serialised to JSON and Zod doesn't have a built-in File schema.
export const lexUploadSourceSchema = z.object({
  file: z
    .any()
    .refine((f): f is File => typeof File !== "undefined" && f instanceof File, "File is required"),
  document_name: z.string().min(1, "Document name is required"),
  document_type: z.string().optional(),
  /** Run the verdict-first review straight after upload. */
  review_now: z.boolean().optional(),
  /** Which side of the contract the user is on; Lex infers it when empty. */
  perspective: z.string().optional(),
  /** Row id of the document this upload replaces, or "" for a new document. */
  previous_version_id: z.string().optional(),
})
export type LexUploadSourceValues = z.infer<typeof lexUploadSourceSchema>

export const lexAnalyzeContractSchema = z.object({
  source_id: z.string().optional(),
  contract_text: z.string().optional(),
  analysis_focus: z.array(z.string()).optional(),
  perspective: z.string().optional(),
})
export type LexAnalyzeContractValues = z.infer<typeof lexAnalyzeContractSchema>

export const lexQueryDocumentSchema = z.object({
  source_id: z.string().min(1, "Pick a source"),
  query: z.string().min(2, "Query is required"),
})
export type LexQueryDocumentValues = z.infer<typeof lexQueryDocumentSchema>

export const LEX_DRAFT_TYPES = [
  "NDA",
  "Service Agreement",
  "Vendor Agreement",
  "Employment Agreement",
  "Consultancy Agreement",
  "Legal Notice",
  "Privacy Policy",
  "Website Terms",
  "Other",
] as const

export const lexDraftDocumentSchema = z.object({
  document_type: z.string().min(1, "Document type is required"),
  other_type: z.string().optional(),
  parties: z.string().optional(),
  purpose: z.string().optional(),
  duration: z.string().optional(),
  commercial_terms: z.string().optional(),
  protect: z.string().optional(),
  requirements: z.string().optional(),
  jurisdiction: z.string().optional(),
  additional_clauses: z.array(z.string()).optional(),
})
export type LexDraftDocumentValues = z.infer<typeof lexDraftDocumentSchema>

export const lexExplainSchema = z.object({
  text: z.string().min(2, "Paste the text to explain"),
  context: z.string().optional(),
})
export type LexExplainValues = z.infer<typeof lexExplainSchema>

export const lexLegalResearchSchema = z.object({
  query: z.string().min(2, "Research query is required"),
  jurisdiction: z.string().optional(),
  legal_areas: z.array(z.string()).optional(),
})
export type LexLegalResearchValues = z.infer<typeof lexLegalResearchSchema>

export const lexStampLetterheadSchema = z.object({
  source_id: z.string().min(1, "Pick a document"),
  source_url: z.string().min(1),
  source_name: z.string().min(1),
})
export type LexStampLetterheadValues = z.infer<typeof lexStampLetterheadSchema>

export const lexComplianceCheckSchema = z.object({
  description: z.string().min(2, "Describe the workflow or system"),
  // Optional: Lex works out which laws apply when none are named.
  frameworks: z.array(z.string()).optional(),
  business_context: z.string().optional(),
})
export type LexComplianceCheckValues = z.infer<typeof lexComplianceCheckSchema>

export const lexDraftReplySchema = z.object({
  analysis: z.any(),
  source_row_id: z.string().nullable().optional(),
  document_name: z.string().optional(),
  /** Indices into analysis.issues to include in the request. */
  selected: z.array(z.number()).optional(),
  sender: z.string().optional(),
  tone: z.string().optional(),
})
export type LexDraftReplyValues = z.infer<typeof lexDraftReplySchema>
