import cron from "node-cron";
import { runEmailPipelineForAllOrgs, runFollowUpCheck } from "../agents/vega/vega.cron.js";
import { runDailyAlertsNow } from "../agents/rex/rex.cron.js";
import { startMayaScheduledPostsCron } from "../agents/maya/maya.cron.js";

export function startSystemCrons() {
  // Vega email pipeline: auto-label + auto-draft new emails — every 30 min
  cron.schedule("*/30 * * * *", () => void runEmailPipelineForAllOrgs());

  // Vega follow-up overdue check — 09:00 UTC daily
  cron.schedule("0 9 * * *", () => void runFollowUpCheck());

  // Rex threshold-based metric alerts — 09:00 UTC daily
  cron.schedule("0 9 * * *", () => void runDailyAlertsNow());

  // Maya scheduled post publisher — every minute
  startMayaScheduledPostsCron();

  console.log("[system-cron] Email pipeline (30min), follow-up check & Rex alerts (daily 09:00 UTC), Maya scheduled posts (every 1min) scheduled");
}
