import { assert, beforeEach, describe, test, vi } from "vitest";

// admin.repository.ts's grantCredits is built entirely on top of
// maya.usage.service.js's existing getCurrentUsage/adjustCurrentPeriodUsage
// primitives — mock that module directly (rather than the underlying prisma
// layer, which already has its own dedicated test suite in
// maya-usage.test.ts) so this test stays focused on grantCredits' own logic:
// mapping a positive "credits to grant" input to a negative delta, and
// computing requested/applied/before/after from the two usage snapshots.
vi.mock("../../config/prisma.js", () => ({
  prisma: {},
}));

const mocks = vi.hoisted(() => ({
  getCurrentUsage: vi.fn(),
  adjustCurrentPeriodUsage: vi.fn(),
}));

vi.mock("../../modules/agents/maya/maya.usage.service.js", () => ({
  getCurrentUsage: mocks.getCurrentUsage,
  adjustCurrentPeriodUsage: mocks.adjustCurrentPeriodUsage,
}));

// admin.repository.ts also imports billing.service.js at module scope (for
// extendTrial/bulkExtendTrial), which otherwise pulls in the real auth.js ->
// mailer -> Resend chain and crashes on a missing API key. Not exercised by
// grantCredits itself, so a bare mock is enough to keep the import graph light.
vi.mock("../../modules/billing/billing.service.js", () => ({
  extendTrialForOrg: vi.fn(),
}));

describe("admin.repository.grantCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("grants the full requested amount when it fits within the remaining headroom", async () => {
    mocks.getCurrentUsage
      .mockResolvedValueOnce({
        tier: "TRIAL",
        credits: { used: 20, limit: 30, remaining: 10 },
      })
      .mockResolvedValueOnce({
        tier: "TRIAL",
        credits: { used: 10, limit: 30, remaining: 20 },
      });
    mocks.adjustCurrentPeriodUsage.mockResolvedValue(undefined);

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.grantCredits("org_1", 10);

    assert.equal(mocks.adjustCurrentPeriodUsage.mock.calls.length, 1);
    assert.deepEqual(mocks.adjustCurrentPeriodUsage.mock.calls[0], ["org_1", -10]);
    assert.deepEqual(result, {
      organizationId: "org_1",
      requested: 10,
      applied: 10,
      before: { used: 20, limit: 30, remaining: 10 },
      after: { used: 10, limit: 30, remaining: 20 },
    });
  });

  test("clamps to the tier cap when the requested amount exceeds remaining headroom", async () => {
    // Org has 5/30 remaining; admin tries to grant 50 — adjustCurrentPeriodUsage
    // floors creditsUsed at 0, so only 25 credits actually get applied.
    mocks.getCurrentUsage
      .mockResolvedValueOnce({
        tier: "TRIAL",
        credits: { used: 25, limit: 30, remaining: 5 },
      })
      .mockResolvedValueOnce({
        tier: "TRIAL",
        credits: { used: 0, limit: 30, remaining: 30 },
      });
    mocks.adjustCurrentPeriodUsage.mockResolvedValue(undefined);

    const repo = await import("../../modules/admin/admin.repository.js");
    const result = await repo.grantCredits("org_2", 50);

    assert.deepEqual(mocks.adjustCurrentPeriodUsage.mock.calls[0], ["org_2", -50]);
    assert.equal(result.requested, 50);
    assert.equal(result.applied, 25);
    assert.equal(result.after.remaining, 30);
  });
});
