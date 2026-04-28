import cron from "node-cron";
import { prisma } from "../../../config/prisma.js";
import { generateAndCacheBriefing } from "./vega.workspace.service.js";

async function findOrgsWithGoogle(): Promise<
  Array<{ organizationId: string; userId: string }>
> {
  const googleAccounts = await prisma.account.findMany({
    where: { providerId: "google", accessToken: { not: null } },
    select: { userId: true },
  });
  if (googleAccounts.length === 0) return [];

  const userIds = googleAccounts.map((a) => a.userId);
  const members = await prisma.member.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, organizationId: true, role: true },
  });

  const orgMap = new Map<string, { organizationId: string; userId: string }>();
  for (const m of members) {
    const existing = orgMap.get(m.organizationId);
    if (!existing || m.role === "owner") {
      orgMap.set(m.organizationId, {
        organizationId: m.organizationId,
        userId: m.userId,
      });
    }
  }
  return Array.from(orgMap.values());
}

async function runBriefingForAllOrgs(type: "MORNING" | "EVENING" | "WEEKLY") {
  const orgs = await findOrgsWithGoogle();
  await Promise.allSettled(
    orgs.map(({ userId, organizationId }) =>
      generateAndCacheBriefing(userId, organizationId, {
        type,
        includeEmail: true,
        includeCalendar: true,
      }).catch((err) =>
        console.error(
          `[vega-cron] ${type} briefing failed for org ${organizationId}:`,
          err
        )
      )
    )
  );
  console.log(`[vega-cron] ${type} briefing generated for ${orgs.length} orgs`);
}

async function runFollowUpCheck() {
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
}

export function startVegaCron() {
  // Morning briefing — 08:00 UTC daily
  cron.schedule("0 8 * * *", () => {
    void runBriefingForAllOrgs("MORNING");
  });

  // Evening wrap-up — 18:00 UTC daily
  cron.schedule("0 18 * * *", () => {
    void runBriefingForAllOrgs("EVENING");
  });

  // Follow-up overdue check — 09:00 UTC daily
  cron.schedule("0 9 * * *", () => {
    void runFollowUpCheck();
  });

  // Weekly insights — Monday 08:00 UTC
  cron.schedule("0 8 * * 1", () => {
    void runBriefingForAllOrgs("WEEKLY");
  });

  console.log("[vega-cron] Scheduled: morning briefing, evening wrap-up, follow-up check, weekly insights");
}
