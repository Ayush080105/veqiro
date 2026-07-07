import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "../../../prisma/generated/prisma/client.js";
import { QuotaExceededError } from "../../common/errors/quotaExceeded.js";

// maya.usage.service.ts touches Subscription/MayaUsage via `prisma` only —
// mock it with a tiny in-memory "row" so assertions check real persisted
// values (not just "was called").
type Row = {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  creditsUsed: number;
};

let row: Row | null = null;

const mockPrisma = {
  subscription: { findUnique: vi.fn() },
  mayaUsage: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
};

vi.mock("../../config/prisma.js", () => ({
  prisma: mockPrisma,
}));

function applyUpdate(data: Record<string, unknown>) {
  if (!row) return;
  for (const key of ["creditsUsed", "periodEnd"] as const) {
    const v = data[key];
    if (v === undefined) continue;
    if (v && typeof v === "object" && "increment" in (v as object)) {
      (row as never as Record<string, number>)[key] =
        (row[key] as number) + (v as { increment: number }).increment;
    } else if (v && typeof v === "object" && "decrement" in (v as object)) {
      (row as never as Record<string, number>)[key] =
        (row[key] as number) - (v as { decrement: number }).decrement;
    } else {
      (row as never as Record<string, unknown>)[key] = v;
    }
  }
}

// ─── Subscription fixtures ────────────────────────────────────────────────

const trialingSub = (trialEndsAt: Date | null) => ({
  status: "TRIALING",
  plan: null,
  entitlementMode: "CREW",
  trialEndsAt,
  currentPeriodEnd: null,
});

const activeSub = (currentPeriodEnd: Date | null, plan: string | null = "ANNUAL") => ({
  status: "ACTIVE",
  plan,
  entitlementMode: "CREW",
  trialEndsAt: null,
  currentPeriodEnd,
});

const cancelledSub = (currentPeriodEnd: Date | null) => ({
  status: "CANCELLED",
  plan: "MONTHLY",
  entitlementMode: "CREW",
  trialEndsAt: null,
  currentPeriodEnd,
});

const expiredSub = () => ({
  status: "EXPIRED",
  plan: null,
  entitlementMode: "CUSTOM",
  trialEndsAt: null,
  currentPeriodEnd: null,
});

const DAY = 24 * 60 * 60 * 1000;

