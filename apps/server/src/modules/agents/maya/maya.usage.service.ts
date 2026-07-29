import { prisma } from "../../../config/prisma.js";
import { EntitlementSource } from "../../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { QuotaExceededError } from "../../../common/errors/quotaExceeded.js";
import { ForbiddenError } from "../../../common/errors/forbidden.js";
import { getMayaEntitlement } from "../../billing/entitlement.service.js";
import { getQuotaForMayaEntitlement } from "./maya.quotas.js";
import { currentCreditWindow } from "./maya.period.js";

// ─── Display tier (frontend badge only) ──────────────────────────────────────
// NOT used for quota lookup — the quota is always read live from the
// entitlement via getQuotaForMayaEntitlement. This purely maps the governing
// entitlement onto the labels the frontend already renders
// (apps/main/.../settings/usage/page.tsx TIER_LABELS), so that surface keeps
// working unchanged.
type DisplayTier = "TRIAL" | "MONTHLY_CUSTOM";

function displayTierFor(source: EntitlementSource): DisplayTier {
  return source === "TRIAL" ? "TRIAL" : "MONTHLY_CUSTOM"; // source === "AGENT": an individually-purchased agent, always MONTHLY.
}

// ─── Window resolution ────────────────────────────────────────────────────────
// Resolves Maya's governing entitlement, the quota it currently implies, and
// the deterministic 1-month credit window `now` falls in — then upserts the
// MayaUsage row for that window so a concurrent caller resolving the same
// window converges on the same row instead of racing to create it.
//
// The quota is read LIVE here rather than snapshotted onto the MayaUsage row:
// a mid-period conversion (e.g. TRIAL → AGENT) just raises the ceiling on the
// already-open window. No reset, so the user never loses unused credits, and
// nobody can refill credits by upgrading mid-period.
async function resolveMayaWindow(organizationId: string) {
  const ent = await getMayaEntitlement(organizationId);
  // Kept as "no-subscription" (not the newer "maya-not-entitled") — three
  // frontend call sites (settings/usage/page.tsx, MayaUsageCard.tsx,
  // credits-pill.tsx) match on this exact string to render their empty
  // state. Changing it would silently break all three.
  if (!ent) throw new BadRequestError("no-subscription");

  const tierLimit = getQuotaForMayaEntitlement({ source: ent.source });
  const tier = displayTierFor(ent.source);
  const { periodStart, periodEnd } = currentCreditWindow(ent.currentPeriodStart, new Date());

  const usage = await prisma.mayaUsage.upsert({
    where: { organizationId_periodStart: { organizationId, periodStart } },
    create: { organizationId, periodStart, periodEnd },
    update: {},
  });

  // Effective limit = the plan's tier limit plus any credits purchased via a
  // top-up this period. Callers should compare/report against this, never
  // the raw tierLimit, once a top-up has been applied.
  const limit = tierLimit + usage.bonusCredits;

  return { limit, tier, usage, periodStart, periodEnd };
}

// ─── Public: getCurrentUsage (for GET /maya/usage) ───────────────────────────

export async function getCurrentUsage(organizationId: string) {
  const { limit, tier, usage, periodStart, periodEnd } = await resolveMayaWindow(organizationId);
  const used = usage.creditsUsed;

  return {
    tier,
    periodStart: periodStart.toISOString(),
    periodEnd:   periodEnd.toISOString(),
    credits: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    },
  };
}

// ─── Public: assertVideoGenerationAllowed ─────────────────────────────────────
// Video generation (Generate Video, Campaign Video, Logo Animation) is not
// available on the free trial — only a paid Maya subscriber can generate
// video. The campaign-video storyboard step is exempt: it only produces a
// still preview image, not video, so trial users can still use it. Checked
// before checkAndDeductCredits at each call site so a trial org never locks a
// MayaUsage row for an action it isn't allowed to complete.

export async function assertVideoGenerationAllowed(organizationId: string): Promise<void> {
  const ent = await getMayaEntitlement(organizationId);
  if (ent?.source === "TRIAL") {
    throw new ForbiddenError(
      "Video generation isn't available on your free trial. Upgrade to a paid plan to unlock it.",
    );
  }
}

// ─── Public: checkAndDeductCredits ────────────────────────────────────────────

