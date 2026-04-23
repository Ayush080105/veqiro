import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Agent,
  SocialPlatform,
} from "./generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY_MS = 24 * 60 * 60 * 1000;
const AGENTS: Agent[] = ["MAYA", "REX", "SCOUT", "SAGE", "LEX", "VEGA"];

const PROMPTS: Record<Agent, string[]> = {
  MAYA: [
    "Draft a launch tweet for our new product",
    "Write a LinkedIn post about our last release",
    "Rewrite this caption to be more punchy",
    "Generate 3 Instagram captions for the new campaign",
    "Brainstorm 5 blog post ideas for next month",
  ],
  REX: [
    "What was last month's MRR?",
    "Pull our churn for Q1",
    "Build a CAC dashboard for me",
    "Spot any anomalies in this week's revenue",
    "Forecast revenue for the next 6 months",
  ],
  SCOUT: [
    "Run a competitor teardown for Notion",
    "What's trending in AI tools this week?",
    "Find me 5 companies in the sales-tech space",
    "Summarize last week's industry news",
    "Pull market data on indie SaaS pricing",
  ],
  SAGE: [
    "Audit my top 10 pages for SEO",
    "Find long-tail keywords for 'AI assistant'",
    "Review meta tags on the home page",
    "Generate a content brief for 'best CRM'",
    "Check our backlink profile",
  ],
  LEX: [
    "Review this NDA for issues",
    "Draft a mutual NDA template",
    "Flag risks in this vendor contract",
    "Explain what this clause means in plain English",
    "Audit our terms of service for compliance",
  ],
  VEGA: [
    "Block 2 hours tomorrow for deep work",
    "Summarize my inbox from this morning",
    "Schedule a team sync for Friday",
    "Draft a reply to the latest investor email",
    "What's on my calendar next week?",
  ],
};

const REPLIES: Record<Agent, string[]> = {
  MAYA: [
    "Drafted 3 versions — one safe, one spicy, one cursed. Linked them in the doc.",
    "Posted a draft. Want me to A/B test against the previous one?",
    "Made it 40% punchier. Cut the adverbs and added a hook.",
  ],
  REX: [
    "MRR is at $12.4K, up 8% MoM. CAC ticked up 12% — flagging for review.",
    "Pulled the numbers. Two anomalies: a refund spike on the 14th, and a 2x conversion bump from the LinkedIn campaign.",
    "Built the dashboard. Linked it in your Notion under /finance.",
  ],
  SCOUT: [
    "Pulled 23 comps, killed 18 that were noise. Here's the 5 worth your time.",
    "Top trend this week: 'AI employees' — 4 funding rounds, 2 acquisitions.",
    "Found 12 fits, ranked them by ICP score. Top 3 already enriched.",
  ],
  SAGE: [
    "Audited 10 pages. 4 are missing meta descriptions, 2 have h1 issues, 1 has duplicate content. Fix order in the doc.",
    "23 long-tails worth pursuing. 5 have low competition + high intent.",
    "Brief drafted. ~2200 words target, 8 sections. Ready for Maya to write.",
  ],
  LEX: [
    "Clause 7.3 is a trap. Redlined it. Clause 4 is fine but written by a poet — cleaned up.",
    "Drafted. Standard mutual NDA, 2-year term, mutual carve-outs.",
    "Three risks flagged. None blocking, but 2 should be negotiated before signing.",
  ],
  VEGA: [
    "Blocked 9-11am tomorrow. Moved the design review to 3pm.",
    "Inbox: 27 new, 4 need your reply, 1 from the board flagged urgent. Drafted replies for the 4.",
    "Friday 2pm sync booked. 5 attendees confirmed, 1 tentative.",
  ],
};

const POST_CAPTIONS = [
  "Shipped a thing today 🚢 — link in bio",
  "We rebuilt our onboarding from scratch. Here's what we learned.",
  "5 lessons from a year of building solo",
  "Why we stopped using Notion for product specs",
  "The real reason most SaaS dashboards suck",
  "Behind the scenes of our latest launch",
  "Our team grew 3x this quarter — here's how we hired",
  "What I'd tell a founder starting today",
  "Three product bets we're making this year",
  "Quiet launch, loud impact",
  "We migrated 8M rows in 4 hours. AMA.",
  "Stop building features nobody asked for",
  "Tiny team, big wins this week",
  "Replaced a meeting with a doc. Productivity went up.",
  "Sneak peek at what we're shipping next month",
];

