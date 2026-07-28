/**
 * Create the 7 Dodo products the billing system needs (6 agents + the Maya
 * credit top-up unit), then print the .env block
 * mapping each to its product-id env var.
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
} from "../src/modules/billing/billing.catalog.js";
import { TOPUP_DOLLAR_UNIT, TOPUP_CREDITS_PER_UNIT } from "../src/modules/agents/maya/maya.quotas.js";
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

type Sku =
  | {
      kind: "recurring";
      /** Stable key written to product metadata; the idempotency anchor. */
      sku: string;
      envKey: string;
      name: string;
      description: string;
      priceCents: number;
      interval: Interval;
    }
  | {
      kind: "one_time";
      sku: string;
      envKey: string;
      name: string;
      description: string;
      priceCents: number;
    };

function buildSkus(): Sku[] {
  const agents: Sku[] = ALL_AGENTS.map((agent) => {
    const meta = AGENT_META[agent];
    return {
      kind: "recurring",
      sku: `agent_${agent.toLowerCase()}`,
      envKey: AGENT_PRODUCT_ENV_KEYS[agent],
      name: `${meta.name} — ${meta.role}`,
      description: `${meta.name}, your AI ${meta.role}. Billed monthly for this agent only; cancel any time.`,
      priceCents: getAgentMonthlyPriceCents(agent),
      interval: "Month",
    };
  });

  return [
    ...agents,
    {
      // One-time purchase, not a subscription — a top-up buys a fixed
      // credit block once. quantity in the checkout cart multiplies this
      // base unit (see billing.topup.ts's createMayaTopupCheckout).
      kind: "one_time",
      sku: "maya_topup_unit",
      envKey: "DODO_PRODUCT_MAYA_TOPUP_UNIT",
      name: `Maya Credit Top-Up (${TOPUP_CREDITS_PER_UNIT} credits per unit)`,
      // Quantity-aware: the checkout page shows this description alongside a
      // fixed "Qty: N" line, but doesn't recompute the total credits for you —
      // a static "50 credits" description was misleading once quantity > 1.
      description: `Each unit adds ${TOPUP_CREDITS_PER_UNIT} Maya generation credits (one-time purchase, not a subscription). Increase quantity at checkout for a bigger top-up — e.g. quantity 3 = ${TOPUP_CREDITS_PER_UNIT * 3} credits.`,
      priceCents: TOPUP_DOLLAR_UNIT * 100,
    },
  ];
}

type Existing = { productId: string; name?: string | null; priceCents?: number | null; description?: string | null };

/** Index every product (recurring and one-time) by its veqiro_sku tag and by exact name. */
async function loadExisting() {
  const bySku = new Map<string, Existing>();
  const byName = new Map<string, Existing>();

  // No `recurring` filter: this must find the one-time top-up product too,
  // not just the 8 subscription products.
  for await (const product of dodoClient.products.list({})) {
    const entry: Existing = {
      productId: product.product_id,
      name: product.name,
      priceCents: product.price,
      description: product.description,
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
    const cadence = sku.kind === "one_time" ? "one-time" : sku.interval === "Year" ? "yr" : "mo";

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
      // Copy-only sync: name/description aren't attached to running
      // subscriptions the way price is, so it's safe to keep them in sync
      // automatically (unlike price, which only ever warns — see above).
      // Matched by the veqiro_sku tag (not by name), so a name change here
      // doesn't create a duplicate — it just needs the existing product's
      // copy pushed to match.
      const copyDrifted = existing.name !== sku.name || existing.description !== sku.description;
      if (copyDrifted) {
        if (APPLY) {
          await dodoClient.products.update(existing.productId, { name: sku.name, description: sku.description });
          console.log(`  exists   ${sku.name}  ($${dollars}/${cadence})  ->  ${existing.productId}  (name/description updated)`);
        } else {
          console.log(`  exists   ${sku.name}  ($${dollars}/${cadence})  ->  ${existing.productId}  (name/description OUT OF DATE — re-run with APPLY=1 to sync)`);
        }
      } else {
        console.log(`  exists   ${sku.name}  ($${dollars}/${cadence})  ->  ${existing.productId}`);
      }
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
      price: sku.kind === "one_time"
        ? {
            type: "one_time_price",
            currency: "USD",
            price: sku.priceCents,
            discount: 0,
            purchasing_power_parity: false,
            tax_inclusive: false,
          }
        : {
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
            // Trials are granted in-app as TRIAL entitlements (one 7-day window
            // per org, all agents at once). A Dodo-side trial would double-grant
            // and hand out a second trial per product purchased.
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
