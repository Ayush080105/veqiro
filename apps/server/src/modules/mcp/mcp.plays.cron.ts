import cron from "node-cron";
import { runDuePlays } from "./mcp.plays.service.js";

/**
 * Each org stores its own cron expression, so the scheduler can't be a set of
 * fixed cron.schedule() calls — it ticks every minute and asks which stored
 * expressions match this minute.
 *
 * Matching is done with node-cron's own validator plus a field-by-field
 * comparison rather than a second cron library, so a schedule that this
 * evaluates as due is the same one node-cron would have fired.
 */

/** Expands one cron field ("*", "1-5", "*\/15", "0,30") to the minutes/hours it covers. */
const expandField = (field: string, min: number, max: number): Set<number> => {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isFinite(step) || step < 1) continue;

    let start = min;
    let end = max;
    if (rangePart && rangePart !== "*") {
      const [a, b] = rangePart.split("-");
      start = Number(a);
      end = b === undefined ? Number(a) : Number(b);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    }
    for (let v = start; v <= end; v += step) {
      if (v >= min && v <= max) values.add(v);
    }
  }
  return values;
};

/**
 * Whether a 5-field cron expression matches the given moment.
 *
 * Day-of-month and day-of-week follow cron's own rule: when both are
 * restricted, either matching is enough. Getting that backwards would make
 * "0 9 1 * 1" fire on almost no days instead of most.
 */
export const matchesCron = (expression: string, at: Date): boolean => {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields as [
    string, string, string, string, string,
  ];

  if (!expandField(minute, 0, 59).has(at.getUTCMinutes())) return false;
  if (!expandField(hour, 0, 23).has(at.getUTCHours())) return false;
  if (!expandField(month, 1, 12).has(at.getUTCMonth() + 1)) return false;

  const domRestricted = dayOfMonth !== "*";
  const dowRestricted = dayOfWeek !== "*";
  // Cron normalises Sunday as both 0 and 7.
  const dowNow = at.getUTCDay();
  const dowSet = expandField(dayOfWeek, 0, 7);
  const domMatch = expandField(dayOfMonth, 1, 31).has(at.getUTCDate());
  const dowMatch = dowSet.has(dowNow) || (dowNow === 0 && dowSet.has(7));

  if (domRestricted && dowRestricted) return domMatch || dowMatch;
  if (domRestricted) return domMatch;
  if (dowRestricted) return dowMatch;
  return true;
};

export function startPlaysCron() {
  cron.schedule("* * * * *", () => {
    const now = new Date();
    void runDuePlays((schedule) => matchesCron(schedule, now)).catch((err) => {
      console.error("[plays-cron] tick failed", err);
    });
  });
  console.log("[plays-cron] Play scheduler started — checking every minute");
}
