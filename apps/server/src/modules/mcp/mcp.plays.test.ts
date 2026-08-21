import { describe, it, assert } from "vitest";

import { matchesCron } from "./mcp.plays.cron.js";
import { PLAY_DEFINITIONS, findPlayDefinition } from "./mcp.plays.js";

/** UTC, because the scheduler compares against UTC fields. */
const at = (iso: string) => new Date(iso);

describe("matchesCron", () => {
  it("matches an exact minute and hour", () => {
    // 2026-08-24 is a Monday.
    assert.isTrue(matchesCron("0 8 * * 1", at("2026-08-24T08:00:00Z")));
    assert.isFalse(matchesCron("0 8 * * 1", at("2026-08-24T08:01:00Z")));
    assert.isFalse(matchesCron("0 8 * * 1", at("2026-08-24T09:00:00Z")));
  });

  it("respects day-of-week, including ranges", () => {
    assert.isFalse(matchesCron("0 8 * * 1", at("2026-08-25T08:00:00Z")), "Tuesday should not match Monday");
    // 1-5 is Mon-Fri.
    assert.isTrue(matchesCron("0 9 * * 1-5", at("2026-08-25T09:00:00Z")), "Tuesday is in Mon-Fri");
    assert.isFalse(matchesCron("0 9 * * 1-5", at("2026-08-29T09:00:00Z")), "Saturday is not");
  });

  it("treats Sunday as both 0 and 7", () => {
    // 2026-08-23 is a Sunday.
    assert.isTrue(matchesCron("0 8 * * 0", at("2026-08-23T08:00:00Z")));
    assert.isTrue(matchesCron("0 8 * * 7", at("2026-08-23T08:00:00Z")));
  });

  it("handles step and list syntax", () => {
    assert.isTrue(matchesCron("*/15 * * * *", at("2026-08-24T08:30:00Z")));
    assert.isFalse(matchesCron("*/15 * * * *", at("2026-08-24T08:31:00Z")));
    assert.isTrue(matchesCron("0,30 * * * *", at("2026-08-24T08:30:00Z")));
    assert.isFalse(matchesCron("0,30 * * * *", at("2026-08-24T08:15:00Z")));
  });

  it("ORs day-of-month with day-of-week when both are restricted", () => {
    // Cron's own rule. Getting this backwards makes such expressions almost
    // never fire instead of firing on either day.
    const expr = "0 9 1 * 1";
    assert.isTrue(matchesCron(expr, at("2026-09-01T09:00:00Z")), "1st of the month (a Tuesday)");
    assert.isTrue(matchesCron(expr, at("2026-08-24T09:00:00Z")), "a Monday that is not the 1st");
    assert.isFalse(matchesCron(expr, at("2026-08-25T09:00:00Z")), "neither the 1st nor a Monday");
  });

  it("rejects malformed expressions instead of firing on everything", () => {
    assert.isFalse(matchesCron("", at("2026-08-24T08:00:00Z")));
    assert.isFalse(matchesCron("0 8 * *", at("2026-08-24T08:00:00Z")));
    assert.isFalse(matchesCron("not a cron", at("2026-08-24T08:00:00Z")));
  });

  it("a wide-open expression matches any minute", () => {
    assert.isTrue(matchesCron("* * * * *", at("2026-08-24T08:37:00Z")));
  });
});

describe("play catalog", () => {
  it("every play has a schedule the matcher understands", () => {
    for (const def of PLAY_DEFINITIONS) {
      const fields = def.schedule.trim().split(/\s+/);
      assert.lengthOf(fields, 5, `${def.id} has a malformed schedule`);
      // A schedule that never matches is a play that silently never runs, which
      // looks identical to a broken agent from the customer's side.
      let matched = false;
      const probe = new Date(Date.UTC(2026, 8, 1, 0, 0, 0));
      for (let i = 0; i < 60 * 24 * 31 && !matched; i += 1) {
        if (matchesCron(def.schedule, new Date(probe.getTime() + i * 60_000))) matched = true;
      }
      assert.isTrue(matched, `${def.id} never fires within a month`);
    }
  });

  it("ids are unique and every play declares what it needs", () => {
    const ids = PLAY_DEFINITIONS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate play id");
    for (const def of PLAY_DEFINITIONS) {
      assert.isNotEmpty(def.requires, `${def.id} requires nothing — it would appear available with nothing connected`);
      assert.isNotEmpty(def.prompt, `${def.id} has no prompt`);
      assert.isNotEmpty(def.scheduleLabel, `${def.id} has no readable schedule`);
    }
  });

  it("looks plays up by id", () => {
    const first = PLAY_DEFINITIONS[0]!;
    assert.equal(findPlayDefinition(first.id)?.id, first.id);
    assert.isUndefined(findPlayDefinition("nope"));
  });
});
