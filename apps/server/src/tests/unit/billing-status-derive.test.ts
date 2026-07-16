import { assert, describe, test, vi } from "vitest";

// billing.controller.ts imports billing.service.ts at module scope, which
// imports lib/auth.ts (pulls in the mailer -> Resend chain, crashes without
// RESEND_API_KEY) and lib/dodo.ts (constructs a DodoPayments client, crashes
// without DODO_PAYMENTS_API_KEY). Mock both out the same way
// billing-checkout-guards.test.ts does, since this test only exercises the
// pure deriveStatusFields helper.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));
vi.mock("../../lib/dodo.js", () => ({ dodoClient: {} }));
vi.mock("../../config/prisma.js", () => ({ prisma: {} }));

const { deriveStatusFields } = await import("../../modules/billing/billing.controller.js");

const ent = (
  agent: string,
  source: "TRIAL" | "AGENT" | "CREW",
  currentPeriodEnd: Date,
  extra: Record<string, unknown> = {},
) => ({
  agent,
  source,
  status: source === "TRIAL" ? "TRIALING" : "ACTIVE",
  currentPeriodEnd,
  cancelAtPeriodEnd: false,
  priceCents: 900,
  ...extra,
} as never);

describe("deriveStatusFields", () => {
  test("no active entitlements -> empty/null legacy fields, no trial", () => {
    const r = deriveStatusFields([]);
    assert.deepEqual(r.unlockedAgents, []);
    assert.deepEqual(r.selectedAgents, []);
    assert.equal(r.entitlementMode, "CUSTOM");
    assert.equal(r.currentPeriodEnd, null);
    assert.equal(r.trialEndsAt, null);
    assert.equal(r.daysRemaining, null);
    assert.deepEqual(r.entitlements, []);
  });

  test("TRIAL entitlements drive trialEndsAt/daysRemaining even though Subscription.status can never be TRIALING", () => {
    const trialEnd = new Date(Date.now() + 3 * 86400_000);
    const active = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"].map((a) =>
      ent(a, "TRIAL", trialEnd),
    );
    const r = deriveStatusFields(active);
    assert.equal(r.trialEndsAt?.toISOString(), trialEnd.toISOString());
    // ceil() of a slightly-under-3-days span can legitimately land on 3.
    assert.ok(r.daysRemaining === 2 || r.daysRemaining === 3, `expected ~3, got ${r.daysRemaining}`);
    assert.equal(r.entitlementMode, "CUSTOM");
    assert.equal(r.unlockedAgents.length, 6);
  });

  test("a CREW row sets entitlementMode CREW even alongside AGENT rows", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", future), ent("REX", "CREW", future)]);
    assert.equal(r.entitlementMode, "CREW");
  });

  test("paid AGENT rows do not set trialEndsAt/daysRemaining", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", future)]);
    assert.equal(r.trialEndsAt, null);
    assert.equal(r.daysRemaining, null);
  });

  test("currentPeriodEnd is the max across all active entitlements", () => {
    const soon = new Date(Date.now() + 1 * 86400_000);
    const later = new Date(Date.now() + 20 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", soon), ent("SAGE", "AGENT", later)]);
    assert.equal(r.currentPeriodEnd?.toISOString(), later.toISOString());
  });

  test("entitlements passthrough preserves per-agent shape", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", future, { cancelAtPeriodEnd: true, priceCents: 1900 })]);
    assert.deepEqual(r.entitlements, [
      {
        agent: "MAYA",
        source: "AGENT",
        status: "ACTIVE",
        currentPeriodEnd: future,
        cancelAtPeriodEnd: true,
        priceCents: 1900,
      },
    ]);
  });
});
