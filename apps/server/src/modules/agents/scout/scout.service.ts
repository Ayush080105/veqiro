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
    conversationId: input.conversationId ?? userMessage.id,
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

  const assistantMessage = await scoutRepository.createAssistantMessage({
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

export const listMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => scoutRepository.findAllScoutMessages(organizationId, opts);

export const researchTopic = async (
  userId: string,
  organizationId: string,
  input: ResearchTopicInput
) => {
  const history = await scoutRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Research topic: ${input.topic} (depth: ${input.depth}, location: ${input.location ?? "global"})`,
    customInput: { actionId: "scout:research-topic", input },
  });

  const data = await callAgentWithContext<ResearchTopicResponse>({
    agentApiPath: "/ai/scout/research-topic",
    agentEnum: Agent.SCOUT,
    agentRole: "Scout: Competitive intelligence assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Research topic: ${input.topic}`,
    rawHistory: history,
    topLevelPayload: {
      topic: input.topic,
      depth: input.depth,
      sources_hint: input.sourcesHint,
      location: input.location ?? "",
    },
  });

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Research complete: ${input.topic} (${data.sources_scraped?.length ?? 0} sources)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "scout:research-topic", input, result: data },
  });

  return data;
};

export const researchCompany = async (
  userId: string,
  organizationId: string,
  input: ResearchCompanyInput
) => {
  const history = await scoutRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Research company: ${input.companyName} (${input.companyUrl??"" })`,
    customInput: { actionId: "scout:research-company", input },
  });

  const data = await callAgentWithContext<ResearchCompanyResponse>({
    agentApiPath: "/ai/scout/research-company",
    agentEnum: Agent.SCOUT,
    agentRole: "Scout: Competitive intelligence assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Research company: ${input.companyName}`,
    rawHistory: history,
    topLevelPayload: {
      company_name: input.companyName,
      company_url: input.companyUrl,
    },
  });

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Research complete: ${data.company.name} `,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "scout:research-company", input, result: data },
  });

  return data;
};

export const trendingTopics = async (
  userId: string,
  organizationId: string,
  input: TrendingTopicsInput
) => {
  const history = await scoutRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Trends in ${input.industry} ${input.location ? `in ${input.location}` : ""}, Count: ${input.count}`,
    customInput: { actionId: "scout:trending-topics", input },
  });

  const data = await callAgentWithContext<TrendingTopicsResponse>({
    agentApiPath: "/ai/scout/trending-topics",
    agentEnum: Agent.SCOUT,
    agentRole: "Scout: Competitive intelligence assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Trends in ${input.industry}`,
    rawHistory: history,
    topLevelPayload: {
      industry: input.industry,
      count: input.count,
      location: input.location ?? "",
    },
  });

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Trending topics identified: ${data.trends.length} trends in ${input.industry} ${input.location ? `in ${input.location}` : ""}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "scout:trending-topics", input, result: data },
  });

  return data;
};


export const discoverCompetitors = async (
  userId: string,
  organizationId: string,
  input: DiscoverCompetitorsInput
): Promise<DiscoverCompetitorsResponse> => {
  const history = await scoutRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Discover competitors: ${input.industry}`,
    customInput: { actionId: "scout:discover-competitors", input },
  });

  const data = await callAgentWithContext<DiscoverCompetitorsResponse>({
    agentApiPath: "/ai/scout/discover-competitors",
    agentEnum: Agent.SCOUT,
    agentRole: "Scout: Competitive intelligence assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Discover competitors: ${input.industry}`,
    rawHistory: history,
    topLevelPayload: {
      description: input.description,
      industry: input.industry,
      count: input.count,
      location: input.location ?? "",
    },
  });

  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Competitor discovery complete: ${data.competitors.length} competitors found in ${input.industry} ${input.location ? `in ${input.location}` : ""}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "scout:discover-competitors", input, result: data },
  });

  return data;
};
