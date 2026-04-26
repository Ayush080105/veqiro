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
})
export type LexUploadSourceValues = z.infer<typeof lexUploadSourceSchema>

export const lexAnalyzeContractSchema = z.object({
  source_id: z.string().optional(),
  contract_text: z.string().min(1, "Contract text is required"),
  analysis_focus: z.array(z.string()).optional(),
})
export type LexAnalyzeContractValues = z.infer<typeof lexAnalyzeContractSchema>

export const lexQueryDocumentSchema = z.object({
  sourceId: z.string().min(1, "Pick a source"),
  query: z.string().min(2, "Query is required"),
})
export type LexQueryDocumentValues = z.infer<typeof lexQueryDocumentSchema>

export const lexDraftDocumentSchema = z.object({
  document_type: z.string().min(1, "Document type is required"),
  requirements: z.string().min(10, "Describe what the document must cover"),
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

export const lexComplianceCheckSchema = z.object({
  description: z.string().min(2, "Describe the workflow or system"),
  frameworks: z.array(z.string()).min(1, "Pick at least one framework"),
  business_context: z.string().optional(),
})
export type LexComplianceCheckValues = z.infer<typeof lexComplianceCheckSchema>
