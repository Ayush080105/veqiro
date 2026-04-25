import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
import { deleteObject, headObject, isR2Configured } from "../../../common/utils/r2.js";
import * as lexRepository from "./lex.repository.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  IngestDocumentResponse,
  AnalyzeContractInput,
  AnalyzeContractResponse,
  DraftDocumentInput,
  DraftDocumentResponse,
  ExplainInput,
  ExplainResponse,
  LegalResearchInput,
  LegalResearchResponse,
  ComplianceCheckInput,
  ComplianceCheckResponse,
  SourceDTO,
  QueryDocumentInput,
  QueryDocumentResponse,
} from "./lex.types.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const userMessage = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const history = await lexRepository.findRecentMessages(
    organizationId,
    SAGE_HISTORY_LIMIT
  );

  const { data } = await aiService.post<AssistantMessagePayload>("/ai/lex/chat", {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
  });
  if (!data) throw new BadRequestError("Failed to get response from AI");

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.response,
    imageUrl: data.image?.url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: data.metadata ? { metadata: data.metadata } : undefined,
  });

  return {
    role: "assistant" as const,
    content: data.response,
    imageUrl: data.image?.url,
    disclaimer: (data.metadata as { disclaimer?: string } | undefined)?.disclaimer,
    createdAt: userMessage.createdAt,
  };
};

export const listMessages = (organizationId: string) =>
  lexRepository.findAllLexMessages(organizationId);

const toSourceDTO = (row: {
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
  createdAt: Date;
}): SourceDTO => ({
  id: row.id,
  sourceId: row.sourceId,
  name: row.name,
  type: row.type,
  typeDetected: row.typeDetected,
  r2Url: row.r2Url,
  sizeBytes: row.sizeBytes,
  pageCount: row.pageCount,
  chunksCreated: row.chunksCreated,
  summary: row.summary,
  keyTopics: row.keyTopics,
  createdAt: row.createdAt.toISOString(),
});

const MAX_LEX_PDF_BYTES = 25 * 1024 * 1024;

export const finalizeSource = async (
  userId: string,
  organizationId: string,
  input: {
    key: string;
    url: string;
    documentName: string;
    documentType: string;
  }
): Promise<SourceDTO> => {
  if (!isR2Configured()) {
    throw new BadRequestError("R2 storage is not configured on the server.");
  }

  // Defence-in-depth: refuse to "claim" a key that doesn't live under this
  // org's namespace (presign already enforces this, but a malicious client
  // might post any key here).
  if (!input.key.startsWith(`${organizationId}/`)) {
    throw new BadRequestError("Invalid object key.");
  }

  const head = await headObject(input.key);
  if (!head) {
    throw new BadRequestError("Upload not found in storage. Try again.");
  }
  if (head.contentType !== "application/pdf") {
    throw new BadRequestError("Uploaded file must be a PDF.");
  }
  if (head.size > MAX_LEX_PDF_BYTES) {
    throw new BadRequestError("PDF must be under 25MB.");
  }

  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Upload document: ${input.documentName}`,
    customInput: {
      tool: "upload-source",
      input: {
        documentName: input.documentName,
        documentType: input.documentType,
        sizeBytes: head.size,
        r2Url: input.url,
      },
    },
  });

  const { data } = await aiService.post<IngestDocumentResponse>(
    "/ai/lex/ingest-document",
    {
      user_id: userId,
      organization_id: organizationId,
      document_name: input.documentName,
      document_type: input.documentType,
      document_url: input.url,
    }
  );

  const source = await lexRepository.createSource({
    organizationId,
    userId,
    sourceId: data.source_id,
    name: input.documentName,
    type: input.documentType,
    typeDetected: data.document_type_detected,
    r2Key: input.key,
    r2Url: input.url,
    sizeBytes: head.size,
    pageCount: data.page_count,
    chunksCreated: data.chunks_created,
    summary: data.summary,
    keyTopics: data.key_topics,
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Ingested ${data.page_count} pages (${data.chunks_created} chunks) — ${data.document_type_detected}`,
    customInput: { tool: "upload-source", output: { ...data, sourceRowId: source.id } },
  });

  return toSourceDTO(source);
};

export const listSources = async (
  userId: string,
  organizationId: string
): Promise<SourceDTO[]> => {
  const rows = await lexRepository.findSourcesForUser(userId, organizationId);
  return rows.map(toSourceDTO);
};

export const deleteSource = async (
  userId: string,
  organizationId: string,
  id: string
): Promise<{ deleted: true }> => {
  const source = await lexRepository.findSourceById(id, userId, organizationId);
  if (!source) {
    throw new NotFoundError("Document not found");
  }

  try {
    await aiService.post("/ai/lex/delete-source", {
      user_id: userId,
      source_id: source.sourceId,
    });
  } catch {
    // best-effort: even if AI cleanup fails, continue removing R2 + DB rows
  }

  try {
    await deleteObject(source.r2Key);
  } catch {
    // best-effort: orphaned R2 objects can be reaped offline
  }

  await lexRepository.deleteSourceById(id);
  return { deleted: true };
};

