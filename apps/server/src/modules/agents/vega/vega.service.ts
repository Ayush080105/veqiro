import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import * as vegaRepository from "./vega.repository.js";
import type { SendMessageInput, AssistantMessagePayload } from "./vega.types.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await vegaRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });

  const responseData = (await callAgentWithContext({
    agentApiPath: "/ai/vega/chat",
    agentEnum: Agent.VEGA,
    agentRole: "Vega: Executive assistant for email and calendar management",
    userId,
    organizationId,
    conversationId: input.conversationId ?? userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  })) as AssistantMessagePayload;
  if (!responseData) throw new BadRequestError("Failed to get response from AI");

  const customInput =
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result }
      : undefined;

  const assistantMessage = await vegaRepository.createAssistantMessage({
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
) => vegaRepository.findAllVegaMessages(organizationId, opts);
