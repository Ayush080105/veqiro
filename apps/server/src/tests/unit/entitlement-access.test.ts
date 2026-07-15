import { assert, beforeEach, describe, test, vi } from "vitest";

type Ent = {
  organizationId: string; agent: string; source: string; status: string;
  currentPeriodEnd: Date; priceCents: number;
};
let ents: Ent[] = [];

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
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { hasAgentAccess, getActiveEntitlements } =
  await import("../../modules/billing/entitlement.service.js");

const future = new Date(Date.now() + 10 * 86400_000);
const past   = new Date(Date.now() - 1 * 86400_000);

beforeEach(() => { ents = []; vi.clearAllMocks(); });

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

  test("CREW row grants access to an agent with no AGENT row", async () => {
    ents = [{ organizationId: "o1", agent: "VEGA", source: "CREW", status: "ACTIVE", currentPeriodEnd: future, priceCents: 650 }];
    assert.equal(await hasAgentAccess("o1", "VEGA" as never), true);
  });

  test("overlapping rows: expired AGENT + active CREW → access", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "SUPERSEDED", currentPeriodEnd: past,   priceCents: 1900 },
      { organizationId: "o1", agent: "MAYA", source: "CREW",  status: "ACTIVE",     currentPeriodEnd: future, priceCents: 650 },
    ];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), true);
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
