import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// billing.topup.ts imports billing.service.ts, which imports lib/auth.ts
// (pulls in the mailer -> Resend chain, crashes without RESEND_API_KEY) and
// lib/dodo.ts (constructs a real DodoPayments client, crashes without
// DODO_PAYMENTS_API_KEY). Same workaround as the other billing.service tests.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

type EntRow = {
  organizationId: string;
  agent: string;
  source: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingSubscriptionId: string | null;
};

type BsRow = { id: string; dodoSubscriptionId?: string; plan: string | null };
type UsageRow = { organizationId: string; periodStart: Date; periodEnd: Date; creditsUsed: number; bonusCredits: number };

let entitlements: EntRow[] = [];
let billingSubscriptions: BsRow[] = [];
let usageRows: UsageRow[] = [];
let pendingCheckouts: Array<Record<string, unknown>> = [];
let webhookEvents: Array<Record<string, unknown>> = [];
let orgSubscription: { organizationId: string; dodoCustomerId: string } | null = {
  organizationId: "o1",
  dodoCustomerId: "cus_1",
};

function matchesEntWhere(e: EntRow, where: Record<string, unknown>): boolean {
  if (where.organizationId !== undefined && e.organizationId !== where.organizationId) return false;
  if (where.agent !== undefined && e.agent !== where.agent) return false;
  if (where.status && typeof where.status === "object" && "in" in (where.status as object)) {
    if (!(where.status as { in: string[] }).in.includes(e.status)) return false;
  }
  if (where.currentPeriodEnd && typeof where.currentPeriodEnd === "object" && "gt" in (where.currentPeriodEnd as object)) {
    const gt = (where.currentPeriodEnd as { gt: Date }).gt;
    if (!(e.currentPeriodEnd.getTime() > gt.getTime())) return false;
  }
  return true;
}

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      entitlements.filter((e) => matchesEntWhere(e, where)),
    ),
  },
  billingSubscription: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      billingSubscriptions.find((b) => b.id === where.id) ?? null,
    ),
  },
  subscription: {
    findUnique: vi.fn(async () => orgSubscription),
  },
  mayaUsage: {
    upsert: vi.fn(async ({ where, create }: {
      where: { organizationId_periodStart: { organizationId: string; periodStart: Date } };
      create: Omit<UsageRow, "creditsUsed">;
    }) => {
      const key = where.organizationId_periodStart;
      let row = usageRows.find(
        (r) => r.organizationId === key.organizationId && r.periodStart.getTime() === key.periodStart.getTime(),
      );
      if (!row) {
        row = { ...create, creditsUsed: 0, bonusCredits: 0 };
        usageRows.push(row);
      }
      return row;
    }),
    update: vi.fn(async ({ where, data }: {
      where: { organizationId_periodStart: { organizationId: string; periodStart: Date } };
      data: Record<string, unknown>;
    }) => {
      const key = where.organizationId_periodStart;
      const row = usageRows.find(
        (r) => r.organizationId === key.organizationId && r.periodStart.getTime() === key.periodStart.getTime(),
      );
      if (!row) return null;
      if (typeof data.creditsUsed === "number") row.creditsUsed = data.creditsUsed;
      const b = data.bonusCredits;
      if (b && typeof b === "object" && "increment" in (b as object)) {
        row.bonusCredits += (b as { increment: number }).increment;
      } else if (typeof b === "number") {
        row.bonusCredits = b;
      }
      return row;
    }),
  },
  pendingCheckout: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `pc_${pendingCheckouts.length + 1}`, ...data };
      pendingCheckouts.push(row);
      return row;
    }),
    deleteMany: vi.fn(async ({ where }: { where: { organizationId: string; kind: string } }) => {
      const before = pendingCheckouts.length;
      pendingCheckouts = pendingCheckouts.filter(
        (p) => !(p.organizationId === where.organizationId && p.kind === where.kind),
      );
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
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(mockPrisma);
    return Promise.all(arg as Promise<unknown>[]);
  }),
  $queryRaw: vi.fn(async (_strings: TemplateStringsArray, orgId: string, periodStart: Date) => {
    const row = usageRows.find((r) => r.organizationId === orgId && r.periodStart.getTime() === periodStart.getTime());
    return row ? [{ creditsUsed: row.creditsUsed }] : [];
  }),
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const mockDodo = {
  checkoutSessions: {
    create: vi.fn(async () => ({ session_id: "sess_topup_1", checkout_url: "https://checkout.dodo.test/sess_topup_1" })),
  },
  customers: {
    create: vi.fn(async () => ({ customer_id: "cus_new" })),
  },
};
vi.mock("../../lib/dodo.js", () => ({ dodoClient: mockDodo }));

