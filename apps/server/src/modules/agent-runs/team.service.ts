import { prisma } from "../../config/prisma.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { Agent, Prisma } from "../../../prisma/generated/prisma/client.js";
import { getEntitledAgents } from "../billing/entitlement.service.js";
import { maybeStartPlannedRun, lastSkipReason } from "./agent-runs.planner.js";
import { callAgentWithContext, agentRoles } from "../../common/utils/contextService.js";
import { aiService } from "../../common/utils/aiService.js";
import * as mcpService from "../mcp/mcp.service.js";
import { CONTEXT_HISTORY_LIMIT } from "../../config/constants.js";

/**
 * The shared team thread.
 *
 * One room containing exactly the agents the org is entitled to, working the
 * union of those agents' connected integrations. Deliberately not a separate
 * product: capability scales with how many agents you already own, so there is
 * no team tier to price and no way to reach an agent you have not bought.
 *
 * Messages live in the existing `message` table behind `isTeam`, so the room
 * inherits history, pagination and the chat UI for free.
 */

/** Whoever leads the room — used as the run's nominal agent and for avatars. */
const LEAD_PRIORITY: Agent[] = [
  Agent.VEGA,   // exec assistant: the natural chair
  Agent.MAYA,
  Agent.SAGE,
  Agent.REX,
  Agent.SCOUT,
  Agent.LEX,
];

const pickLead = (entitled: Agent[]): Agent | null => {
  const owned = new Set(entitled);
  return LEAD_PRIORITY.find((a) => owned.has(a)) ?? entitled[0] ?? null;
};

export const getTeamMembers = async (organizationId: string) => {
  const entitled = await getEntitledAgents(organizationId);
  return {
    agents: LEAD_PRIORITY.filter((a) => entitled.includes(a)),
    lead: pickLead(entitled),
  };
};

export const getMessages = (organizationId: string, limit = CONTEXT_HISTORY_LIMIT, before?: string) =>
  prisma.message.findMany({
    where: {
      organizationId,
      isTeam: true,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

export const sendMessage = async (
  userId: string,
  organizationId: string,
  content: string,
) => {
  const { agents, lead } = await getTeamMembers(organizationId);
  if (!lead) {
    throw new BadRequestError("No agents on this plan yet — hire one to use the team room");
  }
  await prisma.message.create({
    data: { organizationId, userId, agent: lead, role: "user", content, isTeam: true },
  });

  const planned = await maybeStartPlannedRun({
    organizationId,
    userId,
    agent: lead,
    content,
    team: true,
  });
  if (planned) return planned;

  // Single-step work still gets done here. The room is the general entry
  // point, not a multi-step-only surface — sending the user to another chat
  // for "just check my inbox" would make it a worse version of the six.
  if (lastSkipReason === "error") {
    return prisma.message.create({
      data: {
        organizationId,
        userId,
        agent: lead,
        role: "assistant",
        isTeam: true,
        content:
          "I couldn't work out a plan for that just now — something went wrong on " +
          "my side rather than with your request. Try again in a moment.",
      },
    });
  }

  return answerAsOneAgent({ organizationId, userId, content, agents, lead });
};

/**
 * Route a single-step request to whichever agent fits and answer inline.
 *
 * Uses the existing intent classifier, then constrains the result to agents
 * the org actually has — the classifier knows nothing about entitlements.
 */
const answerAsOneAgent = async (opts: {
  organizationId: string;
  userId: string;
  content: string;
  agents: Agent[];
  lead: Agent;
}) => {
  const { organizationId, userId, content, agents, lead } = opts;
  const chosen = (await classifyAgent(content, agents)) ?? lead;

  const history = await prisma.message.findMany({
    where: { organizationId, isTeam: true },
    orderBy: { createdAt: "desc" },
    take: CONTEXT_HISTORY_LIMIT,
  });

  const responseData = await callAgentWithContext({
    agentApiPath: `/ai/${chosen.toLowerCase()}/chat`,
    agentEnum: chosen,
    agentRole: agentRoles[chosen],
    userId,
    organizationId,
    // Synthetic, like every other caller — it is never persisted.
    conversationId: `team-${organizationId}`,
    userMessage: content,
    rawHistory: history,
  });

  const pendingActions = mcpService.readPendingActions(responseData);
  const snapshot = pendingActions.length
    ? mcpService.toPendingActionsSnapshot(pendingActions)
    : undefined;

  const message = await prisma.message.create({
    data: {
      organizationId,
      userId,
      agent: chosen,
      role: "assistant",
      isTeam: true,
      content: responseData.response,
      tokensUsed: responseData.tokens_used ?? 0,
      model: responseData.model_used,
      customInput: mcpService.withToolTrace(
        responseData.action_id && responseData.action_result
          ? {
              actionId: responseData.action_id,
              input: {},
              result: responseData.action_result,
              pendingActions: snapshot,
            }
          : snapshot
            ? { pendingActions: snapshot }
            : undefined,
        responseData.tool_trace,
      ) as Prisma.InputJsonValue | undefined,
    },
  });

  if (pendingActions.length) {
    await mcpService.stagePendingActions({
      organizationId,
      userId,
      agent: chosen,
      messageId: message.id,
      pendingActions,
    });
  }

  return message;
};

/** Cheap intent routing, clamped to the agents in the room. */
const classifyAgent = async (message: string, allowed: Agent[]): Promise<Agent | null> => {
  try {
    const { data } = await aiService.post<{ agent_slug?: string }>(
      "/ai/router/classify",
      { message },
      { timeout: 15_000 },
    );
    const slug = data?.agent_slug?.toUpperCase();
    const match = allowed.find((a) => a === slug);
    return match ?? null;
  } catch {
    // Routing is an optimisation; the lead can always take the message.
    return null;
  }
};
