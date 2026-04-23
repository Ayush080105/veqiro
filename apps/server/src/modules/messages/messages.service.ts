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
