import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext, recordAgentTurnContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import * as mcpService from "../../mcp/mcp.service.js";
import {
  deleteObject,
  getPublicUrl,
  headObject,
  isR2Configured,
  keyBelongsToOrg,
} from "../../../common/utils/r2.js";
import * as lexRepository from "./lex.repository.js";
import { findBrandKit } from "../../brand-kit/brand-kit.repository.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  IngestDocumentResponse,
  AnalyzeContractInput,
  AnalyzeContractResponse,
  DraftDocumentInput,
  DraftDocumentResponse,
  ExportDocumentInput,
  ExportDocumentResponse,
  StampLetterheadInput,
  StampLetterheadResponse,
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
import { maybeStartPlannedRun } from "../../agent-runs/agent-runs.planner.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await lexRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });

  // A multi-step request becomes a planned run the user approves as a
  // graph. Returns null for everything else, including any failure, so
  // the normal single-pass path below stays the default.
  const plannedRun = await maybeStartPlannedRun({
    organizationId,
    userId,
    agent: Agent.LEX,
    content: input.content,
  });
  if (plannedRun) return plannedRun;

  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/lex/chat",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: input.conversationId ?? userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  }) as AssistantMessagePayload;
  if (!responseData) throw new BadRequestError("Failed to get response from AI");

  const pendingActions = mcpService.readPendingActions(responseData)
  const pendingActionsSnapshot = pendingActions?.length ? mcpService.toPendingActionsSnapshot(pendingActions) : undefined

  const customInput = mcpService.withToolTrace(
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result, pendingActions: pendingActionsSnapshot }
      : responseData.metadata
        ? { metadata: responseData.metadata, pendingActions: pendingActionsSnapshot }
        : pendingActionsSnapshot
          ? { pendingActions: pendingActionsSnapshot }
          : undefined,
    responseData.tool_trace,
  );

  const assistantMessage = await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  if (pendingActions?.length) {
    await mcpService.stagePendingActions({
      organizationId,
      userId,
      agent: Agent.LEX,
      messageId: assistantMessage.id,
      pendingActions,
    });
  }

  return assistantMessage;
};

export const listMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => lexRepository.findAllLexMessages(organizationId, opts);

const toSourceDTO = (row: {
  id: string;
  sourceId: string;
  name: string;
  type: string;
  typeDetected: string | null;
  r2Key: string;
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
  r2Key: row.r2Key,
  r2Url: getPublicUrl(row.r2Key),
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
    documentName: string;
    documentType: string;
  }
): Promise<SourceDTO> => {
  if (!isR2Configured()) {
    throw new BadRequestError("R2 storage is not configured on the server.");
  }

  // Defence-in-depth: refuse to "claim" a key that doesn't belong to this
  // org (presign already enforces this, but a malicious client might post
  // any key here).
  if (!keyBelongsToOrg(input.key, organizationId)) {
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

  const documentUrl = getPublicUrl(input.key);
  const [history] = await Promise.all([
    lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
  ]);

  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Upload document: ${input.documentName}`,
    customInput: {
      actionId: "lex:upload-source",
      input: {
        documentName: input.documentName,
        documentType: input.documentType,
        sizeBytes: head.size,
        r2Key: input.key,
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
      document_url: documentUrl,
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
    sizeBytes: head.size,
    pageCount: data.page_count,
    chunksCreated: data.chunks_created,
    summary: data.summary,
    keyTopics: data.key_topics,
  });

  const assistantContent = `Ingested ${data.page_count} pages (${data.chunks_created} chunks) — ${data.document_type_detected}`;
  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:upload-source", result: { ...data, sourceRowId: source.id } },
  });

  void recordAgentTurnContext({
    agent: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    organizationId,
    userContent: `Upload document: ${input.documentName}`,
    assistantContent,
    recentMessages: history,
  }).catch(() => {});

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
  const [source, history] = await Promise.all([
    lexRepository.findSourcesForUser(userId, organizationId),
    lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
  ]);
  const owned = source.find((s) => s.sourceId === input.sourceId);
  if (!owned) {
    throw new NotFoundError("Document not found");
  }

  const userContent = `Query "${owned.name}": ${input.query.slice(0, 120)}${input.query.length > 120 ? "..." : ""}`;
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: userContent,
    customInput: {
      actionId: "lex:query-document",
      input: { sourceId: input.sourceId, query: input.query },
    },
  });

  const { data } = await aiService.post<QueryDocumentResponse>(
    "/ai/lex/query-document",
    {
      user_id: userId,
      source_id: input.sourceId,
      query: input.query,
      top_k: 5,
    }
  );

  const assistantContent = data.answer.slice(0, 500);
  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: {
      actionId: "lex:query-document",
      input: { sourceId: input.sourceId, query: input.query },
      result: data,
    },
  });

  void recordAgentTurnContext({
    agent: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    organizationId,
    userContent,
    assistantContent,
    recentMessages: history,
  }).catch(() => {});

  return data;
};

export const analyzeContract = async (
  userId: string,
  organizationId: string,
  input: AnalyzeContractInput
): Promise<AnalyzeContractResponse> => {
  const history = await lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userContent = input.sourceId
    ? `Analyze ingested contract ${input.sourceId}`
    : "Analyze contract text";
  const userMsg = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: userContent,
    customInput: {
      actionId: "lex:analyze-contract",
      input: {
        sourceId: input.sourceId,
        analysisFocus: input.analysisFocus,
        contractChars: input.contractText?.length ?? 0,
      },
    },
  });

  const data = await callAgentWithContext<AnalyzeContractResponse>({
    agentApiPath: "/ai/lex/analyze-contract",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: userContent,
    rawHistory: history,
    topLevelPayload: {
      source_id: input.sourceId,
      contract_text: input.contractText,
      analysis_focus: input.analysisFocus,
    },
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Risk level: ${data.analysis.risk_level} — ${data.analysis.risks.length} risks identified`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: {
      actionId: "lex:analyze-contract",
      input: {
        sourceId: input.sourceId,
        analysisFocus: input.analysisFocus,
        contractChars: input.contractText?.length ?? 0,
      },
      result: data,
    },
  });

  return data;
};

