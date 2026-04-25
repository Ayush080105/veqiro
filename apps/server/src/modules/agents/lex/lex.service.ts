import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
import * as lexRepository from "./lex.repository.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  IngestDocumentInput,
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

export const ingestDocument = async (
  userId: string,
  organizationId: string,
  input: IngestDocumentInput
): Promise<IngestDocumentResponse> => {
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Ingest document: ${input.documentName}`,
    customInput: {
      tool: "ingest-document",
      input: {
        documentName: input.documentName,
        documentType: input.documentType,
        // avoid logging the raw base64 payload in custom input
        pdfBytesApprox: Math.ceil((input.pdfBase64?.length ?? 0) * 0.75),
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
      pdf_base64: input.pdfBase64,
    }
  );

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Ingested ${data.page_count} pages (${data.chunks_created} chunks) — ${data.document_type_detected}`,
    customInput: { tool: "ingest-document", output: data },
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
