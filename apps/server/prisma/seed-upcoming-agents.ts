import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const upcomingAgents = [
  {
    name: "Orbit",
    tagline: "Join any meeting, capture every insight",
    description:
      "Orbit joins your Google Meet, Zoom, or Teams calls, takes timestamped notes, extracts action items, and sends a clean summary to your inbox — no manual notes needed.",
    emoji: "🛰️",
    color: "#4ECDC4",
    order: 1,
    isVisible: true,
  },
  {
    name: "Pulse",
    tagline: "Design, send & optimize email campaigns that convert",
    description:
      "Pulse lets you build drip sequences, broadcast campaigns, and A/B test subject lines — all from a simple drag-and-drop editor powered by your CRM data.",
    emoji: "📡",
    color: "#FF6B35",
    order: 2,
    isVisible: true,
  },
  {
    name: "Forge",
    tagline: "Find, enrich & qualify leads from any source",
    description:
      "Forge scours the web, LinkedIn, and industry databases to surface qualified leads, auto-enrich their profiles, and push them straight into Scout's pipeline.",
    emoji: "⚗️",
    color: "#9B59B6",
    order: 3,
    isVisible: true,
  },
];

async function main() {
  console.log("Seeding upcoming agents...");

  for (const agent of upcomingAgents) {
    const existing = await prisma.upcomingAgent.findFirst({ where: { name: agent.name } });
    if (existing) {
      await prisma.upcomingAgent.update({
        where: { id: existing.id },
        data: {
          tagline: agent.tagline,
          description: agent.description,
          emoji: agent.emoji,
          color: agent.color,
          order: agent.order,
          isVisible: agent.isVisible,
        },
      });
      console.log(`  ~ Updated ${agent.name}`);
    } else {
      await prisma.upcomingAgent.create({ data: agent });
      console.log(`  + Created ${agent.name}`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
