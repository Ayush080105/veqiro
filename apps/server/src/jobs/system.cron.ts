import cron from "node-cron";
import { runFollowUpCheck } from "../modules/agents/vega/vega.cron.js";
import { runDailyAlertsNow } from "../modules/agents/rex/rex.cron.js";
import { startMayaScheduledPostsCron } from "../modules/agents/maya/maya.cron.js";
import { sweepExpiredEntitlements } from "./entitlementSweeper.job.js";
import { runWeeklyLegalBrief } from "../modules/agents/lex/lex.cron.js";

export function startSystemCrons() {
  // Vega follow-up overdue check — 09:00 UTC daily
  cron.schedule("0 9 * * *", () => {
    void runFollowUpCheck().catch((err) => {
      console.error("[system-cron] follow-up check failed", err);
    });
  });

  // Rex threshold-based metric alerts — 09:00 UTC daily
  cron.schedule("0 9 * * *", () => {
    void runDailyAlertsNow().catch((err) => {
      console.error("[system-cron] Rex daily alerts failed", err);
    });
  });

  // Maya scheduled post publisher — every minute
  startMayaScheduledPostsCron();

  // Entitlement expiry sweeper — every 15 min. Reporting accuracy only: the
  // access check already tests currentPeriodEnd > now on every request, so this
  // never gates access. Idempotent, so multi-instance double-firing is a no-op.
  cron.schedule("*/15 * * * *", () => {
    void sweepExpiredEntitlements().catch((err) => {
      console.error("[system-cron] entitlement sweep failed", err);
    });
  });

  // Lex weekly Legal Brief — Mondays 03:30 UTC (09:00 IST), opt-in per organisation.
  cron.schedule("30 3 * * 1", () => {
    void runWeeklyLegalBrief().catch((err) => {
      console.error("[system-cron] Lex legal brief failed", err);
    });
  });

  console.log("[system-cron] Follow-up check & Rex alerts (daily 09:00 UTC), Maya scheduled posts (every 1min), entitlement sweeper (15min) scheduled");
}
