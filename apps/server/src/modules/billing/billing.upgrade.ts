import { SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";
import { getCrewPriceCents } from "./billing.catalog.js";

export type UpgradeIneligibleReason =
  | "credit-exceeds-crew-price"
  | "no-agents-owned"
  | "already-on-crew";

export type UpgradeQuote =
  | { eligible: true;  creditCents: number; payNowCents: number; discountBasisPoints: number }
  | { eligible: false; creditCents: number; reason: UpgradeIneligibleReason };

/**
 * Prices a Crew upgrade for an org that already owns individual agents.
 *
 * Credit is the FULL list price paid for each owned agent, not its unused
 * portion — a deliberate, spec'd trade-off (upgrading on day 29 still credits
 * the whole agent). See the spec's "Accepted trade-off".
 *
 * Dodo supports percentage discounts only (UNSUPPORTED_DISCOUNT_TYPE for flat
 * amounts), so the credit is expressed as basis points of the Crew price and
 * applied with subscription_cycles=1 so only the first cycle is discounted.
 */
export function quoteCrewUpgrade(
  ownedPriceCents: number[],
  plan: SubscriptionPlan,
): UpgradeQuote {
  const creditCents = ownedPriceCents.reduce((sum, cents) => sum + cents, 0);
  if (creditCents <= 0) return { eligible: false, creditCents: 0, reason: "no-agents-owned" };

  const crewCents = getCrewPriceCents(plan);
  // >= not > : a credit equal to the Crew price would mean a $0 charge, which
  // Dodo rejects (minimum subscription price is $1) and which we would not
  // refund anyway.
  if (creditCents >= crewCents) {
    return { eligible: false, creditCents, reason: "credit-exceeds-crew-price" };
  }

  const discountBasisPoints = Math.round((creditCents / crewCents) * 10000);
  // Mirror Dodo's own arithmetic rather than using (crew - credit) directly, so
  // payNowCents is exactly what the customer will be charged — including any
  // sub-cent drift introduced by quantising the credit to basis points.
  const appliedDiscountCents = Math.round((crewCents * discountBasisPoints) / 10000);
  const payNowCents = crewCents - appliedDiscountCents;

  return { eligible: true, creditCents, payNowCents, discountBasisPoints };
}
