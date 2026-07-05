import { prisma } from "../../../config/prisma.js";
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

// ─── Public: getCurrentUsage (for GET /maya/usage) ───────────────────────────

export async function getCurrentUsage(organizationId: string) {
  const [sub, period] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true, plan: true, entitlementMode: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");

  const tier = getTierFromSubscription(sub);
  const quota = getQuotaForTier(tier);

  const imageCount   = period?.imageCount   ?? 0;
  const videoSeconds = period?.videoSeconds ?? 0;
  const periodStart  = period?.periodStart  ?? new Date();
  const periodEnd    = period?.periodEnd    ?? new Date();

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
      select: { status: true, plan: true, entitlementMode: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");
  if (!period) throw new BadRequestError("no-active-usage-period");

  const tier = getTierFromSubscription(sub);
  const quota = getQuotaForTier(tier);

  await prisma.$transaction(async (tx) => {
    // Lock the row to serialize concurrent requests for the same org.
    const rows = await tx.$queryRaw<Array<{ imageCount: number }>>`
      SELECT "imageCount" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${period.periodStart}
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
          periodStart: period.periodStart,
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
      select: { status: true, plan: true, entitlementMode: true },
    }),
    getActivePeriod(organizationId),
  ]);
  if (!sub) throw new BadRequestError("no-subscription");
  if (!period) throw new BadRequestError("no-active-usage-period");

  const tier = getTierFromSubscription(sub);
  const quota = getQuotaForTier(tier);

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ videoSeconds: number }>>`
      SELECT "videoSeconds" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${period.periodStart}
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
          periodStart: period.periodStart,
        },
      },
      data: { videoSeconds: { increment: seconds } },
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
