import { prisma } from "../config/prisma.js";

/**
 * Flips lapsed entitlements to EXPIRED.
 *
 * Scope note: this is for REPORTING accuracy, not access control. The access
 * check (entitlement.service.ts) already tests `currentPeriodEnd > now` on
 * every request, so a lapsed entitlement is denied whether or not this job
 * ever runs — a missed webhook cannot extend access even with the sweeper
 * down. This job exists only so status columns state the truth (admin views,
 * reporting) and so EXPIRED is a real terminal state rather than "ACTIVE
 * with a past date." Do not make anything depend on this job for
 * correctness.
 *
 * SUPERSEDED is excluded — nothing currently writes that status (it's a
 * defensive no-op inclusion), but if something ever does supersede a row and
 * mark it as such, it must keep that status as an audit trail. Sweeping it to
 * EXPIRED would destroy the distinction between "superseded" and "lapsed".
 */
export async function sweepExpiredEntitlements(now = new Date()): Promise<{ expired: number }> {
  const { count } = await prisma.entitlement.updateMany({
    where: {
      currentPeriodEnd: { lt: now },
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
    },
    data: { status: "EXPIRED" },
  });
  if (count > 0) console.log(`[billing] sweeper expired ${count} entitlement(s)`);
  return { expired: count };
}
