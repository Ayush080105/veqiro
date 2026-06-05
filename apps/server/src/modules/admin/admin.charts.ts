export type WeekBucket = { week: string; count: number };
export type TokenBucket = { week: string; tokens: number; messages: number };
export type HealthBucket = {
  week: string;
  active: number;
  trialing: number;
  pastDue: number;
  cancelledExpired: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekStart(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() - copy.getUTCDay()); // rewind to Sunday
  return copy;
}

export function buildSignupBuckets(
  orgs: Array<{ createdAt: Date }>,
  weekCount: number,
  now: Date = new Date(),
): WeekBucket[] {
  const currentWeekStart = weekStart(now);
  const firstBucketTime = currentWeekStart.getTime() - (weekCount - 1) * WEEK_MS;

  const buckets: WeekBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    week: new Date(firstBucketTime + i * WEEK_MS).toISOString().slice(0, 10),
    count: 0,
  }));

  for (const org of orgs) {
    const ws = weekStart(org.createdAt).getTime();
    const idx = Math.round((ws - firstBucketTime) / WEEK_MS);
    if (idx >= 0 && idx < weekCount) buckets[idx].count++;
  }
  return buckets;
}

export function buildTokenBuckets(
  messages: Array<{ createdAt: Date; tokensUsed: number }>,
  weekCount: number,
  now: Date = new Date(),
): TokenBucket[] {
  const currentWeekStart = weekStart(now);
  const firstBucketTime = currentWeekStart.getTime() - (weekCount - 1) * WEEK_MS;

  const buckets: TokenBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    week: new Date(firstBucketTime + i * WEEK_MS).toISOString().slice(0, 10),
    tokens: 0,
    messages: 0,
  }));

  for (const msg of messages) {
    const ws = weekStart(msg.createdAt).getTime();
    const idx = Math.round((ws - firstBucketTime) / WEEK_MS);
    if (idx >= 0 && idx < weekCount) {
      buckets[idx].tokens += msg.tokensUsed;
      buckets[idx].messages++;
    }
  }
  return buckets;
}

export function buildHealthBuckets(
  orgs: Array<{ createdAt: Date; subscriptionStatus: string | null }>,
  weekCount: number,
  now: Date = new Date(),
): HealthBucket[] {
  const currentWeekStart = weekStart(now);
  const firstBucketTime = currentWeekStart.getTime() - (weekCount - 1) * WEEK_MS;

  const buckets: HealthBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    week: new Date(firstBucketTime + i * WEEK_MS).toISOString().slice(0, 10),
    active: 0,
    trialing: 0,
    pastDue: 0,
    cancelledExpired: 0,
  }));

  for (const org of orgs) {
    const ws = weekStart(org.createdAt).getTime();
    const idx = Math.round((ws - firstBucketTime) / WEEK_MS);
    if (idx < 0 || idx >= weekCount) continue;
    const s = org.subscriptionStatus;
    if (s === "ACTIVE") buckets[idx].active++;
    else if (s === "TRIALING") buckets[idx].trialing++;
    else if (s === "PAST_DUE") buckets[idx].pastDue++;
    else if (s === "CANCELLED" || s === "EXPIRED") buckets[idx].cancelledExpired++;
  }
  return buckets;
}
