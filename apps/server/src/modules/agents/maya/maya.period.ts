/**
 * The 1-month credit window containing `now`, anchored on Maya's entitlement
 * start.
 *
 * Deliberately decoupled from the billing period: an ANNUAL plan bills once a
 * year but its credits still reset monthly. The previous code set the usage
 * period to the billing period, so annual customers got one allowance for the
 * entire year (400 credits/year instead of 400/month).
 *
 * Anchors past the 28th clamp to the target month's last day (Jan 31 → Feb 28),
 * matching how calendar-anniversary billing behaves everywhere. A clamped
 * month does not permanently shrink later windows — the next window that
 * lands in a long-enough month snaps back to the anchor's day-of-month (see
 * the "chained clamp" test case).
 */
export function currentCreditWindow(anchor: Date, now: Date): { periodStart: Date; periodEnd: Date } {
  const monthsElapsed = Math.max(
    0,
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth()) -
      (dayOfMonthBefore(now, anchor) ? 1 : 0),
  );
  return {
    periodStart: addMonthsClamped(anchor, monthsElapsed),
    periodEnd:   addMonthsClamped(anchor, monthsElapsed + 1),
  };
}

function dayOfMonthBefore(now: Date, anchor: Date): boolean {
  const anchorDom = anchor.getUTCDate();
  const nowDom = now.getUTCDate();
  const lastDomThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  // If the anchor day doesn't exist this month, the clamped boundary is the
  // last day — so we're only "before" it if we haven't reached that day.
  const effectiveAnchorDom = Math.min(anchorDom, lastDomThisMonth);
  return nowDom < effectiveAnchorDom;
}

function addMonthsClamped(base: Date, months: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + months;
  const lastDom = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year, month, Math.min(base.getUTCDate(), lastDom),
    base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds(),
  ));
}
