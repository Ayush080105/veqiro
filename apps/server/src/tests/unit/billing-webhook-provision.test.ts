import { assert, beforeEach, describe, test, vi } from "vitest";

// billing.webhooks.ts (transitively, via billing.service.ts) pulls in
// lib/auth.ts, which pulls in the mailer -> Resend chain and crashes without
// RESEND_API_KEY set. Same workaround as billing-webhook-idempotency.test.ts.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

// billing.webhooks.ts pulls in dodoClient (for applyCrewActivation's
// subscriptions.update call) — mock it the same way billing-webhook-
// idempotency.test.ts does so importing the real module under test doesn't
// construct a real Dodo API client.
const updateCalls: Array<{ subId: string; body: unknown }> = [];
const mockDodo = {
  subscriptions: {
    update: vi.fn(async (subId: string, body: unknown) => {
      updateCalls.push({ subId, body });
      return {};
    }),
  },
};
vi.mock("../../lib/dodo.js", () => ({ dodoClient: mockDodo }));

let ents: Array<Record<string, unknown>> = [];
let billingSubs: Array<Record<string, unknown>> = [];
let pendingCheckouts: Array<Record<string, unknown>> = [];
let webhookEvents: Array<Record<string, unknown>> = [];

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
      if (!where) return ents;
      return ents.filter((e) => {
        if (where.organizationId && e.organizationId !== where.organizationId) return false;
        if (where.billingSubscriptionId && e.billingSubscriptionId !== where.billingSubscriptionId) return false;
        if (where.source && e.source !== where.source) return false;
        return true;
      });
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `ent_${ents.length + 1}`, ...data };
      ents.push(row);
      return row;
    }),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      const rows = data.map((d, i) => ({ id: `ent_${ents.length + i + 1}`, ...d }));
      ents.push(...rows);
      return { count: rows.length };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let count = 0;
      for (const e of ents) {
        if (where.billingSubscriptionId && e.billingSubscriptionId !== where.billingSubscriptionId) continue;
        if (where.id && !(where.id as { in: string[] }).in.includes(e.id as string)) continue;
        if (where.status && typeof where.status === "object" && "in" in (where.status as object)) {
          const allowed = (where.status as { in: string[] }).in;
          if (!allowed.includes(e.status as string)) continue;
        } else if (where.status && e.status !== where.status) {
          continue;
        }
        Object.assign(e, data);
        count += 1;
      }
      return { count };
    }),
  },
  billingSubscription: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `bs_${billingSubs.length + 1}`, ...data };
      billingSubs.push(row);
      return row;
    }),
    findUnique: vi.fn(async ({ where }: { where: { dodoSubscriptionId?: string; id?: string } }) => {
      if (where.dodoSubscriptionId) {
        return billingSubs.find((b) => b.dodoSubscriptionId === where.dodoSubscriptionId) ?? null;
      }
      return billingSubs.find((b) => b.id === where.id) ?? null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const bs = billingSubs.find((b) => b.id === where.id);
      if (bs) Object.assign(bs, data);
      return bs;
    }),
  },
  pendingCheckout: {
    findFirst: vi.fn(async ({ where }: { where: { organizationId: string } }) => {
      const rows = pendingCheckouts
        .filter((p) => p.organizationId === where.organizationId)
        .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
      return rows[0] ?? null;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      pendingCheckouts = pendingCheckouts.filter((p) => p.id !== where.id);
    }),
    // Mirrors the shape billing.webhooks.ts's cleanupPendingCheckouts uses:
    // { organizationId, OR: [{ kind, agent? }, { createdAt: { lt } }] }.
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const matchesCond = (p: Record<string, unknown>, cond: Record<string, unknown>) => {
        if ("kind" in cond && p.kind !== cond.kind) return false;
        if ("agent" in cond && p.agent !== cond.agent) return false;
        if ("createdAt" in cond) {
          const lt = (cond.createdAt as { lt: Date }).lt;
          if (!((p.createdAt as Date).getTime() < lt.getTime())) return false;
        }
        return true;
      };
      const matches = (p: Record<string, unknown>) => {
        if (where.organizationId && p.organizationId !== where.organizationId) return false;
        const or = where.OR as Array<Record<string, unknown>> | undefined;
        if (or) return or.some((cond) => matchesCond(p, cond));
        return true;
      };
      const before = pendingCheckouts.length;
      pendingCheckouts = pendingCheckouts.filter((p) => !matches(p));
      return { count: before - pendingCheckouts.length };
    }),
  },
  billingWebhookEvent: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (webhookEvents.some((e) => e.eventId === data.eventId)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      webhookEvents.push({ ...data });
      return data;
    }),
    update: vi.fn(async ({ where, data }: { where: { eventId: string }; data: Record<string, unknown> }) => {
      const row = webhookEvents.find((e) => e.eventId === where.eventId);
      if (row) Object.assign(row, data);
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { eventId: string } }) => {
      webhookEvents = webhookEvents.filter((e) => e.eventId !== where.eventId);
    }),
  },
  // Supports both call shapes used across billing.webhooks.ts:
  //   $transaction(async (tx) => {...})   — applyAgentActivation / applyCrewActivation
  //   $transaction([p1, p2, ...])         — renewed / cancelled / expired / payment-failed
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const {
  applyAgentActivation,
  applyCrewActivation,
  handleSubscriptionActive,
  handleSubscriptionRenewed,
  handlePaymentFailed,
  handleSubscriptionExpired,
} = await import("../../modules/billing/billing.webhooks.js");

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86400_000);
}

