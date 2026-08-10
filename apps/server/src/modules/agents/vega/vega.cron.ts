import { prisma } from "../../../config/prisma.js";

export async function runFollowUpCheck() {
  try {
    const overdue = await prisma.vegaFollowUp.updateMany({
      where: {
        status: "PENDING",
        dueAt: { lt: new Date() },
      },
      data: { status: "OVERDUE" },
    });
    if (overdue.count > 0) {
      console.log(`[vega-cron] Marked ${overdue.count} follow-ups as OVERDUE`);
    }
  } catch (err) {
    console.error("[vega-cron] Follow-up check failed:", err);
  }
}
