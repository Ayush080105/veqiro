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

function crewEntitlement(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  billingSubscriptionId: string,
  status = "ACTIVE",
): EntRow {
  return {
    organizationId: orgId,
    agent: "MAYA",
    source: "CREW",
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
      row = { ...create, creditsUsed: 0 };
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

    test("CREW + ANNUAL billing subscription → tier ANNUAL_CREW, limit 400 (not the annual billing period)", async () => {
      const anchor = new Date("2026-01-10T00:00:00Z");
      entitlements = [crewEntitlement("org_2", anchor, new Date(Date.now() + 300 * DAY), "bs_1")];
      billingSubscriptions = [{ id: "bs_1", plan: "ANNUAL" }];

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_2");

      assert.equal(result.tier, "ANNUAL_CREW");
      assert.equal(result.credits.limit, 400);
      // The window is a fixed 1-month slice, decoupled from the entitlement's
      // (yearly) currentPeriodEnd — the bug this whole task exists to fix.
      const spanDays = (new Date(result.periodEnd).getTime() - new Date(result.periodStart).getTime()) / DAY;
      assert.ok(spanDays <= 31, `expected a ~1-month window, got ${spanDays} days`);
    });

    test("CREW + MONTHLY billing subscription → tier MONTHLY_CREW, limit 300", async () => {
      const anchor = new Date("2026-01-10T00:00:00Z");
      entitlements = [crewEntitlement("org_3", anchor, new Date(Date.now() + 20 * DAY), "bs_2")];
      billingSubscriptions = [{ id: "bs_2", plan: "MONTHLY" }];

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_3");

      assert.equal(result.tier, "MONTHLY_CREW");
      assert.equal(result.credits.limit, 300);
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
      entitlements = [crewEntitlement("org_5", anchor, new Date(Date.now() + 20 * DAY), "bs_4", "EXPIRED")];
      billingSubscriptions = [{ id: "bs_4", plan: "MONTHLY" }];

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(getCurrentUsage("org_5")).rejects.toThrow("no-subscription");
    });

    test("mid-period upgrade (AGENT → CREW) raises the ceiling on the SAME open window without resetting usage", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [{
        organizationId: "org_6", agent: "MAYA", source: "AGENT", status: "ACTIVE",
        currentPeriodStart: anchor, currentPeriodEnd: new Date(Date.now() + 20 * DAY),
        billingSubscriptionId: "bs_5",
      }];
      billingSubscriptions = [{ id: "bs_5", plan: "MONTHLY" }];

      const { getCurrentUsage, checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_6", 50);
      const before = await getCurrentUsage("org_6");
      assert.equal(before.credits.limit, 300);
      assert.equal(before.credits.used, 50);

      // Org upgrades to Crew (annual) mid-period — a second, more generous
      // entitlement row is added. getMayaEntitlement ranks CREW above AGENT.
      entitlements.push(crewEntitlement("org_6", anchor, new Date(Date.now() + 300 * DAY), "bs_6"));
      billingSubscriptions.push({ id: "bs_6", plan: "ANNUAL" });

      const after = await getCurrentUsage("org_6");
      assert.equal(after.credits.limit, 400, "ceiling raised by the upgrade");
      assert.equal(after.credits.used, 50, "usage carries over — no reset");
      assert.equal(after.periodStart, before.periodStart, "same open window, not a new one");
    });
  });

  describe("checkAndDeductCredits", () => {
    test("happy path: increments creditsUsed on the resolved window", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [crewEntitlement("org_7", anchor, new Date(Date.now() + 20 * DAY), "bs_7")];
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
      entitlements = [crewEntitlement("org_11", anchor, new Date(Date.now() + 20 * DAY), "bs_8")];
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
      entitlements = [crewEntitlement("org_12", anchor, new Date(Date.now() + 20 * DAY), "bs_9")];
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

  describe("rollbackCredits", () => {
    test("decrements the resolved window's creditsUsed", async () => {
      const anchor = new Date(Date.now() - 5 * DAY);
      entitlements = [crewEntitlement("org_16", anchor, new Date(Date.now() + 20 * DAY), "bs_10")];
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
