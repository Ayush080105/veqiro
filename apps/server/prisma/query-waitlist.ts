import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function main() {
  const entries = await prisma.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total waitlist entries: ${entries.length}`);
  console.log("Recent entries:");
  console.log(JSON.stringify(entries.slice(0, 15), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
