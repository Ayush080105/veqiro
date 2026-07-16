import { afterEach, assert, describe, test } from "vitest";
import { buildCatalogPayload } from "../../modules/billing/billing.catalog.controller.js";

// Note: whether GET /billing/catalog is actually mounted on the *public*
// (unauthenticated) router — not the authMiddleware-wrapped one — is
// covered by the manual smoke-test checklist, not a unit test here.
// Importing billing.routes.ts transitively pulls in auth.ts's full plugin
// chain (Dodo client, Resend mailer, etc.), each requiring real API keys —
// not worth mocking out just to assert a route path string.

afterEach(() => {
  delete process.env.AGENT_PRICE_MAYA_MONTHLY_CENTS;
  delete process.env.CREW_MONTHLY_CENTS;
});

describe("buildCatalogPayload", () => {
  test("shape covers all 6 agents plus crew monthly/annual", () => {
    const payload = buildCatalogPayload();
    assert.equal(payload.currency, "USD");
    for (const agent of ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"]) {
      assert.equal(typeof payload.agents[agent as keyof typeof payload.agents].priceCents, "number");
    }
    assert.equal(payload.crew.monthly.priceCents, 3900);
    assert.equal(payload.crew.annual.priceCents, 34800);
  });

  test("reflects env var overrides", () => {
    process.env.AGENT_PRICE_MAYA_MONTHLY_CENTS = "2500";
    process.env.CREW_MONTHLY_CENTS = "4500";
    const payload = buildCatalogPayload();
    assert.equal(payload.agents.MAYA.priceCents, 2500);
    assert.equal(payload.crew.monthly.priceCents, 4500);
  });
});
