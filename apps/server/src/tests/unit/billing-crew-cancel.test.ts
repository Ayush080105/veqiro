import { assert, beforeEach, describe, test, vi } from "vitest";

type EntRow = {
  id: string;
  organizationId: string;
  agent: string;
  source: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  billingSubscriptionId: string | null;
};

type BsRow = {
  id: string;
  dodoSubscriptionId: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

let ents: EntRow[] = [];
let subs: BsRow[] = [];
const dodoUpdate = vi.fn(async () => ({}));

function matchesWhere(e: EntRow, where: Record<string, unknown>): boolean {
  if (where.organizationId !== undefined && e.organizationId !== where.organizationId) return false;
  if (where.agent !== undefined && e.agent !== where.agent) return false;
  if (where.source !== undefined && e.source !== where.source) return false;
  if (where.billingSubscriptionId !== undefined && e.billingSubscriptionId !== where.billingSubscriptionId) {
    return false;
  }
  if (where.status && typeof where.status === "object" && "in" in (where.status as object)) {
    const allowed = (where.status as { in: string[] }).in;
    if (!allowed.includes(e.status)) return false;
  }
  if (where.currentPeriodEnd && typeof where.currentPeriodEnd === "object" && "gt" in (where.currentPeriodEnd as object)) {
    const gt = (where.currentPeriodEnd as { gt: Date }).gt;
    if (!(e.currentPeriodEnd.getTime() > gt.getTime())) return false;
  }
  return true;
}

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where, orderBy }: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
    }) => {
      const results = ents.filter((e) => matchesWhere(e, where));
      if (orderBy?.currentPeriodEnd) {
        const dir = orderBy.currentPeriodEnd === "desc" ? -1 : 1;
        results.sort((a, b) => dir * (a.currentPeriodEnd.getTime() - b.currentPeriodEnd.getTime()));
      }
      return results;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<EntRow> }) => {
      let count = 0;
      for (const e of ents) {
        if (matchesWhere(e, where)) {
          Object.assign(e, data);
          count++;
        }
      }
      return { count };
    }),
  },
  billingSubscription: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return subs.find((s) => s.id === where.id) ?? null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<BsRow> }) => {
      const s = subs.find((s) => s.id === where.id);
      if (s) Object.assign(s, data);
      return s;
    }),
  },
  $transaction: vi.fn(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return (arg as (tx: unknown) => unknown)(mockPrisma);
  }),
};

vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../lib/dodo.js", () => ({ dodoClient: { subscriptions: { update: dodoUpdate } } }));

const { cancelCrewAutoPay, resumeCrewAutoPay } =
  await import("../../modules/billing/billing.crew-cancel.js");

const future = new Date(Date.now() + 12 * 86400_000);
const past = new Date(Date.now() - 12 * 86400_000);
const CREW_AGENTS = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"];

function seedCrew(billingSubscriptionId = "bs_crew") {
  return CREW_AGENTS.map((agent) => ({
    id: `crew-${agent}`, organizationId: "o1", agent, source: "CREW", status: "ACTIVE",
    currentPeriodEnd: future, cancelAtPeriodEnd: false, billingSubscriptionId,
  }));
}

beforeEach(() => {
  ents = seedCrew();
  subs = [{ id: "bs_crew", dodoSubscriptionId: "sub_crew", currentPeriodEnd: future, cancelAtPeriodEnd: false }];
  vi.clearAllMocks();
});

describe("cancelCrewAutoPay", () => {
  test("flags all six CREW entitlements + the subscription, calls Dodo once", async () => {
    const out = await cancelCrewAutoPay("o1");
    assert.equal(out.activeUntil.getTime(), future.getTime());
    for (const agent of CREW_AGENTS) {
      assert.equal(ents.find((e) => e.agent === agent)!.cancelAtPeriodEnd, true, `${agent} row must be flagged`);
    }
    assert.equal(subs[0].cancelAtPeriodEnd, true);
    assert.equal(dodoUpdate.mock.calls.length, 1);
    assert.deepEqual(dodoUpdate.mock.calls[0], ["sub_crew", { cancel_at_next_billing_date: true }]);
  });

  test("access is retained until period end (status stays ACTIVE, not EXPIRED)", async () => {
    await cancelCrewAutoPay("o1");
    for (const agent of CREW_AGENTS) {
      assert.equal(ents.find((e) => e.agent === agent)!.status, "ACTIVE");
    }
  });

  test("an org with no Crew subscription is rejected", async () => {
    ents = [];
    await cancelCrewAutoPay("o1").then(
      () => assert.fail("should have thrown"),
      (e) => assert.match(String(e), /no-crew-subscription/),
    );
    assert.equal(dodoUpdate.mock.calls.length, 0);
  });

  test("an EXPIRED Crew (past period end) does not count as an active subscription", async () => {
    ents = seedCrew().map((e) => ({ ...e, currentPeriodEnd: past, status: "EXPIRED" }));
    await cancelCrewAutoPay("o1").then(
      () => assert.fail("should have thrown"),
      (e) => assert.match(String(e), /no-crew-subscription/),
    );
  });

  test("cancelling Crew never touches a same-org SUPERSEDED AGENT row from an earlier upgrade", async () => {
    ents.push({
      id: "agent-maya-superseded", organizationId: "o1", agent: "MAYA", source: "AGENT",
      status: "SUPERSEDED", currentPeriodEnd: future, cancelAtPeriodEnd: false, billingSubscriptionId: "bs_agent_old",
    });
    subs.push({ id: "bs_agent_old", dodoSubscriptionId: "sub_agent_old", currentPeriodEnd: future, cancelAtPeriodEnd: false });

    await cancelCrewAutoPay("o1");

    const superseded = ents.find((e) => e.id === "agent-maya-superseded")!;
    assert.equal(superseded.status, "SUPERSEDED", "must remain SUPERSEDED");
    assert.equal(superseded.cancelAtPeriodEnd, false, "must not be flagged");
    assert.equal(subs.find((s) => s.id === "bs_agent_old")!.cancelAtPeriodEnd, false, "old AGENT subscription must be untouched");
    assert.equal(dodoUpdate.mock.calls.length, 1, "Dodo must only be called for the Crew subscription");
    assert.equal(dodoUpdate.mock.calls[0][0], "sub_crew");
  });
});

describe("resumeCrewAutoPay", () => {
  test("clears the flag on all six rows + the subscription, tells Dodo to keep billing", async () => {
    ents.forEach((e) => { e.cancelAtPeriodEnd = true; });
    subs[0].cancelAtPeriodEnd = true;

    const out = await resumeCrewAutoPay("o1");

    assert.equal(out.renewsOn.getTime(), future.getTime());
    for (const agent of CREW_AGENTS) {
      assert.equal(ents.find((e) => e.agent === agent)!.cancelAtPeriodEnd, false);
    }
    assert.equal(subs[0].cancelAtPeriodEnd, false);
    assert.deepEqual(dodoUpdate.mock.calls[0], ["sub_crew", { cancel_at_next_billing_date: false }]);
  });

  test("an org with no Crew subscription is rejected", async () => {
    ents = [];
    await resumeCrewAutoPay("o1").then(
      () => assert.fail("should have thrown"),
      (e) => assert.match(String(e), /no-crew-subscription/),
    );
  });
});