beforeEach(() => {
  ents = [];
  billingSubs = [];
  pendingCheckouts = [];
  webhookEvents = [];
  updateCalls.length = 0;
  vi.clearAllMocks();
  process.env.CREW_MONTHLY_CENTS = "3900";
  process.env.CREW_ANNUAL_CENTS = "34800";
  process.env.DODO_PRODUCT_CREW_MONTHLY = "pdt_crew_monthly";
  process.env.DODO_PRODUCT_CREW_ANNUAL = "pdt_crew_annual";
  process.env.DODO_PRODUCT_AGENT_MAYA = "pdt_maya";
  process.env.DODO_PRODUCT_AGENT_REX = "pdt_rex";
  delete process.env.AGENT_PRICE_REX_MONTHLY_CENTS;
});

describe("applyAgentActivation", () => {
  test("REGRESSION: buying Rex does not erase Maya", async () => {
    ents = [{
      id: "ent_maya", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: daysFromNow(20), billingSubscriptionId: "bs_maya",
    }];

    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: daysFromNow(30),
    });

    const agents = ents.map((e) => e.agent).sort();
    assert.deepEqual(agents, ["MAYA", "REX"], "Maya must survive Rex's purchase");
  });

  test("Maya and Rex keep independent period ends", async () => {
    const mayaEnd = daysFromNow(20);
    const rexEnd = daysFromNow(30);
    ents = [{
      id: "ent_maya", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: mayaEnd, billingSubscriptionId: "bs_maya",
    }];

    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: rexEnd,
    });

    const maya = ents.find((e) => e.agent === "MAYA")!;
    const rex = ents.find((e) => e.agent === "REX")!;
    assert.equal((maya.currentPeriodEnd as Date).getTime(), mayaEnd.getTime());
    assert.equal((rex.currentPeriodEnd as Date).getTime(), rexEnd.getTime());
  });

  test("stamps the price paid for each agent", async () => {
    process.env.AGENT_PRICE_REX_MONTHLY_CENTS = "900";
    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: daysFromNow(30),
    });
    assert.equal(ents[0].priceCents, 900);
  });

  test("creates a BillingSubscription row scoped to this Dodo subscription", async () => {
    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: daysFromNow(30),
    });
    assert.equal(billingSubs.length, 1);
    assert.equal(billingSubs[0].dodoSubscriptionId, "sub_rex");
    assert.equal(billingSubs[0].plan, "MONTHLY");
    assert.equal(ents[0].billingSubscriptionId, billingSubs[0].id);
  });
});

