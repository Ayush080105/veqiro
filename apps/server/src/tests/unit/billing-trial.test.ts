import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// billing.service.ts imports `auth` (better-auth) at module scope — mock it
// (and dodoClient, for good measure, since other exports in this module use
// it) so importing the real service under test doesn't construct a real auth
// instance or hit an external API.
const mockPrisma = {
  entitlement: {
    updateMany: vi.fn(),
  },
};

vi.mock("../../config/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../lib/dodo.js", () => ({
  dodoClient: {
    customers: { create: vi.fn() },
  },
}));

vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

describe("extendTrialForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("extends TRIAL-sourced entitlement rows to TRIALING with a fresh currentPeriodEnd", async () => {
    mockPrisma.entitlement.updateMany.mockResolvedValue({ count: 6 });

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    const before = Date.now();
    const result = await extendTrialForOrg("org_1", 14);
    const after = Date.now();

    const call = mockPrisma.entitlement.updateMany.mock.calls[0]![0];
    assert.deepEqual(call.where, { organizationId: "org_1", source: "TRIAL" });
    assert.equal(call.data.status, "TRIALING");

    const expectedMs = 14 * 24 * 60 * 60 * 1000;
    assert.ok(call.data.currentPeriodEnd.getTime() - before >= expectedMs - 1000);
    assert.ok(call.data.currentPeriodEnd.getTime() - after <= expectedMs + 1000);
    assert.equal(result.trialEndsAt.getTime(), call.data.currentPeriodEnd.getTime());
  });

  test("defaults to a 7 day extension when days is omitted", async () => {
    mockPrisma.entitlement.updateMany.mockResolvedValue({ count: 6 });

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    const before = Date.now();
    await extendTrialForOrg("org_2");

    const call = mockPrisma.entitlement.updateMany.mock.calls[0]![0];
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    assert.ok(call.data.currentPeriodEnd.getTime() - before >= expectedMs - 1000);
  });

  test("re-TRIALs rows the sweeper already marked EXPIRED — that is what 'extend an expired trial' means", async () => {
    // updateMany's where clause doesn't filter by status, so it reaches
    // EXPIRED rows too — asserted here by confirming the where clause has no
    // status filter at all.
    mockPrisma.entitlement.updateMany.mockResolvedValue({ count: 6 });

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    await extendTrialForOrg("org_expired", 7);

    const call = mockPrisma.entitlement.updateMany.mock.calls[0]![0];
    assert.deepEqual(Object.keys(call.where).sort(), ["organizationId", "source"]);
  });

  test("never touches MayaUsage — extending an expired trial must not silently hand back spent credits", async () => {
    // mockPrisma intentionally has no `mayaUsage` key at all: if
    // extendTrialForOrg touched it (e.g. to reset creditsUsed via a fresh
    // period, the way the deleted startOrExtendTrial did), this call would
    // throw "Cannot read properties of undefined" instead of resolving.
    mockPrisma.entitlement.updateMany.mockResolvedValue({ count: 6 });

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    const result = await extendTrialForOrg("org_3", 7);

    assert.ok(result.trialEndsAt instanceof Date);
  });

  test("throws no-trial-to-extend when the org has no TRIAL entitlement rows", async () => {
    mockPrisma.entitlement.updateMany.mockResolvedValue({ count: 0 });

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");

    await expect(extendTrialForOrg("org_no_trial", 7)).rejects.toThrow(/no-trial-to-extend/);
  });
});
