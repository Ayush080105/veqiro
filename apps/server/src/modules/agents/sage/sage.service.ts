import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { aiService } from "../../../common/utils/aiService.js";
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
  SerpAnalysisInput,
  SerpAnalysisResponse,
  TopicalMapInput,
  TopicalMapResponse,
  MetaOptimizerInput,
  MetaOptimizerResponse,
  PageSeoAuditInput,
  PageSeoAuditResponse,
  DiscoverPagesInput,
  DiscoverPagesResponse,
  SiteAuditInput,
  SiteAuditResponse,
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
    conversationId: input.conversationId ?? userMessage.id,
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

  const assistantMessage = await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  return assistantMessage;
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
    tokensUsed: data.tokens_used,
    model: data.model_used,
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
    tokensUsed: data.tokens_used,
    model: data.model_used,
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
    tokensUsed: data.tokens_used,
    model: data.model_used,
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
    tokensUsed: data.tokens_used,
    model: data.model_used,
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
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "sage:generate-blog-ideas", input, result: data },
  });

  return data;
};

export const serpAnalysis = async (
  userId: string,
  organizationId: string,
  input: SerpAnalysisInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `SERP analysis: ${input.keyword}`,
    customInput: { actionId: "sage:serp-analysis", input },
  });

  const data = await callAgentWithContext<SerpAnalysisResponse>({
    agentApiPath: "/ai/sage/serp-analysis",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `SERP analysis: ${input.keyword}`,
    rawHistory: history,
    topLevelPayload: { keyword: input.keyword },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `SERP analysis for "${input.keyword}" — ${data.serp_features.length} features detected`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "sage:serp-analysis", input, result: data },
  });

  return data;
};

export const topicalMap = async (
  userId: string,
  organizationId: string,
  input: TopicalMapInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Topical map: ${input.mainTopic}`,
    customInput: { actionId: "sage:topical-map", input },
  });

  const data = await callAgentWithContext<TopicalMapResponse>({
    agentApiPath: "/ai/sage/topical-map",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Topical map: ${input.mainTopic}`,
    rawHistory: history,
    topLevelPayload: {
      main_topic: input.mainTopic,
      site_stage: input.siteStage,
      cluster_count: input.clusterCount,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Topical map for "${input.mainTopic}" — ${data.cluster_pages.length} cluster pages`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "sage:topical-map", input, result: data },
  });

  return data;
};

export const metaOptimizer = async (
  userId: string,
  organizationId: string,
  input: MetaOptimizerInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Meta optimizer: ${input.targetKeyword}`,
    customInput: { actionId: "sage:meta-optimizer", input },
  });

  const data = await callAgentWithContext<MetaOptimizerResponse>({
    agentApiPath: "/ai/sage/meta-optimizer",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Meta optimizer: ${input.targetKeyword}`,
    rawHistory: history,
    topLevelPayload: {
      target_keyword: input.targetKeyword,
      page_topic: input.pageTopic,
      existing_title: input.existingTitle,
      existing_description: input.existingDescription,
      brand_name: input.brandName,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Meta tags optimised for "${input.targetKeyword}"`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "sage:meta-optimizer", input, result: data },
  });

  return data;
};

export const pageSeoAudit = async (
  userId: string,
  organizationId: string,
  input: PageSeoAuditInput
) => {
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Page SEO audit: ${input.url}`,
    customInput: { actionId: "sage:page-seo-audit", input },
  });

  const data = await callAgentWithContext<PageSeoAuditResponse>({
    agentApiPath: "/ai/sage/page-audit",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Page SEO audit: ${input.url} — keyword: ${input.targetKeyword}`,
    rawHistory: history,
    topLevelPayload: {
      url: input.url,
      target_keyword: input.targetKeyword,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Page SEO audit for "${input.url}" — overall score: ${data.overall_score}/100`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "sage:page-seo-audit", input, result: data },
  });

  return data;
};

export const discoverPages = async (
  userId: string,
  organizationId: string,
  input: DiscoverPagesInput
): Promise<DiscoverPagesResponse> => {
  const { data } = await aiService.post<DiscoverPagesResponse>("/ai/sage/discover-pages", {
    domain: input.domain,
    user_id: userId,
    organization_id: organizationId,
  });
  return data;
};

export const siteAudit = async (
  userId: string,
  organizationId: string,
  input: SiteAuditInput
) => {
  const domain = new URL(input.urls[0]).hostname;
  const history = await sageRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await sageRepository.createUserMessage({
    organizationId,
    userId,
    content: `Batch SEO audit: ${input.urls.length} pages on ${domain}`,
    customInput: { actionId: "sage:site-audit", input },
  });

  const data = await callAgentWithContext<SiteAuditResponse>({
    agentApiPath: "/ai/sage/batch-page-audit",
    agentEnum: Agent.SAGE,
    agentRole: "Sage: SEO and content strategy assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Batch SEO audit: ${input.urls.length} pages — keyword: ${input.targetKeyword}`,
    rawHistory: history,
    topLevelPayload: {
      urls: input.urls,
      target_keyword: input.targetKeyword,
    },
  });

  await sageRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Batch SEO audit complete — ${data.total_audited} pages audited on ${data.domain}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "sage:site-audit", input, result: data },
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