describe("applyCrewActivation", () => {
  test("creates six CREW rows priced at floor(crewPrice / 6), not agent list price", async () => {
    await applyCrewActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_crew",
      plan: "MONTHLY" as never, periodEnd: daysFromNow(30),
    });
    assert.equal(ents.length, 6);
    for (const e of ents) {
      assert.equal(e.source, "CREW");
      assert.equal(e.priceCents, Math.floor(3900 / 6));
    }
  });

  test("supersedes (not deletes) prior AGENT rows for the org", async () => {
    ents = [{
      id: "ent_rex", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: daysFromNow(20), billingSubscriptionId: "bs_rex",
    }];
    billingSubs = [{ id: "bs_rex", organizationId: "o1", dodoSubscriptionId: "sub_rex", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(20) }];

    await applyCrewActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_crew",
      plan: "MONTHLY" as never, periodEnd: daysFromNow(30),
    });

    const rex = ents.find((e) => e.id === "ent_rex")!;
    assert.equal(rex.status, "SUPERSEDED", "prior AGENT row must be superseded, not deleted");
    assert.ok(ents.some((e) => e.agent === "REX" && e.source === "CREW"), "a new CREW row must exist");
  });

  test("stops the superseded subscription's auto-pay OUTSIDE the write transaction", async () => {
    ents = [{
      id: "ent_rex", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: daysFromNow(20), billingSubscriptionId: "bs_rex",
    }];
    billingSubs = [{ id: "bs_rex", organizationId: "o1", dodoSubscriptionId: "sub_rex", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(20) }];

    await applyCrewActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_crew",
      plan: "MONTHLY" as never, periodEnd: daysFromNow(30),
    });

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].subId, "sub_rex");
    assert.deepEqual(updateCalls[0].body, { cancel_at_next_billing_date: true });
  });

  test("a failure stopping the superseded Dodo subscription does not undo the Crew grant already paid for", async () => {
    ents = [{
      id: "ent_rex", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE",
      currentPeriodEnd: daysFromNow(20), billingSubscriptionId: "bs_rex",
    }];
    billingSubs = [{ id: "bs_rex", organizationId: "o1", dodoSubscriptionId: "sub_rex", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(20) }];
    mockDodo.subscriptions.update = vi.fn(async () => { throw new Error("dodo down"); });

    // Must not throw — the Crew grant is already committed and must survive
    // a failure in the best-effort "stop the old sub" cleanup step.
    await applyCrewActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_crew",
      plan: "MONTHLY" as never, periodEnd: daysFromNow(30),
    });

    assert.ok(ents.some((e) => e.agent === "REX" && e.source === "CREW"), "Crew grant must still exist");
    const rex = ents.find((e) => e.id === "ent_rex")!;
    assert.equal(rex.status, "SUPERSEDED", "supersede must still have committed despite the Dodo call failing");
  });
});

