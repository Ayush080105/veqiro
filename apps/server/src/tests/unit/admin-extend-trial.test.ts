import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// admin.repository.ts's extendTrial/bulkExtendTrial should delegate entirely
// to the shared billing.service helper (fixing the old bug where they only
// patched the denormalized Organization cache), but only for orgs that are
// TRIALING (or have no subscription yet — the legitimate "start a trial"
// case). Mock prisma.subscription lookups plus billing.service.js so we can
// assert both the eligibility guard and the delegation in isolation.
const mockPrisma = {
  subscription: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("../../config/prisma.js", () => ({
  prisma: mockPrisma,
}));

const mocks = vi.hoisted(() => ({
  startOrExtendTrial: vi.fn(),
}));

vi.mock("../../modules/billing/billing.service.js", () => ({
  startOrExtendTrial: mocks.startOrExtendTrial,
}));

describe("admin.repository extendTrial / bulkExtendTrial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("extendTrial delegates to startOrExtendTrial with the given id and days when status is TRIALING", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: "TRIALING" });
    mocks.startOrExtendTrial.mockResolvedValue({
      id: "sub_1",
      organizationId: "org_1",
      status: "TRIALING",
    });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.extendTrial("org_1", 10);

    assert.equal(mocks.startOrExtendTrial.mock.calls.length, 1);
    assert.deepEqual(mocks.startOrExtendTrial.mock.calls[0], ["org_1", 10]);
    assert.equal((result as { status: string }).status, "TRIALING");
  });

  test("extendTrial defaults to a 7 day trial when days is omitted", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: "TRIALING" });
    mocks.startOrExtendTrial.mockResolvedValue({ id: "sub_2" });

    const repo = await import("../../modules/admin/admin.repository.js");
    await repo.extendTrial("org_2");

    assert.deepEqual(mocks.startOrExtendTrial.mock.calls[0], ["org_2", 7]);
  });

  test("extendTrial proceeds when the org has no subscription yet (start-trial case)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mocks.startOrExtendTrial.mockResolvedValue({ id: "sub_new", status: "TRIALING" });

    const repo = await import("../../modules/admin/admin.repository.js");
    await repo.extendTrial("org_new", 7);

    assert.equal(mocks.startOrExtendTrial.mock.calls.length, 1);
    assert.deepEqual(mocks.startOrExtendTrial.mock.calls[0], ["org_new", 7]);
  });

  for (const status of ["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]) {
    test(`extendTrial throws and never calls startOrExtendTrial when status is ${status}`, async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ status });

      const repo = await import("../../modules/admin/admin.repository.js");
      await expect(repo.extendTrial("org_paying", 7)).rejects.toThrow();

      assert.equal(mocks.startOrExtendTrial.mock.calls.length, 0);
    });
  }

  test("bulkExtendTrial only extends eligible (trialing or subscription-less) orgs and reports skipped ones", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { organizationId: "org_a", status: "TRIALING" },
      { organizationId: "org_b", status: "ACTIVE" },
      // org_c omitted entirely -> no subscription yet, still eligible
    ]);
    mocks.startOrExtendTrial.mockResolvedValue({ status: "TRIALING" });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.bulkExtendTrial(["org_a", "org_b", "org_c"], 5);

    assert.equal(mocks.startOrExtendTrial.mock.calls.length, 2);
    for (const call of mocks.startOrExtendTrial.mock.calls) {
      assert.equal(call[1], 5);
    }
    assert.deepEqual(result, {
      extended: 2,
      orgIds: ["org_a", "org_c"],
      skipped: ["org_b"],
    });
  });

  test("bulkExtendTrial reports no skips when every org is eligible", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { organizationId: "org_a", status: "TRIALING" },
      { organizationId: "org_b", status: "TRIALING" },
      { organizationId: "org_c", status: "TRIALING" },
    ]);
    mocks.startOrExtendTrial.mockResolvedValue({ status: "TRIALING" });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.bulkExtendTrial(["org_a", "org_b", "org_c"], 5);

    assert.equal(mocks.startOrExtendTrial.mock.calls.length, 3);
    assert.deepEqual(result, {
      extended: 3,
      orgIds: ["org_a", "org_b", "org_c"],
      skipped: [],
    });
  });
});
