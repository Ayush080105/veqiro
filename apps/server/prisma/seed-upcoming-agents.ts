import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const upcomingAgents = [
  {
    name: "Cade",
    tagline: "Find leads, map connections & run outreach on autopilot",
    description:
      "Cade digs through the web to surface qualified leads, maps decision-maker connections, and fires off personalised outreach sequences — so your pipeline fills itself.",
    emoji: "🎯",
    color: "#FF6B35",
    order: 1,
    isVisible: true,
  },
  {
    name: "Echo",
    tagline: "Joins your calls, takes notes & turns talk into tasks",
    description:
      "Echo sits in on any video call, transcribes every word, pulls out action items, and drops them straight into your task list. Nothing decided in a meeting gets lost again.",
    emoji: "🎙️",
    color: "#4ECDC4",
    order: 2,
    isVisible: true,
  },
  {
    name: "Vera",
    tagline: "Screen candidates & run AI interviews at scale",
    description:
      "Vera takes over your hiring pipeline — parsing CVs, running structured AI video interviews, scoring soft skills, and handing you a ranked shortlist of your best fits.",
    emoji: "🤝",
    color: "#9B59B6",
    order: 3,
    isVisible: true,
  },
  {
    name: "Aria",
    tagline: "Handles your support queue 24/7 with human warmth",
    description:
      "Aria answers questions, resolves tickets, and only loops in your team when it really needs to — so customers get instant replies and your team stays focused.",
    emoji: "🎧",
    color: "#3498DB",
    order: 4,
    isVisible: true,
  },
];

async function main() {
  console.log("Clearing existing upcoming agents and votes...");
  await prisma.upcomingAgentVote.deleteMany();
  await prisma.upcomingAgent.deleteMany();

  console.log("Seeding upcoming agents...");
  for (const agent of upcomingAgents) {
    await prisma.upcomingAgent.create({ data: agent });
    console.log(`  + Created ${agent.name}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
