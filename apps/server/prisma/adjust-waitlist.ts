import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function main() {
  const currentCount = await prisma.waitlistEntry.count();
  console.log(`Current count: ${currentCount}`);

  if (currentCount > 107) {
    const toDelete = currentCount - 107;
    console.log(`Need to delete ${toDelete} test entries to make total count exactly 107...`);

    // Let's find some obvious test emails like a@x.com, a@y.com, a@z.com, abc@abc.com, dcdc@dd.com
    const testEmails = [
      "dcdc@dd.com",
      "abc@abc.com",
      "a@z.com",
      "a@y.com",
      "a@x.com"
    ];

    let deleted = 0;
    for (const email of testEmails) {
      if (deleted >= toDelete) break;
      const entry = await prisma.waitlistEntry.findUnique({ where: { email } });
      if (entry) {
        await prisma.waitlistEntry.delete({ where: { email } });
        console.log(`Deleted test email: ${email}`);
        deleted++;
      }
    }

    // If we still need to delete more, delete by id from the oldest entries (excluding our seeded abX@xyz.com)
    if (deleted < toDelete) {
      const remainingToDelete = toDelete - deleted;
      const entries = await prisma.waitlistEntry.findMany({
        where: {
          NOT: {
            email: {
              startsWith: "ab",
            }
          }
        },
        orderBy: { createdAt: "asc" },
        take: remainingToDelete
      });

      for (const entry of entries) {
        await prisma.waitlistEntry.delete({ where: { id: entry.id } });
        console.log(`Deleted oldest entry: ${entry.email}`);
      }
    }
  }

  const finalCount = await prisma.waitlistEntry.count();
  console.log(`Final waitlist count: ${finalCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
