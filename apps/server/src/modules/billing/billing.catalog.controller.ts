import { Request, Response } from "express";
import { ALL_AGENTS, getAgentMonthlyPriceCents, getCrewPriceCents } from "./billing.catalog.js";

export function buildCatalogPayload() {
  const agents = Object.fromEntries(
    ALL_AGENTS.map((agent) => [agent, { priceCents: getAgentMonthlyPriceCents(agent) }]),
  );

  return {
    agents,
    crew: {
      monthly: { priceCents: getCrewPriceCents("MONTHLY") },
      annual: { priceCents: getCrewPriceCents("ANNUAL") },
    },
    currency: "USD",
  };
}

/** Public, unauthenticated — apps/landing and apps/main both read real prices from here. */
export function getBillingCatalog(_req: Request, res: Response) {
  res.status(200).json(buildCatalogPayload());
}
