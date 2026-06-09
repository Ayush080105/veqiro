import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  conversationId: z.string().min(1).max(200).optional(),
});

// Called after the browser PUTs the PDF directly to R2 via a presigned URL.
// Server verifies (HeadObject) and triggers AI ingestion using the public URL.
export const finalizeSourceSchema = z.object({
  key: z.string().min(1).max(500),
  documentName: z.string().min(1).max(200),
  documentType: z.string().max(100).optional().default("nda"),
});

export const analyzeContractSchema = z
  .object({
    sourceId: z.string().nullable().optional(),
    contractText: z.string().max(100000).optional().default(""),
    analysisFocus: z.array(z.string()).max(20).optional().default([]),
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
  jurisdiction: z.string().max(100).optional().default("United States (Delaware)"),
  additionalClauses: z.array(z.string()).max(20).optional().default([]),
});

export const explainSchema = z.object({
  text: z.string().min(1).max(10000),
  context: z.string().max(2000).nullable().optional(),
});

export const legalResearchSchema = z.object({
  query: z.string().min(1).max(2000),
  jurisdiction: z.string().max(100).optional().default("United States"),
  legalAreas: z.array(z.string()).max(20).optional().default([]),
});

export const complianceCheckSchema = z.object({
  description: z.string().min(1).max(5000),
  frameworks: z.array(z.string()).min(1).max(20),
  businessContext: z.string().max(2000).optional().default(""),
});
