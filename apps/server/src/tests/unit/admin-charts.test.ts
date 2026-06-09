import { assert, describe, test } from "vitest";
import { buildSignupBuckets, buildHealthBuckets } from "../../modules/admin/admin.charts.js";

// Fixed Sunday anchor so week math is deterministic
const NOW = new Date("2026-06-07T12:00:00Z");

describe("buildSignupBuckets", () => {
  test("returns exactly weekCount buckets", () => {
    const result = buildSignupBuckets([], 4, NOW);
    assert.equal(result.length, 4);
  });

  test("counts orgs in the correct week bucket", () => {
    const orgs = [
      { createdAt: new Date("2026-06-07T10:00:00Z") }, // current week (Sun)
      { createdAt: new Date("2026-06-07T22:00:00Z") }, // current week
      { createdAt: new Date("2026-05-31T10:00:00Z") }, // one week ago
    ];
    const result = buildSignupBuckets(orgs, 3, NOW);
    assert.equal(result[2].count, 2);
    assert.equal(result[1].count, 1);
    assert.equal(result[0].count, 0);
  });

  test("ignores orgs outside the window", () => {
    const orgs = [{ createdAt: new Date("2020-01-01T00:00:00Z") }];
    const result = buildSignupBuckets(orgs, 3, NOW);
    const total = result.reduce((s, b) => s + b.count, 0);
    assert.equal(total, 0);
  });
});

describe("buildHealthBuckets", () => {
  test("returns exactly weekCount buckets", () => {
    const result = buildHealthBuckets([], 4, NOW);
    assert.equal(result.length, 4);
  });

  test("categorises all five statuses correctly", () => {
    const orgs = [
      { createdAt: new Date("2026-06-07T10:00:00Z"), subscriptionStatus: "ACTIVE" },
      { createdAt: new Date("2026-06-07T11:00:00Z"), subscriptionStatus: "TRIALING" },
      { createdAt: new Date("2026-06-07T12:00:00Z"), subscriptionStatus: "PAST_DUE" },
      { createdAt: new Date("2026-06-07T13:00:00Z"), subscriptionStatus: "CANCELLED" },
      { createdAt: new Date("2026-06-07T14:00:00Z"), subscriptionStatus: "EXPIRED" },
    ];
    const [bucket] = buildHealthBuckets(orgs, 1, NOW);
    assert.equal(bucket.active, 1);
    assert.equal(bucket.trialing, 1);
    assert.equal(bucket.pastDue, 1);
    assert.equal(bucket.cancelledExpired, 2); // CANCELLED + EXPIRED combined
  });

  test("null status is silently ignored", () => {
    const orgs = [{ createdAt: new Date("2026-06-07T10:00:00Z"), subscriptionStatus: null }];
    const [bucket] = buildHealthBuckets(orgs, 1, NOW);
    assert.equal(bucket.active + bucket.trialing + bucket.pastDue + bucket.cancelledExpired, 0);
  });
});
