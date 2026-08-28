import { describe, it, expect } from "vitest";
import { shouldConsiderPlanning } from "./agent-runs.planner.js";

/**
 * This pre-filter only avoids a network round trip; apps/ai's `should_plan` is
 * the authoritative decision. It must therefore be a strict SUPERSET: a false
 * positive costs one internal request, a false negative silently disables the
 * feature for that phrasing with no way to tell.
 */
describe("shouldConsiderPlanning", () => {
  const LANDING =
    "Audit our top twenty pages in Google Search Console, cross-check the " +
    "rankings against Ahrefs, and open a prioritised fix-list in Linear.";

  it("passes the request the product promises", () => {
    expect(shouldConsiderPlanning(LANDING)).toBe(true);
  });

  it.each([
    "thanks",
    "run my briefing",
    "what's on my calendar?",
    "hi there",
  ])("rejects the short one-liner %j", (msg) => {
    expect(shouldConsiderPlanning(msg)).toBe(false);
  });

  it("passes on sequencing language", () => {
    expect(
      shouldConsiderPlanning(
        "Pull the revenue numbers and then draft a summary for the board",
      ),
    ).toBe(true);
  });

  it("passes on two or more distinct actions", () => {
    expect(
      shouldConsiderPlanning("Review the contract and summarise the risky clauses for me"),
    ).toBe(true);
  });

  it("passes when the request operates over a collection", () => {
    expect(
      shouldConsiderPlanning("Go through the top 10 posts from last month and rewrite them"),
    ).toBe(true);
  });

  it("rejects a single action however wordy", () => {
    expect(
      shouldConsiderPlanning(
        "Could you please draft something short for me about the new pricing page",
      ),
    ).toBe(false);
  });

  it("is a superset of Python's gate on the shared fixtures", () => {
    // Anything Python would plan must survive this filter, or Python never
    // gets asked. Mirrors tests/agents/test_planner.py's "yes" cases.
    const pythonWouldPlan = [
      LANDING,
      "Pull last quarter from Stripe and then reconcile it against Google " +
        "Sheets and draft the board summary",
    ];
    for (const msg of pythonWouldPlan) {
      expect(shouldConsiderPlanning(msg), msg).toBe(true);
    }
  });
});
