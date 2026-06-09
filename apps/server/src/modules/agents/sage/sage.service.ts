import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
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
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Keyword research: ${input.seedTopic}`,
    customInput: { actionId: "sage:keyword-research", input },
  });

  const data = await callAgentWithContext<KeywordResearchResponse>({
    agentApiPath: "/ai/sage/keyword-research",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Keyword research: ${input.seedTopic}`,
    rawHistory: history,
    topLevelPayload: {
      seed_topic: input.seedTopic,
      niche: input.niche,
      competitor_urls: input.competitorUrls,
      count: input.count,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.keywords.length} keywords in ${data.clusters.length} clusters`,
    customInput: { actionId: "sage:keyword-research", input, result: data },
  });

  return data;
};

export const generateBlog = async (
  userId: string,
  organizationId: string,
  input: GenerateBlogInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Blog: ${input.topic}`,
    customInput: { actionId: "sage:generate-blog", input },
  });

  const data = await callAgentWithContext<GenerateBlogResponse>({
    agentApiPath: "/ai/sage/generate-blog",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Blog: ${input.topic}`,
    rawHistory: history,
    topLevelPayload: {
      topic: input.topic,
      target_keyword: input.targetKeyword,
      secondary_keywords: input.secondaryKeywords,
      word_count: input.wordCount,
      output_format: input.outputFormat,
      include_meta: input.includeMeta,
      include_schema_markup: input.includeSchemaMarkup,
      tone_override: input.toneOverride,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Generated ${data.blog.word_count}-word post (SEO score ${data.seo_score})`,
    customInput: { actionId: "sage:generate-blog", input, result: data },
  });

  return data;
};

export const analyzeContent = async (
  userId: string,
  organizationId: string,
  input: AnalyzeContentInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Content analysis: ${input.targetKeyword}`,
    customInput: { actionId: "sage:analyze-content", input },
  });

  const data = await callAgentWithContext<ContentAnalysisResponse>({
    agentApiPath: "/ai/sage/analyze-content",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Content analysis: ${input.targetKeyword}`,
    rawHistory: history,
    topLevelPayload: {
      content: input.content,
      target_keyword: input.targetKeyword,
      url: input.url,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `SEO score ${data.score}`,
    customInput: { actionId: "sage:analyze-content", input, result: data },
  });

  return data;
};

export const contentBrief = async (
  userId: string,
  organizationId: string,
  input: ContentBriefInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Content brief: ${input.topic}`,
    customInput: { actionId: "sage:content-brief", input },
  });

  const data = await callAgentWithContext<ContentBriefResponse>({
    agentApiPath: "/ai/sage/content-brief",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Content brief: ${input.topic}`,
    rawHistory: history,
    topLevelPayload: {
      topic: input.topic,
      target_keyword: input.targetKeyword,
      competitor_urls: input.competitorUrls,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Brief generated for "${input.targetKeyword}"`,
    customInput: { actionId: "sage:content-brief", input, result: data },
  });

  return data;
};

export const generateBlogIdeas = async (
  userId: string,
  organizationId: string,
  input: GenerateBlogIdeasInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Blog ideas: ${input.count} ideas`,
    customInput: { actionId: "sage:generate-blog-ideas", input },
  });

  const data = await callAgentWithContext<GenerateBlogIdeasResponse>({
    agentApiPath: "/ai/sage/generate-blog-ideas",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Blog ideas: ${input.count} ideas`,
    rawHistory: history,
    topLevelPayload: { count: input.count },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Generated ${data.ideas.length} blog ideas`,
    customInput: { actionId: "sage:generate-blog-ideas", input, result: data },
  });

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
