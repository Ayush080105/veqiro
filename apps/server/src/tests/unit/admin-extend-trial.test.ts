import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// admin.repository.ts's extendTrial/bulkExtendTrial now delegate entirely to
// the entitlements-based billing.service helper `extendTrialForOrg`, which
// owns the only eligibility check that still matters (does the org have any
// TRIAL-sourced entitlement rows to extend) — there is no separate
// Subscription-status gate to test here anymore, since extendTrialForOrg
// never touches Subscription.
vi.mock("../../config/prisma.js", () => ({
  prisma: {},
}));

const mocks = vi.hoisted(() => ({
  extendTrialForOrg: vi.fn(),
}));

vi.mock("../../modules/billing/billing.service.js", () => ({
  extendTrialForOrg: mocks.extendTrialForOrg,
}));

describe("admin.repository extendTrial / bulkExtendTrial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("extendTrial delegates to extendTrialForOrg with the given id and days", async () => {
    mocks.extendTrialForOrg.mockResolvedValue({ trialEndsAt: new Date("2026-02-01") });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.extendTrial("org_1", 10);

    assert.equal(mocks.extendTrialForOrg.mock.calls.length, 1);
    assert.deepEqual(mocks.extendTrialForOrg.mock.calls[0], ["org_1", 10]);
    assert.equal(
      (result as { trialEndsAt: Date }).trialEndsAt.getTime(),
      new Date("2026-02-01").getTime(),
    );
  });

  test("extendTrial defaults to a 7 day trial when days is omitted", async () => {
    mocks.extendTrialForOrg.mockResolvedValue({ trialEndsAt: new Date() });

    const repo = await import("../../modules/admin/admin.repository.js");
    await repo.extendTrial("org_2");

    assert.deepEqual(mocks.extendTrialForOrg.mock.calls[0], ["org_2", 7]);
  });

  test("extendTrial propagates the no-trial-to-extend rejection for an org with no trial", async () => {
    mocks.extendTrialForOrg.mockRejectedValue(new Error("no-trial-to-extend"));

    const repo = await import("../../modules/admin/admin.repository.js");

    await expect(repo.extendTrial("org_paying", 7)).rejects.toThrow(/no-trial-to-extend/);
  });

  test("bulkExtendTrial extends every org and reports none skipped when all succeed", async () => {
    mocks.extendTrialForOrg.mockResolvedValue({ trialEndsAt: new Date() });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.bulkExtendTrial(["org_a", "org_b", "org_c"], 5);

    assert.equal(mocks.extendTrialForOrg.mock.calls.length, 3);
    for (const call of mocks.extendTrialForOrg.mock.calls) {
      assert.equal(call[1], 5);
    }
    assert.deepEqual(result, {
      extended: 3,
      orgIds: ["org_a", "org_b", "org_c"],
      skipped: [],
    });
  });

  test("bulkExtendTrial reports orgs with no trial to extend as skipped rather than aborting the batch", async () => {
    mocks.extendTrialForOrg.mockImplementation(async (id: string) => {
      if (id === "org_b") throw new Error("no-trial-to-extend");
      return { trialEndsAt: new Date() };
    });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.bulkExtendTrial(["org_a", "org_b", "org_c"], 5);

    assert.deepEqual(result, {
      extended: 2,
      orgIds: ["org_a", "org_c"],
      skipped: ["org_b"],
    });
  });
});
