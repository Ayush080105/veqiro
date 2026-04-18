import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
import * as sageRepository from "./sage.repository.js";
import type { SendMessageInput, AssistantMessagePayload } from "./sage.types.js";

export const sendMessage = async (input: SendMessageInput) => {
  const userMessage = await sageRepository.createUserMessage(
    input.organizationId,
    input.content
  );

  const history = await sageRepository.findRecentMessages(
    input.organizationId,
    SAGE_HISTORY_LIMIT
  );

  const response = await aiService.post<AssistantMessagePayload>("/ai/sage/chat", {
    user_id: input.organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
  });

  if (!response.data) {
    throw new BadRequestError("Failed to get response from AI");
  }

  await sageRepository.createAssistantMessage({
    organizationId: input.organizationId,
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
