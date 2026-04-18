import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
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
} from "./sage.types.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const userMessage = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const history = await sageRepository.findRecentMessages(
    organizationId,
    SAGE_HISTORY_LIMIT
  );
  const response = await aiService.post<AssistantMessagePayload>("/ai/sage/chat", {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
  });
  if (!response.data) {
    throw new BadRequestError("Failed to get response ");
  }

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: response.data.response,
    imageUrl: response.data.image?.url,
    tokensUsed: response.data.tokens_used,
    model: response.data.model_used,
  });

  return {
    role: "assistant" as const,
    content: response.data.response,
    imageUrl: response.data.image?.url,
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
  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Keyword research: ${input.seedTopic}`,
    customInput: { tool: "keyword-research", input },
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
    }
  );

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.keywords.length} keywords in ${data.clusters.length} clusters`,
    customInput: { tool: "keyword-research", output: data },
  });

  return data;
};

export const generateBlog = async (
  userId: string,
  organizationId: string,
  input: GenerateBlogInput
) => {
  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Blog: ${input.topic}`,
    customInput: { tool: "generate-blog", input },
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
    }
  );

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Generated ${data.blog.word_count}-word post (SEO score ${data.seo_score})`,
    customInput: { tool: "generate-blog", output: data },
  });

  return data;
};

export const analyzeContent = async (
  userId: string,
  organizationId: string,
  input: AnalyzeContentInput
) => {
  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Content analysis: ${input.targetKeyword}`,
    customInput: { tool: "analyze-content", input },
  });

  const { data } = await aiService.post<ContentAnalysisResponse>(
    "/ai/sage/analyze-content",
    {
      user_id: userId,
      organization_id: organizationId,
      content: input.content,
      target_keyword: input.targetKeyword,
      url: input.url,
    }
  );

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `SEO score ${data.score}`,
    customInput: { tool: "analyze-content", output: data },
  });

  return data;
};

export const contentBrief = async (
  userId: string,
  organizationId: string,
  input: ContentBriefInput
) => {
  await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Content brief: ${input.topic}`,
    customInput: { tool: "content-brief", input },
  });

  const { data } = await aiService.post<ContentBriefResponse>(
    "/ai/sage/content-brief",
    {
      user_id: userId,
      organization_id: organizationId,
      topic: input.topic,
      target_keyword: input.targetKeyword,
      competitor_urls: input.competitorUrls,
    }
  );

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Brief generated for "${input.targetKeyword}"`,
    customInput: { tool: "content-brief", output: data },
  });

  return data;
};