export const draftDocument = async (
  userId: string,
  organizationId: string,
  input: DraftDocumentInput
): Promise<DraftDocumentResponse> => {
  const history = await lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Draft ${input.documentType}`,
    customInput: { actionId: "lex:draft-document", input },
  });

  const data = await callAgentWithContext<DraftDocumentResponse>({
    agentApiPath: "/ai/lex/draft-document",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Draft ${input.documentType}`,
    rawHistory: history,
    topLevelPayload: {
      document_type: input.documentType,
      requirements: input.requirements,
      jurisdiction: input.jurisdiction,
      additional_clauses: input.additionalClauses,
    },
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Drafted ${input.documentType} (${data.document.length} chars)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:draft-document", input, result: data },
  });

  return data;
};

export const stampLetterhead = async (
  organizationId: string,
  input: StampLetterheadInput
): Promise<StampLetterheadResponse> => {
  const brandKit = await findBrandKit(organizationId);
  if (!brandKit?.letterhead_url) {
    throw new BadRequestError(
      "No letterhead configured. Upload a letterhead image in your Brand Brain first."
    );
  }

  const { data } = await aiService.post<StampLetterheadResponse>(
    "/ai/lex/stamp-letterhead",
    {
      file_url: input.fileUrl,
      filename: input.filename,
      format: input.format,
      organization_id: organizationId,
      letterhead_url: brandKit.letterhead_url,
    }
  );
  return data;
};

export const exportDocument = async (
  organizationId: string,
  input: ExportDocumentInput
): Promise<ExportDocumentResponse> => {
  const { data } = await aiService.post<ExportDocumentResponse>(
    "/ai/lex/export-document",
    {
      document: input.document,
      format: input.format,
      document_type: input.documentType,
      organization_id: organizationId,
      include_letterhead: input.includeLetterhead ?? false,
    }
  );
  return data;
};

export const explainLegalText = async (
  userId: string,
  organizationId: string,
  input: ExplainInput
): Promise<ExplainResponse> => {
  const history = await lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userContent = `Explain: ${input.text.slice(0, 120)}${input.text.length > 120 ? "..." : ""}`;
  const userMsg = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: userContent,
    customInput: { actionId: "lex:explain", input },
  });

  const data = await callAgentWithContext<ExplainResponse>({
    agentApiPath: "/ai/lex/explain",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: userContent,
    rawHistory: history,
    topLevelPayload: { text: input.text, context: input.context },
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Explanation ready (${data.practical_implications.length} implications, ${data.related_concepts.length} related concepts)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:explain", input, result: data },
  });

  return data;
};

export const legalResearch = async (
  userId: string,
  organizationId: string,
  input: LegalResearchInput
): Promise<LegalResearchResponse> => {
  const history = await lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Legal research: ${input.query}`,
    customInput: { actionId: "lex:legal-research", input },
  });

  const data = await callAgentWithContext<LegalResearchResponse>({
    agentApiPath: "/ai/lex/legal-research",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Legal research: ${input.query}`,
    rawHistory: history,
    topLevelPayload: {
      query: input.query,
      jurisdiction: input.jurisdiction,
      legal_areas: input.legalAreas,
    },
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.sections?.length ?? 0} sections, ${data.references?.length ?? 0} references (${data.confidence_level})`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:legal-research", input, result: data },
  });

  return data;
};

export const complianceCheck = async (
  userId: string,
  organizationId: string,
  input: ComplianceCheckInput
): Promise<ComplianceCheckResponse> => {
  const history = await lexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Compliance check: ${input.frameworks.join(", ")}`,
    customInput: { actionId: "lex:compliance-check", input },
  });

  const data = await callAgentWithContext<ComplianceCheckResponse>({
    agentApiPath: "/ai/lex/compliance-check",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Compliance check: ${input.frameworks.join(", ")}`,
    rawHistory: history,
    topLevelPayload: {
      description: input.description,
      frameworks: input.frameworks,
      business_context: input.businessContext,
    },
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Status: ${data.overall_status} — ${data.critical_gaps.length} critical gaps, ${data.remediation_steps.length} remediation steps`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:compliance-check", input, result: data },
  });

  return data;
};
