import { Agent, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

export const ALL_AGENTS: Agent[] = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"];

export const AGENT_SLUG_TO_ENUM: Record<string, Agent> = {
  maya: "MAYA",
  sage: "SAGE",
  lex: "LEX",
  rex: "REX",
  scout: "SCOUT",
  vega: "VEGA",
};

const AGENT_ENV_KEYS: Record<Agent, string> = {
  MAYA: "AGENT_PRICE_MAYA_MONTHLY_CENTS",
  SAGE: "AGENT_PRICE_SAGE_MONTHLY_CENTS",
  LEX: "AGENT_PRICE_LEX_MONTHLY_CENTS",
  REX: "AGENT_PRICE_REX_MONTHLY_CENTS",
  SCOUT: "AGENT_PRICE_SCOUT_MONTHLY_CENTS",
  VEGA: "AGENT_PRICE_VEGA_MONTHLY_CENTS",
};

const DEFAULT_AGENT_MONTHLY_CENTS: Record<Agent, number> = {
  MAYA: 19 * 100,
  SAGE: 9 * 100,
  LEX: 9 * 100,
  REX: 9 * 100,
  SCOUT: 9 * 100,
  VEGA: 9 * 100,
};

function centsFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new BadRequestError(`invalid-price:${key}`);
  return value;
}

export function normalizeAgents(input: unknown): Agent[] {
  if (!Array.isArray(input)) throw new BadRequestError("agents-required");

  const normalized = input.map((agent) => {
    if (typeof agent !== "string") throw new BadRequestError("invalid-agent");
    const key = agent.trim().toLowerCase();
    const enumValue = AGENT_SLUG_TO_ENUM[key] ?? (ALL_AGENTS.includes(agent.toUpperCase() as Agent) ? agent.toUpperCase() as Agent : undefined);
    if (!enumValue || !ALL_AGENTS.includes(enumValue)) {
      throw new BadRequestError(`invalid-agent:${agent}`);
    }
    return enumValue;
  });

  return [...new Set(normalized)].sort((a, b) => ALL_AGENTS.indexOf(a) - ALL_AGENTS.indexOf(b));
}

export function normalizePlan(input: unknown): SubscriptionPlan {
  const value = typeof input === "string" ? input.toUpperCase() : "";
  if (value === "MONTHLY" || value === "ANNUAL") return value;
  throw new BadRequestError("invalid-billing-cadence");
}

export function getAgentMonthlyPriceCents(agent: Agent): number {
  return centsFromEnv(AGENT_ENV_KEYS[agent], DEFAULT_AGENT_MONTHLY_CENTS[agent]);
}

export const AGENT_PRODUCT_ENV_KEYS: Record<Agent, string> = {
  MAYA: "DODO_PRODUCT_AGENT_MAYA",
  SAGE: "DODO_PRODUCT_AGENT_SAGE",
  LEX: "DODO_PRODUCT_AGENT_LEX",
  REX: "DODO_PRODUCT_AGENT_REX",
  SCOUT: "DODO_PRODUCT_AGENT_SCOUT",
  VEGA: "DODO_PRODUCT_AGENT_VEGA",
};

export function agentProductId(agent: Agent): string {
  const value = process.env[AGENT_PRODUCT_ENV_KEYS[agent]];
  if (!value) throw new BadRequestError(`missing-product-id:${agent}`);
  return value;
}

/** One-time (non-recurring) product for a single $3-credit-unit Maya top-up purchase. */
export function mayaTopupUnitProductId(): string {
  const value = process.env.DODO_PRODUCT_MAYA_TOPUP_UNIT;
  if (!value) throw new BadRequestError("missing-product-id:MAYA_TOPUP");
  return value;
}

export function resolveAgentFromProductId(productId: string): Agent | null {
  if (!productId) return null;
  for (const agent of ALL_AGENTS) {
    if (process.env[AGENT_PRODUCT_ENV_KEYS[agent]] === productId) return agent;
  }
  return null;
}

