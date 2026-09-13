import { Agent } from "../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import * as repo from "./messages.repository.js";

export type AgentSlug = "maya" | "rex" | "scout" | "sage" | "lex" | "vega";

export type LastMessage = {
  content: string;
  createdAt: string;
  role: string;
};

const EMPTY: Record<AgentSlug, LastMessage | null> = {
  maya: null,
  rex: null,
  scout: null,
  sage: null,
  lex: null,
  vega: null,
};

export const getLastMessages = async (organizationId: string) => {
  const rows = await repo.findLastMessagePerAgent(organizationId);
  const result = { ...EMPTY };
  for (const r of rows) {
    const slug = r.agent.toLowerCase() as AgentSlug;
    if (slug in result) {
      result[slug] = {
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        role: r.role,
      };
    }
  }
  return result;
};

const AGENT_SLUGS = new Set<AgentSlug>(["maya", "rex", "scout", "sage", "lex", "vega"]);

export function parseAgentSlug(value: unknown): Agent {
  if (typeof value !== "string" || !AGENT_SLUGS.has(value as AgentSlug)) {
    throw new BadRequestError("Unknown or missing agent");
  }
  return value.toUpperCase() as Agent;
}

export const togglePin = async (id: string, organizationId: string, pinned: boolean) => {
  const owned = await repo.findMessageForOrg(id, organizationId);
  if (!owned) throw new NotFoundError("Message not found");
  return repo.setPinned(id, pinned);
};

export const listPinnedMessages = (organizationId: string, agent: Agent) =>
  repo.findPinnedMessages(organizationId, agent);

export const searchMessages = (organizationId: string, agent: Agent, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return Promise.resolve([]);
  return repo.searchMessages(organizationId, agent, trimmed);
};
