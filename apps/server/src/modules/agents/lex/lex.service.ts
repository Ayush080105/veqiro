import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import {
  callAgentWithContext,
  recordAgentTurnContext,
  streamAgentWithContext,
  type SseEvent,
} from "../../../common/utils/contextService.js";
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
import * as lexMemory from "./lex.memory.js";
import { prisma } from "../../../config/prisma.js";
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
  DraftReplyInput,
  DraftReplyResponse,
  SourceReviewSummary,
} from "./lex.types.js";
import { maybeStartPlannedRun } from "../../agent-runs/agent-runs.planner.js";

/**
 * Fetches full text for sources explicitly attached via the composer's "#"
 * picker and folds it into a context block prepended to the agent-facing
 * message. The DISPLAYED/persisted user message stays as raw typed text —
 * only the copy sent to the LLM carries the document dump — mirroring how
 * core/rag.py's silent auto-retrieval already augments the prompt without
 * touching what's shown in the transcript. Best-effort: an id that isn't
 * owned by this user, or a fetch failure, is silently dropped rather than
 * failing the whole chat turn.
 */
async function buildAttachedContext(
  userId: string,
  organizationId: string,
  sourceIds: string[] | undefined
): Promise<{ contextBlock: string; attached: { sourceId: string; name: string }[] }> {
  if (!sourceIds?.length) return { contextBlock: "", attached: [] };

  const owned = await lexRepository.findSourcesForUser(userId, organizationId);
  const matched = sourceIds
    .map((id) => owned.find((s) => s.sourceId === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (!matched.length) return { contextBlock: "", attached: [] };

  const blocks = await Promise.all(
    matched.map(async (s) => {
      try {
        const { data } = await aiService.post<{ content: string }>("/ai/lex/source-content", {
          user_id: userId,
          source_id: s.sourceId,
        });
        return `### Attached document: ${s.name}\n${data.content}`;
      } catch {
        return null;
      }
    })
  );
  const ok = blocks.filter((b): b is string => Boolean(b));
  return {
    contextBlock: ok.length ? `${ok.join("\n\n")}\n\n---\n\n` : "",
    attached: matched.map((s) => ({ sourceId: s.sourceId, name: s.name })),
  };
}

/** A review run from chat (Lex's analyze_contract tool) is saved to legal memory like one run from the card. */
const rememberChatReview = async (userId: string, organizationId: string, responseData: AssistantMessagePayload) => {
  if (responseData.action_id !== "lex:analyze-contract") return;
  const result = responseData.action_result as { analysis?: AnalyzeContractResponse["analysis"]; source_id?: string } | undefined;
  if (!result?.analysis || !result.source_id) return;
  try {
    await lexMemory.saveReview({ organizationId, userId, sourceId: result.source_id, analysis: result.analysis, actor: "lex" });
  } catch (err) {
    console.warn("[lex] saving chat review failed", err);
  }
};

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await lexRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const [attached, memoryContext] = await Promise.all([
    buildAttachedContext(userId, organizationId, input.sourceIds),
    lexMemory.buildLegalMemoryContext(userId, organizationId).catch(() => ""),
  ]);
  const userMessage = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
    customInput: attached.attached.length ? { attachedSources: attached.attached } : undefined,
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
    userMessage: `${memoryContext}${attached.contextBlock}${input.content}`,
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

  await rememberChatReview(userId, organizationId, responseData);

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

/**
 * Streaming sibling of `sendMessage`. Yields SSE frames as apps/ai produces
 * them; the caller (lex.controller.ts) writes each straight to the HTTP
 * response. Persistence (assistant Message row, pending-action staging)
 * happens once the stream ends, mirroring exactly what sendMessage does with
 * callAgentWithContext's return value — see that function for the shape of
 * the persisted row and why each piece is written the way it is.
 */
export async function* streamMessage(
  userId: string,
  organizationId: string,
  input: SendMessageInput
): AsyncGenerator<SseEvent, void, unknown> {
  const history = await lexRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const [attached, memoryContext] = await Promise.all([
    buildAttachedContext(userId, organizationId, input.sourceIds),
    lexMemory.buildLegalMemoryContext(userId, organizationId).catch(() => ""),
  ]);
  const userMessage = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
    customInput: attached.attached.length ? { attachedSources: attached.attached } : undefined,
  });

  // Planned/DAG runs keep their existing polling UX (RunPanel/RunGraph) —
  // signal it to the client instead of trying to stream a run's progress.
  const plannedRun = await maybeStartPlannedRun({
    organizationId,
    userId,
    agent: Agent.LEX,
    content: input.content,
  });
  if (plannedRun) {
    yield { event: "plan_started", data: JSON.stringify(plannedRun) };
    return;
  }

  const iterator = streamAgentWithContext({
    agentApiPath: "/ai/lex/chat",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: input.conversationId ?? userMessage.id,
    userMessage: `${memoryContext}${attached.contextBlock}${input.content}`,
    rawHistory: history,
  });

  let step: IteratorResult<SseEvent, AssistantMessagePayload | null>;
  // eslint-disable-next-line no-cond-assign
  while (!(step = (await iterator.next()) as IteratorResult<SseEvent, AssistantMessagePayload | null>).done) {
    yield step.value;
  }
  const responseData = step.value;
  if (!responseData) return; // error already relayed as an SSE `error` frame

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

  await rememberChatReview(userId, organizationId, responseData);

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

  // The done/token frames only carry what apps/ai returned — give the client
  // the persisted row's real id/createdAt so it can reconcile its optimistic
  // message by identity, same as the non-streaming response already lets it.
  yield { event: "persisted", data: JSON.stringify(assistantMessage) };
}