describe("maya.usage.service self-heal + adjustCurrentPeriodUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    row = null;

    mockPrisma.mayaUsage.findFirst.mockImplementation(async () => {
      if (row && row.periodEnd.getTime() > Date.now()) return row;
      return null;
    });
    mockPrisma.mayaUsage.create.mockImplementation(async ({ data }: { data: Omit<Row, "creditsUsed"> }) => {
      row = { ...data, creditsUsed: 0 };
      return row;
    });
    mockPrisma.mayaUsage.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      applyUpdate(data);
      return row;
    });
    mockPrisma.$queryRaw.mockImplementation(async () => {
      return row ? [{ creditsUsed: row.creditsUsed }] : [];
    });
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
  });

  describe("getCurrentUsage", () => {
    test("self-heals a missing period for a TRIALING sub with a future trialEndsAt", async () => {
      const trialEndsAt = new Date(Date.now() + 3 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(trialingSub(trialEndsAt));

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_1");

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 1);
      const createArgs = mockPrisma.mayaUsage.create.mock.calls[0]![0] as { data: { organizationId: string; periodEnd: Date } };
      assert.equal(createArgs.data.organizationId, "org_1");
      assert.equal(createArgs.data.periodEnd.getTime(), trialEndsAt.getTime());

      assert.equal(result.tier, "TRIAL");
      assert.equal(result.credits.used, 0);
      assert.equal(result.credits.limit, 30);
      assert.equal(result.periodEnd, trialEndsAt.toISOString());
    });

    test("does not fabricate a period for an EXPIRED subscription (no valid date to derive from)", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(expiredSub());

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const before = Date.now();
      const result = await getCurrentUsage("org_2");

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
      assert.equal(result.credits.used, 0);
      assert.ok(new Date(result.periodEnd).getTime() >= before);
    });

    test("does not self-heal a CANCELLED sub whose currentPeriodEnd has already lapsed", async () => {
      const pastEnd = new Date(Date.now() - 1000);
      mockPrisma.subscription.findUnique.mockResolvedValue(cancelledSub(pastEnd));

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_3");

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
      assert.equal(result.credits.used, 0);
    });

    test("throws no-subscription when the Subscription row is missing", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(getCurrentUsage("org_none")).rejects.toThrow("no-subscription");
    });
  });

  describe("checkAndDeductCredits", () => {
    test("happy path: an existing active period increments without invoking self-heal", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      row = {
        organizationId: "org_4",
        periodStart: new Date(Date.now() - 5 * DAY),
        periodEnd,
        creditsUsed: 6,
      };
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_4", 4);

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
      assert.equal(row!.creditsUsed, 10);
    });

    test("self-heals when period missing but subscription is ACTIVE with a future currentPeriodEnd", async () => {
      const periodEnd = new Date(Date.now() + 30 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_5", 8);

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 1);
      assert.equal(row!.creditsUsed, 8);
      assert.equal(row!.periodEnd.getTime(), periodEnd.getTime());
    });

    test("still throws no-active-usage-period when a CANCELLED sub's currentPeriodEnd has already lapsed", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(cancelledSub(new Date(Date.now() - 1000)));

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(checkAndDeductCredits("org_6", 2)).rejects.toThrow("no-active-usage-period");
      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
    });

    test("still throws QuotaExceededError when over quota — self-heal branch doesn't change happy-path enforcement", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      row = { organizationId: "org_7", periodStart: new Date(), periodEnd, creditsUsed: 25 };
      mockPrisma.subscription.findUnique.mockResolvedValue(trialingSub(periodEnd)); // TRIAL credit limit = 30

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      const error = await checkAndDeductCredits("org_7", 10).catch((e) => e);
      expect(error).toBeInstanceOf(QuotaExceededError);
      assert.equal((error as QuotaExceededError).used, 25);
      assert.equal((error as QuotaExceededError).limit, 30);
      assert.equal(row!.creditsUsed, 25); // unchanged — the increment never committed
    });

    test("still throws no-subscription when the Subscription row is missing", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(checkAndDeductCredits("org_8", 1)).rejects.toThrow("no-subscription");
    });

    test("race safety: a unique-constraint collision on create refetches the concurrently-created period instead of failing", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      // First getActivePeriod call (top of checkAndDeductCredits) sees nothing yet.
      mockPrisma.mayaUsage.findFirst.mockImplementationOnce(async () => null);
      // Our create() races with a concurrent request that inserted the row first.
      mockPrisma.mayaUsage.create.mockImplementationOnce(async () => {
        row = {
          organizationId: "org_15",
          periodStart: new Date(),
          periodEnd,
          creditsUsed: 2,
        };
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        });
      });

      const { checkAndDeductCredits } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndDeductCredits("org_15", 4);

      // Refetch (via the default findFirst impl, now that `row` exists) found the
      // concurrently-created period and incremented onto it — no error surfaced.
      assert.equal(row!.creditsUsed, 6);
    });
  });

  describe("adjustCurrentPeriodUsage", () => {
    test("adjusts creditsUsed by delta and clamps the floor at 0", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      row = { organizationId: "org_10", periodStart: new Date(), periodEnd, creditsUsed: 4 };
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");

      // Grant credits: negative delta decrements `used`, clamped at 0 (4 - 10 -> 0, not -6).
      await adjustCurrentPeriodUsage("org_10", -10);
      assert.equal(row!.creditsUsed, 0);

      // Revoke credits: positive delta increments `used`.
      await adjustCurrentPeriodUsage("org_10", 3);
      assert.equal(row!.creditsUsed, 3);
    });

    test("self-heals when no active period exists but the subscription is legitimately active", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(trialingSub(trialEndsAt));

      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await adjustCurrentPeriodUsage("org_11", -5);

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 1);
      assert.equal(row!.creditsUsed, 0); // fresh row starts at 0, clamped after -5
      assert.equal(row!.periodEnd.getTime(), trialEndsAt.getTime());
    });

    test("throws no-subscription when the Subscription row is missing", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(adjustCurrentPeriodUsage("org_12", 1)).rejects.toThrow("no-subscription");
    });

    test("throws no-active-usage-period when there is nothing valid to self-heal from", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(expiredSub());
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(adjustCurrentPeriodUsage("org_13", 1)).rejects.toThrow("no-active-usage-period");
    });

    test("no-op when delta is 0 — never touches the Subscription or MayaUsage tables", async () => {
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await adjustCurrentPeriodUsage("org_14", 0);
      assert.equal(mockPrisma.subscription.findUnique.mock.calls.length, 0);
      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
    });
  });
});
