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
  imageCount: number;
  videoSeconds: number;
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
  for (const key of ["imageCount", "videoSeconds", "periodEnd"] as const) {
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
    mockPrisma.mayaUsage.create.mockImplementation(async ({ data }: { data: Omit<Row, "imageCount" | "videoSeconds"> }) => {
      row = { ...data, imageCount: 0, videoSeconds: 0 };
      return row;
    });
    mockPrisma.mayaUsage.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      applyUpdate(data);
      return row;
    });
    mockPrisma.$queryRaw.mockImplementation(async () => {
      return row ? [{ imageCount: row.imageCount, videoSeconds: row.videoSeconds }] : [];
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
      assert.equal(result.images.used, 0);
      assert.equal(result.periodEnd, trialEndsAt.toISOString());
    });

    test("does not fabricate a period for an EXPIRED subscription (no valid date to derive from)", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(expiredSub());

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const before = Date.now();
      const result = await getCurrentUsage("org_2");

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
      assert.equal(result.images.used, 0);
      assert.equal(result.videoSeconds.used, 0);
      assert.ok(new Date(result.periodEnd).getTime() >= before);
    });

    test("does not self-heal a CANCELLED sub whose currentPeriodEnd has already lapsed", async () => {
      const pastEnd = new Date(Date.now() - 1000);
      mockPrisma.subscription.findUnique.mockResolvedValue(cancelledSub(pastEnd));

      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      const result = await getCurrentUsage("org_3");

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
      assert.equal(result.images.used, 0);
    });

    test("throws no-subscription when the Subscription row is missing", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const { getCurrentUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(getCurrentUsage("org_none")).rejects.toThrow("no-subscription");
    });
  });

  describe("checkAndIncrementImages", () => {
    test("happy path: an existing active period increments without invoking self-heal", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      row = {
        organizationId: "org_4",
        periodStart: new Date(Date.now() - 5 * DAY),
        periodEnd,
        imageCount: 3,
        videoSeconds: 0,
      };
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      const { checkAndIncrementImages } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndIncrementImages("org_4", 2);

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
      assert.equal(row!.imageCount, 5);
    });

    test("self-heals when period missing but subscription is ACTIVE with a future currentPeriodEnd", async () => {
      const periodEnd = new Date(Date.now() + 30 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      const { checkAndIncrementImages } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndIncrementImages("org_5", 4);

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 1);
      assert.equal(row!.imageCount, 4);
      assert.equal(row!.periodEnd.getTime(), periodEnd.getTime());
    });

    test("still throws no-active-usage-period when a CANCELLED sub's currentPeriodEnd has already lapsed", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(cancelledSub(new Date(Date.now() - 1000)));

      const { checkAndIncrementImages } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(checkAndIncrementImages("org_6", 1)).rejects.toThrow("no-active-usage-period");
      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
    });

    test("still throws QuotaExceededError when over quota — self-heal branch doesn't change happy-path enforcement", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      row = { organizationId: "org_7", periodStart: new Date(), periodEnd, imageCount: 19, videoSeconds: 0 };
      mockPrisma.subscription.findUnique.mockResolvedValue(trialingSub(periodEnd)); // TRIAL images limit = 20

      const { checkAndIncrementImages } = await import("../../modules/agents/maya/maya.usage.service.js");
      const error = await checkAndIncrementImages("org_7", 5).catch((e) => e);
      expect(error).toBeInstanceOf(QuotaExceededError);
      assert.equal((error as QuotaExceededError).resource, "images");
      assert.equal(row!.imageCount, 19); // unchanged — the increment never committed
    });

    test("still throws no-subscription when the Subscription row is missing", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const { checkAndIncrementImages } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(checkAndIncrementImages("org_8", 1)).rejects.toThrow("no-subscription");
    });

    test("race safety: a unique-constraint collision on create refetches the concurrently-created period instead of failing", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      // First getActivePeriod call (top of checkAndIncrementImages) sees nothing yet.
      mockPrisma.mayaUsage.findFirst.mockImplementationOnce(async () => null);
      // Our create() races with a concurrent request that inserted the row first.
      mockPrisma.mayaUsage.create.mockImplementationOnce(async () => {
        row = {
          organizationId: "org_15",
          periodStart: new Date(),
          periodEnd,
          imageCount: 1,
          videoSeconds: 0,
        };
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        });
      });

      const { checkAndIncrementImages } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndIncrementImages("org_15", 2);

      // Refetch (via the default findFirst impl, now that `row` exists) found the
      // concurrently-created period and incremented onto it — no error surfaced.
      assert.equal(row!.imageCount, 3);
    });
  });

  describe("checkAndIncrementVideoSeconds", () => {
    test("self-heals when period missing but subscription is TRIALING with a future trialEndsAt", async () => {
      const trialEndsAt = new Date(Date.now() + 5 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(trialingSub(trialEndsAt));

      const { checkAndIncrementVideoSeconds } = await import("../../modules/agents/maya/maya.usage.service.js");
      await checkAndIncrementVideoSeconds("org_9", 10);

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 1);
      assert.equal(row!.videoSeconds, 10);
      assert.equal(row!.periodEnd.getTime(), trialEndsAt.getTime());
    });

    test("still throws no-active-usage-period when nothing valid to self-heal from", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(expiredSub());
      const { checkAndIncrementVideoSeconds } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(checkAndIncrementVideoSeconds("org_9b", 5)).rejects.toThrow("no-active-usage-period");
    });
  });

  describe("adjustCurrentPeriodUsage", () => {
    test("adjusts only the fields passed and clamps the floor at 0", async () => {
      const periodEnd = new Date(Date.now() + 10 * DAY);
      row = { organizationId: "org_10", periodStart: new Date(), periodEnd, imageCount: 2, videoSeconds: 5 };
      mockPrisma.subscription.findUnique.mockResolvedValue(activeSub(periodEnd));

      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");

      // Grant credits: negative delta decrements `used`, clamped at 0 (2 - 10 -> 0, not -8).
      await adjustCurrentPeriodUsage("org_10", { images: -10 });
      assert.equal(row!.imageCount, 0);
      assert.equal(row!.videoSeconds, 5); // untouched — only `images` was passed

      // Revoke credits: positive delta increments `used`; videoSeconds-only call
      // leaves imageCount alone.
      await adjustCurrentPeriodUsage("org_10", { videoSeconds: 3 });
      assert.equal(row!.videoSeconds, 8);
      assert.equal(row!.imageCount, 0);
    });

    test("self-heals when no active period exists but the subscription is legitimately active", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * DAY);
      mockPrisma.subscription.findUnique.mockResolvedValue(trialingSub(trialEndsAt));

      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await adjustCurrentPeriodUsage("org_11", { images: -5 });

      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 1);
      assert.equal(row!.imageCount, 0); // fresh row starts at 0, clamped after -5
      assert.equal(row!.periodEnd.getTime(), trialEndsAt.getTime());
    });

    test("throws no-subscription when the Subscription row is missing", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(adjustCurrentPeriodUsage("org_12", { images: 1 })).rejects.toThrow("no-subscription");
    });

    test("throws no-active-usage-period when there is nothing valid to self-heal from", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(expiredSub());
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await expect(adjustCurrentPeriodUsage("org_13", { images: 1 })).rejects.toThrow("no-active-usage-period");
    });

    test("no-op when neither field is passed — never touches the Subscription or MayaUsage tables", async () => {
      const { adjustCurrentPeriodUsage } = await import("../../modules/agents/maya/maya.usage.service.js");
      await adjustCurrentPeriodUsage("org_14", {});
      assert.equal(mockPrisma.subscription.findUnique.mock.calls.length, 0);
      assert.equal(mockPrisma.mayaUsage.create.mock.calls.length, 0);
    });
  });
});
