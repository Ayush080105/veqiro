import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// billing.service.ts imports `auth` (better-auth) at module scope — mock it
// (and dodoClient, for good measure, since other exports in this module use
// it) so importing the real service under test doesn't construct a real auth
// instance or hit an external API.
const mockPrisma = {
  entitlement: {
    updateMany: vi.fn(),
    // Default: no active paid entitlement, so the org-has-paid-entitlement
    // guard in extendTrialForOrg passes through for tests that don't care
    // about it. Tests exercising the guard itself override this per-case.
    findFirst: vi.fn(async () => null),
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

// These tests use a real (stateful) in-memory row store for `entitlement`
// instead of call-count mocks: the whole point of the guard is that stale
// EXPIRED TRIAL rows must survive untouched when the org is a paying
// customer, and that's only checkable by inspecting row state after the
// call, not by asserting which mock functions fired.
type Row = {
  id: string;
  organizationId: string;
  agent: string;
  source: "TRIAL" | "AGENT";
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "EXPIRED" | "SUPERSEDED";
  currentPeriodEnd: Date;
};

const ACCESS_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"];
let rows: Row[] = [];

function statefulFindFirst({ where }: { where: { organizationId: string; source: { in: string[] }; status: { in: string[] }; currentPeriodEnd: { gt: Date } } }) {
  const match = rows.find((r) =>
    r.organizationId === where.organizationId &&
    where.source.in.includes(r.source) &&
    where.status.in.includes(r.status) &&
    r.currentPeriodEnd.getTime() > where.currentPeriodEnd.gt.getTime(),
  );
  return Promise.resolve(match ?? null);
}

function statefulUpdateMany({ where, data }: { where: { organizationId: string; source: string }; data: Partial<Row> }) {
  const matches = rows.filter((r) => r.organizationId === where.organizationId && r.source === where.source);
  for (const r of matches) Object.assign(r, data);
  return Promise.resolve({ count: matches.length });
}

describe("extendTrialForOrg — org-has-paid-entitlement guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [];
    // Re-point the mocks at the stateful implementations regardless of what
    // earlier tests in this file left behind via mockResolvedValue.
    mockPrisma.entitlement.findFirst.mockImplementation(statefulFindFirst as never);
    mockPrisma.entitlement.updateMany.mockImplementation(statefulUpdateMany as never);
  });

  test("a genuine expired-trial org (only TRIAL rows) succeeds — rows return to TRIALING with a fresh period", async () => {
    const staleEnd = new Date(Date.now() - 1000);
    rows = [
      { id: "t1", organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "EXPIRED", currentPeriodEnd: staleEnd },
      { id: "t2", organizationId: "o1", agent: "LEX", source: "TRIAL", status: "EXPIRED", currentPeriodEnd: staleEnd },
    ];

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    const result = await extendTrialForOrg("o1", 7);

    assert.ok(rows.every((r) => r.status === "TRIALING"));
    assert.ok(rows.every((r) => r.currentPeriodEnd.getTime() > Date.now()));
    assert.equal(result.trialEndsAt.getTime(), rows[0]!.currentPeriodEnd.getTime());
  });

  test("REGRESSION: an org with stale EXPIRED TRIAL rows AND an active AGENT entitlement is refused, and nothing is mutated", async () => {
    const staleEnd = new Date(Date.now() - 1000);
    const futureEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    rows = [
      { id: "t1", organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "EXPIRED", currentPeriodEnd: staleEnd },
      { id: "a1", organizationId: "o1", agent: "LEX", source: "AGENT", status: "ACTIVE", currentPeriodEnd: futureEnd },
    ];

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    await extendTrialForOrg("o1", 7).then(
      () => assert.fail("a paying org's trial rows must not be revivable"),
      (e) => assert.match(String(e), /org-has-paid-entitlement/),
    );

    assert.equal(rows[0]!.status, "EXPIRED");
    assert.equal(rows[0]!.currentPeriodEnd.getTime(), staleEnd.getTime());
    assert.equal(rows[1]!.status, "ACTIVE");
  });

  test("a lapsed ex-customer (paid entitlement itself EXPIRED) may have their trial revived", async () => {
    const staleEnd = new Date(Date.now() - 1000);
    rows = [
      { id: "t1", organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "EXPIRED", currentPeriodEnd: staleEnd },
      { id: "a1", organizationId: "o1", agent: "LEX", source: "AGENT", status: "EXPIRED", currentPeriodEnd: staleEnd },
    ];

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    const result = await extendTrialForOrg("o1", 7);

    assert.equal(rows[0]!.status, "TRIALING");
    assert.equal(rows[1]!.status, "EXPIRED"); // the lapsed paid row is untouched, just no longer blocking
    assert.ok(result.trialEndsAt instanceof Date);
  });

  test("an org with no TRIAL rows at all still throws no-trial-to-extend", async () => {
    rows = [];

    const { extendTrialForOrg } = await import("../../modules/billing/billing.service.js");
    await expect(extendTrialForOrg("o1", 7)).rejects.toThrow(/no-trial-to-extend/);
  });
});
