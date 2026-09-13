import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import {
  callAgentWithContext,
  streamAgentWithContext,
  type SseEvent,
} from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import * as vegaRepository from "./vega.repository.js";
import * as mcpService from "../../mcp/mcp.service.js";
import type { SendMessageInput, AssistantMessagePayload } from "./vega.types.js";
import { maybeStartPlannedRun } from "../../agent-runs/agent-runs.planner.js";

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

  // A multi-step request becomes a planned run the user approves as a
  // graph. Returns null for everything else, including any failure, so
  // the normal single-pass path below stays the default.
  const plannedRun = await maybeStartPlannedRun({
    organizationId,
    userId,
    agent: Agent.VEGA,
    content: input.content,
  });
  if (plannedRun) return plannedRun;

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

  const pendingActions = mcpService.readPendingActions(responseData)
  const pendingActionsSnapshot = pendingActions?.length ? mcpService.toPendingActionsSnapshot(pendingActions) : undefined

  const customInput = mcpService.withToolTrace(
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result, pendingActions: pendingActionsSnapshot }
      : pendingActionsSnapshot
        ? { pendingActions: pendingActionsSnapshot }
        : undefined,
    responseData.tool_trace,
  );

  const assistantMessage = await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  if (pendingActions?.length) {
    await mcpService.stagePendingActions({
      organizationId,
      userId,
      agent: Agent.VEGA,
      messageId: assistantMessage.id,
      pendingActions,
    });
  }

  return assistantMessage;
};

/** Streaming sibling of `sendMessage` — see lex.service.ts's streamMessage
 * for the shape of this pattern and why persistence happens after the loop. */
export async function* streamMessage(
  userId: string,
  organizationId: string,
  input: SendMessageInput
): AsyncGenerator<SseEvent, void, unknown> {
  const history = await vegaRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });

  const plannedRun = await maybeStartPlannedRun({
    organizationId,
    userId,
    agent: Agent.VEGA,
    content: input.content,
  });
  if (plannedRun) {
    yield { event: "plan_started", data: JSON.stringify(plannedRun) };
    return;
  }

  const iterator = streamAgentWithContext({
    agentApiPath: "/ai/vega/chat",
    agentEnum: Agent.VEGA,
    agentRole: "Vega: Executive assistant for email and calendar management",
    userId,
    organizationId,
    conversationId: input.conversationId ?? userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  });

  let step: IteratorResult<SseEvent, AssistantMessagePayload | null>;
  // eslint-disable-next-line no-cond-assign
  while (!(step = (await iterator.next()) as IteratorResult<SseEvent, AssistantMessagePayload | null>).done) {
    yield step.value;
  }
  const responseData = step.value;
  if (!responseData) return;

  const pendingActions = mcpService.readPendingActions(responseData)
  const pendingActionsSnapshot = pendingActions?.length ? mcpService.toPendingActionsSnapshot(pendingActions) : undefined

  const customInput = mcpService.withToolTrace(
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result, pendingActions: pendingActionsSnapshot }
      : pendingActionsSnapshot
        ? { pendingActions: pendingActionsSnapshot }
        : undefined,
    responseData.tool_trace,
  );

  const assistantMessage = await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  if (pendingActions?.length) {
    await mcpService.stagePendingActions({
      organizationId,
      userId,
      agent: Agent.VEGA,
      messageId: assistantMessage.id,
      pendingActions,
    });
  }

  yield { event: "persisted", data: JSON.stringify(assistantMessage) };
}

export const listMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => vegaRepository.findAllVegaMessages(organizationId, opts);
