import { prisma } from "../../../config/prisma.js";
import { Prisma } from "../../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { QuotaExceededError } from "../../../common/errors/quotaExceeded.js";
import { getTierFromSubscription, getQuotaForTier } from "./maya.quotas.js";

// ─── Period lookup ────────────────────────────────────────────────────────────
// Period boundaries are always set explicitly by billing hooks when a plan
// starts or renews. This function simply finds the currently active record.

export async function getActivePeriod(organizationId: string) {
  return prisma.mayaUsage.findFirst({
    where: { organizationId, periodEnd: { gt: new Date() } },
    orderBy: { periodStart: "desc" },
  });
}

// Subset of Subscription fields needed to derive where a legitimately-active
// org's current MayaUsage period should end, mirroring the convention used by
// `startTrialForOrg`/`startOrExtendTrial`/the billing webhooks: TRIALING
// periods end at `trialEndsAt`, paid periods (ACTIVE/PAST_DUE/CANCELLED — the
// latter two still hold access through the period they already paid for) end
// at `currentPeriodEnd`. EXPIRED (or any status missing the relevant date)
// has nothing valid to derive from and is treated as genuinely expired, not
// a gap to self-heal.
type SubscriptionPeriodFields = {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

function deriveExpectedPeriodEnd(sub: SubscriptionPeriodFields): Date | null {
  if (sub.status === "TRIALING") return sub.trialEndsAt ?? null;
  if (sub.status === "ACTIVE" || sub.status === "PAST_DUE" || sub.status === "CANCELLED") {
    return sub.currentPeriodEnd ?? null;
  }
  return null;
}

// Lazily creates the MayaUsage row for an org whose Subscription is
// legitimately active but has no current period (e.g. a webhook race, or an
// edge case the backfill migration didn't catch). Returns null (no self-heal)
// when the subscription has no valid date to derive a period from, or when
// the derived end date is already in the past — the latter matters because
// without it, a CANCELLED/PAST_DUE org whose paid period has already lapsed
// (but hasn't yet received its `subscription.expired` webhook) would get a
// brand-new already-expired MayaUsage row created on *every* read, since it
// would never satisfy `getActivePeriod`'s `periodEnd > now` filter.
//
// Race safety: two concurrent requests can both observe "no active period"
// and both attempt to create one. Because `periodStart` is `new Date()` at
// call time, the two creates will almost never collide on the
// `organizationId_periodStart` unique key (different millisecond timestamps),
// so both could succeed, leaving two active-looking rows. That's an accepted,
// low-stakes risk here (worst case: a rare, temporary double-counted period
// window that `getActivePeriod`'s `orderBy periodStart desc` will converge on
// the newer row for) rather than something worth a distributed lock for. We
// still catch the (rare, same-millisecond) unique-constraint violation case
// and refetch instead of crashing the caller.
async function ensurePeriod(organizationId: string, sub: SubscriptionPeriodFields) {
  const periodEnd = deriveExpectedPeriodEnd(sub);
  if (!periodEnd || periodEnd.getTime() <= Date.now()) return null;

  try {
    return await prisma.mayaUsage.create({
      data: { organizationId, periodStart: new Date(), periodEnd },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await getActivePeriod(organizationId);
      if (existing) return existing;
    }
    throw err;
  }
}

// ─── Public: getCurrentUsage (for GET /maya/usage) ───────────────────────────

export async function getCurrentUsage(organizationId: string) {
  const [sub, period] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true, plan: true, entitlementMode: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");

  // Period missing but subscription legitimately active: self-heal instead of
  // showing fake zeros for a gap that's really just a missing row. If the sub
  // has nothing valid to derive a period from, `ensurePeriod` returns null and
  // we fall back to the previous zeroed-display behavior below.
  const resolvedPeriod = period ?? (await ensurePeriod(organizationId, sub));

  const tier = getTierFromSubscription(sub);
  const quota = getQuotaForTier(tier);

  const imageCount   = resolvedPeriod?.imageCount   ?? 0;
  const videoSeconds = resolvedPeriod?.videoSeconds ?? 0;
  const periodStart  = resolvedPeriod?.periodStart  ?? new Date();
  const periodEnd    = resolvedPeriod?.periodEnd    ?? new Date();

  return {
    tier,
    periodStart: periodStart.toISOString(),
    periodEnd:   periodEnd.toISOString(),
    images: {
      used:      imageCount,
      limit:     quota.images,
      remaining: Math.max(0, quota.images - imageCount),
    },
    videoSeconds: {
      used:      videoSeconds,
      limit:     quota.videoSeconds,
      remaining: Math.max(0, quota.videoSeconds - videoSeconds),
    },
  };
}

// ─── Public: checkAndIncrementImages ─────────────────────────────────────────

export async function checkAndIncrementImages(
  organizationId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;

  const [sub, period] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true, plan: true, entitlementMode: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");
  // Period missing but subscription legitimately active: self-heal instead of
  // hard-failing generation. `ensurePeriod` only returns a row when there's a
  // valid, still-future date to derive `periodEnd` from — otherwise this
  // still throws `no-active-usage-period` as before.
  const resolvedPeriod = period ?? (await ensurePeriod(organizationId, sub));
  if (!resolvedPeriod) throw new BadRequestError("no-active-usage-period");

  const tier = getTierFromSubscription(sub);
  const quota = getQuotaForTier(tier);

  await prisma.$transaction(async (tx) => {
    // Lock the row to serialize concurrent requests for the same org.
    const rows = await tx.$queryRaw<Array<{ imageCount: number }>>`
      SELECT "imageCount" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${resolvedPeriod.periodStart}
      FOR UPDATE
    `;
    const current = rows[0]?.imageCount ?? 0;

    if (current + count > quota.images) {
      throw new QuotaExceededError("images", current, quota.images);
    }

    await tx.mayaUsage.update({
      where: {
        organizationId_periodStart: {
          organizationId,
          periodStart: resolvedPeriod.periodStart,
        },
      },
      data: { imageCount: { increment: count } },
    });
  });
}

// ─── Public: checkAndIncrementVideoSeconds ────────────────────────────────────

export async function checkAndIncrementVideoSeconds(
  organizationId: string,
  seconds: number,
): Promise<void> {
  if (seconds <= 0) return;

  const [sub, period] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true, plan: true, entitlementMode: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");
  const resolvedPeriod = period ?? (await ensurePeriod(organizationId, sub));
  if (!resolvedPeriod) throw new BadRequestError("no-active-usage-period");

  const tier = getTierFromSubscription(sub);
  const quota = getQuotaForTier(tier);

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ videoSeconds: number }>>`
      SELECT "videoSeconds" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${resolvedPeriod.periodStart}
      FOR UPDATE
    `;
    const current = rows[0]?.videoSeconds ?? 0;

    if (current + seconds > quota.videoSeconds) {
      throw new QuotaExceededError("video_seconds", current, quota.videoSeconds);
    }

    await tx.mayaUsage.update({
      where: {
        organizationId_periodStart: {
          organizationId,
          periodStart: resolvedPeriod.periodStart,
        },
      },
      data: { videoSeconds: { increment: seconds } },
    });
  });
}

