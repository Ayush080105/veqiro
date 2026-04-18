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
  ScanCompetitorsInput,
  CompetitorScanResponse,
  TrendingTopicsInput,
  TrendingTopicsResponse,
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
    content: `Research complete (${data.sources_scraped.length} sources, ${data.keywords_found.length} keywords)`,
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
    content: `Profile: ${data.company.funding}, ${data.company.team_size}`,
    customInput: { tool: "research-company", output: data },
  });

  return data;
};

// TODO: switch lastScanHash to server-side state.
//   Add a CompetitorScan model keyed by (organizationId, url) storing name + hash + lastScannedAt.
//   Drop lastScanHash from the request schema, auto-populate it server-side before calling AI,
//   and persist the returned new_hash on the row. Also consider storing last scraped content
//   so the AI's diff_content() gets a real old/new pair (current bug: it diffs hash vs content).
export const scanCompetitors = async (
  userId: string,
  organizationId: string,
  input: ScanCompetitorsInput
) => {
  await scoutRepository.createUserMessage({
    organizationId,
    userId,
    content: `Competitor scan: ${input.competitors.length} sites`,
    customInput: { tool: "scan-competitors", input },
  });

  const { data } = await aiService.post<CompetitorScanResponse>(
    "/ai/scout/scan-competitors",
    {
      user_id: userId,
      organization_id: organizationId,
      competitors: input.competitors.map((c) => ({
        name: c.name,
        url: c.url,
        last_scan_hash: c.lastScanHash,
      })),
    }
  );

  const changedCount = data.results.filter((r) => r.has_changes).length;
  await scoutRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${changedCount} of ${data.results.length} competitors have changes`,
    customInput: { tool: "scan-competitors", output: data },
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
