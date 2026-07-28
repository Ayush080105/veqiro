import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { QuotaExceededError } from "../../common/errors/quotaExceeded.js";

// maya.usage.service.ts now resolves Maya's window from her governing
// Entitlement row (+ its BillingSubscription, for plan) instead of the
// legacy Subscription model — mock those two tables plus MayaUsage with a
// tiny in-memory store so assertions check real persisted values (not just
// "was called").
type EntRow = {
  organizationId: string;
  agent: string;
  source: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingSubscriptionId: string | null;
};

type BsRow = {
  id: string;
  plan: string | null;
};

type UsageRow = {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  creditsUsed: number;
  bonusCredits: number;
};

let entitlements: EntRow[] = [];
let billingSubscriptions: BsRow[] = [];
let usageRows: UsageRow[] = [];

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return entitlements.filter((e) => {
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
      });
    }),
  },
  billingSubscription: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return billingSubscriptions.find((b) => b.id === where.id) ?? null;
    }),
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
        row = { ...create, creditsUsed: 0 };
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
      const v = data.creditsUsed;
      if (v && typeof v === "object" && "increment" in (v as object)) {
        row.creditsUsed += (v as { increment: number }).increment;
      } else if (v && typeof v === "object" && "decrement" in (v as object)) {
        row.creditsUsed -= (v as { decrement: number }).decrement;
      } else if (typeof v === "number") {
        row.creditsUsed = v;
      }
      return row;
    }),
  },
  $transaction: vi.fn(async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma)),
  $queryRaw: vi.fn(async () => {
    // Backing the FOR UPDATE lock query — reads whatever row exists for the
    // (org, periodStart) that the most recent upsert/update touched. Tests
    // that need a specific row locked call `usageRows` directly beforehand.
    return usageRows.length ? [{ creditsUsed: usageRows[usageRows.length - 1]!.creditsUsed }] : [];
  }),
};

vi.mock("../../config/prisma.js", () => ({
  prisma: mockPrisma,
}));

// ─── Entitlement fixtures ─────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

function trialEntitlement(orgId: string, periodStart: Date, periodEnd: Date): EntRow {
  return {
    organizationId: orgId,
    agent: "MAYA",
    source: "TRIAL",
    status: "TRIALING",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    billingSubscriptionId: null,
  };
}

function agentEntitlement(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  billingSubscriptionId: string,
  status = "ACTIVE",
): EntRow {
  return {
    organizationId: orgId,
    agent: "MAYA",
    source: "AGENT",
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    billingSubscriptionId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  entitlements = [];
  billingSubscriptions = [];
  usageRows = [];

  mockPrisma.entitlement.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    return entitlements.filter((e) => {
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
    });
  });
  mockPrisma.billingSubscription.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    return billingSubscriptions.find((b) => b.id === where.id) ?? null;
  });
  mockPrisma.mayaUsage.upsert.mockImplementation(async ({ where, create }: {
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
  });
  mockPrisma.mayaUsage.update.mockImplementation(async ({ where, data }: {
    where: { organizationId_periodStart: { organizationId: string; periodStart: Date } };
    data: Record<string, unknown>;
  }) => {
    const key = where.organizationId_periodStart;
    const row = usageRows.find(
      (r) => r.organizationId === key.organizationId && r.periodStart.getTime() === key.periodStart.getTime(),
    );
    if (!row) return null;
    const v = data.creditsUsed;
    if (v && typeof v === "object" && "increment" in (v as object)) {
      row.creditsUsed += (v as { increment: number }).increment;
    } else if (v && typeof v === "object" && "decrement" in (v as object)) {
      row.creditsUsed -= (v as { decrement: number }).decrement;
    } else if (typeof v === "number") {
      row.creditsUsed = v;
    }
    const b = data.bonusCredits;
    if (b && typeof b === "object" && "increment" in (b as object)) {
      row.bonusCredits += (b as { increment: number }).increment;
    } else if (typeof b === "number") {
      row.bonusCredits = b;
    }
    return row;
  });
  mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, orgId: string, periodStart: Date) => {
    const row = usageRows.find(
      (r) => r.organizationId === orgId && r.periodStart.getTime() === periodStart.getTime(),
    );
    return row ? [{ creditsUsed: row.creditsUsed }] : [];
  });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
});