// ─── Public: adjustCurrentPeriodUsage ─────────────────────────────────────────
// Foundation primitive for a future admin "add/remove N credits" action:
// grant credits by passing a negative delta (decrements `used`), revoke by
// passing a positive delta (increments `used`). No schema change — this just
// nudges the counters on the org's active MayaUsage period. Unlike
// checkAndIncrement*, this does NOT enforce the quota ceiling (an admin
// override is allowed to push `used` above the plan limit), but it does
// clamp the floor at 0 so a revoke-then-grant sequence (or an overzealous
// grant) can never leave a negative count.

export async function adjustCurrentPeriodUsage(
  organizationId: string,
  delta: { images?: number; videoSeconds?: number },
): Promise<void> {
  const { images, videoSeconds } = delta;
  if (images === undefined && videoSeconds === undefined) return;

  const [sub, period] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true, plan: true, entitlementMode: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");
  const resolvedPeriod = period ?? (await ensurePeriod(organizationId, sub));
  if (!resolvedPeriod) throw new BadRequestError("no-active-usage-period");

  await prisma.$transaction(async (tx) => {
    // Lock the row to serialize concurrent adjustments for the same org.
    const rows = await tx.$queryRaw<Array<{ imageCount: number; videoSeconds: number }>>`
      SELECT "imageCount", "videoSeconds" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${resolvedPeriod.periodStart}
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) return;

    const data: { imageCount?: number; videoSeconds?: number } = {};
    if (images !== undefined) {
      data.imageCount = Math.max(0, current.imageCount + images);
    }
    if (videoSeconds !== undefined) {
      data.videoSeconds = Math.max(0, current.videoSeconds + videoSeconds);
    }

    await tx.mayaUsage.update({
      where: {
        organizationId_periodStart: {
          organizationId,
          periodStart: resolvedPeriod.periodStart,
        },
      },
      data,
    });
  });
}

// ─── Public: rollbacks ────────────────────────────────────────────────────────
// Called when an AI generation fails AFTER the quota was reserved.
// Failures are logged but never surfaced to the caller — the original error wins.

export async function rollbackImages(organizationId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const period = await getActivePeriod(organizationId);
  if (!period) return;
  await prisma.mayaUsage
    .update({
      where: {
        organizationId_periodStart: {
          organizationId,
          periodStart: period.periodStart,
        },
      },
      data: { imageCount: { decrement: count } },
    })
    .catch((e) => console.error("[maya] image quota rollback failed", e));
}

export async function rollbackVideoSeconds(organizationId: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const period = await getActivePeriod(organizationId);
  if (!period) return;
  await prisma.mayaUsage
    .update({
      where: {
        organizationId_periodStart: {
          organizationId,
          periodStart: period.periodStart,
        },
      },
      data: { videoSeconds: { decrement: seconds } },
    })
    .catch((e) => console.error("[maya] video quota rollback failed", e));
}
