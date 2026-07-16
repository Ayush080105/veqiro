/**
 * Create the 8 Dodo products the billing system needs, then print the .env
 * block mapping each to its product-id env var.
 *
 *   DRY RUN (default, creates nothing):
 *     cd apps/server && npx tsx scripts/create-dodo-products.ts
 *
 *   APPLY (test mode):
 *     cd apps/server && APPLY=1 npx tsx scripts/create-dodo-products.ts
 *
 *   APPLY (live mode — requires DODO_ENV=live in .env AND the extra flag):
 *     cd apps/server && APPLY=1 ALLOW_LIVE=1 npx tsx scripts/create-dodo-products.ts
 *
 * Targets whatever mode DODO_ENV selects (see src/lib/dodo.ts): anything other
 * than "live" is test mode. ALLOW_LIVE exists so a careless run cannot create
 * products against real billing.
 *
 * Idempotent: every product it creates is tagged `metadata.veqiro_sku`, and a
 * re-run reuses any product already carrying that tag instead of creating a
 * duplicate. Dodo has no product upsert, and duplicates are worse than they
 * look — two products named "Maya" with different ids means the id in .env and
 * the id a webhook reports can disagree, and `resolveAgentFromProductId` would
 * return null for the stray one, silently failing to provision a paid purchase.
 *
 * Prices come from billing.catalog.ts, NOT from constants here, so the product
 * a customer is charged for always matches what the app quotes. If you override
 * a price via env (e.g. AGENT_PRICE_MAYA_MONTHLY_CENTS), set it BEFORE running
 * this, or the created product will charge the default while the UI quotes the
 * override.
 */
import "dotenv/config";
import { dodoClient } from "../src/lib/dodo.js";
import {
  ALL_AGENTS,
  AGENT_PRODUCT_ENV_KEYS,
  getAgentMonthlyPriceCents,
  getCrewPriceCents,
} from "../src/modules/billing/billing.catalog.js";
import type { Agent } from "../prisma/generated/prisma/client.js";

const APPLY = process.env.APPLY === "1";
const ALLOW_LIVE = process.env.ALLOW_LIVE === "1";
const IS_LIVE = process.env.DODO_ENV === "live";

/** Customer-facing names, mirroring apps/main/src/lib/config/agents.ts so the
 *  Dodo checkout page names the same thing the pricing card does. */
const AGENT_META: Record<Agent, { name: string; role: string }> = {
  MAYA: { name: "Maya", role: "Content & Marketing" },
  SAGE: { name: "Sage", role: "SEO Specialist" },
  LEX: { name: "Lex", role: "Legal Assistant" },
  REX: { name: "Rex", role: "Data Analyst & Finance" },
  SCOUT: { name: "Scout", role: "Research & Strategist" },
  VEGA: { name: "Vega", role: "Executive Assistant" },
};

type Interval = "Month" | "Year";

type Sku = {
  /** Stable key written to product metadata; the idempotency anchor. */
  sku: string;
  envKey: string;
  name: string;
  description: string;
  priceCents: number;
  interval: Interval;
};

function buildSkus(): Sku[] {
  const agents: Sku[] = ALL_AGENTS.map((agent) => {
    const meta = AGENT_META[agent];
    return {
      sku: `agent_${agent.toLowerCase()}`,
      envKey: AGENT_PRODUCT_ENV_KEYS[agent],
      name: `${meta.name} — ${meta.role}`,
      description: `${meta.name}, your AI ${meta.role}. Billed monthly for this agent only; cancel any time.`,
      priceCents: getAgentMonthlyPriceCents(agent),
      interval: "Month",
    };
  });

  // Individual agents are monthly-only by design; annual exists for Crew alone.
  return [
    ...agents,
    {
      sku: "crew_monthly",
      envKey: "DODO_PRODUCT_CREW_MONTHLY",
      name: "Veqiro Crew — All 6 AI Employees (Monthly)",
      description: "Maya, Sage, Lex, Rex, Scout and Vega. Billed monthly.",
      priceCents: getCrewPriceCents("MONTHLY"),
      interval: "Month",
    },
    {
      sku: "crew_annual",
      envKey: "DODO_PRODUCT_CREW_ANNUAL",
      name: "Veqiro Crew — All 6 AI Employees (Annual)",
      description: "Maya, Sage, Lex, Rex, Scout and Vega. Billed once yearly.",
      priceCents: getCrewPriceCents("ANNUAL"),
      interval: "Year",
    },
  ];
}

