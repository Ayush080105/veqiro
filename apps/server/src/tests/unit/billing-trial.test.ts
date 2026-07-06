import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// billing.service.ts touches Subscription/Organization/MayaUsage via `prisma`,
// creates Dodo customers via `dodoClient`, and imports `auth` (better-auth) at
// module scope — mock all three so importing the real service under test
// doesn't hit a database, an external API, or construct a real auth instance.
const mockPrisma = {
  subscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organization: {
    update: vi.fn(),
  },
  mayaUsage: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  member: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
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

const ALL_AGENTS = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"];

describe("startOrExtendTrial", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Simulate `prisma.$transaction(cb)` by handing the callback our mocked
    // prisma object directly, since it exposes the same tx.subscription /
    // tx.organization / tx.mayaUsage surface the real transaction client does.
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );

    mockPrisma.member.findFirst.mockResolvedValue({
      id: "member_1",
      user: { email: "owner@acme.test", name: "Owner" },
    });

    const dodo = await import("../../lib/dodo.js");
    vi.mocked(dodo.dodoClient.customers.create).mockResolvedValue({
      customer_id: "cus_123",
    } as never);
  });

  test("no existing Subscription: creates Dodo customer + TRIALING Subscription + Organization cache + MayaUsage period", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.subscription.create.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: "sub_new",
      ...(data as object),
    }));

    const { startOrExtendTrial } = await import("../../modules/billing/billing.service.js");
    const before = Date.now();
    const result = await startOrExtendTrial("org_legacy", 14);
    const after = Date.now();

    // Owner lookup + Dodo customer creation happened.
    assert.equal(mockPrisma.member.findFirst.mock.calls.length, 1);
    const dodo = await import("../../lib/dodo.js");
    expect(dodo.dodoClient.customers.create).toHaveBeenCalledWith({
      email: "owner@acme.test",
      name: "Owner",
      metadata: { organizationId: "org_legacy", type: "organization" },
    });

    // Subscription created as TRIALING with a trialEndsAt ~14 days out.
    const createCall = mockPrisma.subscription.create.mock.calls[0]![0];
    assert.equal(createCall.data.organizationId, "org_legacy");
    assert.equal(createCall.data.dodoCustomerId, "cus_123");
    assert.equal(createCall.data.status, "TRIALING");
    assert.equal(createCall.data.entitlementMode, "CREW");
    assert.deepEqual(createCall.data.selectedAgents, ALL_AGENTS);
    const trialEndsAt: Date = createCall.data.trialEndsAt;
    const expectedMs = 14 * 24 * 60 * 60 * 1000;
    assert.ok(trialEndsAt.getTime() - before >= expectedMs - 1000);
    assert.ok(trialEndsAt.getTime() - after <= expectedMs + 1000);

    // Organization cache flipped to match.
    const orgUpdateCall = mockPrisma.organization.update.mock.calls[0]![0];
    assert.equal(orgUpdateCall.where.id, "org_legacy");
    assert.equal(orgUpdateCall.data.subscriptionStatus, "TRIALING");
    assert.equal(orgUpdateCall.data.entitlementExpiresAt.getTime(), trialEndsAt.getTime());
    assert.deepEqual(orgUpdateCall.data.unlockedAgents, ALL_AGENTS);

    // Initial Maya usage period opened for the trial window.
    const usageCall = mockPrisma.mayaUsage.create.mock.calls[0]![0];
    assert.equal(usageCall.data.organizationId, "org_legacy");
    assert.equal(usageCall.data.periodEnd.getTime(), trialEndsAt.getTime());

    // Returns the created Subscription row.
    assert.equal((result as { id: string }).id, "sub_new");
  });

  test("existing Subscription (e.g. EXPIRED): syncs Subscription+Organization via syncOrgEntitlement and opens a new MayaUsage period when none is active", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub_1",
      organizationId: "org_expired",
      status: "EXPIRED",
      entitlementMode: "CUSTOM",
      selectedAgents: ["MAYA"],
      trialEndsAt: null,
      currentPeriodEnd: null,
    });
    mockPrisma.subscription.update.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: "sub_1",
      organizationId: "org_expired",
      entitlementMode: "CUSTOM",
      selectedAgents: ["MAYA"],
      currentPeriodEnd: null,
      ...(data as object),
    }));
    mockPrisma.mayaUsage.findFirst.mockResolvedValue(null);

    const { startOrExtendTrial } = await import("../../modules/billing/billing.service.js");
    const result = await startOrExtendTrial("org_expired", 7);

    // No Dodo customer created for an org that already has a Subscription.
    const dodo = await import("../../lib/dodo.js");
    expect(dodo.dodoClient.customers.create).not.toHaveBeenCalled();

    // Subscription flipped to TRIALING with a fresh trialEndsAt, existing
    // entitlementMode/selectedAgents left untouched.
    const updateCall = mockPrisma.subscription.update.mock.calls[0]![0];
    assert.deepEqual(updateCall.where, { organizationId: "org_expired" });
    assert.equal(updateCall.data.status, "TRIALING");
    const trialEndsAt: Date = updateCall.data.trialEndsAt;
    assert.ok(trialEndsAt instanceof Date);

    // Organization cache derived from the updated Subscription (deriveEntitlementFields).
    const orgUpdateCall = mockPrisma.organization.update.mock.calls[0]![0];
    assert.equal(orgUpdateCall.where.id, "org_expired");
    assert.equal(orgUpdateCall.data.subscriptionStatus, "TRIALING");
    assert.equal(orgUpdateCall.data.entitlementExpiresAt.getTime(), trialEndsAt.getTime());
    assert.deepEqual(orgUpdateCall.data.unlockedAgents, ["MAYA"]);

    // No active MayaUsage period existed, so a new one covering the trial window was created.
    assert.equal(mockPrisma.mayaUsage.findFirst.mock.calls.length, 1);
    const usageCall = mockPrisma.mayaUsage.create.mock.calls[0]![0];
    assert.equal(usageCall.data.organizationId, "org_expired");
    assert.equal(usageCall.data.periodEnd.getTime(), trialEndsAt.getTime());

    assert.equal((result as { status: string }).status, "TRIALING");
  });

  test("existing Subscription with an already-active MayaUsage period: does not create a duplicate period", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub_2",
      organizationId: "org_active_trial",
      status: "TRIALING",
      entitlementMode: "CREW",
      selectedAgents: ALL_AGENTS,
      trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: null,
    });
    mockPrisma.subscription.update.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: "sub_2",
      organizationId: "org_active_trial",
      entitlementMode: "CREW",
      selectedAgents: ALL_AGENTS,
      currentPeriodEnd: null,
      ...(data as object),
    }));
    mockPrisma.mayaUsage.findFirst.mockResolvedValue({
      id: "usage_existing",
      periodEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });

    const { startOrExtendTrial } = await import("../../modules/billing/billing.service.js");
    await startOrExtendTrial("org_active_trial", 7);

    assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
  });
});
