import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function main() {
  const countBefore = await prisma.waitlistEntry.count();
  console.log(`Current waitlist count: ${countBefore}`);

  const dummyEmails = [
    "ab1@xyz.com",
    "ab2@xyz.com",
    "ab3@xyz.com",
    "ab4@xyz.com",
    "ab5@xyz.com",
    "ab6@xyz.com",
    "ab7@xyz.com",
  ];

  console.log("Seeding 7 dummy emails...");
  for (const email of dummyEmails) {
    // Using upsert to avoid duplicate errors if run multiple times
    await prisma.waitlistEntry.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }

  const countAfter = await prisma.waitlistEntry.count();
  console.log(`Waitlist count after seeding: ${countAfter}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
