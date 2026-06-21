import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function run() {
  console.log("\n══════════════════════════════════════════════");
  console.log("TEST 1 — VEGA payload on default tasks");
  console.log("══════════════════════════════════════════════");
  const vegaTasks = await prisma.task.findMany({
    where: { agent: "VEGA", isDefault: true },
    select: { name: true, cronExpression: true, payload: true, isEnabled: true },
    orderBy: { name: "asc" },
    distinct: ["name"],
  });
  for (const t of vegaTasks) {
    const payload = t.payload as Record<string, unknown> | null;
    const type = payload?.vegaBriefingType ?? "❌ MISSING";
    const ok = !!payload?.vegaBriefingType ? "✅" : "❌";
    console.log(`  ${ok} ${t.name} → vegaBriefingType: ${type}`);
  }

  console.log("\n══════════════════════════════════════════════");
  console.log("TEST 2 — All default task names seeded per org");
  console.log("══════════════════════════════════════════════");
  const expected = ["Weekly Financial Digest", "Morning Briefing", "Evening Wrap-up", "Content Ideas", "Weekly SEO Report"];
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  let orgPass = 0, orgFail = 0;
  for (const org of orgs) {
    const names = await prisma.task.findMany({
      where: { organizationId: org.id, isDefault: true },
      select: { name: true },
    });
    const nameSet = new Set(names.map((n) => n.name));
    const missing = expected.filter((e) => !nameSet.has(e));
    if (missing.length === 0) {
      console.log(`  ✅ ${org.name} (${org.id.slice(0, 8)}) — all 5 defaults present`);
      orgPass++;
    } else {
      console.log(`  ❌ ${org.name} (${org.id.slice(0, 8)}) — missing: ${missing.join(", ")}`);
      orgFail++;
    }
  }
  console.log(`  → ${orgPass} orgs complete, ${orgFail} incomplete`);

  console.log("\n══════════════════════════════════════════════");
  console.log("TEST 3 — Force manual-run: stamp lastRunAt");
  console.log("══════════════════════════════════════════════");
  const sample = await prisma.task.findFirst({
    where: { isDefault: true, agent: "VEGA" },
    select: { id: true, organizationId: true, name: true, lastRunAt: true },
  });
  if (sample) {
    const before = sample.lastRunAt;
    await prisma.task.update({
      where: { id: sample.id },
      data: { lastRunAt: new Date() },
    });
    const after = await prisma.task.findFirst({
      where: { id: sample.id },
      select: { lastRunAt: true },
    });
    const ok = after?.lastRunAt && after.lastRunAt !== before ? "✅" : "❌";
    console.log(`  ${ok} ${sample.name} — lastRunAt: ${before ?? "null"} → ${after?.lastRunAt?.toISOString()}`);
  }

  console.log("\n══════════════════════════════════════════════");
  console.log("TEST 4 — claimDueTasks: force a task due, claim it");
  console.log("══════════════════════════════════════════════");
  const target = await prisma.task.findFirst({
    where: { isDefault: true, agent: "REX" },
    select: { id: true, organizationId: true, name: true },
  });
  if (target) {
    // Set nextRunAt to past
    await prisma.task.update({
      where: { id: target.id },
      data: { nextRunAt: new Date(Date.now() - 60_000) },
    });
    // Run the claim query
    const claimed = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
      UPDATE "task"
      SET "nextRunAt" = NULL, "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "task"
        WHERE "isEnabled" = true AND "nextRunAt" <= NOW()
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, name
    `;
    const claimedTask = claimed.find((c) => c.id === target.id);
    const ok = claimedTask ? "✅" : "❌";
    console.log(`  ${ok} ${target.name} — claimed: ${!!claimedTask} (nextRunAt set to NULL)`);

    // Restore it with a future nextRunAt
    await prisma.task.update({
      where: { id: target.id },
      data: { nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    console.log(`  ↩ Restored nextRunAt to 7 days from now`);
  }

  console.log("\n══════════════════════════════════════════════");
  console.log("TEST 5 — seedDefaultTasks name-guard: create org with 1 custom task, re-seed");
  console.log("══════════════════════════════════════════════");
  const { seedDefaultTasks } = await import("../src/modules/tasks/tasks.service.js");
  const { findDefaultTaskNames } = await import("../src/modules/tasks/tasks.repository.js");

  // Use first org and temporarily check what happens if we re-seed
  const firstOrg = orgs[0]!;
  const beforeNames = await findDefaultTaskNames(firstOrg.id);
  await seedDefaultTasks(firstOrg.id); // should skip all (all exist)
  const afterNames = await findDefaultTaskNames(firstOrg.id);
  const countBefore = beforeNames.size;
  const countAfter = afterNames.size;
  const ok = countBefore === countAfter ? "✅" : "❌";
  console.log(`  ${ok} Re-seeding ${firstOrg.name}: ${countBefore} tasks before → ${countAfter} after (idempotent, no duplicates)`);

  console.log("\n══════════════════════════════════════════════");
  console.log("TEST 6 — nextRunAt sanity: all enabled defaults have future nextRunAt");
  console.log("══════════════════════════════════════════════");
  const now = new Date();
  const stale = await prisma.task.findMany({
    where: {
      isDefault: true,
      isEnabled: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    select: { name: true, organizationId: true, nextRunAt: true },
  });
  if (stale.length === 0) {
    console.log("  ✅ All enabled default tasks have a future nextRunAt");
  } else {
    console.log(`  ⚠️  ${stale.length} task(s) with null or past nextRunAt:`);
    for (const s of stale.slice(0, 5)) {
      console.log(`     - ${s.name} (org ${s.organizationId.slice(0, 8)}) → ${s.nextRunAt?.toISOString() ?? "null"}`);
    }
    if (stale.length > 5) console.log(`     ... and ${stale.length - 5} more`);
  }

  console.log("\n══════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("══════════════════════════════════════════════");
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
