import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
import * as scoutRepository from "./scout.repository.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  ResearchTopicInput,
  ResearchTopicResponse,
  ResearchCompanyInput,
  ResearchCompanyResponse,
  TrendingTopicsInput,
  TrendingTopicsResponse,
  AddCompetitorInput,
  CompetitorWatch,
  DiscoverCompetitorsInput,
  DiscoverCompetitorsResponse,
} from "./scout.types.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const userMessage = await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const history = await scoutRepository.findRecentMessages(
    organizationId,
    SAGE_HISTORY_LIMIT
  );
  const response = await aiService.post<AssistantMessagePayload>("/ai/scout/chat", {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
  });
  if (!response.data) {
    throw new BadRequestError("Failed to get response from AI");
  }

  await scoutRepository.createAssistantMessage({
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
  scoutRepository.findAllScoutMessages(organizationId);

export const researchTopic = async (
  userId: string,
  organizationId: string,
  input: ResearchTopicInput
) => {
  await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Research topic: ${input.topic}`,
    customInput: { tool: "research-topic", input },
  });

  const { data } = await aiService.post<ResearchTopicResponse>(
    "/ai/scout/research-topic",
    {
      user_id: userId,
      organization_id: organizationId,
      topic: input.topic,
      depth: input.depth,
      sources_hint: input.sourcesHint,
    }
  );

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Research complete: ${input.topic} (${data.sources_scraped?.length ?? 0} sources)`,
    customInput: { tool: "research-topic", output: data },
  });

  return data;
};

export const researchCompany = async (
  userId: string,
  organizationId: string,
  input: ResearchCompanyInput
) => {
  await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Research company: ${input.companyName}`,
    customInput: { tool: "research-company", input },
  });

  const { data } = await aiService.post<ResearchCompanyResponse>(
    "/ai/scout/research-company",
    {
      user_id: userId,
      organization_id: organizationId,
      company_name: input.companyName,
      company_url: input.companyUrl,
    }
  );

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Company profile: ${input.companyName}`,
    customInput: { tool: "research-company", output: data },
  });

  return data;
};

export const trendingTopics = async (
  userId: string,
  organizationId: string,
  input: TrendingTopicsInput
) => {
  await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Trends in ${input.industry}`,
    customInput: { tool: "trending-topics", input },
  });

  const { data } = await aiService.post<TrendingTopicsResponse>(
    "/ai/scout/trending-topics",
    {
      user_id: userId,
      organization_id: organizationId,
      industry: input.industry,
      count: input.count,
    }
  );

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.trends.length} trends identified`,
    customInput: { tool: "trending-topics", output: data },
  });

  return data;
};

// ── Competitor Watchlist ──────────────────────────────────────────────────────

export const listCompetitors = (organizationId: string): Promise<CompetitorWatch[]> =>
  scoutRepository.findCompetitorWatches(organizationId) as unknown as Promise<CompetitorWatch[]>;

export const addCompetitor = async (
  organizationId: string,
  input: AddCompetitorInput
): Promise<CompetitorWatch> => {
  const record = await scoutRepository.upsertCompetitorWatch({
    organizationId,
    name: input.name,
    url: input.url,
  });
  return record as unknown as CompetitorWatch;
};

export const removeCompetitor = async (id: string, organizationId: string): Promise<void> => {
  await scoutRepository.deleteCompetitorWatch(id, organizationId);
};

export const discoverCompetitors = async (
  userId: string,
  organizationId: string,
  input: DiscoverCompetitorsInput
): Promise<DiscoverCompetitorsResponse> => {
  await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Discover competitors: ${input.industry}`,
    customInput: { tool: "discover-competitors", input },
  });

  const { data } = await aiService.post<DiscoverCompetitorsResponse>(
    "/ai/scout/discover-competitors",
    {
      user_id: userId,
      organization_id: organizationId,
      description: input.description,
      industry: input.industry,
      count: input.count,
    }
  );

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Found ${data.competitors.length} competitor${data.competitors.length !== 1 ? "s" : ""} in ${input.industry}`,
    customInput: { tool: "discover-competitors", output: data },
  });

  return data;
};
