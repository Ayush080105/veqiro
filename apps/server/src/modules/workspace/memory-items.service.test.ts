import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, createMany, create, count } = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    memoryItem: { findMany, createMany, create, count },
    agentMemory: { findUnique: vi.fn().mockResolvedValue(null) },
    orgMemory: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

import { Agent, MemoryOrigin } from "../../../prisma/generated/prisma/client.js";
import {
  addMemoryItem,
  loadPromptFacts,
  parseFact,
  recordExtractedFacts,
} from "./memory-items.service.js";

describe("parseFact", () => {
  it("reads the tag as the kind and drops it from the text", () => {
    expect(parseFact("[PREFERENCE] Keep posts short")).toEqual({
      kind: "preference",
      content: "Keep posts short",
    });
  });
  it("treats untagged text as a fact", () => {
    expect(parseFact("Sells B2B invoicing software")).toEqual({
      kind: "fact",
      content: "Sells B2B invoicing software",
    });
  });
  it("skips audit lines and empties", () => {
    expect(parseFact("[CONTEXT] Maya completed maya:draft-content on 2026-09-23")).toBeNull();
    expect(parseFact("   ")).toBeNull();
    expect(parseFact("[FACT]   ")).toBeNull();
  });
});

describe("recordExtractedFacts", () => {
  beforeEach(() => {
    findMany.mockReset();
    createMany.mockReset();
  });

  it("files preferences company-wide and everything else under the agent", async () => {
    findMany.mockResolvedValue([]);
    await recordExtractedFacts({
      organizationId: "o1",
      agent: Agent.LEX,
      facts: ["[PREFERENCE] Plain English please", "Governing law is Delaware"],
    });
    const rows = createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows.find((r: { kind: string }) => r.kind === "preference").agent).toBeNull();
    expect(rows.find((r: { kind: string }) => r.kind === "fact").agent).toBe(Agent.LEX);
  });

  it("does not re-learn something already known, retired ones included", async () => {
    findMany.mockResolvedValue([{ content: "Governing law is Delaware" }]);
    const n = await recordExtractedFacts({
      organizationId: "o1",
      agent: Agent.LEX,
      facts: ["Governing law is Delaware", "governing law is delaware"],
    });
    expect(n).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("never throws into the caller", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    await expect(
      recordExtractedFacts({ organizationId: "o1", agent: Agent.LEX, facts: ["x"] }),
    ).resolves.toBe(0);
  });
});

const row = (over: Record<string, unknown>) => ({
  kind: "fact",
  content: "x",
  confirmed: false,
  origin: MemoryOrigin.AGENT,
  ...over,
});

describe("loadPromptFacts — what the agent is actually given", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset().mockResolvedValue(1);
  });

  it("never reads a retired fact, and reads both this agent's and the company's", async () => {
    findMany.mockResolvedValue([row({ content: "a", confirmed: true })]);
    await loadPromptFacts("o1", Agent.LEX, []);
    const where = findMany.mock.calls[0][0].where;
    expect(where.retiredAt).toBeNull();
    expect(where.OR).toEqual([{ agent: Agent.LEX }, { agent: null }]);
  });

  it("asks for the newest 200, so a very full memory drops the oldest, not the latest thing said", async () => {
    findMany.mockResolvedValue([row({ content: "a", confirmed: true })]);
    await loadPromptFacts("o1", Agent.REX, []);
    const args = findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(200);
  });

  it("within a tier the newest fact comes last, so it survives the tail cut", async () => {
    // The database returns newest first.
    findMany.mockResolvedValue([
      row({ content: "ABC pays on the 1st", confirmed: true, origin: MemoryOrigin.USER }),
      row({ content: "XYZ pays on the 2nd", confirmed: true, origin: MemoryOrigin.USER }),
    ]);
    const { facts } = await loadPromptFacts("o1", Agent.REX, []);
    expect(facts).toEqual(["XYZ pays on the 2nd", "ABC pays on the 1st"]);
  });

  it("puts what the customer said last, because the AI service keeps the tail", async () => {
    // Newest first, as the database returns them.
    findMany.mockResolvedValue([
      row({ content: "older guess", confirmed: false }),
      row({ content: "user told me", confirmed: true, origin: MemoryOrigin.USER }),
      row({ content: "confirmed inference", confirmed: true }),
      row({ content: "guess", confirmed: false }),
    ]);
    const { facts, fromItems } = await loadPromptFacts("o1", Agent.LEX, []);
    expect(fromItems).toBe(true);
    expect(facts.at(-1)).toBe("user told me");
    expect(facts.at(-2)).toBe("confirmed inference");
    expect(facts.slice(0, 2)).toEqual(["(not yet confirmed) guess", "(not yet confirmed) older guess"]);
  });

  it("labels the kind and marks unconfirmed guesses as guesses", async () => {
    findMany.mockResolvedValue([
      row({ kind: "constraint", content: "No quotes off the pricing page", confirmed: true }),
      row({ kind: "preference", content: "Short replies" }),
    ]);
    const { facts } = await loadPromptFacts("o1", Agent.MAYA, []);
    expect(facts).toContain("Constraint: No quotes off the pricing page");
    expect(facts).toContain("(not yet confirmed) Preference: Short replies");
  });

  it("falls back to the old list rather than failing the chat turn", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    const result = await loadPromptFacts("o1", Agent.REX, ["legacy fact"]);
    expect(result).toEqual({ facts: ["legacy fact"], fromItems: false });
  });
});

describe("addMemoryItem", () => {
  it("stores the customer's own words as confirmed and USER-origin", async () => {
    create.mockReset().mockResolvedValue({ id: "m1" });
    await addMemoryItem({ organizationId: "o1", userId: "u1", agent: null, kind: "constraint", content: "  Never discount  " });
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      agent: null,
      kind: "constraint",
      content: "Never discount",
      origin: MemoryOrigin.USER,
      confirmed: true,
      confirmedByUserId: "u1",
    });
  });
});
