import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  conversationId: z.string().min(1).max(200).optional(),
  // Ids of Lex sources explicitly attached via the composer's "#" picker —
  // their full text is prepended into what the agent sees, on top of
  // whatever core/rag.py's silent auto-retrieval already surfaces.
  sourceIds: z.array(z.string()).max(3).optional(),
});

// Called after the browser PUTs the PDF directly to R2 via a presigned URL.
// Server verifies (HeadObject) and triggers AI ingestion using the public URL.
export const finalizeSourceSchema = z.object({
  key: z.string().min(1).max(500),
  documentName: z.string().min(1).max(200),
  documentType: z.string().max(100).optional().default("nda"),
  // Row id of the document this upload is a new version of.
  previousVersionId: z.string().max(100).nullable().optional(),
});

export const analyzeContractSchema = z
  .object({
    sourceId: z.string().nullable().optional(),
    contractText: z.string().max(100000).optional().default(""),
    analysisFocus: z.array(z.string()).max(20).optional().default([]),
    // Which side of the contract the user is on; Lex infers it when empty.
    perspective: z.string().max(200).optional().default(""),
  })
  .refine(
    (v) => Boolean(v.sourceId) || (v.contractText && v.contractText.length > 0),
    "Provide either sourceId or contractText"
  );

export const queryDocumentSchema = z.object({
  sourceId: z.string().min(1),
  query: z.string().min(1).max(2000),
});

export const draftDocumentSchema = z.object({
  documentType: z.string().min(1).max(100),
  requirements: z.string().min(1).max(5000),
  // Empty means "use the organisation's location, else India" — decided by the AI service.
  jurisdiction: z.string().max(100).optional().default(""),
  additionalClauses: z.array(z.string()).max(20).optional().default([]),
});

export const exportDocumentSchema = z.object({
  document: z.string().min(1).max(200000),
  format: z.enum(["docx", "pdf"]),
  documentType: z.string().max(100).optional().default("Legal Document"),
  includeLetterhead: z.boolean().optional().default(false),
});

export const stampLetterheadSchema = z.object({
  fileUrl: z.string().url(),
  filename: z.string().min(1).max(255),
  format: z.enum(["docx", "pdf"]),
});

export const explainSchema = z.object({
  text: z.string().min(1).max(10000),
  context: z.string().max(2000).nullable().optional(),
});

export const legalResearchSchema = z.object({
  query: z.string().min(1).max(2000),
  jurisdiction: z.string().max(100).optional().default(""),
  legalAreas: z.array(z.string()).max(20).optional().default([]),
});

export const complianceCheckSchema = z.object({
  description: z.string().min(1).max(5000),
  // Empty lets Lex pick the laws that apply (India-first).
  frameworks: z.array(z.string()).max(20).optional().default([]),
  businessContext: z.string().max(2000).optional().default(""),
  jurisdiction: z.string().max(100).optional().default(""),
});

export const draftReplySchema = z.object({
  // The saved review as a JSON string: the body camelizer would rewrite a nested object's
  // snake_case keys (send_back → sendBack) before it reaches the AI service.
  analysisJson: z.string().min(2).max(200000),
  sourceRowId: z.string().max(100).nullable().optional(),
  sender: z.string().max(200).optional().default(""),
  tone: z.string().max(100).optional().default("firm but friendly"),
});

export const listSourcesQuerySchema = z.object({
  q: z.string().max(200).optional(),
});

export const preferencesSchema = z.object({
  values: z.record(z.string(), z.string().max(300)),
});

export const settingsSchema = z.object({
  weeklyBrief: z.boolean(),
});

export const obligationUpdateSchema = z.object({
  status: z.enum(["open", "done", "dismissed"]).optional(),
  reminderOn: z.boolean().optional(),
});

export const remindersSchema = z.object({
  obligationIds: z.array(z.string()).min(1).max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const activitySchema = z.object({
  sourceRowId: z.string().max(100).nullable().optional(),
  action: z.enum(["exported_review", "copied_reply", "shared_with_counsel", "opened_version_changes"]),
  detail: z.string().max(300).optional().default(""),
});
