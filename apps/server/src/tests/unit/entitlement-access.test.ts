import { assert, beforeEach, describe, test, vi } from "vitest";

type Ent = {
  organizationId: string; agent: string; source: string; status: string;
  currentPeriodEnd: Date; priceCents: number;
};
let ents: Ent[] = [];

type OrgRow = { trialStartedAt: Date | null };
let orgs: Record<string, OrgRow> = {};

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where }: never) => {
      const w = where as {
        organizationId: string; agent?: string;
        currentPeriodEnd: { gt: Date }; status: { in: string[] };
      };
      return ents.filter((e) =>
        e.organizationId === w.organizationId &&
        (!w.agent || e.agent === w.agent) &&
        e.currentPeriodEnd > w.currentPeriodEnd.gt &&
        w.status.in.includes(e.status));
    }),
    // Used by the middleware to tell "only ever had a trial" apart from
    // "held a paid entitlement at some point" — deliberately unfiltered by
    // status/currentPeriodEnd, unlike findMany above.
    findFirst: vi.fn(async ({ where }: never) => {
      const w = where as { organizationId: string; source?: string };
      return ents.find((e) =>
        e.organizationId === w.organizationId &&
        (!w.source || e.source === w.source)) ?? null;
    }),
  },
  organization: {
    findUnique: vi.fn(async ({ where }: never) => {
      const w = where as { id: string };
      return orgs[w.id] ?? null;
    }),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { hasAgentAccess, getActiveEntitlements, getMayaEntitlement } =
  await import("../../modules/billing/entitlement.service.js");
const { entitlementMiddlewareForAgent } =
  await import("../../middlewares/entitlement.middleware.js");

const future = new Date(Date.now() + 10 * 86400_000);
const past   = new Date(Date.now() - 1 * 86400_000);

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => { ents = []; orgs = {}; vi.clearAllMocks(); });

describe("hasAgentAccess", () => {
  test("ACTIVE and unexpired → access", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), true);
  });

  test("REGRESSION: ACTIVE but period lapsed → NO access even without a webhook", async () => {
    // The old model set entitlementExpiresAt=null for ACTIVE, so a missed
    // `subscription.expired` webhook granted access forever.
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: past, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
  });

  test("PAST_DUE within period → access (dunning grace)", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "PAST_DUE", currentPeriodEnd: future, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), true);
  });

  test("SUPERSEDED → no access", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "SUPERSEDED", currentPeriodEnd: future, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
  });

  test("agents are independent: Maya lapsed does not affect Rex", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: past,   priceCents: 1900 },
      { organizationId: "o1", agent: "REX",  source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 900 },
    ];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
    assert.equal(await hasAgentAccess("o1", "REX"  as never), true);
    assert.equal((await getActiveEntitlements("o1")).length, 1);
  });

  test("no rows → no access", async () => {
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
  });
});

describe("entitlementMiddlewareForAgent", () => {
  test("no req.organizationId → 403 'No active organization'", async () => {
    const req = {} as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.deepEqual(res.status.mock.calls[0], [403]);
    assert.deepEqual(res.json.mock.calls[0], [{ error: "No active organization" }]);
    assert.equal(next.mock.calls.length, 0);
  });

  test("zero active entitlements + trialStartedAt null → 402 'Trial not started'", async () => {
    ents = [];
    orgs.o1 = { trialStartedAt: null };
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.deepEqual(res.status.mock.calls[0], [402]);
    assert.deepEqual(res.json.mock.calls[0], [{ error: "Trial not started" }]);
    assert.equal(next.mock.calls.length, 0);
  });

  test("zero active entitlements + trialStartedAt set + only-ever TRIAL entitlements → 402 'Trial expired'", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "EXPIRED", currentPeriodEnd: past, priceCents: 0 },
    ];
    orgs.o1 = { trialStartedAt: past };
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.deepEqual(res.status.mock.calls[0], [402]);
    assert.deepEqual(res.json.mock.calls[0], [{ error: "Trial expired" }]);
    assert.equal(next.mock.calls.length, 0);
  });

  test("zero active entitlements + trialStartedAt set + has held a paid entitlement → 402 'Subscription expired'", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "EXPIRED", currentPeriodEnd: past, priceCents: 0 },
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "EXPIRED", currentPeriodEnd: past, priceCents: 1900 },
    ];
    orgs.o1 = { trialStartedAt: past };
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.deepEqual(res.status.mock.calls[0], [402]);
    assert.deepEqual(res.json.mock.calls[0], [{ error: "Subscription expired" }]);
    assert.equal(next.mock.calls.length, 0);
  });

  test("active entitlement for a different agent → 402 'Agent not purchased'", async () => {
    ents = [
      { organizationId: "o1", agent: "VEGA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 650 },
    ];
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.deepEqual(res.status.mock.calls[0], [402]);
    assert.deepEqual(res.json.mock.calls[0], [{ error: "Agent not purchased" }]);
    assert.equal(next.mock.calls.length, 0);
  });

  test("active entitlement for the requested agent → next() called", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 1900 },
    ];
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.equal(next.mock.calls.length, 1);
    assert.equal(res.status.mock.calls.length, 0);
  });

  test("called with no agent argument (shared /agents messages route) → any entitlement passes", async () => {
    ents = [
      { organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 900 },
    ];
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent()(req, res as never, next);

    assert.equal(next.mock.calls.length, 1);
    assert.equal(res.status.mock.calls.length, 0);
  });

  test("all covering rows PAST_DUE → next() called AND X-Billing-State: past_due header set", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "PAST_DUE", currentPeriodEnd: future, priceCents: 1900 },
    ];
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.equal(next.mock.calls.length, 1);
    assert.deepEqual(res.setHeader.mock.calls[0], ["X-Billing-State", "past_due"]);
  });

  test("one PAST_DUE row alongside a healthy ACTIVE row → next() called and header NOT set", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "PAST_DUE", currentPeriodEnd: future, priceCents: 1900 },
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",   currentPeriodEnd: future, priceCents: 650 },
    ];
    const req = { organizationId: "o1" } as never;
    const res = makeRes();
    const next = vi.fn();

    await entitlementMiddlewareForAgent("MAYA" as never)(req, res as never, next);

    assert.equal(next.mock.calls.length, 1);
    assert.equal(res.setHeader.mock.calls.length, 0);
  });
});

describe("getMayaEntitlement", () => {
  test("TRIAL + AGENT rows both covering → returns the AGENT row", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "TRIALING", currentPeriodEnd: future, priceCents: 0 },
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",   currentPeriodEnd: future, priceCents: 1900 },
    ];
    const result = await getMayaEntitlement("o1");
    assert.equal(result?.source, "AGENT");
  });

  test("no covering rows → returns null", async () => {
    ents = [];
    assert.equal(await getMayaEntitlement("o1"), null);
  });
});
