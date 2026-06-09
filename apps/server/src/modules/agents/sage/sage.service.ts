import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext, buildMemoryBlock, storeActionTurn } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import * as sageRepository from "./sage.repository.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  KeywordResearchInput,
  KeywordResearchResponse,
  GenerateBlogInput,
  GenerateBlogResponse,
  AnalyzeContentInput,
  ContentAnalysisResponse,
  ContentBriefInput,
  ContentBriefResponse,
  GenerateBlogIdeasInput,
  GenerateBlogIdeasResponse,
  SavedKeyword,
} from "./sage.types.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await sageRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/sage/chat",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  }) as AssistantMessagePayload;
  if (!responseData) {
    throw new BadRequestError("Failed to get response ");
  }

  const customInput =
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result }
      : undefined;

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  return {
    role: "assistant" as const,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    customInput: customInput ?? null,
    createdAt: userMessage.createdAt,
  };
};

export const listMessages = (organizationId: string) =>
  sageRepository.findAllSageMessages(organizationId);

export const keywordResearch = async (
  userId: string,
  organizationId: string,
  input: KeywordResearchInput
) => {
  const [history, memBlock] = await Promise.all([
    sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.SAGE),
  ]);

  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Keyword research: ${input.seedTopic}`,
    customInput: { actionId: "sage:keyword-research", input },
  });

  const { data } = await aiService.post<KeywordResearchResponse>(
    "/ai/sage/keyword-research",
    {
      user_id: userId,
      organization_id: organizationId,
      seed_topic: input.seedTopic,
      niche: input.niche,
      competitor_urls: input.competitorUrls,
      count: input.count,
      metadata: { memory_context: memBlock ?? "" },
    }
  );

  const assistantContent = `${data.keywords.length} keywords in ${data.clusters.length} clusters`;
  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    customInput: { actionId: "sage:keyword-research", input, result: data },
  });

  void storeActionTurn({
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    organizationId,
    userContent: `Keyword research: ${input.seedTopic}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return data;
};

export const generateBlog = async (
  userId: string,
  organizationId: string,
  input: GenerateBlogInput
) => {
  const [history, memBlock] = await Promise.all([
    sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.SAGE),
  ]);

  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Blog: ${input.topic}`,
    customInput: { actionId: "sage:generate-blog", input },
  });

  const { data } = await aiService.post<GenerateBlogResponse>(
    "/ai/sage/generate-blog",
    {
      user_id: userId,
      organization_id: organizationId,
      topic: input.topic,
      target_keyword: input.targetKeyword,
      secondary_keywords: input.secondaryKeywords,
      word_count: input.wordCount,
      output_format: input.outputFormat,
      include_meta: input.includeMeta,
      include_schema_markup: input.includeSchemaMarkup,
      tone_override: input.toneOverride,
      metadata: { memory_context: memBlock ?? "" },
    }
  );

  const assistantContent = `Generated ${data.blog.word_count}-word post (SEO score ${data.seo_score})`;
  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    customInput: { actionId: "sage:generate-blog", input, result: data },
  });

  void storeActionTurn({
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    organizationId,
    userContent: `Blog: ${input.topic}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return data;
};

export const analyzeContent = async (
  userId: string,
  organizationId: string,
  input: AnalyzeContentInput
) => {
  const [history, memBlock] = await Promise.all([
    sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.SAGE),
  ]);

  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Content analysis: ${input.targetKeyword}`,
    customInput: { actionId: "sage:analyze-content", input },
  });

  const { data } = await aiService.post<ContentAnalysisResponse>(
    "/ai/sage/analyze-content",
    {
      user_id: userId,
      organization_id: organizationId,
      content: input.content,
      target_keyword: input.targetKeyword,
      url: input.url,
      metadata: { memory_context: memBlock ?? "" },
    }
  );

  const assistantContent = `SEO score ${data.score}`;
  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    customInput: { actionId: "sage:analyze-content", input, result: data },
  });

  void storeActionTurn({
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    organizationId,
    userContent: `Content analysis: ${input.targetKeyword}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return data;
};

export const contentBrief = async (
  userId: string,
  organizationId: string,
  input: ContentBriefInput
) => {
  const [history, memBlock] = await Promise.all([
    sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.SAGE),
  ]);

  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Content brief: ${input.topic}`,
    customInput: { actionId: "sage:content-brief", input },
  });

  const { data } = await aiService.post<ContentBriefResponse>(
    "/ai/sage/content-brief",
    {
      user_id: userId,
      organization_id: organizationId,
      topic: input.topic,
      target_keyword: input.targetKeyword,
      competitor_urls: input.competitorUrls,
      metadata: { memory_context: memBlock ?? "" },
    }
  );

  const assistantContent = `Brief generated for "${input.targetKeyword}"`;
  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    customInput: { actionId: "sage:content-brief", input, result: data },
  });

  void storeActionTurn({
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    organizationId,
    userContent: `Content brief: ${input.topic}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return data;
};

export const generateBlogIdeas = async (
  userId: string,
  organizationId: string,
  input: GenerateBlogIdeasInput
) => {
  const [history, memBlock] = await Promise.all([
    sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.SAGE),
  ]);

  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Blog ideas: ${input.count} ideas`,
    customInput: { actionId: "sage:generate-blog-ideas", input },
  });

  const { data } = await aiService.post<GenerateBlogIdeasResponse>(
    "/ai/sage/generate-blog-ideas",
    {
      user_id: userId,
      organization_id: organizationId,
      count: input.count,
      metadata: { memory_context: memBlock ?? "" },
    }
  );

  const assistantContent = `Generated ${data.ideas.length} blog ideas`;
  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    customInput: { actionId: "sage:generate-blog-ideas", input, result: data },
  });

  void storeActionTurn({
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    organizationId,
    userContent: `Blog ideas: ${input.count} ideas`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return data;
};

// ── Saved Keywords ──────────────────────────────────────────────────────────

export const listSavedKeywords = (organizationId: string): Promise<SavedKeyword[]> =>
  sageRepository.findSavedKeywords(organizationId) as Promise<SavedKeyword[]>;

export const saveKeyword = (
  organizationId: string,
  keyword: Omit<SavedKeyword, "id" | "createdAt" | "organizationId">
): Promise<SavedKeyword> =>
  sageRepository.upsertSavedKeyword({ organizationId, ...keyword }) as Promise<SavedKeyword>;

export const unsaveKeyword = (id: string, organizationId: string) =>
  sageRepository.deleteSavedKeyword(id, organizationId);
