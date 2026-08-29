import { EntitlementSource } from "../../../../prisma/generated/prisma/client.js";

// ─── Credit conversion factors ─────────────────────────────────────────────
export const CREDITS_PER_IMAGE = 2;
export const CREDITS_PER_VIDEO_SECOND = 4;

export function imageCreditsFor(count: number): number {
  return count * CREDITS_PER_IMAGE;
}
export function videoCreditsFor(seconds: number): number {
  return seconds * CREDITS_PER_VIDEO_SECOND;
}

// ─── Video length ───────────────────────────────────────────────────────────
// Gemini Omni renders one 10s shot per call and extends in 10s steps up to 40s,
// so every video is a whole number of 10-second segments. The storyboard step
// draws one 3x3 sheet per segment, which is why its cost scales the same way.
export const VIDEO_SEGMENT_SECONDS = 10;
export const MAX_VIDEO_SECONDS = 40;
export const VIDEO_DURATION_OPTIONS = [10, 20, 30, 40] as const;

export function videoSegmentsFor(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / VIDEO_SEGMENT_SECONDS));
}
export function storyboardCreditsFor(seconds: number): number {
  return imageCreditsFor(videoSegmentsFor(seconds));
}

// ─── Top-up conversion ──────────────────────────────────────────────────────
export const TOPUP_DOLLAR_UNIT = 3;
export const TOPUP_CREDITS_PER_UNIT = 50;

// The only amounts a top-up checkout may be created for — matches the
// frontend's preset buttons exactly. Deliberately a closed allowlist, not
// just "any positive multiple of $3": the checkout route is reachable
// directly (not only through the dialog), so without this a caller could
// request an arbitrary multiple of 3 (e.g. $300) that was never intended to
// be offered.
export const ALLOWED_TOPUP_DOLLARS = [3, 6, 9, 12, 15] as const;

export function isAllowedTopupDollars(dollars: number): dollars is (typeof ALLOWED_TOPUP_DOLLARS)[number] {
  return (ALLOWED_TOPUP_DOLLARS as readonly number[]).includes(dollars);
}

// Throws on non-multiples so a future backend purchase handler fails loudly
// on bad input rather than silently truncating/rounding.
export function creditsForTopUpDollars(dollars: number): number {
  if (dollars <= 0 || dollars % TOPUP_DOLLAR_UNIT !== 0) {
    throw new Error(`Top-up amount must be a positive multiple of $${TOPUP_DOLLAR_UNIT}`);
  }
  return (dollars / TOPUP_DOLLAR_UNIT) * TOPUP_CREDITS_PER_UNIT;
}

/**
 * Maya's monthly credit allowance, read live from her entitlement.
 *
 * Only `source` matters: every non-trial agent purchase gets the same 300
 * credit allowance regardless of billing cadence, so this deliberately does
 * not take a `plan` param — callers should not fetch one just to pass it in.
 */
export function getQuotaForMayaEntitlement(e: { source: EntitlementSource }): number {
  return e.source === "TRIAL" ? 30 : 300;
}
