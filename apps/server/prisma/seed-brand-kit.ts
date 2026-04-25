import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ── Edit this block to seed a brand kit ──────────────────────────────────────
const ORGANIZATION_ID = "user_123";

const BRAND_KIT = {
  company_name: "Veqiro AI",
  company_description: "AI-powered workspace for founders and small teams",
  industry: "SaaS / AI Productivity",
  target_audience: "Founders, solopreneurs, and early-stage startup teams",
  brand_voice: "Smart, confident, and founder-friendly",
  logo_url: "https://blob.veqiro.com/pitchdesk_logo.jpg.jpeg",
  mascot_url: "https://blob.veqiro.com/mascot.jpeg",
  brand_colors: {
    primary: "#6C3CE1",
    secondary: "#FF6B35",
    accent: "#10B981",
  },
  platform_tones: {
    twitter: "casual, punchy, uses emojis sparingly",
    linkedin: "professional, insight-driven, thought leadership",
    instagram: "visual-first, inspiring, short captions",
  },
  competitors: ["Notion AI", "Monday.com AI", "Marblism"],
  key_differentiators: "Purpose-built AI agents for founders – not generic chatbots",
  website_url: "https://veqiro.com",
};
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding brand kit for organizationId: ${ORGANIZATION_ID}`);

  const result = await prisma.brandKit.upsert({
    where: { organizationId: ORGANIZATION_ID },
    update: BRAND_KIT,
    create: { organizationId: ORGANIZATION_ID, ...BRAND_KIT },
  });

  console.log("Done:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
