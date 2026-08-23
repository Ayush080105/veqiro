import cron from "node-cron";
import { prisma } from "../../config/prisma.js";

/**
 * Retention for the two append-only MCP tables. Both grow forever otherwise,
 * and neither has a natural bound — the action log grows with every provider
 * call, the event ledger with every inbound trigger.
 *
 * The windows differ because the tables mean different things.
 */

/**
 * The action log is the customer-facing audit trail — "what did the agents do
 * in my systems". Deleting it aggressively would undercut the product's own
 * promise, so it keeps a year. The value report reads a 30-day window, so a
 * year leaves plenty of margin for anyone asking about last quarter.
 *
 * At the measured ~570 bytes a row, a year of even 1,000 calls a day is
 * roughly 200 MB — large but not alarming, and bounded.
 */
const ACTION_LOG_RETENTION_DAYS = 365;

/**
 * The event ledger is operational debris: it exists to dedupe redeliveries and
 * to explain why a trigger did or didn't fire. Ninety days is far beyond any
 * provider's redelivery window — retries arrive within hours — while still
 * leaving enough history to investigate "this fired twice last month".
 */
const TRIGGER_EVENT_RETENTION_DAYS = 90;

/** Deleted in batches so a first run against a long-neglected table doesn't
 *  take a lock long enough to matter to live requests. */
const BATCH_SIZE = 5_000;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const pruneTable = async (
  label: string,
  deleteBatch: (cutoff: Date, limit: number) => Promise<number>,
  retentionDays: number,
): Promise<number> => {
  const cutoff = daysAgo(retentionDays);
  let removed = 0;
  // Bounded: at worst this clears BATCH_SIZE * 20 rows per nightly run, and
  // the next run picks up where it left off rather than running unbounded.
  for (let i = 0; i < 20; i += 1) {
    const n = await deleteBatch(cutoff, BATCH_SIZE);
    removed += n;
    if (n < BATCH_SIZE) break;
  }
  if (removed > 0) console.log(`[mcp-retention] pruned ${removed} rows from ${label}`);
  return removed;
};

export const pruneActionLog = () =>
  pruneTable(
    "mcp_action_log",
    async (cutoff, limit) => {
      const { count } = await prisma.mcpActionLog.deleteMany({
        where: {
          id: {
            in: (
              await prisma.mcpActionLog.findMany({
                where: { createdAt: { lt: cutoff } },
                select: { id: true },
                take: limit,
              })
            ).map((r) => r.id),
          },
        },
      });
      return count;
    },
    ACTION_LOG_RETENTION_DAYS,
  );

export const pruneTriggerEvents = () =>
  pruneTable(
    "mcp_trigger_event",
    async (cutoff, limit) => {
      const { count } = await prisma.mcpTriggerEvent.deleteMany({
        where: {
          id: {
            in: (
              await prisma.mcpTriggerEvent.findMany({
                where: { createdAt: { lt: cutoff } },
                select: { id: true },
                take: limit,
              })
            ).map((r) => r.id),
          },
        },
      });
      return count;
    },
    TRIGGER_EVENT_RETENTION_DAYS,
  );

export function startMcpRetentionCron() {
  // 03:30 UTC — off the 09:00 slot the other daily jobs share, so a long first
  // prune can't delay the briefing crons.
  cron.schedule("30 3 * * *", () => {
    void pruneActionLog().catch((err) =>
      console.error("[mcp-retention] action log prune failed", err),
    );
    void pruneTriggerEvents().catch((err) =>
      console.error("[mcp-retention] trigger event prune failed", err),
    );
  });
  console.log(
    `[mcp-retention] Nightly prune scheduled (03:30 UTC) — action log ${ACTION_LOG_RETENTION_DAYS}d, trigger events ${TRIGGER_EVENT_RETENTION_DAYS}d`,
  );
}
