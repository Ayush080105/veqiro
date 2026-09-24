import { describe, expect, it, vi } from "vitest";

vi.mock("../../../config/prisma.js", () => ({ prisma: {} }));
vi.mock("../../../common/utils/contextService.js", () => ({
  callAgentWithContext: vi.fn(),
  agentRoles: {},
}));

import { parseExtras } from "./maya.contentplan.js";

describe("parseExtras", () => {
  it("returns nulls for a plan made before signals existed", () => {
    expect(parseExtras({ note: "old", items: [] })).toEqual({
      headline: null,
      signals: null,
      limits: null,
    });
    expect(parseExtras(null)).toEqual({ headline: null, signals: null, limits: null });
  });

  it("reads signals, keeping only real counts", () => {
    const out = parseExtras({
      headline: "  Lean into exhibition reels  ",
      signals: [
        {
          kind: "own_post",
          label: "Dadar exhibition Reel",
          detail: "Most engaged post",
          format: "reel",
          likes: 83,
          comments: 6,
          source: "Instagram insights",
        },
        // A model that writes "about 50" or "-3" has not read a number.
        { kind: "own_post", label: "Guessed", detail: "", format: "post", likes: "about 50", comments: -3 },
      ],
      limits: ["Reach was not available"],
    });

    expect(out.headline).toBe("Lean into exhibition reels");
    expect(out.signals).toHaveLength(2);
    expect(out.signals![0]).toMatchObject({ kind: "own_post", format: "reel", likes: 83, comments: 6 });
    expect(out.signals![1]).toMatchObject({ likes: null, comments: null });
    expect(out.limits).toEqual(["Reach was not available"]);
  });

  it("skips entries without a label and falls back on an unknown kind", () => {
    const out = parseExtras({
      signals: [{ kind: "rumour", label: "Local festival", detail: "x" }, { detail: "no label" }, null],
    });
    expect(out.signals).toHaveLength(1);
    expect(out.signals![0]!.kind).toBe("trend");
  });

  it("caps signals at eight", () => {
    const signals = Array.from({ length: 12 }, (_, i) => ({ kind: "event", label: `e${i}`, detail: "" }));
    expect(parseExtras({ signals }).signals).toHaveLength(8);
  });
});
