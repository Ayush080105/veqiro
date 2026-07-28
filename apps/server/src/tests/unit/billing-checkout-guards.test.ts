import { assert, describe, test, vi } from "vitest";

// billing.service.ts imports lib/auth.ts at module scope, which pulls in the
// mailer -> Resend chain and crashes without RESEND_API_KEY set. Mock it out
// the same way billing-trial-entitlements.test.ts does, since this test only
// exercises the pure assertAgentPurchasable guard.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));
// Same reason: lib/dodo.ts constructs a DodoPayments client at module scope,
// which throws without DODO_PAYMENTS_API_KEY set.
vi.mock("../../lib/dodo.js", () => ({ dodoClient: {} }));
vi.mock("../../config/prisma.js", () => ({ prisma: {} }));

const { assertAgentPurchasable } = await import("../../modules/billing/billing.service.js");

const future = new Date(Date.now() + 10 * 86400_000);
const ent = (agent: string, source: string, extra: Record<string, unknown> = {}) => ({
  agent, source, status: "ACTIVE", currentPeriodEnd: future,
  cancelAtPeriodEnd: false, priceCents: 900, ...extra,
} as never);

describe("assertAgentPurchasable", () => {
  test("buying an un-owned agent is allowed", () => {
    assert.doesNotThrow(() => assertAgentPurchasable([ent("MAYA", "AGENT")], "REX" as never));
  });

  test("buying with nothing owned is allowed", () => {
    assert.doesNotThrow(() => assertAgentPurchasable([], "MAYA" as never));
  });

  test("re-buying an actively owned agent is rejected", () => {
    assert.throws(
      () => assertAgentPurchasable([ent("MAYA", "AGENT")], "MAYA" as never),
      /already-entitled:MAYA/,
    );
  });

  test("an agent cancelled-but-unexpired is repurchasable (resume, not double-charge)", () => {
    assert.doesNotThrow(
      () => assertAgentPurchasable([ent("MAYA", "AGENT", { cancelAtPeriodEnd: true })], "MAYA" as never),
    );
  });

  test("an agent held only via TRIAL is purchasable (converting to paid)", () => {
    assert.doesNotThrow(
      () => assertAgentPurchasable([ent("MAYA", "TRIAL")], "MAYA" as never),
    );
  });

  test("owning Maya and Sage does not block buying Rex", () => {
    assert.doesNotThrow(
      () => assertAgentPurchasable([ent("MAYA", "AGENT"), ent("SAGE", "AGENT")], "REX" as never),
    );
  });
});
