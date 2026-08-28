import { describe, it, expect } from "vitest";
import { dependentClosure, isTerminal } from "./agent-runs.service.js";
import { AgentRunStatus } from "../../../prisma/generated/prisma/client.js";

/**
 * The approval cascade. The client greys out dependents for feedback, but the
 * server recomputes the closure because a client that omitted one would get a
 * step executed against inputs its producer never generated.
 */
describe("dependentClosure", () => {
  const chain = [
    { key: "s1", dependsOn: [] },
    { key: "s2", dependsOn: ["s1"] },
    { key: "s3", dependsOn: ["s2"] },
  ];

  it("follows the chain transitively", () => {
    expect(dependentClosure(chain, ["s1"])).toEqual(new Set(["s2", "s3"]));
  });

  it("excludes the seeds themselves", () => {
    expect(dependentClosure(chain, ["s1"]).has("s1")).toBe(false);
  });

  it("returns nothing for a leaf", () => {
    expect(dependentClosure(chain, ["s3"])).toEqual(new Set());
  });

  it("leaves an independent branch untouched", () => {
    const forked = [
      { key: "s1", dependsOn: [] },
      { key: "s2", dependsOn: ["s1"] },
      { key: "s3", dependsOn: [] },
      { key: "s4", dependsOn: ["s3"] },
    ];
    expect(dependentClosure(forked, ["s1"])).toEqual(new Set(["s2"]));
  });

  it("collects a diamond's join exactly once", () => {
    const diamond = [
      { key: "a", dependsOn: [] },
      { key: "b", dependsOn: ["a"] },
      { key: "c", dependsOn: ["a"] },
      { key: "d", dependsOn: ["b", "c"] },
    ];
    expect(dependentClosure(diamond, ["a"])).toEqual(new Set(["b", "c", "d"]));
  });

  it("disabling one arm of a diamond still blocks the join", () => {
    const diamond = [
      { key: "a", dependsOn: [] },
      { key: "b", dependsOn: ["a"] },
      { key: "c", dependsOn: ["a"] },
      { key: "d", dependsOn: ["b", "c"] },
    ];
    // d needs both arms, so losing b is enough to block it.
    expect(dependentClosure(diamond, ["b"])).toEqual(new Set(["d"]));
  });

  it("handles multiple seeds", () => {
    const g = [
      { key: "a", dependsOn: [] },
      { key: "b", dependsOn: ["a"] },
      { key: "c", dependsOn: [] },
      { key: "d", dependsOn: ["c"] },
    ];
    expect(dependentClosure(g, ["a", "c"])).toEqual(new Set(["b", "d"]));
  });

  it("terminates on a cycle instead of looping forever", () => {
    // The planner rejects cyclic plans, but this must not hang if one slips in.
    const cyclic = [
      { key: "a", dependsOn: ["b"] },
      { key: "b", dependsOn: ["a"] },
    ];
    expect(dependentClosure(cyclic, ["a"])).toEqual(new Set(["b"]));
  });

  it("is empty for no seeds", () => {
    expect(dependentClosure(chain, [])).toEqual(new Set());
  });
});

describe("isTerminal", () => {
  it("treats finished states as terminal", () => {
    for (const s of [
      AgentRunStatus.COMPLETED,
      AgentRunStatus.PARTIAL,
      AgentRunStatus.FAILED,
      AgentRunStatus.CANCELLED,
      AgentRunStatus.REJECTED,
    ]) {
      expect(isTerminal(s)).toBe(true);
    }
  });

  it("treats in-flight and waiting states as non-terminal", () => {
    for (const s of [
      AgentRunStatus.PLANNING,
      AgentRunStatus.AWAITING_PLAN_APPROVAL,
      AgentRunStatus.RUNNING,
      AgentRunStatus.AWAITING_ACTION_APPROVAL,
      AgentRunStatus.REPLANNING,
    ]) {
      expect(isTerminal(s)).toBe(false);
    }
  });
});

/**
 * The sibling-action allowance on a reviewed step.
 *
 * A user can switch a draft to a carousel inside the form, which the dialog
 * resolves to a different action id than the step proposed. That one swap is
 * legitimate; substituting anything else would run work the plan never
 * described.
 */
describe("reviewed step action matching", () => {
  const SIBLINGS: Record<string, string[]> = {
    "maya:draft-content": ["maya:draft-carousel"],
    "maya:draft-carousel": ["maya:draft-content"],
  }
  const allows = (proposed: string, submitted: string) =>
    new Set([proposed, ...(SIBLINGS[proposed] ?? [])]).has(submitted)

  it("accepts the action the step proposed", () => {
    expect(allows("maya:draft-content", "maya:draft-content")).toBe(true)
  })

  it("accepts a carousel switched on inside the draft form", () => {
    expect(allows("maya:draft-content", "maya:draft-carousel")).toBe(true)
  })

  it("refuses an unrelated action", () => {
    expect(allows("maya:draft-content", "maya:generate-video")).toBe(false)
  })

  it("refuses another agent's action entirely", () => {
    expect(allows("maya:draft-content", "rex:investor-update")).toBe(false)
  })
})