type Existing = { productId: string; name?: string | null; priceCents?: number | null };

/** Index every recurring product by its veqiro_sku tag and by exact name. */
async function loadExisting() {
  const bySku = new Map<string, Existing>();
  const byName = new Map<string, Existing>();

  for await (const product of dodoClient.products.list({ recurring: true })) {
    const entry: Existing = {
      productId: product.product_id,
      name: product.name,
      priceCents: product.price,
    };
    const sku = product.metadata?.veqiro_sku;
    if (sku) bySku.set(sku, entry);
    if (product.name) byName.set(product.name, entry);
  }

  return { bySku, byName };
}

async function main() {
  if (IS_LIVE && !ALLOW_LIVE) {
    console.error(
      "REFUSING: DODO_ENV=live. This would create products against real billing.\n" +
        "Re-run with ALLOW_LIVE=1 if that is genuinely what you want.",
    );
    process.exit(1);
  }

  const mode = IS_LIVE ? "LIVE" : "test";
  console.log(`Dodo mode: ${mode}${APPLY ? "" : "   (DRY RUN — nothing will be created)"}\n`);

  const skus = buildSkus();
  const { bySku, byName } = await loadExisting();

  const resolved: Array<{ envKey: string; productId: string | null; note: string }> = [];
  const warnings: string[] = [];

  for (const sku of skus) {
    const dollars = (sku.priceCents / 100).toFixed(2);
    const cadence = sku.interval === "Year" ? "yr" : "mo";

    const tagged = bySku.get(sku.sku);
    const named = byName.get(sku.name);
    const existing = tagged ?? named;

    if (existing) {
      // Reuse. Never silently re-price an existing product: a live product's
      // price is attached to running subscriptions, so a mismatch is a decision
      // for a human, not a script.
      if (existing.priceCents != null && existing.priceCents !== sku.priceCents) {
        warnings.push(
          `${sku.sku}: existing product ${existing.productId} costs $${(existing.priceCents / 100).toFixed(2)} ` +
            `but the catalog quotes $${dollars}. The app will quote one price and Dodo will charge the other. ` +
            `Fix in the Dodo dashboard, or align the price env var.`,
        );
      }
      if (!tagged && named) {
        warnings.push(
          `${sku.sku}: matched product ${existing.productId} by NAME, not by the veqiro_sku tag ` +
            `(hand-created?). It works, but a rename would make the next run create a duplicate. ` +
            `Consider adding metadata veqiro_sku=${sku.sku} to it in the dashboard.`,
        );
      }
      console.log(`  exists   ${sku.name}  ($${dollars}/${cadence})  ->  ${existing.productId}`);
      resolved.push({ envKey: sku.envKey, productId: existing.productId, note: "existing" });
      continue;
    }

    if (!APPLY) {
      console.log(`  CREATE   ${sku.name}  ($${dollars}/${cadence})`);
      resolved.push({ envKey: sku.envKey, productId: null, note: "would-create" });
      continue;
    }

    const created = await dodoClient.products.create({
      name: sku.name,
      description: sku.description,
      tax_category: "saas",
      metadata: { veqiro_sku: sku.sku },
      price: {
        type: "recurring_price",
        currency: "USD",
        price: sku.priceCents,
        discount: 0,
        purchasing_power_parity: false,
        payment_frequency_count: 1,
        payment_frequency_interval: sku.interval,
        subscription_period_count: 1,
        subscription_period_interval: sku.interval,
        tax_inclusive: false,
        // Trials are granted in-app as TRIAL entitlements (one 7-day window per
        // org, all agents at once). A Dodo-side trial would double-grant and
        // hand out a second trial per product purchased.
        trial_period_days: 0,
      },
    });

    console.log(`  created  ${sku.name}  ($${dollars}/${cadence})  ->  ${created.product_id}`);
    resolved.push({ envKey: sku.envKey, productId: created.product_id, note: "created" });
  }

  if (warnings.length > 0) {
    console.log(`\nWARNINGS (${warnings.length}):`);
    for (const warning of warnings) console.log(`  ! ${warning}`);
  }

  console.log(`\n${"─".repeat(60)}\nPaste into apps/server/.env (${mode} mode):\n`);
  for (const row of resolved) {
    console.log(`${row.envKey}=${row.productId ?? "<would create — re-run with APPLY=1>"}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing was created. Re-run with APPLY=1 to create.`);
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err);
    process.exit(1);
  })
  .finally(() => void dodoClient);
