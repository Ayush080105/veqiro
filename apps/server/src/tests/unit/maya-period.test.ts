import { assert, describe, test } from "vitest";
import { currentCreditWindow } from "../../modules/agents/maya/maya.period.js";

describe("currentCreditWindow", () => {
  test("inside the first month → window is anchor → anchor+1mo", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-20T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-01-10T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-02-10T00:00:00.000Z");
  });

  test("ANNUAL: credits roll monthly even though billing is yearly", () => {
    // 5 months into an annual plan the window is the 6th month, NOT the year.
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-06-15T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-06-10T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-07-10T00:00:00.000Z");
  });

  test("anchored on the 31st, a 30-day month clamps to the last day", () => {
    const w = currentCreditWindow(new Date("2026-01-31T00:00:00Z"), new Date("2026-04-15T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-03-31T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-04-30T00:00:00.000Z");
  });

  test("exactly on a boundary starts the new window", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-02-10T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-02-10T00:00:00.000Z");
  });

  test("now before anchor → the anchor window (clock skew must not go negative)", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-09T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-01-10T00:00:00.000Z");
  });

  // ─── Additional cases not in the brief ─────────────────────────────────────

  test("anchored on the 29th during a leap-day February clamps correctly (2028 is a leap year)", () => {
    // Jan 29 anchor: the second window (starting once Feb 29 has passed) should
    // land exactly on Feb 29 in a leap year — no clamping needed, since Feb 2028
    // does have 29 days.
    const w = currentCreditWindow(new Date("2028-01-29T00:00:00Z"), new Date("2028-03-01T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2028-02-29T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2028-03-29T00:00:00.000Z");
  });

  test("anchored on the 31st, chained clamped months don't drift back to the 30th once a 31-day month reappears", () => {
    // Jan 31 -> Feb 28 (clamped) -> Mar should snap back to 31, not stay clamped at 28.
    const w = currentCreditWindow(new Date("2026-01-31T00:00:00Z"), new Date("2026-03-31T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-03-31T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-04-30T00:00:00.000Z");
  });

  test("a non-UTC-midnight anchor preserves its time-of-day across months", () => {
    const w = currentCreditWindow(new Date("2026-01-10T14:37:22.500Z"), new Date("2026-03-12T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-03-10T14:37:22.500Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-04-10T14:37:22.500Z");
  });

  test("now exactly equal to the anchor is inside the first window, not before it", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-10T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-01-10T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-02-10T00:00:00.000Z");
  });

  test("a year-plus gap rolls forward the correct number of whole months, not just one", () => {
    const w = currentCreditWindow(new Date("2025-01-10T00:00:00Z"), new Date("2026-07-15T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-07-10T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-08-10T00:00:00.000Z");
  });
});
