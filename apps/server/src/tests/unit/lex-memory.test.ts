import { describe, expect, it } from "vitest";
import { computeDueDate, normaliseDocumentName } from "../../modules/agents/lex/lex.memory.js";
import { renderBriefEmail } from "../../modules/agents/lex/lex.brief-email.js";

const now = new Date("2026-09-17T10:00:00.000Z");
const start = new Date("2026-09-01T00:00:00.000Z");

describe("computeDueDate", () => {
  it("uses the calendar date the contract states", () => {
    expect(computeDueDate({ date: "2026-12-31" }, start, now)?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("adds a relative offset to the contract start", () => {
    expect(computeDueDate({ days_from_start: 10 }, start, now)?.toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });

  it("returns null rather than guessing when there is no start date", () => {
    expect(computeDueDate({ days_from_start: 10 }, null, now)).toBeNull();
    expect(computeDueDate({ recurrence: "monthly" }, null, now)).toBeNull();
  });

  it("rolls a recurring duty forward to the next occurrence on or after today", () => {
    expect(computeDueDate({ recurrence: "monthly" }, start, now)?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(computeDueDate({ recurrence: "half_yearly" }, new Date("2025-01-15T00:00:00.000Z"), now)?.toISOString())
      .toBe("2027-01-15T00:00:00.000Z");
  });

  it("ignores malformed dates", () => {
    expect(computeDueDate({ date: "31 Dec 2026" }, null, now)).toBeNull();
  });
});

describe("normaliseDocumentName", () => {
  it("strips version markers so versions of one contract match", () => {
    expect(normaliseDocumentName("Acme MSA v2 FINAL.pdf")).toBe(normaliseDocumentName("Acme MSA (revised) 2026-09-01"));
    expect(normaliseDocumentName("Acme MSA v2 FINAL.pdf")).toBe("acme msa");
  });
});

describe("renderBriefEmail", () => {
  const base = { generatedAt: now.toISOString(), reviewedThisWeek: 2, monitored: 18 };

  it("says clearly when nothing needs attention", () => {
    const html = renderBriefEmail({ ...base, attentionCount: 0, upcomingCount: 0, attention: [], upcoming: [], clear: true }, "https://app");
    expect(html).toContain("Nothing urgent needs your attention this week.");
    expect(html).toContain("does not replace advice from a qualified lawyer");
  });

  it("lists attention items and escapes document names", () => {
    const item = {
      id: "x", kind: "deadline" as const, severity: "high" as const, sourceRowId: "s",
      documentName: "Acme <MSA>", title: "Renewal notice — in 14 days", dueDate: null, daysLeft: 14,
    };
    const html = renderBriefEmail({ ...base, attentionCount: 1, upcomingCount: 1, attention: [item], upcoming: [item], clear: false }, "https://app");
    expect(html).toContain("Acme &lt;MSA&gt;");
    expect(html).toContain("1 item needs attention");
  });
});
