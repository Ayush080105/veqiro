import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// billing.controller.ts imports billing.service.ts at module scope, which
// imports lib/auth.ts (pulls in the mailer -> Resend chain, crashes without
// RESEND_API_KEY) and lib/dodo.ts (constructs a DodoPayments client, crashes
// without DODO_PAYMENTS_API_KEY). Mock both out the same way
// billing-checkout-guards.test.ts does, since this test only exercises the
// pure deriveStatusFields helper (plus getStatus below, with prisma mocked).
const mockGetSession = vi.fn();
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: mockGetSession } },
}));
vi.mock("../../lib/dodo.js", () => ({ dodoClient: {} }));

const mockPrisma = {
  subscription: { findUnique: vi.fn() },
  entitlement: { findMany: vi.fn() },
  pendingCheckout: { findFirst: vi.fn(), deleteMany: vi.fn() },
  member: { findFirst: vi.fn() },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { deriveStatusFields, getStatus, dismissPendingCheckout } = await import("../../modules/billing/billing.controller.js");

const ent = (
  agent: string,
  source: "TRIAL" | "AGENT" | "CREW",
  currentPeriodEnd: Date,
  extra: Record<string, unknown> = {},
) => ({
  agent,
  source,
  status: source === "TRIAL" ? "TRIALING" : "ACTIVE",
  currentPeriodEnd,
  cancelAtPeriodEnd: false,
  priceCents: 900,
  ...extra,
} as never);

describe("deriveStatusFields", () => {
  test("no active entitlements -> empty/null legacy fields, no trial", () => {
    const r = deriveStatusFields([]);
    assert.deepEqual(r.unlockedAgents, []);
    assert.deepEqual(r.selectedAgents, []);
    assert.equal(r.entitlementMode, "CUSTOM");
    assert.equal(r.currentPeriodEnd, null);
    assert.equal(r.trialEndsAt, null);
    assert.equal(r.daysRemaining, null);
    assert.deepEqual(r.entitlements, []);
  });

  test("TRIAL entitlements drive trialEndsAt/daysRemaining even though Subscription.status can never be TRIALING", () => {
    const trialEnd = new Date(Date.now() + 3 * 86400_000);
    const active = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"].map((a) =>
      ent(a, "TRIAL", trialEnd),
    );
    const r = deriveStatusFields(active);
    assert.equal(r.trialEndsAt?.toISOString(), trialEnd.toISOString());
    // ceil() of a slightly-under-3-days span can legitimately land on 3.
    assert.ok(r.daysRemaining === 2 || r.daysRemaining === 3, `expected ~3, got ${r.daysRemaining}`);
    assert.equal(r.entitlementMode, "CUSTOM");
    assert.equal(r.unlockedAgents.length, 6);
  });

  test("a CREW row sets entitlementMode CREW even alongside AGENT rows", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", future), ent("REX", "CREW", future)]);
    assert.equal(r.entitlementMode, "CREW");
  });

  test("paid AGENT rows do not set trialEndsAt/daysRemaining", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", future)]);
    assert.equal(r.trialEndsAt, null);
    assert.equal(r.daysRemaining, null);
  });

  test("currentPeriodEnd is the max across all active entitlements", () => {
    const soon = new Date(Date.now() + 1 * 86400_000);
    const later = new Date(Date.now() + 20 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", soon), ent("SAGE", "AGENT", later)]);
    assert.equal(r.currentPeriodEnd?.toISOString(), later.toISOString());
  });

  test("plan comes from the row's own BillingSubscription, not a shared value", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([
      ent("MAYA", "CREW", future, { billingSubscription: { plan: "ANNUAL" } }),
      ent("REX", "AGENT", future, { billingSubscription: { plan: "MONTHLY" } }),
      ent("SAGE", "TRIAL", future),
    ]);
    assert.equal(r.entitlements.find((e) => e.agent === "MAYA")?.plan, "ANNUAL");
    assert.equal(r.entitlements.find((e) => e.agent === "REX")?.plan, "MONTHLY");
    assert.equal(r.entitlements.find((e) => e.agent === "SAGE")?.plan, null);
  });

  test("entitlements passthrough preserves per-agent shape", () => {
    const future = new Date(Date.now() + 10 * 86400_000);
    const r = deriveStatusFields([ent("MAYA", "AGENT", future, { cancelAtPeriodEnd: true, priceCents: 1900 })]);
    assert.deepEqual(r.entitlements, [
      {
        agent: "MAYA",
        source: "AGENT",
        status: "ACTIVE",
        currentPeriodEnd: future,
        cancelAtPeriodEnd: true,
        priceCents: 1900,
        plan: null,
      },
    ]);
  });
});

describe("getStatus's pendingCheckout field", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "MONTHLY",
      dodoCustomerId: "cus_1",
    });
    mockPrisma.entitlement.findMany.mockResolvedValue([]);
  });

  function fakeReqRes(organizationId: string) {
    const json = vi.fn();
    const req = { organizationId } as never;
    const res = { status: () => ({ json }), json } as never;
    return { req, res, json };
  }

  test("no PendingCheckout row -> pendingCheckout is null", async () => {
    mockPrisma.pendingCheckout.findFirst.mockResolvedValue(null);
    const { req, res, json } = fakeReqRes("org_1");
    await getStatus(req, res);
    const body = json.mock.calls[0][0];
    assert.equal(body.subscription.pendingCheckout, null);
  });

  test("an in-flight PendingCheckout row surfaces kind/agent/plan/createdAt", async () => {
    const createdAt = new Date("2026-07-16T12:00:00Z");
    mockPrisma.pendingCheckout.findFirst.mockResolvedValue({
      kind: "AGENT",
      agent: "REX",
      plan: "MONTHLY",
      createdAt,
    });
    const { req, res, json } = fakeReqRes("org_1");
    await getStatus(req, res);
    const body = json.mock.calls[0][0];
    assert.deepEqual(body.subscription.pendingCheckout, {
      kind: "AGENT",
      agent: "REX",
      plan: "MONTHLY",
      createdAt,
    });
  });
});

describe("dismissPendingCheckout", () => {
  function fakeReqRes() {
    const json = vi.fn();
    const req = { headers: {} } as never;
    const res = { status: () => ({ json }), json } as never;
    return { req, res, json };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: "org_1" },
      user: { id: "user_1" },
    });
    mockPrisma.member.findFirst.mockResolvedValue({ id: "member_1" });
    mockPrisma.pendingCheckout.deleteMany.mockResolvedValue({ count: 1 });
  });

  test("deletes the org's PendingCheckout rows and returns the count", async () => {
    const { req, res, json } = fakeReqRes();
    await dismissPendingCheckout(req, res);

    assert.deepEqual(mockPrisma.pendingCheckout.deleteMany.mock.calls[0][0], {
      where: { organizationId: "org_1" },
    });
    assert.deepEqual(json.mock.calls[0][0], { dismissed: 1 });
  });

  test("rejects a non-owner", async () => {
    mockPrisma.member.findFirst.mockResolvedValue(null);
    const { req, res } = fakeReqRes();
    await expect(dismissPendingCheckout(req, res)).rejects.toThrow();
    assert.equal(mockPrisma.pendingCheckout.deleteMany.mock.calls.length, 0);
  });
});
