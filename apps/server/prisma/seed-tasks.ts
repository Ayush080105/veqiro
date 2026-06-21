/**
 * One-time backfill: seed default tasks for all existing organizations that
 * have zero tasks. Safe to re-run — seedDefaultTasks() is idempotent (it
 * checks the count before inserting).
 *
 * Usage:
 *   pnpm --filter server seed:tasks
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { seedDefaultTasks } from "../src/modules/tasks/tasks.service.js";

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`Found ${orgs.length} organization(s). Seeding tasks for those with none…`);

  let seeded = 0;
  let skipped = 0;

  for (const org of orgs) {
    const before = await prisma.task.count({ where: { organizationId: org.id } });
    if (before > 0) {
      console.log(`  [skip] ${org.name} (${org.id}) — already has ${before} task(s)`);
      skipped++;
      continue;
    }
    await seedDefaultTasks(org.id);
    const after = await prisma.task.count({ where: { organizationId: org.id } });
    console.log(`  [done] ${org.name} (${org.id}) — seeded ${after} task(s)`);
    seeded++;
  }

  console.log(`\nDone. Seeded: ${seeded}, Skipped (already had tasks): ${skipped}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
