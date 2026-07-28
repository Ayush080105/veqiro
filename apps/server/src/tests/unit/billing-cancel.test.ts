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
  cancelAtPeriodEnd: boolean;
};

let ents: EntRow[] = [];
let subs: BsRow[] = [];
const dodoUpdate = vi.fn(async () => ({}));

const ACCESS_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"];

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

const { cancelAgentAutoPay, resumeAgentAutoPay } =
  await import("../../modules/billing/billing.cancel.js");

const future = new Date(Date.now() + 12 * 86400_000);
const past = new Date(Date.now() - 12 * 86400_000);

beforeEach(() => {
  ents = [
    {
      id: "e1", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: future, cancelAtPeriodEnd: false, billingSubscriptionId: "bs_1",
    },
  ];
  subs = [{ id: "bs_1", dodoSubscriptionId: "sub_1", cancelAtPeriodEnd: false }];
  vi.clearAllMocks();
});

describe("cancelAgentAutoPay", () => {
  test("flags the entitlement and tells Dodo to stop at period end", async () => {
    const out = await cancelAgentAutoPay("o1", "REX" as never);
    assert.equal(out.activeUntil.getTime(), future.getTime());
    assert.equal(ents[0].cancelAtPeriodEnd, true);
    assert.deepEqual(dodoUpdate.mock.calls[0], ["sub_1", { cancel_at_next_billing_date: true }]);
  });

  test("access is retained until period end (status stays ACTIVE, not EXPIRED)", async () => {
    await cancelAgentAutoPay("o1", "REX" as never);
    assert.equal(ents[0].status, "ACTIVE", "cancelling auto-pay must not revoke paid-for access");
  });

  test("cancelling an agent the org does not own is rejected", async () => {
    await cancelAgentAutoPay("o1", "MAYA" as never).then(
      () => assert.fail("should have thrown"),
      (e) => assert.match(String(e), /not-entitled:MAYA/),
    );
  });

  test("a TRIAL entitlement has no auto-pay to cancel", async () => {
    ents[0].source = "TRIAL";
    ents[0].billingSubscriptionId = null;
    await cancelAgentAutoPay("o1", "REX" as never).then(
      () => assert.fail("should have thrown"),
      (e) => assert.match(String(e), /no-subscription-for-agent/),
    );
  });

  test("cancelling an agent whose subscription bills ONLY that agent succeeds (normal path)", async () => {
    const out = await cancelAgentAutoPay("o1", "REX" as never);
    assert.equal(out.activeUntil.getTime(), future.getTime());
    assert.equal(dodoUpdate.mock.calls.length, 1);
  });

  describe("shared-subscription guard (legacy quantity-hack backfill)", () => {
    test("cancelling an agent whose subscription bills TWO AGENT entitlements throws and mutates nothing", async () => {
      ents.push({
        id: "e2", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",
        currentPeriodEnd: future, cancelAtPeriodEnd: false, billingSubscriptionId: "bs_1",
      });
      const before = JSON.parse(JSON.stringify(ents));

      await cancelAgentAutoPay("o1", "REX" as never).then(
        () => assert.fail("should have thrown"),
        (e) => assert.match(String(e), /shared-subscription:MAYA,REX/),
      );

      assert.deepEqual(JSON.parse(JSON.stringify(ents)), before, "entitlement rows must be unchanged");
      assert.equal(dodoUpdate.mock.calls.length, 0, "Dodo must never be called when the guard fires");
    });

    test("the guard counts only ACTIVE/covering rows — an EXPIRED sibling does not trigger it", async () => {
      ents.push({
        id: "e2", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "EXPIRED",
        currentPeriodEnd: past, cancelAtPeriodEnd: false, billingSubscriptionId: "bs_1",
      });
      const out = await cancelAgentAutoPay("o1", "REX" as never);
      assert.equal(out.activeUntil.getTime(), future.getTime());
      assert.equal(ents[0].cancelAtPeriodEnd, true);
    });
  });
});

describe("resumeAgentAutoPay", () => {
  test("clears the flag and tells Dodo to keep billing", async () => {
    ents[0].cancelAtPeriodEnd = true;
    const out = await resumeAgentAutoPay("o1", "REX" as never);
    assert.equal(out.renewsOn.getTime(), future.getTime());
    assert.equal(ents[0].cancelAtPeriodEnd, false);
    assert.deepEqual(dodoUpdate.mock.calls[0], ["sub_1", { cancel_at_next_billing_date: false }]);
  });

  test("resuming a shared subscription resumes all its agents (no guard — harmless)", async () => {
    ents[0].cancelAtPeriodEnd = true;
    ents.push({
      id: "e2", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: future, cancelAtPeriodEnd: true, billingSubscriptionId: "bs_1",
    });
    await resumeAgentAutoPay("o1", "REX" as never);
    assert.equal(ents[0].cancelAtPeriodEnd, false);
    assert.equal(ents[1].cancelAtPeriodEnd, false);
  });
});
