import { afterEach, assert, beforeEach, describe, test } from "vitest";
import {
  agentProductId,
  resolveAgentFromProductId,
  getAgentMonthlyPriceCents,
} from "../../modules/billing/billing.catalog.js";

beforeEach(() => {
  process.env.DODO_PRODUCT_AGENT_MAYA = "pdt_maya";
  process.env.DODO_PRODUCT_AGENT_REX = "pdt_rex";
});

afterEach(() => {
  delete process.env.DODO_PRODUCT_AGENT_MAYA;
  delete process.env.DODO_PRODUCT_AGENT_REX;
});

describe("product id mapping", () => {
  test("agent → product id", () => {
    assert.equal(agentProductId("MAYA"), "pdt_maya");
  });

  test("product id → agent (round trip)", () => {
    assert.equal(resolveAgentFromProductId("pdt_maya"), "MAYA");
    assert.equal(resolveAgentFromProductId("pdt_rex"), "REX");
  });

  test("unknown product id resolves to null, never throws", () => {
    assert.equal(resolveAgentFromProductId("pdt_bogus"), null);
  });

  test("missing env for a required product throws a named error", () => {
    delete process.env.DODO_PRODUCT_AGENT_MAYA;
    assert.throws(() => agentProductId("MAYA"), /missing-product-id:MAYA/);
  });

  // REGRESSION: process.env[k] is undefined when unset, and product_id is
  // `string | undefined` on the webhook payload. Without a falsy guard,
  // `undefined === undefined` matches and the resolver returns MAYA (first in
  // ALL_AGENTS, and the priciest agent) for a malformed webhook.
  test("undefined product id resolves to null even when env vars are unset", () => {
    delete process.env.DODO_PRODUCT_AGENT_MAYA;
    assert.equal(resolveAgentFromProductId(undefined as never), null);
  });

  test("empty product id resolves to null", () => {
    assert.equal(resolveAgentFromProductId(""), null);
  });
});

describe("prices", () => {
  test("maya is 1900, others 900", () => {
    assert.equal(getAgentMonthlyPriceCents("MAYA"), 1900);
    assert.equal(getAgentMonthlyPriceCents("SAGE"), 900);
  });
});
