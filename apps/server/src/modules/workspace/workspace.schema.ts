import { z } from "zod";
import {
  Agent,
  HandoffStatus,
  InsightSeverity,
  InsightStatus,
  WorkObjectStatus,
} from "../../../prisma/generated/prisma/client.js";

/**
 * The workspace routes are mounted under /workspace/:agent, so the agent
 * arrives as a lowercase URL slug ("lex") and has to become an Agent enum
 * ("LEX"). Doing that here means the middleware, the controller and the
 * services all agree on one spelling.
 */
export const AGENT_SLUGS = ["maya", "rex", "scout", "sage", "lex", "vega"] as const;
export type AgentSlug = (typeof AGENT_SLUGS)[number];

export const AGENT_BY_SLUG: Record<AgentSlug, Agent> = {
  maya: Agent.MAYA,
  rex: Agent.REX,
  scout: Agent.SCOUT,
  sage: Agent.SAGE,
  lex: Agent.LEX,
  vega: Agent.VEGA,
};

export const agentSlugParamSchema = z.object({
  agent: z.enum(AGENT_SLUGS),
});

export const activityQuerySchema = z.object({
  verb: z.string().min(1).optional(),
  objectKind: z.string().min(1).optional(),
  objectId: z.string().min(1).optional(),
  cursor: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const insightsQuerySchema = z.object({
  status: z.nativeEnum(InsightStatus).optional(),
  severity: z.nativeEnum(InsightSeverity).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const insightStatusBodySchema = z.object({
  status: z.nativeEnum(InsightStatus),
});

export const insightIdParamSchema = z.object({ id: z.string().min(1) });

export const workQuerySchema = z.object({
  kind: z.string().min(1).optional(),
  status: z.nativeEnum(WorkObjectStatus).optional(),
  q: z.string().min(1).max(200).optional(),
  cursor: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const handoffsQuerySchema = z.object({
  direction: z.enum(["in", "out"]).default("in"),
  status: z.nativeEnum(HandoffStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const createHandoffBodySchema = z.object({
  fromAgent: z.nativeEnum(Agent).optional(),
  toAgent: z.nativeEnum(Agent),
  requestedActionId: z.string().min(1).optional(),
  requestedArgs: z.record(z.string(), z.unknown()).optional(),
  note: z.string().max(2000).optional(),
  objectKind: z.string().min(1).optional(),
  objectId: z.string().min(1).optional(),
  sourceMessageId: z.string().min(1).optional(),
  dueAt: z.coerce.date().optional(),
});

export const handoffIdParamSchema = z.object({ id: z.string().min(1) });

export const reindexBodySchema = z.object({
  kind: z.string().min(1),
  /** Omit to reindex every organization — slow, and normally not what you want. */
  organizationId: z.string().min(1).optional(),
});

export const memoryItemIdParamSchema = z.object({ id: z.string().min(1) });

/** At least one of the two must be present, or the request does nothing. */
export const memoryItemBodySchema = z
  .object({
    confirmed: z.boolean().optional(),
    retired: z.boolean().optional(),
  })
  .refine((body) => body.confirmed !== undefined || body.retired !== undefined, {
    message: "Provide confirmed or retired",
  });
