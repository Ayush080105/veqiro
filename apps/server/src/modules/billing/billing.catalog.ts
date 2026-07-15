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

function optionalCentsFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return fallback;
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

export function isCrewSelection(agents: Agent[]) {
  return agents.length === ALL_AGENTS.length && ALL_AGENTS.every((agent) => agents.includes(agent));
}

export function getCrewPriceCents(plan: SubscriptionPlan): number {
  if (plan === "ANNUAL") {
    return optionalCentsFromEnv("CREW_ANNUAL_CENTS", 29 * 12 * 100);
  }
  return optionalCentsFromEnv("CREW_MONTHLY_CENTS", 39 * 100);
}

export function getAgentMonthlyPriceCents(agent: Agent): number {
  return centsFromEnv(AGENT_ENV_KEYS[agent], DEFAULT_AGENT_MONTHLY_CENTS[agent]);
}

const AGENT_PRODUCT_ENV_KEYS: Record<Agent, string> = {
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

export function crewProductId(plan: SubscriptionPlan): string {
  const key = plan === "ANNUAL" ? "DODO_PRODUCT_CREW_ANNUAL" : "DODO_PRODUCT_CREW_MONTHLY";
  const value = process.env[key];
  if (!value) throw new BadRequestError(`missing-product-id:CREW_${plan}`);
  return value;
}

export function resolveAgentFromProductId(productId: string): Agent | null {
  for (const agent of ALL_AGENTS) {
    if (process.env[AGENT_PRODUCT_ENV_KEYS[agent]] === productId) return agent;
  }
  return null;
}

export function resolveCrewPlanFromProductId(productId: string): SubscriptionPlan | null {
  if (productId && productId === process.env.DODO_PRODUCT_CREW_MONTHLY) return "MONTHLY";
  if (productId && productId === process.env.DODO_PRODUCT_CREW_ANNUAL) return "ANNUAL";
  return null;
}

/**
 * Sum of monthly list prices for a set of agents. Individual agents are
 * MONTHLY-only by design, so there is no cadence argument to get wrong.
 *
 * Transitional: this exists only to keep the current quantity-hack call site
 * compiling until Task 5.1 replaces it with real per-agent products. Phase 12
 * deletes it.
 */
export function sumAgentMonthlyPriceCents(agents: Agent[]): number {
  return agents.reduce((sum, agent) => sum + getAgentMonthlyPriceCents(agent), 0);
}