export const queryDocument = async (
  userId: string,
  organizationId: string,
  input: QueryDocumentInput
): Promise<QueryDocumentResponse> => {
  const source = await lexRepository.findSourcesForUser(userId, organizationId);
  const owned = source.find((s) => s.sourceId === input.sourceId);
  if (!owned) {
    throw new NotFoundError("Document not found");
  }

  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Query "${owned.name}": ${input.query.slice(0, 120)}${
      input.query.length > 120 ? "..." : ""
    }`,
    customInput: {
      tool: "query-document",
      input: { sourceId: input.sourceId, query: input.query, topK: input.topK },
    },
  });

  const { data } = await aiService.post<QueryDocumentResponse>(
    "/ai/lex/query-document",
    {
      user_id: userId,
      source_id: input.sourceId,
      query: input.query,
      top_k: input.topK,
    }
  );

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.answer.slice(0, 500),
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { tool: "query-document", output: data },
  });

  return data;
};

export const analyzeContract = async (
  userId: string,
  organizationId: string,
  input: AnalyzeContractInput
): Promise<AnalyzeContractResponse> => {
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.sourceId
      ? `Analyze ingested contract ${input.sourceId}`
      : "Analyze contract text",
    customInput: {
      tool: "analyze-contract",
      input: {
        sourceId: input.sourceId,
        analysisFocus: input.analysisFocus,
        contractChars: input.contractText?.length ?? 0,
      },
    },
  });

  const { data } = await aiService.post<AnalyzeContractResponse>(
    "/ai/lex/analyze-contract",
    {
      user_id: userId,
      organization_id: organizationId,
      source_id: input.sourceId,
      contract_text: input.contractText,
      analysis_focus: input.analysisFocus,
    }
  );

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Risk level: ${data.analysis.risk_level} — ${data.analysis.risks.length} risks identified`,
    customInput: { tool: "analyze-contract", output: data },
  });

  return data;
};

export const draftDocument = async (
  userId: string,
  organizationId: string,
  input: DraftDocumentInput
): Promise<DraftDocumentResponse> => {
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Draft ${input.documentType}`,
    customInput: { tool: "draft-document", input },
  });

  const { data } = await aiService.post<DraftDocumentResponse>(
    "/ai/lex/draft-document",
    {
      user_id: userId,
      organization_id: organizationId,
      document_type: input.documentType,
      requirements: input.requirements,
      jurisdiction: input.jurisdiction,
      additional_clauses: input.additionalClauses,
    }
  );

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Drafted ${input.documentType} (${data.document.length} chars)`,
    customInput: { tool: "draft-document", output: data },
  });

  return data;
};

export const explainLegalText = async (
  userId: string,
  organizationId: string,
  input: ExplainInput
): Promise<ExplainResponse> => {
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Explain: ${input.text.slice(0, 120)}${input.text.length > 120 ? "..." : ""}`,
    customInput: { tool: "explain", input },
  });

  const { data } = await aiService.post<ExplainResponse>("/ai/lex/explain", {
    user_id: userId,
    organization_id: organizationId,
    text: input.text,
    context: input.context,
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Explanation ready (${data.practical_implications.length} implications, ${data.related_concepts.length} related concepts)`,
    customInput: { tool: "explain", output: data },
  });

  return data;
};

export const legalResearch = async (
  userId: string,
  organizationId: string,
  input: LegalResearchInput
): Promise<LegalResearchResponse> => {
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Legal research: ${input.query}`,
    customInput: { tool: "legal-research", input },
  });

  const { data } = await aiService.post<LegalResearchResponse>(
    "/ai/lex/legal-research",
    {
      user_id: userId,
      organization_id: organizationId,
      query: input.query,
      jurisdiction: input.jurisdiction,
      legal_areas: input.legalAreas,
    }
  );

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.applicable_laws.length} laws, ${data.relevant_cases.length} cases found (${data.confidence_level})`,
    customInput: { tool: "legal-research", output: data },
  });

  return data;
};

export const complianceCheck = async (
  userId: string,
  organizationId: string,
  input: ComplianceCheckInput
): Promise<ComplianceCheckResponse> => {
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Compliance check: ${input.frameworks.join(", ")}`,
    customInput: { tool: "compliance-check", input },
  });

  const { data } = await aiService.post<ComplianceCheckResponse>(
    "/ai/lex/compliance-check",
    {
      user_id: userId,
      organization_id: organizationId,
      description: input.description,
      frameworks: input.frameworks,
      business_context: input.businessContext,
    }
  );

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Status: ${data.overall_status} — ${data.critical_gaps.length} critical gaps, ${data.remediation_steps.length} remediation steps`,
    customInput: { tool: "compliance-check", output: data },
  });

  return data;
};
