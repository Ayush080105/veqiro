/**
 * Grants (or extends) agent access for testing, by inserting Entitlement
 * rows directly -- bypassing Dodo checkout entirely. Intended for internal
 * test/admin orgs whose real plans have lapsed and need to be re-armed
 * without going through billing.
 *
 * Does NOT touch existing Entitlement rows. Access is additive: a new
 * `source: "AGENT"`, `priceCents: 0` row is created for any org+agent combo
 * that isn't currently covered by an active row. This mirrors how the schema
 * itself expects repeat grants to work (see the Entitlement model's own
 * comment: "One row per purchase ... overlapping rows are legal"), and keeps
 * every prior row -- including old expired trials -- as an untouched
 * historical record.
 *
 * Also refreshes the two Organization "fast path cache" fields
 * (subscriptionStatus, entitlementExpiresAt) so admin dashboards don't show
 * a stale EXPIRED/TRIALING badge next to freshly-granted access. Neither
 * field gates real API access -- entitlement.middleware.ts reads Entitlement
 * rows directly -- so this step is cosmetic only.
 *
 *   DRY RUN (default, writes nothing):
 *     cd apps/server && npx tsx scripts/grant-test-access.ts
 *
 *   APPLY:
 *     cd apps/server && APPLY=1 npx tsx scripts/grant-test-access.ts
 *
 * Env vars (all optional):
 *   OWNER_EMAIL   Grant access to every org owned by this user. Default:
 *                 admin@veqiro.com
 *   ORG_IDS       Comma-separated organization ids. Overrides OWNER_EMAIL
 *                 when set.
 *   AGENTS        Comma-separated agent codes (MAYA,SAGE,LEX,REX,SCOUT,VEGA).
 *                 Default: all six.
 *   DAYS          Access length in days from now. Default: 30.
 *
 * Idempotent: re-running with the same args only fills in gaps -- an
 * org+agent combo that already has a currently-active covering row
 * (status in TRIALING/ACTIVE/PAST_DUE and currentPeriodEnd in the future)
 * is left alone, never double-granted.
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { ALL_AGENTS } from "../src/modules/billing/billing.catalog.js";
import { ACCESS_STATUSES } from "../src/modules/billing/entitlement.service.js";
import type { Agent } from "../prisma/generated/prisma/client.js";

const APPLY = process.env.APPLY === "1";
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "admin@veqiro.com";
const DAYS = Number(process.env.DAYS ?? 30);

function parseAgents(raw: string | undefined): Agent[] {
  if (!raw) return ALL_AGENTS;
  const codes = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const invalid = codes.filter((c) => !ALL_AGENTS.includes(c as Agent));
  if (invalid.length) throw new Error(`Unknown agent code(s): ${invalid.join(", ")}`);
  return codes as Agent[];
}

async function resolveOrgIds(): Promise<{ id: string; name: string }[]> {
  const explicit = process.env.ORG_IDS;
  if (explicit) {
    const ids = explicit.split(",").map((s) => s.trim()).filter(Boolean);
    const orgs = await prisma.organization.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const missing = ids.filter((id) => !orgs.some((o) => o.id === id));
    if (missing.length) throw new Error(`ORG_IDS not found: ${missing.join(", ")}`);
    return orgs;
  }

  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });
  if (!user) throw new Error(`No user found with email ${OWNER_EMAIL}`);

  const memberships = await prisma.member.findMany({
    where: { userId: user.id },
    select: { organization: { select: { id: true, name: true } } },
  });
  return memberships.map((m) => m.organization);
}

async function main() {
  if (!Number.isFinite(DAYS) || DAYS <= 0) throw new Error(`Invalid DAYS: ${process.env.DAYS}`);

  const agents = parseAgents(process.env.AGENTS);
  const orgs = await resolveOrgIds();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);

  console.log(`\n=== GRANT TEST ACCESS ${APPLY ? "APPLY" : "DRY RUN"} ===`);
  console.log(`orgs      : ${orgs.length} (${orgs.map((o) => o.name).join(", ")})`);
  console.log(`agents    : ${agents.join(", ")}`);
  console.log(`period end: ${periodEnd.toISOString()} (+${DAYS}d)\n`);

  type PlannedGrant = { orgId: string; orgName: string; agent: Agent };
  const toGrant: PlannedGrant[] = [];
  const alreadyCovered: PlannedGrant[] = [];

  for (const org of orgs) {
    const covering = await prisma.entitlement.findMany({
      where: {
        organizationId: org.id,
        agent: { in: agents },
        status: { in: ACCESS_STATUSES },
        currentPeriodEnd: { gt: now },
      },
      select: { agent: true },
    });
    const coveredAgents = new Set(covering.map((e) => e.agent));

    for (const agent of agents) {
      const row = { orgId: org.id, orgName: org.name, agent };
      if (coveredAgents.has(agent)) alreadyCovered.push(row);
      else toGrant.push(row);
    }
  }

  console.log(`already covered : ${alreadyCovered.length}`);
  console.log(`to grant        : ${toGrant.length}`);
  for (const g of toGrant) console.log(`  + ${g.orgName} / ${g.agent}`);

  if (!APPLY) {
    console.log("\nDRY RUN -- nothing written. Re-run with APPLY=1 to apply.\n");
    await prisma.$disconnect();
    return;
  }

  if (toGrant.length > 0) {
    await prisma.entitlement.createMany({
      data: toGrant.map((g) => ({
        organizationId: g.orgId,
        agent: g.agent,
        source: "AGENT" as const,
        status: "ACTIVE" as const,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        priceCents: 0,
      })),
    });
  }

  // Cosmetic cache refresh only -- see file header. Real access already
  // works from the Entitlement rows written above regardless of this step.
  await prisma.organization.updateMany({
    where: { id: { in: orgs.map((o) => o.id) } },
    data: { subscriptionStatus: "ACTIVE", entitlementExpiresAt: periodEnd },
  });

  console.log(`\nAPPLIED. entitlement rows created: ${toGrant.length}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("GRANT FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
