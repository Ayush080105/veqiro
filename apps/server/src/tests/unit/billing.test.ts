import { assert, describe, test } from "vitest";
import {
  deriveEntitlementFields,
  parseEntitlementModeMetadata,
  parsePlanMetadata,
  resolvePlan,
} from "../../modules/billing/billing.types.js";
import { sumAgentMonthlyPriceCents } from "../../modules/billing/billing.catalog.js";

describe("deriveEntitlementFields", () => {
  const trialEnd = new Date("2026-05-05");
  const periodEnd = new Date("2026-06-01");

  test("TRIALING → expires at trialEndsAt", () => {
    const r = deriveEntitlementFields({ status: "TRIALING", trialEndsAt: trialEnd, currentPeriodEnd: null });
    assert.equal(r.subscriptionStatus, "TRIALING");
    assert.equal(r.entitlementExpiresAt?.toISOString(), trialEnd.toISOString());
  });

  test("CANCELLED → expires at currentPeriodEnd", () => {
    const r = deriveEntitlementFields({ status: "CANCELLED", trialEndsAt: null, currentPeriodEnd: periodEnd });
    assert.equal(r.subscriptionStatus, "CANCELLED");
    assert.equal(r.entitlementExpiresAt?.toISOString(), periodEnd.toISOString());
  });

  test("ACTIVE → no expiry", () => {
    const r = deriveEntitlementFields({ status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: periodEnd });
    assert.equal(r.subscriptionStatus, "ACTIVE");
    assert.equal(r.entitlementExpiresAt, null);
  });

  test("PAST_DUE → no expiry", () => {
    const r = deriveEntitlementFields({ status: "PAST_DUE", trialEndsAt: null, currentPeriodEnd: periodEnd });
    assert.equal(r.subscriptionStatus, "PAST_DUE");
    assert.equal(r.entitlementExpiresAt, null);
  });

  test("EXPIRED → no expiry", () => {
    const r = deriveEntitlementFields({ status: "EXPIRED", trialEndsAt: null, currentPeriodEnd: null });
    assert.equal(r.subscriptionStatus, "EXPIRED");
    assert.equal(r.entitlementExpiresAt, null);
  });
});

describe("resolvePlan", () => {
  test("monthly product id → MONTHLY", () => {
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_m";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID  = "pdt_a";
    assert.equal(resolvePlan("pdt_m"), "MONTHLY");
  });

  test("annual product id → ANNUAL", () => {
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_m";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID  = "pdt_a";
    assert.equal(resolvePlan("pdt_a"), "ANNUAL");
  });

  test("unknown product id → null", () => {
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_m";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID  = "pdt_a";
    assert.equal(resolvePlan("pdt_xxx"), null);
  });
});

describe("billing metadata parsers", () => {
  test("parses checkout entitlement metadata", () => {
    assert.equal(parseEntitlementModeMetadata("CUSTOM"), "CUSTOM");
    assert.equal(parseEntitlementModeMetadata("CREW"), "CREW");
    assert.equal(parseEntitlementModeMetadata("custom"), null);
  });

  test("parses checkout plan metadata", () => {
    assert.equal(parsePlanMetadata("MONTHLY"), "MONTHLY");
    assert.equal(parsePlanMetadata("ANNUAL"), "ANNUAL");
    assert.equal(parsePlanMetadata("monthly"), null);
  });
});

describe("agent entitlement modes", () => {
  test("CUSTOM ACTIVE unlocks only selected agents", () => {
    const r = deriveEntitlementFields({
      status: "ACTIVE",
      trialEndsAt: null,
      currentPeriodEnd: null,
      entitlementMode: "CUSTOM",
      selectedAgents: ["MAYA"],
    });
    assert.deepEqual(r.unlockedAgents, ["MAYA"]);
  });

  test("CREW ACTIVE unlocks all agents", () => {
    const r = deriveEntitlementFields({
      status: "ACTIVE",
      trialEndsAt: null,
      currentPeriodEnd: null,
      entitlementMode: "CREW",
      selectedAgents: ["MAYA"],
    });
    assert.deepEqual(r.unlockedAgents, ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"]);
  });
});

describe("agent selection pricing", () => {
  test("defaults Maya to $19 and other agents to $9", () => {
    delete process.env.AGENT_PRICE_MAYA_MONTHLY_CENTS;
    delete process.env.AGENT_PRICE_SAGE_MONTHLY_CENTS;
    assert.equal(sumAgentMonthlyPriceCents(["MAYA", "SAGE"]), 2800);
  });
});
