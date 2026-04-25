import { z } from "zod";
import {
  sendMessageSchema,
  uploadSourceFieldsSchema,
  analyzeContractSchema,
  draftDocumentSchema,
  explainSchema,
  legalResearchSchema,
  complianceCheckSchema,
  queryDocumentSchema,
} from "./lex.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UploadSourceFields = z.infer<typeof uploadSourceFieldsSchema>;
export type AnalyzeContractInput = z.infer<typeof analyzeContractSchema>;
export type DraftDocumentInput = z.infer<typeof draftDocumentSchema>;
export type ExplainInput = z.infer<typeof explainSchema>;
export type LegalResearchInput = z.infer<typeof legalResearchSchema>;
export type ComplianceCheckInput = z.infer<typeof complianceCheckSchema>;
export type QueryDocumentInput = z.infer<typeof queryDocumentSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url: string };
  tokens_used?: number;
  model_used?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestDocumentResponse {
  source_id: string;
  chunks_created: number;
  page_count: number;
  summary: string;
  key_topics: string[];
  document_type_detected: string;
}

export interface SourceDTO {
  id: string;
  sourceId: string;
  name: string;
  type: string;
  typeDetected: string | null;
  r2Url: string;
  sizeBytes: number;
  pageCount: number;
  chunksCreated: number;
  summary: string;
  keyTopics: string[];
  createdAt: string;
}

export interface QueryDocumentChunk {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface QueryDocumentResponse {
  answer: string;
  sources: QueryDocumentChunk[];
  tokens_used?: number;
  model_used?: string;
}

export interface ContractRisk {
  clause: string;
  risk: string;
  severity: "low" | "medium" | "high";
}

export interface ContractAnalysis {
  summary: string;
  risk_level: string;
  risks: ContractRisk[];
  unusual_clauses: string[];
  missing_protections: string[];
  key_terms: Record<string, string>;
  overall_assessment: string;
}

export interface AnalyzeContractResponse {
  analysis: ContractAnalysis;
  disclaimer: string;
}

export interface DraftDocumentResponse {
  document: string;
  review_notes: string[];
  disclaimer: string;
}

export interface ExplainResponse {
  explanation: string;
  key_terms: Record<string, string>;
  related_concepts: string[];
  practical_implications: string[];
}

export interface LegalResearchResponse {
  summary: string;
  applicable_laws: string[];
  key_requirements: string[];
  relevant_cases: string[];
  practical_guidance: string[];
  jurisdiction_notes: string;
  confidence_level: string;
  disclaimer: string;
}

export interface FrameworkResult {
  framework: string;
  status: string;
  gaps: string[];
  requirements: string[];
}

export interface RemediationStep {
  priority: "high" | "medium" | "low";
  action: string;
}

export interface ComplianceCheckResponse {
  overall_status: string;
  framework_results: FrameworkResult[];
  critical_gaps: string[];
  remediation_steps: RemediationStep[];
  estimated_effort: string;
  disclaimer: string;
}