export async function checkAndDeductCredits(
  organizationId: string,
  credits: number,
): Promise<void> {
  if (credits <= 0) return;

  const { limit, periodStart } = await resolveMayaWindow(organizationId);

  await prisma.$transaction(async (tx) => {
    // Lock the row to serialize concurrent requests for the same org.
    const rows = await tx.$queryRaw<Array<{ creditsUsed: number }>>`
      SELECT "creditsUsed" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${periodStart}
      FOR UPDATE
    `;
    const current = rows[0]?.creditsUsed ?? 0;

    if (current + credits > limit) {
      throw new QuotaExceededError(current, limit);
    }

    await tx.mayaUsage.update({
      where: {
        organizationId_periodStart: { organizationId, periodStart },
      },
      data: { creditsUsed: { increment: credits } },
    });
  });
}

// ─── Public: adjustCurrentPeriodUsage ─────────────────────────────────────────
// Foundation primitive for a future admin "add/remove N credits" action:
// grant credits by passing a negative delta (decrements `used`), revoke by
// passing a positive delta (increments `used`). No schema change — this just
// nudges the counter on the org's current MayaUsage window. Unlike
// checkAndDeductCredits, this does NOT enforce the quota ceiling (an admin
// override is allowed to push `used` above the plan limit), but it does
// clamp the floor at 0 so a revoke-then-grant sequence (or an overzealous
// grant) can never leave a negative count.

export async function adjustCurrentPeriodUsage(
  organizationId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  const { periodStart } = await resolveMayaWindow(organizationId);

  await prisma.$transaction(async (tx) => {
    // Lock the row to serialize concurrent adjustments for the same org.
    const rows = await tx.$queryRaw<Array<{ creditsUsed: number }>>`
      SELECT "creditsUsed" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${periodStart}
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) return;

    await tx.mayaUsage.update({
      where: {
        organizationId_periodStart: { organizationId, periodStart },
      },
      data: { creditsUsed: Math.max(0, current.creditsUsed + delta) },
    });
  });
}

// ─── Public: grantPurchasedTopupCredits ───────────────────────────────────────
// Grants credits from a real money purchase (Maya top-up), by raising
// `bonusCredits` on the current window — a dedicated column, not a call to
// adjustCurrentPeriodUsage with a negative delta. That function's floor-at-0
// clamp on `creditsUsed` is correct for its own (admin grant/revoke) callers
// but wrong here: this repo's earlier version of this function decremented
// `creditsUsed` below zero to bank top-up headroom, which computed
// `remaining` correctly but rendered `used` as a raw negative number
// anywhere the frontend displays it directly (e.g. the usage progress bar
// showing "-50 / 300"). `bonusCredits` avoids that: `creditsUsed` never
// goes negative, and resolveMayaWindow's effective limit
// (tierLimit + bonusCredits) is what `remaining` is computed against.
export async function grantPurchasedTopupCredits(
  organizationId: string,
  credits: number,
): Promise<void> {
  if (credits <= 0) return;

  const { periodStart } = await resolveMayaWindow(organizationId);

  await prisma.$transaction(async (tx) => {
    // Lock the row to serialize concurrent top-up grants for the same org —
    // matches the other mutators' pattern even though a plain increment
    // wouldn't strictly need the read first.
    await tx.$queryRaw`
      SELECT "creditsUsed" FROM "maya_usage"
      WHERE "organizationId" = ${organizationId} AND "periodStart" = ${periodStart}
      FOR UPDATE
    `;

    await tx.mayaUsage.update({
      where: {
        organizationId_periodStart: { organizationId, periodStart },
      },
      data: { bonusCredits: { increment: credits } },
    });
  });
}

// ─── Public: rollback ─────────────────────────────────────────────────────────
// Called when an AI generation fails AFTER credits were reserved.
// Failures are logged but never surfaced to the caller — the original error
// wins. Resolving the window here (rather than just decrementing whatever
// MayaUsage row happens to exist) keeps this in step with checkAndDeductCredits,
// which already resolved and upserted the same window moments earlier in the
// same request — so this is expected to be a no-op lookup, not a fresh create.

export async function rollbackCredits(organizationId: string, credits: number): Promise<void> {
  if (credits <= 0) return;
  try {
    const { periodStart } = await resolveMayaWindow(organizationId);
    await prisma.mayaUsage.update({
      where: {
        organizationId_periodStart: { organizationId, periodStart },
      },
      data: { creditsUsed: { decrement: credits } },
    });
  } catch (e) {
    console.error("[maya] credits rollback failed", e);
  }
}