const { createMayaTopupCheckout } = await import("../../modules/billing/billing.topup.js");
const { handleMayaTopupPaymentSucceeded, providerEventId } = await import("../../modules/billing/billing.webhooks.js");

const DAY = 24 * 60 * 60 * 1000;
const future = new Date(Date.now() + 20 * DAY);
const anchor = new Date(Date.now() - 5 * DAY);

function crewMayaEntitlement(orgId: string, billingSubscriptionId = "bs_1"): EntRow {
  return {
    organizationId: orgId, agent: "MAYA", source: "CREW", status: "ACTIVE",
    currentPeriodStart: anchor, currentPeriodEnd: future, billingSubscriptionId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  entitlements = [];
  billingSubscriptions = [{ id: "bs_1", plan: "MONTHLY" }];
  usageRows = [];
  pendingCheckouts = [];
  webhookEvents = [];
  orgSubscription = { organizationId: "o1", dodoCustomerId: "cus_1" };
  process.env.DODO_PRODUCT_MAYA_TOPUP_UNIT = "pdt_topup_unit";
  process.env.CLIENT_URL = "http://localhost:3001";

  mockPrisma.entitlement.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    entitlements.filter((e) => matchesEntWhere(e, where)),
  );
  mockPrisma.billingSubscription.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    billingSubscriptions.find((b) => b.id === where.id) ?? null,
  );
  mockPrisma.subscription.findUnique.mockImplementation(async () => orgSubscription);
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(mockPrisma);
    return Promise.all(arg as Promise<unknown>[]);
  });
  mockPrisma.$queryRaw.mockImplementation(async (_strings: TemplateStringsArray, orgId: string, periodStart: Date) => {
    const row = usageRows.find((r) => r.organizationId === orgId && r.periodStart.getTime() === periodStart.getTime());
    return row ? [{ creditsUsed: row.creditsUsed }] : [];
  });
});

describe("createMayaTopupCheckout", () => {
  test("rejects a dollar amount that isn't one of the 5 allowed presets", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    await expect(createMayaTopupCheckout("o1", 10)).rejects.toThrow("invalid-topup-amount");
  });

  test("rejects a valid multiple of $3 that isn't a preset (closed allowlist, not just 'any multiple of 3')", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    await expect(createMayaTopupCheckout("o1", 18)).rejects.toThrow("invalid-topup-amount");
  });

  test("rejects when the org has no Maya entitlement at all", async () => {
    entitlements = [];
    await expect(createMayaTopupCheckout("o1", 9)).rejects.toThrow("no-subscription");
  });

  test("happy path: quantity = dollars/3, PendingCheckout row records kind + credits", async () => {
    entitlements = [crewMayaEntitlement("o1")];

    const result = await createMayaTopupCheckout("o1", 9);

    assert.equal(result.url, "https://checkout.dodo.test/sess_topup_1");
    assert.equal(result.credits, 150); // 9/3 = 3 units * 50 credits
    assert.equal(result.dollars, 9);

    const cartArgs = mockDodo.checkoutSessions.create.mock.calls[0][0];
    assert.equal(cartArgs.product_cart[0].product_id, "pdt_topup_unit");
    assert.equal(cartArgs.product_cart[0].quantity, 3);

    assert.equal(pendingCheckouts.length, 1);
    assert.equal(pendingCheckouts[0].kind, "MAYA_TOPUP");
    assert.equal(pendingCheckouts[0].credits, 150);
  });

  test("a trialing Maya org can top up (stricter-but-correct entitlement check, not the old 'ACTIVE only' gate)", async () => {
    entitlements = [{
      organizationId: "o1", agent: "MAYA", source: "TRIAL", status: "TRIALING",
      currentPeriodStart: anchor, currentPeriodEnd: future, billingSubscriptionId: null,
    }];
    const result = await createMayaTopupCheckout("o1", 6);
    assert.equal(result.credits, 100);
  });
});

