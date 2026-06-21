import cron from "node-cron";
import { claimDueTasks, updateTask } from "./tasks.repository.js";
import { computeNextRun, dispatchTask } from "./tasks.service.js";

export function startTaskCronRunner() {
  cron.schedule("*/15 * * * *", async () => {
    let dueTasks;
    try {
      // Atomic claim via FOR UPDATE SKIP LOCKED — safe across multiple server instances
      dueTasks = await claimDueTasks();
    } catch (err) {
      console.error("[tasks-cron] Failed to claim due tasks:", err);
      return;
    }

    for (const task of dueTasks) {
      const now = new Date();
      const nextRunAt = task.cronExpression
        ? computeNextRun(task.cronExpression, task.timezone)
        : null;

      try {
        await updateTask(task.id, task.organizationId, { lastRunAt: now, nextRunAt });
      } catch (err) {
        console.error(`[tasks-cron] Failed to update timestamps for task ${task.id}:`, err);
        continue;
      }

      void dispatchTask(task).catch((err) =>
        console.error(`[tasks-cron] Handler failed for task ${task.id} (${task.name}):`, err)
      );
    }

    if (dueTasks.length > 0) {
      console.log(`[tasks-cron] Dispatched ${dueTasks.length} due task(s)`);
    }
  });

  console.log("[tasks-cron] Dynamic task runner started — polling every 15 minutes");
}