export const listMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => lexRepository.findAllLexMessages(organizationId, opts);

type SourceRow = Awaited<ReturnType<typeof lexRepository.findSourcesForUser>>[number];

const toSourceDTO = (
  row: SourceRow,
  latestReview: SourceReviewSummary | null = null,
  nextDate: SourceDTO["nextDate"] = null
): SourceDTO => ({
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
  latestReview:
    row.lastReviewedAt && row.reviewHeadline
      ? {
          headline: row.reviewHeadline,
          action: row.reviewAction ?? "",
          riskLevel: row.riskLevel ?? "",
          issueCount: row.criticalCount + row.highCount,
          nextDate: nextDate ? `${nextDate.description}` : null,
          reviewedAt: row.lastReviewedAt.toISOString(),
        }
      : latestReview,
  status: row.status,
  counterparty: row.counterparty,
  expiryDate: row.expiryDate?.toISOString() ?? null,
  renewalDate: row.renewalDate?.toISOString() ?? null,
  noticeDeadline: row.noticeDeadline?.toISOString() ?? null,
  riskLevel: row.riskLevel,
  lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
  version: row.version,
  previousVersionId: row.previousVersionId,
  hasUnseenChanges: Boolean(row.versionComparison) && !row.versionComparisonSeen,
  nextDate,
});

type ReviewMessage = { customInput: unknown; createdAt: Date };

/** Latest review per sourceId, from saved analyze-contract messages (newest first). */
const summariseReviews = (messages: ReviewMessage[]): Map<string, SourceReviewSummary> => {
  const out = new Map<string, SourceReviewSummary>();
  for (const m of messages) {
    const ci = m.customInput as {
      input?: { sourceId?: string | null };
      result?: { analysis?: AnalyzeContractResponse["analysis"] };
    } | null;
    const sourceId = ci?.input?.sourceId;
    const a = ci?.result?.analysis;
    if (!sourceId || !a || out.has(sourceId) || a.failed) continue;
    out.set(sourceId, {
      headline: a.verdict?.headline ?? a.recommended_action.replace(/_/g, " "),
      action: a.verdict?.action ?? a.recommended_action,
      riskLevel: a.risk_level,
      issueCount: a.issues?.length ?? a.risks?.length ?? 0,
      nextDate: a.key_dates?.[0] ? `${a.key_dates[0].when} — ${a.key_dates[0].what}` : null,
      reviewedAt: m.createdAt.toISOString(),
    });
  }
  return out;
};