const PLATFORMS: SocialPlatform[] = ["TWITTER", "LINKEDIN", "INSTAGRAM"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let orgId: string | undefined;
  let reset = false;
  let createSocialAccount = true;
  for (const a of args) {
    if (a === "--reset") reset = true;
    else if (a === "--no-social") createSocialAccount = false;
    else if (a.startsWith("--org=")) orgId = a.slice("--org=".length);
    else if (!a.startsWith("--")) orgId = a;
  }
  return { orgId, reset, createSocialAccount };
}

async function main() {
  const { orgId: argOrgId, reset, createSocialAccount } = parseArgs(process.argv);

  let orgId = argOrgId;
  if (!orgId) {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    });
    if (orgs.length === 0) {
      console.error("No organizations found. Sign up + complete onboarding first.");
      process.exit(1);
    }
    if (orgs.length === 1) {
      orgId = orgs[0].id;
      console.log(`Auto-selected only org: ${orgs[0].name} (${orgs[0].slug})`);
    } else {
      console.error("Multiple organizations exist. Re-run with --org=<id>:");
      for (const o of orgs) console.error(`  ${o.id}  ${o.name}  (/${o.slug})`);
      process.exit(1);
    }
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    console.error(`Organization ${orgId} not found.`);
    process.exit(1);
  }

  const member = await prisma.member.findFirst({ where: { organizationId: orgId } });
  if (!member) {
    console.error(`No members in organization ${orgId}.`);
    process.exit(1);
  }
  const userId = member.userId;

  if (reset) {
    const m = await prisma.message.deleteMany({ where: { organizationId: orgId } });
    const p = await prisma.publishedPost.deleteMany({ where: { organizationId: orgId } });
    console.log(`Reset: removed ${m.count} messages, ${p.count} posts.`);
  }

  console.log(`Seeding dashboard data for "${org.name}" (${orgId})...`);

  const now = Date.now();
  const messageRows: Array<Parameters<typeof prisma.message.create>[0]["data"]> = [];

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const dayStart = now - dayOffset * DAY_MS;
    for (const agent of AGENTS) {
      const exchanges = randInt(0, 3);
      for (let i = 0; i < exchanges; i++) {
        const tsBase = new Date(dayStart + Math.floor(Math.random() * DAY_MS));
        messageRows.push({
          organizationId: orgId,
          userId,
          agent,
          role: "user",
          content: pick(PROMPTS[agent]),
          createdAt: tsBase,
          tokensUsed: 0,
        });
        messageRows.push({
          organizationId: orgId,
          userId,
          agent,
          role: "assistant",
          content: pick(REPLIES[agent]),
          createdAt: new Date(tsBase.getTime() + randInt(15, 90) * 1000),
          tokensUsed: randInt(120, 850),
          model: "gpt-4o-mini",
        });
      }
    }
  }

  for (const data of messageRows) {
    await prisma.message.create({ data });
  }
  console.log(`  + ${messageRows.length} messages across 14 days`);

  let socialAccount = await prisma.socialAccount.findFirst({
    where: { organizationId: orgId },
  });

  if (!socialAccount && createSocialAccount) {
    socialAccount = await prisma.socialAccount.create({
      data: {
        organizationId: orgId,
        userId,
        platform: SocialPlatform.TWITTER,
        providerAccountId: `seed-${Date.now()}`,
        accountName: "@seed_account",
        accessToken: "SEED_PLACEHOLDER",
      },
    });
    console.log(`  + 1 placeholder Twitter SocialAccount (so posts have a parent)`);
    console.log(`    ⚠  This will show as "connected" in Integration Health. Disconnect via /settings/integrations or pass --no-social to skip.`);
  }

  if (socialAccount) {
    let postCount = 0;
    for (let i = 0; i < 18; i++) {
      const dayOffset = randInt(0, 13);
      const ts = new Date(now - dayOffset * DAY_MS - Math.floor(Math.random() * DAY_MS));
      const platform = pick(PLATFORMS);
      const status =
        i % 9 === 0 ? "failed" : i % 6 === 0 ? "scheduled" : i % 7 === 0 ? "draft" : "success";
      await prisma.publishedPost.create({
        data: {
          organizationId: orgId,
          userId,
          socialAccountId: socialAccount.id,
          platform,
          platformPostId: status === "success" ? `seed-post-${i}` : null,
          caption: pick(POST_CAPTIONS),
          hashtags: ["#ai", "#productivity", "#building"],
          status,
          publishedAt: status === "success" ? ts : null,
          createdAt: ts,
        },
      });
      postCount++;
    }
    console.log(`  + ${postCount} published posts across 14 days (mix of success/scheduled/draft/failed)`);
  } else {
    console.log("  - skipped published posts (no social account, --no-social passed)");
  }

  console.log("Done. Reload /dashboard to see it.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
