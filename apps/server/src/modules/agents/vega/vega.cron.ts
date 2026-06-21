import cron from "node-cron";
import { prisma } from "../../../config/prisma.js";
import { generateAndCacheBriefing } from "./vega.workspace.service.js";
import { runEmailPipeline } from "./email.job.js";

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

export async function runBriefingForOrg(organizationId: string, type: "MORNING" | "EVENING" | "WEEKLY") {
  const orgs = await findOrgsWithGoogle();
  const org = orgs.find((o) => o.organizationId === organizationId);
  if (!org) return;
  await generateAndCacheBriefing(org.userId, org.organizationId, {
    type,
    includeEmail: true,
    includeCalendar: true,
  }).catch((err) =>
    console.error(`[vega-cron] ${type} briefing failed for org ${organizationId}:`, err)
  );
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

export async function runEmailPipelineForAllOrgs() {
  const orgs = await findOrgsWithGoogle();
  // Sequential — parallel Promise.allSettled across 16 orgs floods the event loop
  // with 100+ concurrent AI + Gmail callbacks, causing node-cron missed-tick warnings.
  for (const { userId, organizationId } of orgs) {
    await runEmailPipeline(userId, organizationId).catch((err) =>
      console.error(`[vega-cron] email pipeline failed for org ${organizationId}:`, err)
    );
  }
  console.log(`[vega-cron] Email pipeline complete for ${orgs.length} orgs`);
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

  // Email pipeline: auto-label + auto-draft for new emails — every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    void runEmailPipelineForAllOrgs();
  });

  console.log("[vega-cron] Scheduled: morning briefing, evening wrap-up, follow-up check, weekly insights, email pipeline (30min)");
}