describe("maya.usage.service", () => {
  describe("getCurrentUsage", () => {
    test("TRIAL entitlement → tier TRIAL, limit 30", async () => {
      const periodStart = new Date("2026-01-10T00:00:00Z");
      const periodEnd = new Date(Date.now() + 20 * DAY); // still-covering entitlement
      entitlements = [trialEntitlement("org_1", periodStart, periodEnd)];

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_1");

      assert.equal(result.tier, "TRIAL");
      assert.equal(result.credits.used, 0);
      assert.equal(result.credits.limit, 30);
      assert.equal(mockPrisma.mayaUsage.upsert.mock.calls.length, 1);
    });

    test("AGENT (individually purchased Maya) → tier MONTHLY_CUSTOM, limit 300", async () => {
      const anchor = new Date("2026-01-10T00:00:00Z");
      entitlements = [{
        organizationId: "org_4", agent: "MAYA", source: "AGENT", status: "ACTIVE",
        currentPeriodStart: anchor, currentPeriodEnd: new Date(Date.now() + 20 * DAY),
        billingSubscriptionId: "bs_3",
      }];
      billingSubscriptions = [{ id: "bs_3", plan: "MONTHLY" }];

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_4");

      assert.equal(result.tier, "MONTHLY_CUSTOM");
      assert.equal(result.credits.limit, 300);
    });

    test("throws no-subscription when there is no covering Maya entitlement — string is load-bearing for the frontend's empty state", async () => {
      entitlements = [];
      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(getCurrentUsage("org_none")).rejects.toThrow("no-subscription");
    });

    test("an EXPIRED-status entitlement (not in ACCESS_STATUSES) is invisible — throws no-subscription", async () => {
      const anchor = new Date("2026-01-10T00:00:00Z");
      entitlements = [agentEntitlement("org_5", anchor, new Date(Date.now() + 20 * DAY), "bs_4", "EXPIRED")];
      billingSubscriptions = [{ id: "bs_4", plan: "MONTHLY" }];

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(getCurrentUsage("org_5")).rejects.toThrow("no-subscription");
    });

  });

  describe("checkAndDeductCredits", () => {
    test("happy path: increments creditsUsed on the resolved window", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_7", anchor, new Date(Date.now() + 20 * DAY), "bs_7")];
      billingSubscriptions = [{ id: "bs_7", plan: "MONTHLY" }];

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_7", 4);
      await checkAndDeductCredits("org_7", 6);

      assert.equal(usageRows.length, 1);
      assert.equal(usageRows[0]!.creditsUsed, 10);
    });

    test("throws QuotaExceededError when the deduction would exceed the live-read limit", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [trialEntitlement("org_8", anchor, new Date(Date.now() + 20 * DAY))]; // TRIAL limit = 30

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_8", 25);
      const error = await checkAndDeductCredits("org_8", 10).catch((e) => e);

      expect(error).toBeInstanceOf(QuotaExceededError);
      assert.equal((error as QuotaExceededError).used, 25);
      assert.equal((error as QuotaExceededError).limit, 30);
      assert.equal(usageRows[0]!.creditsUsed, 25, "unchanged — the rejected increment never committed");
    });

    test("throws no-subscription when there is no covering Maya entitlement", async () => {
      entitlements = [];
      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(checkAndDeductCredits("org_9", 1)).rejects.toThrow("no-subscription");
    });

    test("no-op (does not touch the entitlement or MayaUsage tables) when credits <= 0", async () => {
      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_10", 0);
      assert.equal(mockPrisma.entitlement.findMany.mock.calls.length, 0);
      assert.equal(mockPrisma.mayaUsage.upsert.mock.calls.length, 0);
    });

    test("two concurrent resolutions for the same org converge on one row (upsert, not create-and-catch)", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_11", anchor, new Date(Date.now() + 20 * DAY), "bs_8")];
      billingSubscriptions = [{ id: "bs_8", plan: "MONTHLY" }];

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      // Both "requests" resolve the same deterministic periodStart (derived
      // from the entitlement's currentPeriodStart, not `new Date()`), so the
      // race that the old create-and-catch-P2002 dance had to defend against
      // cannot happen here — both upserts target the same row.
      await Promise.all([
        checkAndDeductCredits("org_11", 4),
        checkAndDeductCredits("org_11", 6),
      ]);

      assert.equal(usageRows.length, 1, "exactly one MayaUsage row for the org");
      assert.equal(usageRows[0]!.creditsUsed, 10);
    });
  });

  describe("adjustCurrentPeriodUsage", () => {
    test("grants (negative delta) decrement `used`, clamped at 0", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_12", anchor, new Date(Date.now() + 20 * DAY), "bs_9")];
      billingSubscriptions = [{ id: "bs_9", plan: "MONTHLY" }];

      const { checkAndDeductCredits, adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_12", 4);

      await adjustCurrentPeriodUsage("org_12", -10);
      assert.equal(usageRows[0]!.creditsUsed, 0, "clamped at 0, not -6");

      await adjustCurrentPeriodUsage("org_12", 3);
      assert.equal(usageRows[0]!.creditsUsed, 3);
    });

    test("does NOT enforce the quota ceiling — an admin grant can push `used` above `limit`", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [trialEntitlement("org_13", anchor, new Date(Date.now() + 20 * DAY))]; // limit 30

      const { checkAndDeductCredits, adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_13", 25);
      await adjustCurrentPeriodUsage("org_13", 20); // revoke direction, pushes used to 45 > limit 30
      assert.equal(usageRows[0]!.creditsUsed, 45);
    });

    test("throws no-subscription when there is no covering Maya entitlement", async () => {
      entitlements = [];
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(adjustCurrentPeriodUsage("org_14", 1)).rejects.toThrow("no-subscription");
    });

    test("no-op when delta is 0 — never touches the entitlement or MayaUsage tables", async () => {
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await adjustCurrentPeriodUsage("org_15", 0);
      assert.equal(mockPrisma.entitlement.findMany.mock.calls.length, 0);
      assert.equal(mockPrisma.mayaUsage.upsert.mock.calls.length, 0);
    });
  });

  describe("grantPurchasedTopupCredits", () => {
    test("raises bonusCredits, never touches creditsUsed — `used` must never go negative for display", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_19", anchor, new Date(Date.now() + 20 * DAY), "bs_11")];
      billingSubscriptions = [{ id: "bs_11", plan: "MONTHLY" }];

      const { getCurrentUsage, grantPurchasedTopupCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      // Usage is 0 (nothing spent yet) — a top-up bought at this point must
      // still grant real, usable extra credits, not be silently absorbed by
      // a floor clamp (the bug the old adjustCurrentPeriodUsage-based
      // implementation would have hit).
      await grantPurchasedTopupCredits("org_19", 150);

      assert.equal(usageRows[0]!.creditsUsed, 0, "creditsUsed must be untouched by a grant");
      assert.equal(usageRows[0]!.bonusCredits, 150);
      const usage = await getCurrentUsage("org_19");
      assert.equal(usage.credits.used, 0, "used must never be negative");
      assert.equal(usage.credits.limit, 450, "effective limit = 300 base + 150 purchased");
      assert.equal(usage.credits.remaining, 450, "300 base + 150 purchased = 450 usable");
    });

    test("stacks with existing usage correctly", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_20", anchor, new Date(Date.now() + 20 * DAY), "bs_12")];
      billingSubscriptions = [{ id: "bs_12", plan: "MONTHLY" }];

      const { checkAndDeductCredits, grantPurchasedTopupCredits, getCurrentUsage } =
        await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_20", 300); // exhaust the base 300
      await grantPurchasedTopupCredits("org_20", 150);

      const usage = await getCurrentUsage("org_20");
      assert.equal(usage.credits.used, 300, "used reflects only real consumption, unaffected by the topup");
      assert.equal(usage.credits.limit, 450);
      assert.equal(usage.credits.remaining, 150, "300 used against a 450 effective limit = 150 still usable");
    });

    test("buying a topup before exhausting the base allowance grants real, immediately usable headroom (the bug this design avoids)", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_23", anchor, new Date(Date.now() + 20 * DAY), "bs_13")];
      billingSubscriptions = [{ id: "bs_13", plan: "MONTHLY" }];

      const { checkAndDeductCredits, grantPurchasedTopupCredits, getCurrentUsage } =
        await import("../../modules/agents/maya/maya.usage.service.js");
      // Nothing spent yet — this is exactly the case where the old
      // negative-creditsUsed design would clamp to 0 and silently discard
      // the purchase.
      await grantPurchasedTopupCredits("org_23", 150);
      await checkAndDeductCredits("org_23", 400); // would exceed the base 300 limit alone

      const usage = await getCurrentUsage("org_23");
      assert.equal(usage.credits.used, 400);
      assert.equal(usage.credits.remaining, 50, "450 effective limit - 400 used = 50 remaining");
    });

    test("no-op when credits <= 0", async () => {
      const { grantPurchasedTopupCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await grantPurchasedTopupCredits("org_21", 0);
      assert.equal(mockPrisma.entitlement.findMany.mock.calls.length, 0);
    });

    test("throws no-subscription when there is no covering Maya entitlement", async () => {
      entitlements = [];
      const { grantPurchasedTopupCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(grantPurchasedTopupCredits("org_22", 50)).rejects.toThrow("no-subscription");
    });
  });

  describe("rollbackCredits", () => {
    test("decrements the resolved window's creditsUsed", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [agentEntitlement("org_16", anchor, new Date(Date.now() + 20 * DAY), "bs_10")];
      billingSubscriptions = [{ id: "bs_10", plan: "MONTHLY" }];

      const { checkAndDeductCredits, rollbackCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_16", 10);
      await rollbackCredits("org_16", 4);

      assert.equal(usageRows[0]!.creditsUsed, 6);
    });

    test("no-op when credits <= 0", async () => {
      const { rollbackCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await rollbackCredits("org_17", 0);
      assert.equal(mockPrisma.entitlement.findMany.mock.calls.length, 0);
    });

    test("swallows errors instead of throwing — a rollback must never mask the original failure", async () => {
      // No entitlement at all: resolveMayaWindow throws no-subscription
      // internally, but rollbackCredits must swallow it, not propagate.
      entitlements = [];
      const { rollbackCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(rollbackCredits("org_18", 4)).resolves.toBeUndefined();
    });
  });
});
