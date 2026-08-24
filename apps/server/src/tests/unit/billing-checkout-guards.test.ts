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

const { assertAgentPurchasable, assertNoPendingCheckout } = await import("../../modules/billing/billing.service.js");

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

describe("assertNoPendingCheckout", () => {
  test("no existing pending checkout: allowed", () => {
    assert.doesNotThrow(() => assertNoPendingCheckout(null, "MAYA" as never));
  });

  test("REGRESSION: a fresh pending checkout for the same agent is rejected (closes the double-purchase race)", () => {
    assert.throws(
      () => assertNoPendingCheckout({ agent: "MAYA" as never, kind: "AGENT", createdAt: new Date() }, "MAYA" as never),
      /checkout-already-pending:MAYA/,
    );
  });

  test("a pending checkout for a different agent does not block", () => {
    assert.doesNotThrow(() =>
      assertNoPendingCheckout({ agent: "REX" as never, kind: "AGENT", createdAt: new Date() }, "MAYA" as never),
    );
  });

  test("a MAYA_TOPUP pending checkout (kind mismatch) never blocks an agent checkout", () => {
    assert.doesNotThrow(() =>
      assertNoPendingCheckout({ agent: null, kind: "MAYA_TOPUP", createdAt: new Date() }, "MAYA" as never),
    );
  });

  test("a stale (>24h) pending checkout is treated as abandoned and does not block", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    assert.doesNotThrow(() =>
      assertNoPendingCheckout({ agent: "MAYA" as never, kind: "AGENT", createdAt: old }, "MAYA" as never),
    );
  });

  test("a pending checkout just under the 24h staleness bound still blocks", () => {
    const almost24h = new Date(Date.now() - 23 * 60 * 60 * 1000);
    assert.throws(
      () => assertNoPendingCheckout({ agent: "MAYA" as never, kind: "AGENT", createdAt: almost24h }, "MAYA" as never),
      /checkout-already-pending:MAYA/,
    );
  });
});
