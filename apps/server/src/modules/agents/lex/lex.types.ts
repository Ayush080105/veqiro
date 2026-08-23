import type { ToolTraceEntry } from "../../mcp/mcp.types.js";
import { z } from "zod";
import {
  sendMessageSchema,
  finalizeSourceSchema,
  analyzeContractSchema,
  draftDocumentSchema,
  exportDocumentSchema,
  stampLetterheadSchema,
  explainSchema,
  legalResearchSchema,
  complianceCheckSchema,
  queryDocumentSchema,
} from "./lex.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type FinalizeSourceInput = z.infer<typeof finalizeSourceSchema>;
export type AnalyzeContractInput = z.infer<typeof analyzeContractSchema>;
export type DraftDocumentInput = z.infer<typeof draftDocumentSchema>;
export type ExportDocumentInput = z.infer<typeof exportDocumentSchema>;
export type StampLetterheadInput = z.infer<typeof stampLetterheadSchema>;
export type StampLetterheadResponse = ExportDocumentResponse;

export type ExplainInput = z.infer<typeof explainSchema>;
export type LegalResearchInput = z.infer<typeof legalResearchSchema>;
export type ComplianceCheckInput = z.infer<typeof complianceCheckSchema>;
export type QueryDocumentInput = z.infer<typeof queryDocumentSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url?: string; image_base64?: string; content_type?: string; prompt_used?: string };
  tokens_used?: number;
  model_used?: string;
  action_id?: string;
  action_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Visible tool trace for this turn — see mcp.service.ts's withToolTrace. */
  tool_trace?: ToolTraceEntry[];
}

export interface IngestDocumentResponse {
  source_id: string;
  chunks_created: number;
  page_count: number;
  summary: string;
  key_topics: string[];
  document_type_detected: string;
  tokens_used?: number;
  model_used?: string;
}

export interface SourceDTO {
  id: string;
  sourceId: string;
  name: string;
  type: string;
  typeDetected: string | null;
  r2Key: string;
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
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string;
  confidence?: "high" | "medium" | "low";
  basis?: string;
}

export interface ScoreBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ObligationItem {
  action: string;
  deadline?: string | null;
  condition?: string | null;
  consequence?: string | null;
}

export interface PartyObligations {
  party: string;
  items: ObligationItem[];
}

export interface AmbiguousClause {
  clause: string;
  section?: string | null;
  issue: string;
  interpretation: string;
}

export interface ClauseBreakdown {
  section: string;
  title: string;
  summary: string;
  risk_level: string;
  notes: string;
}

export interface NegotiationPoint {
  priority: "high" | "medium" | "low";
  clause: string;
  issue: string;
  suggested_change: string;
}

export interface ContractAnalysis {
  document_type: string;
  parties: string[];
  effective_date: string;
  governing_law: string;
  jurisdiction: string;
  executive_summary: string;
  risk_level: string;
  risk_score: number;
  risks: ContractRisk[];
  unusual_clauses: string[];
  missing_protections: string[];
  clause_breakdown: ClauseBreakdown[];
  key_terms: Record<string, string>;
  obligations: Record<string, string[]>;
  negotiation_points: NegotiationPoint[];
  overall_assessment: string;
  recommended_action: string;
  score_breakdown?: ScoreBreakdown;
  obligations_structured?: PartyObligations[];
  ambiguous_clauses?: AmbiguousClause[];
}

export interface AnalyzeContractResponse {
  analysis: ContractAnalysis;
  tokens_used?: number;
  model_used?: string;
}

export interface DraftDocumentResponse {
  document: string;
  review_notes: string[];
  tokens_used?: number;
  model_used?: string;
}

export interface ExportDocumentResponse {
  file_b64: string;
  mime_type: string;
  filename: string;
}

export interface ExplainResponse {
  explanation: string;
  key_terms: Record<string, string>;
  related_concepts: string[];
  practical_implications: string[];
  tokens_used?: number;
  model_used?: string;
}

export interface LegalResearchSection {
  title: string;
  type: "ordered" | "bullets" | "narrative";
  items: string[];
}

export interface LegalResearchResponse {
  answer: string;
  sections: LegalResearchSection[];
  references: string[];
  relevant_cases: string[];
  jurisdiction_notes: string;
  confidence_level: string;
  tokens_used?: number;
  model_used?: string;
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
  tokens_used?: number;
  model_used?: string;
}