describe("handleMayaTopupPaymentSucceeded", () => {
  const basePayload = (overrides: Record<string, unknown> = {}) => ({
    type: "payment.succeeded",
    data: {
      payment_id: "pay_1",
      subscription_id: null,
      customer: { customer_id: "cus_1" },
      metadata: { organizationId: "o1", kind: "MAYA_TOPUP", credits: "150" },
      product_cart: [{ product_id: "pdt_topup_unit", quantity: 3 }],
      ...overrides,
    },
  });

  test("ignores a payment.succeeded payload that isn't a top-up", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    await handleMayaTopupPaymentSucceeded(
      basePayload({ metadata: { organizationId: "o1", kind: "AGENT" } }) as never,
    );
    assert.equal(usageRows.length, 0, "must never grant credits for a non-topup payment");
  });

  test("grants credits computed from product_cart (dodo's own record), not just checkout-time metadata", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    await handleMayaTopupPaymentSucceeded(basePayload() as never);

    assert.equal(usageRows.length, 1);
    assert.equal(usageRows[0]!.creditsUsed, 0, "creditsUsed must be untouched by a grant");
    assert.equal(usageRows[0]!.bonusCredits, 150, "granting raises bonusCredits, not creditsUsed");
  });

  test("cleans up the matching MAYA_TOPUP PendingCheckout row", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    pendingCheckouts = [{ id: "pc_1", organizationId: "o1", kind: "MAYA_TOPUP", credits: 150 }];

    await handleMayaTopupPaymentSucceeded(basePayload() as never);

    assert.equal(pendingCheckouts.length, 0);
  });

  test("idempotent: replaying the same payment_id grants credits exactly once", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    await handleMayaTopupPaymentSucceeded(basePayload() as never);
    await handleMayaTopupPaymentSucceeded(basePayload() as never);

    assert.equal(usageRows[0]!.bonusCredits, 150, "second delivery must be a no-op, not a second grant");
  });

  test("a subscription payment's payment.succeeded echo (if any) never triggers the topup credit-grant path", async () => {
    entitlements = [crewMayaEntitlement("o1")];
    await handleMayaTopupPaymentSucceeded(
      basePayload({
        subscription_id: "sub_real_subscription",
        metadata: { organizationId: "o1" }, // no kind: MAYA_TOPUP
      }) as never,
    );
    assert.equal(usageRows.length, 0);
  });
});

describe("providerEventId — payment_id branch (regression: top-up collision fix)", () => {
  test("two distinct top-up payments (same org, different payment_id) produce different idempotency keys", () => {
    const a = providerEventId({
      type: "payment.succeeded",
      data: { payment_id: "pay_1", subscription_id: undefined },
    } as never);
    const b = providerEventId({
      type: "payment.succeeded",
      data: { payment_id: "pay_2", subscription_id: undefined },
    } as never);
    assert.notEqual(a, b, "distinct payments must never collapse onto the same key");
  });

  test("without a payment_id, two payloads with no subscription/period do collide (documents the pre-existing, accepted fallback risk)", () => {
    const a = providerEventId({ type: "payment.succeeded", data: {} } as never);
    const b = providerEventId({ type: "payment.succeeded", data: {} } as never);
    assert.equal(a, b);
  });
});