const MAX_LEX_PDF_BYTES = 25 * 1024 * 1024;

export const finalizeSource = async (
  userId: string,
  organizationId: string,
  input: {
    key: string;
    documentName: string;
    documentType: string;
    previousVersionId?: string | null;
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

  const previous = input.previousVersionId
    ? await lexRepository.findSourceById(input.previousVersionId, userId, organizationId)
    : null;

  const created = await lexRepository.createSource({
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
  const source = previous
    ? await prisma.lexSource.update({
        where: { id: created.id },
        data: { previousVersionId: previous.id, version: previous.version + 1, counterparty: previous.counterparty, perspective: previous.perspective },
      })
    : created;

  await lexMemory.logActivity({
    organizationId,
    sourceRowId: source.id,
    actor: "user",
    userId,
    action: previous ? `Uploaded version ${source.version} of ${previous.name}` : `Uploaded ${source.name}`,
    detail: `${data.page_count} pages`,
  });
  if (previous) {
    // Comparison is one model call, cached on the new version; it runs in the background so
    // the upload returns immediately and Legal Watch picks the result up when it lands.
    void lexMemory
      .compareWithPreviousVersion({ organizationId, userId, sourceRowId: source.id })
      .catch((err) => console.warn("[lex] version comparison failed", err));
  }

  const assistantContent = `Uploaded "${input.documentName}" (${data.page_count} pages)${data.summary ? ` — ${data.summary}` : ""}`;
  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:upload-source", result: { ...data, ...toSourceDTO(source), sourceRowId: source.id } },
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
  organizationId: string,
  query: { q?: string } = {}
): Promise<SourceDTO[]> => {
  const [rows, reviews, dates] = await Promise.all([
    lexRepository.findSourcesForUser(userId, organizationId, query.q),
    lexRepository.findRecentReviewMessages(organizationId).catch(() => []),
    lexRepository.findUpcomingObligations(userId, organizationId),
  ]);
  // Reviews saved before legal memory existed live only in chat history.
  const latest = summariseReviews(reviews);
  const nextBySource = new Map<string, SourceDTO["nextDate"]>();
  for (const d of dates) {
    if (d.dueDate && !nextBySource.has(d.sourceRowId)) {
      nextBySource.set(d.sourceRowId, { description: d.description, dueDate: d.dueDate.toISOString() });
    }
  }
  return rows.map((row) => toSourceDTO(row, latest.get(row.sourceId) ?? null, nextBySource.get(row.id) ?? null));
};

export const getSourceDetail = async (userId: string, organizationId: string, id: string) => {
  const row = await lexRepository.findSourceDetail(id, userId, organizationId);
  if (!row) throw new NotFoundError("Document not found");
  if (row.versionComparison && !row.versionComparisonSeen) {
    await prisma.lexSource.update({ where: { id: row.id }, data: { versionComparisonSeen: true } });
  }
  const versions = await lexRepository.findVersionChain(row, userId, organizationId);
  const { findings, obligations, activities, review, versionComparison, ...rest } = row;
  return {
    source: toSourceDTO(rest as SourceRow),
    review,
    versionComparison,
    findings,
    obligations: obligations.map((o) => ({ ...o, dueDate: o.dueDate?.toISOString() ?? null })),
    activity: activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    versions,
  };
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

  await lexMemory.logActivity({ organizationId, actor: "user", userId, action: `Deleted ${source.name}` });
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
  // Chunk text and similarity scores are retrieval internals — the card shows the answer and
  // its quoted citations, so the saved message doesn't carry five raw passages.
  const saved = { ...data, sources: [] };
  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: {
      actionId: "lex:query-document",
      input: { sourceId: input.sourceId, sourceName: owned.name, query: input.query },
      result: saved,
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
  const owned = input.sourceId
    ? (await lexRepository.findSourcesForUser(userId, organizationId)).find((s) => s.sourceId === input.sourceId)
    : undefined;
  if (input.sourceId && !owned) {
    throw new NotFoundError("Document not found");
  }
  const userContent = owned ? `Review "${owned.name}"` : "Review pasted contract text";
  const userMsg = await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: userContent,
    customInput: {
      actionId: "lex:analyze-contract",
      input: {
        sourceId: input.sourceId,
        analysisFocus: input.analysisFocus,
        perspective: input.perspective,
        contractChars: input.contractText?.length ?? 0,
      },
    },
  });

  const preferences = await lexMemory.activePreferences(organizationId);
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
      perspective: input.perspective,
      preferences,
    },
  });

  const sourceRowId = input.sourceId
    ? await lexMemory.saveReview({ organizationId, userId, sourceId: input.sourceId, analysis: data.analysis, actor: "user" })
    : null;

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.analysis.verdict
      ? `${data.analysis.verdict.headline} — ${data.analysis.verdict.summary}`
      : `Risk level: ${data.analysis.risk_level} — ${data.analysis.risks.length} risks identified`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: {
      actionId: "lex:analyze-contract",
      input: {
        sourceId: input.sourceId,
        sourceName: owned?.name,
        sourceRowId,
        analysisFocus: input.analysisFocus,
        perspective: input.perspective,
        contractChars: input.contractText?.length ?? 0,
      },
      result: data,
    },
  });

  // The card links the review to its document (reminders, full review, Ask Lex) — the same
  // identity the saved message carries in its input.
  return {
    ...data,
    source: owned ? { sourceRowId, sourceName: owned.name, sourceId: owned.sourceId } : null,
  };
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
    content: `Drafted ${input.documentType}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "lex:draft-document", input, result: data },
  });

  return data;
};

export const draftReply = async (
  userId: string,
  organizationId: string,
  input: DraftReplyInput
): Promise<DraftReplyResponse> => {
  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(input.analysisJson) as Record<string, unknown>;
  } catch {
    throw new BadRequestError("The review couldn't be read. Run the review again.");
  }
  const counterparty = typeof analysis.counterparty === "string" ? analysis.counterparty : "";
  const userContent = counterparty ? `Draft a reply to ${counterparty}` : "Draft a reply to the other side";
  await lexRepository.createUserMessage({
    organizationId,
    userId,
    content: userContent,
    customInput: { actionId: "lex:draft-reply", input: { counterparty, tone: input.tone } },
  });

  const { data } = await aiService.post<DraftReplyResponse>("/ai/lex/draft-reply", {
    user_id: userId,
    organization_id: organizationId,
    analysis,
    sender: input.sender,
    tone: input.tone,
  });

  await lexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Reply drafted: ${data.subject} (${data.changes.length} proposed changes)`,
    model: data.model_used,
    customInput: { actionId: "lex:draft-reply", input: { counterparty, tone: input.tone }, result: data },
  });

  await lexMemory.logActivity({
    organizationId,
    sourceRowId: input.sourceRowId ?? null,
    actor: "user",
    userId,
    action: "Generated a negotiation draft",
    detail: `${data.changes.length} proposed ${data.changes.length === 1 ? "change" : "changes"}${counterparty ? ` for ${counterparty}` : ""}`,
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
    content: data.answer.slice(0, 500),
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
    content: `Compliance check: ${input.frameworks.length ? input.frameworks.join(", ") : input.description.slice(0, 80)}`,
    customInput: { actionId: "lex:compliance-check", input },
  });

  const data = await callAgentWithContext<ComplianceCheckResponse>({
    agentApiPath: "/ai/lex/compliance-check",
    agentEnum: Agent.LEX,
    agentRole: "Lex: Legal and compliance assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Compliance check: ${input.frameworks.length ? input.frameworks.join(", ") : input.description.slice(0, 80)}`,
    rawHistory: history,
    topLevelPayload: {
      description: input.description,
      frameworks: input.frameworks,
      business_context: input.businessContext,
      jurisdiction: input.jurisdiction,
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
