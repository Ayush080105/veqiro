import { assert, beforeEach, describe, test, vi } from "vitest";

// admin.repository.ts's extendTrial/bulkExtendTrial should delegate entirely
// to the shared billing.service helper (fixing the old bug where they only
// patched the denormalized Organization cache). Mock prisma (unused by these
// two functions, but imported at module scope by admin.repository.ts) and
// billing.service.js so we can assert the delegation in isolation.
vi.mock("../../config/prisma.js", () => ({
  prisma: {},
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

  test("extendTrial delegates to startOrExtendTrial with the given id and days", async () => {
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
    mocks.startOrExtendTrial.mockResolvedValue({ id: "sub_2" });

    const repo = await import("../../modules/admin/admin.repository.js");
    await repo.extendTrial("org_2");

    assert.deepEqual(mocks.startOrExtendTrial.mock.calls[0], ["org_2", 7]);
  });

  test("bulkExtendTrial maps every org id through the same (now-fixed) extendTrial path", async () => {
    mocks.startOrExtendTrial.mockResolvedValue({ status: "TRIALING" });

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.bulkExtendTrial(["org_a", "org_b", "org_c"], 5);

    assert.equal(mocks.startOrExtendTrial.mock.calls.length, 3);
    for (const call of mocks.startOrExtendTrial.mock.calls) {
      assert.equal(call[1], 5);
    }
    assert.deepEqual(result, { extended: 3, orgIds: ["org_a", "org_b", "org_c"] });
  });
});