describe("handleSubscriptionActive", () => {
  const basePayload = (overrides: Record<string, unknown> = {}) => ({
    type: "subscription.active",
    data: {
      subscription_id: "sub_new",
      next_billing_date: daysFromNow(30).toISOString(),
      metadata: { organizationId: "o1" },
      ...overrides,
    },
  });

  test("dispatches to applyAgentActivation using metadata written at checkout, and cleans up the matching PendingCheckout row", async () => {
    pendingCheckouts = [{
      id: "pc_1", organizationId: "o1", sessionId: "sess_1",
      kind: "AGENT", agent: "REX", plan: "MONTHLY", createdAt: new Date(),
    }];

    await handleSubscriptionActive(
      basePayload({ metadata: { organizationId: "o1", kind: "AGENT", agent: "REX" } }) as never,
    );

    assert.equal(ents.length, 1);
    assert.equal(ents[0].agent, "REX");
    assert.equal(ents[0].source, "AGENT");
    assert.equal(pendingCheckouts.length, 0, "the matching PendingCheckout row must be cleaned up");
  });

  test("dispatches to applyCrewActivation using metadata written at checkout, and cleans up the matching PendingCheckout row", async () => {
    pendingCheckouts = [{
      id: "pc_1", organizationId: "o1", sessionId: "sess_1",
      kind: "CREW", agent: null, plan: "MONTHLY", createdAt: new Date(),
    }];

    await handleSubscriptionActive(
      basePayload({ metadata: { organizationId: "o1", kind: "CREW", plan: "MONTHLY" } }) as never,
    );

    assert.equal(ents.length, 6);
    assert.ok(ents.every((e) => e.source === "CREW"));
    assert.equal(pendingCheckouts.length, 0, "the matching PendingCheckout row must be cleaned up");
  });

  test("REGRESSION (the money bug): an abandoned Rex checkout is the most-recent PendingCheckout row, but the customer actually paid for Maya — Maya must be provisioned, not Rex", async () => {
    const older = new Date(Date.now() - 10 * 60 * 1000); // Maya checkout opened first...
    const newer = new Date(); // ...then abandoned; Rex checkout opened after and is now "most recent"
    pendingCheckouts = [
      { id: "pc_maya", organizationId: "o1", sessionId: "sess_maya", kind: "AGENT", agent: "MAYA", plan: "MONTHLY", createdAt: older },
      { id: "pc_rex", organizationId: "o1", sessionId: "sess_rex", kind: "AGENT", agent: "REX", plan: "MONTHLY", createdAt: newer },
    ];

    // The webhook that actually fires is for the completed Maya checkout:
    // its own session's metadata and product_id both say MAYA.
    await handleSubscriptionActive(
      basePayload({
        metadata: { organizationId: "o1", kind: "AGENT", agent: "MAYA" },
        product_id: "pdt_maya",
      }) as never,
    );

    assert.equal(ents.length, 1);
    assert.equal(
      ents[0].agent,
      "MAYA",
      "the customer paid for Maya's subscription (this event's own metadata says MAYA) and must be provisioned Maya — recency of an unrelated PendingCheckout row must never override that",
    );
  });

  test("resolves the agent from metadata when present", async () => {
    pendingCheckouts = [];
    await handleSubscriptionActive(
      basePayload({ metadata: { organizationId: "o1", kind: "AGENT", agent: "REX" } }) as never,
    );
    assert.equal(ents.length, 1);
    assert.equal(ents[0].agent, "REX");
  });

  test("falls back to product_id resolution when metadata carries no agent/kind", async () => {
    pendingCheckouts = [];
    await handleSubscriptionActive(
      basePayload({ metadata: { organizationId: "o1" }, product_id: "pdt_rex" }) as never,
    );
    assert.equal(ents.length, 1);
    assert.equal(ents[0].agent, "REX");
  });

  test("fails closed with ignored-unresolved-agent when neither metadata nor product_id resolve an agent — never defaults", async () => {
    pendingCheckouts = [];
    await handleSubscriptionActive(
      basePayload({ metadata: { organizationId: "o1" } }) as never,
    );
    assert.equal(ents.length, 0, "no entitlement must be created for an unresolved agent");
    assert.equal(billingSubs.length, 0);
  });

  test("REGRESSION: metadata.plan wins over a stale PendingCheckout row's plan for Crew pricing", async () => {
    // The PendingCheckout row (unrelated/stale) says MONTHLY; this event's
    // own metadata — the session that actually completed — says ANNUAL.
    // Getting this wrong changes getCrewPriceCents and therefore every
    // stamped priceCents on the six CREW entitlement rows.
    pendingCheckouts = [{
      id: "pc_1", organizationId: "o1", sessionId: "sess_1",
      kind: "CREW", agent: null, plan: "MONTHLY", createdAt: new Date(),
    }];

    await handleSubscriptionActive(
      basePayload({ metadata: { organizationId: "o1", kind: "CREW", plan: "ANNUAL" } }) as never,
    );

    assert.equal(ents.length, 6);
    assert.ok(ents.every((e) => e.source === "CREW"));
    assert.equal(
      ents[0].priceCents,
      Math.floor(34800 / 6),
      "priceCents must be stamped from ANNUAL (this event's metadata), not MONTHLY (the unrelated PendingCheckout row)",
    );
  });

  test("cleanup: provisioning MAYA also removes a stale unrelated PendingCheckout row so it cannot poison a later webhook", async () => {
    const staleRex = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h old — past the 24h staleness bound
    pendingCheckouts = [
      { id: "pc_maya", organizationId: "o1", sessionId: "sess_maya", kind: "AGENT", agent: "MAYA", plan: "MONTHLY", createdAt: new Date() },
      { id: "pc_rex_stale", organizationId: "o1", sessionId: "sess_rex", kind: "AGENT", agent: "REX", plan: "MONTHLY", createdAt: staleRex },
    ];

    await handleSubscriptionActive(
      basePayload({
        metadata: { organizationId: "o1", kind: "AGENT", agent: "MAYA" },
        product_id: "pdt_maya",
      }) as never,
    );

    assert.equal(ents.length, 1);
    assert.equal(ents[0].agent, "MAYA");
    assert.equal(
      pendingCheckouts.length,
      0,
      "both the matching MAYA row (same kind+agent as provisioned) and the stale REX row (older than 24h) must be gone",
    );
  });

  test("REGRESSION: idempotency — a redelivery for an already-provisioned Dodo subscription does not create a second row", async () => {
    billingSubs = [{ id: "bs_1", organizationId: "o1", dodoSubscriptionId: "sub_new", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(30) }];
    pendingCheckouts = [{
      id: "pc_1", organizationId: "o1", sessionId: "sess_1",
      kind: "AGENT", agent: "REX", plan: "MONTHLY", createdAt: new Date(),
    }];

    await handleSubscriptionActive(basePayload() as never);

    assert.equal(billingSubs.length, 1, "must not create a second BillingSubscription for the same Dodo sub");
    assert.equal(ents.length, 0, "must not create a duplicate entitlement either");
  });
});

