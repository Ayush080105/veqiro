import cronParser from "cron-parser";

/**
 * Next fire time for a 5-field cron expression, or null if it can't be parsed.
 *
 * Lived in the tasks module until that feature was removed; expenses depends on
 * it for recurring-expense scheduling, so it moved here rather than being
 * deleted with its former home.
 */
export function computeNextRun(cronExpression: string, timezone = "UTC"): Date | null {
  if (!cronExpression || cronExpression.trim().split(/\s+/).length !== 5) return null;
  try {
    const interval = cronParser.parseExpression(cronExpression, { tz: timezone });
    return interval.next().toDate();
  } catch {
    return null;
  }
}
