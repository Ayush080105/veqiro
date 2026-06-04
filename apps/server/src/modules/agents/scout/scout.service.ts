import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
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
  const history = await scoutRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/scout/chat",
    agentEnum: Agent.SCOUT,
    agentRole: "Scout: Competitive intelligence assistant",
    userId,
    organizationId,
    conversationId: userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  }) as AssistantMessagePayload;
  if (!responseData) {
    throw new BadRequestError("Failed to get response from AI");
  }

  const customInput =
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result }
      : undefined;

  await scoutRepository.createAssistantMessage({
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
    customInput: { actionId: "scout:research-topic", input },
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
    customInput: { actionId: "scout:research-topic", input, result: data },
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
    customInput: { actionId: "scout:research-company", input },
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
    customInput: { actionId: "scout:research-company", input, result: data },
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
    customInput: { actionId: "scout:trending-topics", input },
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
    customInput: { actionId: "scout:trending-topics", input, result: data },
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
    customInput: { actionId: "scout:discover-competitors", input },
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
    customInput: { actionId: "scout:discover-competitors", input, result: data },
  });

  return data;
};