describe("handleSubscriptionRenewed", () => {
  test("REGRESSION: Maya renewing does not touch Rex's independent period", async () => {
    const mayaEnd = daysFromNow(0.1);
    const rexEnd = daysFromNow(10);
    billingSubs = [
      { id: "bs_maya", organizationId: "o1", dodoSubscriptionId: "sub_maya", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: mayaEnd },
      { id: "bs_rex", organizationId: "o1", dodoSubscriptionId: "sub_rex", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: rexEnd },
    ];
    ents = [
      { id: "ent_maya", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: mayaEnd, billingSubscriptionId: "bs_maya" },
      { id: "ent_rex", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE", currentPeriodEnd: rexEnd, billingSubscriptionId: "bs_rex" },
    ];

    const newMayaEnd = daysFromNow(30);
    await handleSubscriptionRenewed({
      type: "subscription.renewed",
      data: { subscription_id: "sub_maya", next_billing_date: newMayaEnd.toISOString() },
    } as never);

    const maya = ents.find((e) => e.id === "ent_maya")!;
    const rex = ents.find((e) => e.id === "ent_rex")!;
    assert.equal((maya.currentPeriodEnd as Date).getTime(), newMayaEnd.getTime());
    assert.equal((rex.currentPeriodEnd as Date).getTime(), rexEnd.getTime(), "Rex's period must be untouched by Maya's renewal");
  });

  test("out-of-order guard: a period at or before the stored currentPeriodEnd is ignored", async () => {
    const currentEnd = daysFromNow(30);
    billingSubs = [{ id: "bs_maya", organizationId: "o1", dodoSubscriptionId: "sub_maya", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: currentEnd }];
    ents = [{ id: "ent_maya", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: currentEnd, billingSubscriptionId: "bs_maya" }];

    const staleEnd = daysFromNow(10); // earlier than currentEnd
    const result = await handleSubscriptionRenewed({
      type: "subscription.renewed",
      data: { subscription_id: "sub_maya", next_billing_date: staleEnd.toISOString() },
    } as never);

    assert.equal(result, "ignored-stale-period");
    assert.equal((ents[0].currentPeriodEnd as Date).getTime(), currentEnd.getTime(), "period must not move backwards");
  });
});

describe("handlePaymentFailed", () => {
  test("REGRESSION: a failed card on Rex's subscription does not mark Maya PAST_DUE", async () => {
    billingSubs = [
      { id: "bs_maya", organizationId: "o1", dodoSubscriptionId: "sub_maya", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(20) },
      { id: "bs_rex", organizationId: "o1", dodoSubscriptionId: "sub_rex", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(10) },
    ];
    ents = [
      { id: "ent_maya", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: daysFromNow(20), billingSubscriptionId: "bs_maya" },
      { id: "ent_rex", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE", currentPeriodEnd: daysFromNow(10), billingSubscriptionId: "bs_rex" },
    ];

    await handlePaymentFailed({
      type: "payment.failed",
      data: { subscription_id: "sub_rex" },
    } as never);

    const maya = ents.find((e) => e.id === "ent_maya")!;
    const rex = ents.find((e) => e.id === "ent_rex")!;
    assert.equal(maya.status, "ACTIVE", "Maya must survive a payment failure on Rex's subscription");
    assert.equal(rex.status, "PAST_DUE");
  });
});

describe("handleSubscriptionExpired", () => {
  test("expiring one subscription does not expire a sibling agent's entitlement", async () => {
    billingSubs = [
      { id: "bs_maya", organizationId: "o1", dodoSubscriptionId: "sub_maya", plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: daysFromNow(20) },
      { id: "bs_rex", organizationId: "o1", dodoSubscriptionId: "sub_rex", plan: "MONTHLY", status: "PAST_DUE", currentPeriodEnd: daysFromNow(1) },
    ];
    ents = [
      { id: "ent_maya", organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: daysFromNow(20), billingSubscriptionId: "bs_maya" },
      { id: "ent_rex", organizationId: "o1", agent: "REX", source: "AGENT", status: "PAST_DUE", currentPeriodEnd: daysFromNow(1), billingSubscriptionId: "bs_rex" },
    ];

    await handleSubscriptionExpired({
      type: "subscription.expired",
      data: { subscription_id: "sub_rex" },
    } as never);

    const maya = ents.find((e) => e.id === "ent_maya")!;
    const rex = ents.find((e) => e.id === "ent_rex")!;
    assert.equal(maya.status, "ACTIVE");
    assert.equal(rex.status, "EXPIRED");
  });
});
