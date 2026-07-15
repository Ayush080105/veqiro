import { assert, beforeEach, describe, test } from "vitest";
import { quoteCrewUpgrade } from "../../modules/billing/billing.upgrade.js";

beforeEach(() => {
  process.env.CREW_MONTHLY_CENTS = "3900";
  process.env.CREW_ANNUAL_CENTS = "34800";
});

describe("quoteCrewUpgrade — the spec's worked example", () => {
  test("Maya(1900) + Rex(900) → pay 1100", () => {
    const q = quoteCrewUpgrade([1900, 900], "MONTHLY");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 2800);
    assert.equal(q.payNowCents, 1100);
    assert.equal(q.discountBasisPoints, 7179);
  });
});

describe("quoteCrewUpgrade — full reachable delta matrix", () => {
  // Every basket reachable from prices {1900 Maya, 900 x5} with total < 3900.
  const cases: Array<[number[], number, number, number]> = [
    // owned,                credit, bp,   payNow
    [[900],                   900,   2308, 3000],
    [[900, 900],             1800,   4615, 2100],
    [[1900],                 1900,   4872, 2000],
    [[900, 900, 900],        2700,   6923, 1200],
    [[1900, 900],            2800,   7179, 1100],
    [[900, 900, 900, 900],   3600,   9231,  300],
    [[1900, 900, 900],       3700,   9487,  200],
  ];

  for (const [owned, credit, bp, payNow] of cases) {
    test(`owned ${credit} → ${bp}bp → pay ${payNow}`, () => {
      const q = quoteCrewUpgrade(owned, "MONTHLY");
      assert.equal(q.eligible, true);
      if (!q.eligible) return;
      assert.equal(q.creditCents, credit);
      assert.equal(q.discountBasisPoints, bp);
      assert.equal(q.payNowCents, payNow);
    });
  }

  test("every reachable payNow is a whole dollar (no rounding drift)", () => {
    for (const [owned] of cases) {
      const q = quoteCrewUpgrade(owned, "MONTHLY");
      assert.equal(q.eligible, true);
      if (!q.eligible) return;
      assert.equal(q.payNowCents % 100, 0, `owned=${owned} produced ${q.payNowCents}`);
    }
  });

  test("every reachable payNow clears Dodo's $1 minimum", () => {
    for (const [owned] of cases) {
      const q = quoteCrewUpgrade(owned, "MONTHLY");
      assert.equal(q.eligible, true);
      if (!q.eligible) return;
      assert.isAtLeast(q.payNowCents, 100, `owned=${owned} is below the $1 floor`);
    }
  });
});

describe("quoteCrewUpgrade — ineligible", () => {
  test("credit exactly equals crew price → ineligible (no refund, no $0 charge)", () => {
    const q = quoteCrewUpgrade([1900, 900, 900, 200], "MONTHLY"); // 3900
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "credit-exceeds-crew-price");
  });

  test("credit exceeds crew price → ineligible", () => {
    const q = quoteCrewUpgrade([1900, 900, 900, 900], "MONTHLY"); // 4600 > 3900
    assert.equal(q.eligible, false);
  });

  test("nothing owned → ineligible (this is a plain Crew purchase, not an upgrade)", () => {
    const q = quoteCrewUpgrade([], "MONTHLY");
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "no-agents-owned");
  });
});

describe("quoteCrewUpgrade — annual", () => {
  test("credit applies against the annual crew price", () => {
    const q = quoteCrewUpgrade([1900, 900], "ANNUAL");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 2800);
    assert.equal(q.payNowCents, 31999);
  });
});
