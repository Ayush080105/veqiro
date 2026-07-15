# Per-Agent Entitlements, Subscriptions & Credits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every agent an independently-billed entitlement with its own period anchored to its own purchase date, its own renewal, and its own auto-pay toggle — while Crew stays a single bundled subscription reachable via a credited upgrade.

**Architecture:** Invert the source of truth. Entitlement stops being derived from one `Subscription` row and becomes per-agent `Entitlement` rows; Dodo subscriptions become a billing detail (`BillingSubscription`) pointing at them. Access becomes a live indexed query instead of a denormalized cache. Rollout is strictly additive: new tables and logic land alongside the old, the read path swaps over, and legacy columns drop only in the final phase after backfill is verified.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Express, Prisma (`prisma/generated/prisma/client.js`), PostgreSQL (Supabase), Dodo Payments SDK v2.28.2, `@dodopayments/better-auth` v1.6.2, Vitest 4, Next.js (apps/main), TanStack Query.

**Spec:** `docs/superpowers/specs/2026-07-15-per-agent-entitlements-billing-design.md`

## Global Constraints

- **No git operations.** Never run `git add`/`git commit`/`git push`. The user handles all git themselves. (This overrides the writing-plans skill default of a commit step per task.)
- **Prisma migrations must use `DIRECT_URL` (port 5432), never the 6543 pooler.** The live DB has drift — `prisma migrate dev` is **unsafe**. Use `prisma migrate diff` + curated `prisma migrate deploy`.
- **ESM imports:** all relative imports end in `.js`, even from `.ts` sources. Prisma client imports come from `../../../prisma/generated/prisma/client.js`.
- **Tests:** Vitest. Unit tests mock Prisma via `vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }))` with in-memory rows — follow `src/tests/unit/maya-usage.test.ts`. Run with `npm test` from `apps/server`. The `test` script globs `src/tests/unit/*.test.ts`, so new files there are picked up automatically.
- **Agent prices (cents), single-sourced in `billing.catalog.ts`:** MAYA 1900, SAGE 900, LEX 900, REX 900, SCOUT 900, VEGA 900. Crew monthly 3900, Crew annual 34800.
- **Annual is Crew-only.** Individual agents are MONTHLY-only, enforced in exactly one place.
- **One agent = one checkout = one Dodo subscription.** Dodo rejects multi-subscription carts (`422`, verified Phase 0). There is no cart anywhere in the product.
- **Lockout scope unchanged:** only `/agents/*` routes gate on entitlement. Brand kit, integrations, dashboard, settings stay accessible.
- **Never break existing features.** `GET /billing/status` keeps its current response shape until Phase 10 swaps the frontend.

## Phase Map

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Dodo capability spike | ✅ **DONE 2026-07-15** — see below |
| 1 | Pure catalog + pricing logic | — |
| 2 | Webhook idempotency hardening | **Must precede 3** |
| 3 | Schema + backfill (additive only) | — |
| 4 | Entitlement read path, middleware + trial | — |
| 5 | Per-agent checkout flows | — |
| 6 | Webhook write path | — |
| 7 | Per-agent cancel/resume | — |
| 8 | Credits rework | — |
| 9 | Expiry sweeper | — |
| 10 | Billing + pricing pages | — |
| 11 | Usage / dashboard / admin | — |
| 12 | Drop legacy columns | Last |

**Two ordering constraints are non-negotiable:**
1. **Phase 2 before Phase 3.** Real `webhook-id` idempotency must land before backfill, or a webhook replay mid-migration corrupts half-migrated state.
2. **Phase 12 last.** Legacy columns drop only after backfill is verified in production.

---

## Phase 0: Dodo Capability Spike — ✅ RESOLVED 2026-07-15

**Outcome: one subscription per checkout. Confirmed against Dodo test mode.**

```
POST /checkouts  product_cart: [maya_monthly, rex_monthly]
→ 422 Only one subscription product allowed per checkout
```

Combined with the absent payment-method listing API (no off-session
`subscriptions.create` fallback), multi-agent checkout is impossible on this
platform.

**Decision taken (user, 2026-07-15): drop the cart entirely.**

Composite products (one Dodo product per agent *combination*, cancel via
`changePlan` to the remaining-subset product) were considered and rejected on
scaling: the product space is 2^N − 1 — 63 products at 6 agents, **1,023** at a
planned 10+. Each new agent would double the surface, and every cancel would
become a subset lookup against a combinatorial catalog.

**The model is now: one agent = one checkout = one Dodo subscription = one
entitlement.** Products grow N+2, not 2^N. Per-agent cancel needs no
`changePlan` and cannot collaterally cancel a neighbour. Crew remains a single
subscription (monthly or annual) covering all six.

No spike tasks remain. Spike products `pdt_0NjFTqMmqcYtfOC4pFWcO` /
`pdt_0NjFTqSu5FHdWgtVzTqlw` archived; scripts deleted.

---

## Phase 1: Pure Catalog & Pricing Logic

Pure functions only — no DB, no network. Fully TDD-able and zero risk to running code. Nothing here is wired up yet.

### Task 1.1: Rewrite the catalog around 8 real products

**Files:**
- Modify: `apps/server/src/modules/billing/billing.catalog.ts`
- Test: `apps/server/src/tests/unit/billing-catalog.test.ts` (create)

**Interfaces:**
- Consumes: `Agent`, `SubscriptionPlan` from `../../../prisma/generated/prisma/client.js`
- Produces:
  - `ALL_AGENTS: Agent[]`
  - `normalizeAgents(input: unknown): Agent[]`
  - `isCrewSelection(agents: Agent[]): boolean`
  - `getAgentMonthlyPriceCents(agent: Agent): number`
  - `getCrewPriceCents(plan: SubscriptionPlan): number`
  - `agentProductId(agent: Agent): string`
  - `crewProductId(plan: SubscriptionPlan): string`
  - `resolveAgentFromProductId(productId: string): Agent | null`
  - `resolveCrewPlanFromProductId(productId: string): SubscriptionPlan | null`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/tests/unit/billing-catalog.test.ts`:

```ts
import { assert, beforeEach, describe, test } from "vitest";
import {
  agentProductId,
  crewProductId,
  resolveAgentFromProductId,
  resolveCrewPlanFromProductId,
  getAgentMonthlyPriceCents,
  getCrewPriceCents,
} from "../../modules/billing/billing.catalog.js";

beforeEach(() => {
  process.env.DODO_PRODUCT_AGENT_MAYA = "pdt_maya";
  process.env.DODO_PRODUCT_AGENT_REX = "pdt_rex";
  process.env.DODO_PRODUCT_CREW_MONTHLY = "pdt_crew_m";
  process.env.DODO_PRODUCT_CREW_ANNUAL = "pdt_crew_a";
});

describe("product id mapping", () => {
  test("agent → product id", () => {
    assert.equal(agentProductId("MAYA"), "pdt_maya");
  });

  test("crew plan → product id", () => {
    assert.equal(crewProductId("MONTHLY"), "pdt_crew_m");
    assert.equal(crewProductId("ANNUAL"), "pdt_crew_a");
  });

  test("product id → agent (round trip)", () => {
    assert.equal(resolveAgentFromProductId("pdt_maya"), "MAYA");
    assert.equal(resolveAgentFromProductId("pdt_rex"), "REX");
  });

  test("crew product id does not resolve to an agent", () => {
    assert.equal(resolveAgentFromProductId("pdt_crew_m"), null);
  });

  test("product id → crew plan", () => {
    assert.equal(resolveCrewPlanFromProductId("pdt_crew_a"), "ANNUAL");
    assert.equal(resolveCrewPlanFromProductId("pdt_maya"), null);
  });

  test("unknown product id resolves to null, never throws", () => {
    assert.equal(resolveAgentFromProductId("pdt_bogus"), null);
    assert.equal(resolveCrewPlanFromProductId("pdt_bogus"), null);
  });

  // REGRESSION: process.env[k] is undefined when unset, and product_id is
  // `string | undefined` on the webhook payload. Without a falsy guard,
  // `undefined === undefined` matches and the resolver returns MAYA (first in
  // ALL_AGENTS, and the priciest agent) for a malformed webhook.
  test("undefined product id resolves to null even when env vars are unset", () => {
    delete process.env.DODO_PRODUCT_AGENT_MAYA;
    delete process.env.DODO_PRODUCT_CREW_MONTHLY;
    assert.equal(resolveAgentFromProductId(undefined as never), null);
    assert.equal(resolveCrewPlanFromProductId(undefined as never), null);
  });

  test("empty product id resolves to null", () => {
    assert.equal(resolveAgentFromProductId(""), null);
    assert.equal(resolveCrewPlanFromProductId(""), null);
  });

  test("missing env for a required product throws a named error", () => {
    delete process.env.DODO_PRODUCT_AGENT_MAYA;
    assert.throws(() => agentProductId("MAYA"), /missing-product-id:MAYA/);
  });
});

describe("prices", () => {
  test("maya is 1900, others 900", () => {
    assert.equal(getAgentMonthlyPriceCents("MAYA"), 1900);
    assert.equal(getAgentMonthlyPriceCents("SAGE"), 900);
  });

  test("crew monthly 3900, annual 34800", () => {
    assert.equal(getCrewPriceCents("MONTHLY"), 3900);
    assert.equal(getCrewPriceCents("ANNUAL"), 34800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-catalog.test.ts`
Expected: FAIL — `agentProductId is not a function`

- [ ] **Step 3: Implement**

In `billing.catalog.ts`, **keep** `ALL_AGENTS`, `AGENT_SLUG_TO_ENUM`, `normalizeAgents`, `isCrewSelection`, `getAgentMonthlyPriceCents`, `getCrewPriceCents` as-is, and **add**:

```ts
const AGENT_PRODUCT_ENV_KEYS: Record<Agent, string> = {
  MAYA:  "DODO_PRODUCT_AGENT_MAYA",
  SAGE:  "DODO_PRODUCT_AGENT_SAGE",
  LEX:   "DODO_PRODUCT_AGENT_LEX",
  REX:   "DODO_PRODUCT_AGENT_REX",
  SCOUT: "DODO_PRODUCT_AGENT_SCOUT",
  VEGA:  "DODO_PRODUCT_AGENT_VEGA",
};

export function agentProductId(agent: Agent): string {
  const value = process.env[AGENT_PRODUCT_ENV_KEYS[agent]];
  if (!value) throw new BadRequestError(`missing-product-id:${agent}`);
  return value;
}

export function crewProductId(plan: SubscriptionPlan): string {
  const key = plan === "ANNUAL" ? "DODO_PRODUCT_CREW_ANNUAL" : "DODO_PRODUCT_CREW_MONTHLY";
  const value = process.env[key];
  if (!value) throw new BadRequestError(`missing-product-id:CREW_${plan}`);
  return value;
}

export function resolveAgentFromProductId(productId: string): Agent | null {
  if (!productId) return null;
  for (const agent of ALL_AGENTS) {
    if (process.env[AGENT_PRODUCT_ENV_KEYS[agent]] === productId) return agent;
  }
  return null;
}

export function resolveCrewPlanFromProductId(productId: string): SubscriptionPlan | null {
  if (!productId) return null;
  if (productId === process.env.DODO_PRODUCT_CREW_MONTHLY) return "MONTHLY";
  if (productId === process.env.DODO_PRODUCT_CREW_ANNUAL)  return "ANNUAL";
  return null;
}
```

> **The falsy guard is load-bearing in BOTH resolvers — this is a real bug, not
> style.** `process.env[k]` is `undefined` when a var is unset, and
> `payload.data.product_id` is typed `string | undefined`. Without the guard,
> `undefined === undefined` matches and `resolveAgentFromProductId(undefined)`
> returns **`"MAYA"`** (first in `ALL_AGENTS`, and the priciest agent) instead
> of `null` — silently provisioning the wrong agent from a malformed webhook.
> Verified empirically. Guard once at the top of each function rather than
> per-comparison, so the two cannot drift apart again.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-catalog.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Delete the annual-custom dead paths**

Remove from `billing.catalog.ts`:

```ts
// DELETE — annual individual-agent plans are not a product. Annual is Crew-only.
export function calculateAgentSelectionPriceCents(agents: Agent[], plan: SubscriptionPlan): number {
  if (isCrewSelection(agents)) return getCrewPriceCents(plan);
  const monthlyTotal = agents.reduce((sum, agent) => sum + getAgentMonthlyPriceCents(agent), 0);
  if (plan === "MONTHLY") return monthlyTotal;
  return Math.round(monthlyTotal * 12 * 0.75);   // ← the dead annual branch
}
```

Replace with a monthly-only total that cannot express the illegal case:

```ts
/**
 * Sum of monthly list prices for a set of agents. Individual agents are
 * MONTHLY-only by design, so there is no cadence argument to get wrong.
 *
 * Transitional: this exists only to keep the current quantity-hack call site
 * compiling until Task 5.1 replaces it with real per-agent products. Phase 12
 * deletes it.
 */
export function sumAgentMonthlyPriceCents(agents: Agent[]): number {
  return agents.reduce((sum, agent) => sum + getAgentMonthlyPriceCents(agent), 0);
}
```

Then update the one caller, `billing.service.ts:304`, to `sumAgentMonthlyPriceCents(selectedAgents)`, and delete the now-unused `plan` argument threading at `billing.service.ts:303-309`.

- [ ] **Step 6: Verify the whole suite still passes**

Run: `cd apps/server && npm test`
Expected: PASS. `src/tests/unit/billing.test.ts` has a `calculateAgentSelectionPriceCents` import that will now fail to resolve — update that test to `sumAgentMonthlyPriceCents` and drop its annual-custom case, which asserted behavior the spec forbids.

### Task 1.2: Crew upgrade credit math

**Files:**
- Create: `apps/server/src/modules/billing/billing.upgrade.ts`
- Test: `apps/server/src/tests/unit/billing-upgrade.test.ts` (create)

**Interfaces:**
- Consumes: `getAgentMonthlyPriceCents`, `getCrewPriceCents` from `./billing.catalog.js`
- Produces:
  ```ts
  export type UpgradeIneligibleReason =
    | "credit-exceeds-crew-price"
    | "no-agents-owned"
    | "already-on-crew";

  export type UpgradeQuote =
    | { eligible: true;  creditCents: number; payNowCents: number; discountBasisPoints: number }
    | { eligible: false; creditCents: number; reason: UpgradeIneligibleReason };

  export function quoteCrewUpgrade(
    ownedPriceCents: number[],
    plan: SubscriptionPlan,
  ): UpgradeQuote;
  ```

  > `quoteCrewUpgrade` itself never returns `already-on-crew` — it is pure and sees only prices. That reason is produced by `getUpgradeQuoteForOrg` (Task 5.2), which can see entitlement sources. It lives in the shared union so the frontend has one exhaustive type to switch on.

> **Why `ownedPriceCents: number[]` and not `Agent[]`:** the credit must use the price actually **paid** (`Entitlement.priceCents`), not today's list price. If catalog prices change, an existing customer's credit must not silently shift. This keeps the function pure and correct across price changes.

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/tests/unit/billing-upgrade.test.ts`:

```ts
import { assert, beforeEach, describe, test } from "vitest";
import { quoteCrewUpgrade } from "../../modules/billing/billing.upgrade.js";

beforeEach(() => {
  process.env.CREW_MONTHLY_CENTS = "3900";
  process.env.CREW_ANNUAL_CENTS = "34800";
});

describe("quoteCrewUpgrade — the spec's worked example", () => {
  test("Maya(1900) + Rex(900) → pay 1100", () => {
    const q = quoteCrewUpgrade([1900, 900], "MONTHLY");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 2800);
    assert.equal(q.payNowCents, 1100);
    assert.equal(q.discountBasisPoints, 7179);
  });
});

describe("quoteCrewUpgrade — full reachable delta matrix", () => {
  // Every basket reachable from prices {1900 Maya, 900 x5} with total < 3900.
  const cases: Array<[number[], number, number, number]> = [
    // owned,                credit, bp,   payNow
    [[900],                   900,   2308, 3000],
    [[900, 900],             1800,   4615, 2100],
    [[1900],                 1900,   4872, 2000],
    [[900, 900, 900],        2700,   6923, 1200],
    [[1900, 900],            2800,   7179, 1100],
    [[900, 900, 900, 900],   3600,   9231,  300],
    [[1900, 900, 900],       3700,   9487,  200],
  ];

  for (const [owned, credit, bp, payNow] of cases) {
    test(`owned ${credit} → ${bp}bp → pay ${payNow}`, () => {
      const q = quoteCrewUpgrade(owned, "MONTHLY");
      assert.equal(q.eligible, true);
      if (!q.eligible) return;
      assert.equal(q.creditCents, credit);
      assert.equal(q.discountBasisPoints, bp);
      assert.equal(q.payNowCents, payNow);
    });
  }

  test("every reachable payNow is a whole dollar (no rounding drift)", () => {
    for (const [owned] of cases) {
      const q = quoteCrewUpgrade(owned, "MONTHLY");
      assert.equal(q.eligible, true);
      if (!q.eligible) return;
      assert.equal(q.payNowCents % 100, 0, `owned=${owned} produced ${q.payNowCents}`);
    }
  });

  test("every reachable payNow clears Dodo's $1 minimum", () => {
    for (const [owned] of cases) {
      const q = quoteCrewUpgrade(owned, "MONTHLY");
      assert.equal(q.eligible, true);
      if (!q.eligible) return;
      assert.isAtLeast(q.payNowCents, 100, `owned=${owned} is below the $1 floor`);
    }
  });
});

describe("quoteCrewUpgrade — ineligible", () => {
  test("credit exactly equals crew price → ineligible (no refund, no $0 charge)", () => {
    const q = quoteCrewUpgrade([1900, 900, 900, 200], "MONTHLY"); // 3900
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "credit-exceeds-crew-price");
  });

  test("credit exceeds crew price → ineligible", () => {
    const q = quoteCrewUpgrade([1900, 900, 900, 900], "MONTHLY"); // 4600 > 3900
    assert.equal(q.eligible, false);
  });

  test("nothing owned → ineligible (this is a plain Crew purchase, not an upgrade)", () => {
    const q = quoteCrewUpgrade([], "MONTHLY");
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "no-agents-owned");
  });
});

describe("quoteCrewUpgrade — annual", () => {
  test("credit applies against the annual crew price", () => {
    const q = quoteCrewUpgrade([1900, 900], "ANNUAL");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 2800);
    assert.equal(q.payNowCents, 34800 - 2800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-upgrade.test.ts`
Expected: FAIL — cannot find module `billing.upgrade.js`

- [ ] **Step 3: Implement**

Create `apps/server/src/modules/billing/billing.upgrade.ts`:

```ts
import { SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";
import { getCrewPriceCents } from "./billing.catalog.js";

export type UpgradeIneligibleReason =
  | "credit-exceeds-crew-price"
  | "no-agents-owned"
  | "already-on-crew";

export type UpgradeQuote =
  | { eligible: true;  creditCents: number; payNowCents: number; discountBasisPoints: number }
  | { eligible: false; creditCents: number; reason: UpgradeIneligibleReason };

/**
 * Prices a Crew upgrade for an org that already owns individual agents.
 *
 * Credit is the FULL list price paid for each owned agent, not its unused
 * portion — a deliberate, spec'd trade-off (upgrading on day 29 still credits
 * the whole agent). See the spec's "Accepted trade-off".
 *
 * Dodo supports percentage discounts only (UNSUPPORTED_DISCOUNT_TYPE for flat
 * amounts), so the credit is expressed as basis points of the Crew price and
 * applied with subscription_cycles=1 so only the first cycle is discounted.
 */
export function quoteCrewUpgrade(
  ownedPriceCents: number[],
  plan: SubscriptionPlan,
): UpgradeQuote {
  const creditCents = ownedPriceCents.reduce((sum, cents) => sum + cents, 0);
  if (creditCents <= 0) return { eligible: false, creditCents: 0, reason: "no-agents-owned" };

  const crewCents = getCrewPriceCents(plan);
  // >= not > : a credit equal to the Crew price would mean a $0 charge, which
  // Dodo rejects (minimum subscription price is $1) and which we would not
  // refund anyway.
  if (creditCents >= crewCents) {
    return { eligible: false, creditCents, reason: "credit-exceeds-crew-price" };
  }

  const discountBasisPoints = Math.round((creditCents / crewCents) * 10000);
  // Mirror Dodo's own arithmetic rather than using (crew - credit) directly, so
  // payNowCents is exactly what the customer will be charged — including any
  // sub-cent drift introduced by quantising the credit to basis points.
  const appliedDiscountCents = Math.round((crewCents * discountBasisPoints) / 10000);
  const payNowCents = crewCents - appliedDiscountCents;

  return { eligible: true, creditCents, payNowCents, discountBasisPoints };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-upgrade.test.ts`
Expected: PASS (13 tests)

The "whole dollar" and "$1 minimum" tests are the guardrails: if anyone changes a price in the catalog such that a delta stops landing on a clean dollar or drops below Dodo's floor, these fail loudly rather than shipping a checkout that Dodo rejects at runtime.

### Task 1.3: Maya quota from an entitlement

**Files:**
- Modify: `apps/server/src/modules/agents/maya/maya.quotas.ts`
- Test: `apps/server/src/tests/unit/maya-quotas.test.ts` (create)

**Interfaces:**
- Produces: `getQuotaForMayaEntitlement(e: { source: EntitlementSource; plan: SubscriptionPlan | null }): number`
- Keeps unchanged: `CREDITS_PER_IMAGE = 2`, `CREDITS_PER_VIDEO_SECOND = 4`, `imageCreditsFor`, `videoCreditsFor`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/tests/unit/maya-quotas.test.ts`:

```ts
import { assert, describe, test } from "vitest";
import {
  getQuotaForMayaEntitlement,
  CREDITS_PER_IMAGE,
  CREDITS_PER_VIDEO_SECOND,
  imageCreditsFor,
  videoCreditsFor,
} from "../../modules/agents/maya/maya.quotas.js";

describe("getQuotaForMayaEntitlement", () => {
  test("trial → 30", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "TRIAL", plan: null }), 30);
  });

  test("individually purchased Maya (monthly) → 300", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "AGENT", plan: "MONTHLY" }), 300);
  });

  test("crew monthly → 300", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "CREW", plan: "MONTHLY" }), 300);
  });

  test("crew annual → 400 (per month, not per year)", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "CREW", plan: "ANNUAL" }), 400);
  });
});

describe("credit conversion is unchanged", () => {
  test("constants hold", () => {
    assert.equal(CREDITS_PER_IMAGE, 2);
    assert.equal(CREDITS_PER_VIDEO_SECOND, 4);
  });

  test("3 images = 6 credits, 10s video = 40 credits", () => {
    assert.equal(imageCreditsFor(3), 6);
    assert.equal(videoCreditsFor(10), 40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/maya-quotas.test.ts`
Expected: FAIL — `getQuotaForMayaEntitlement is not a function`

- [ ] **Step 3: Implement**

Add to `maya.quotas.ts` (leave `getTierFromSubscription` in place for now — Phase 8 removes it):

```ts
import { EntitlementSource, SubscriptionPlan } from "../../../../prisma/generated/prisma/client.js";

/**
 * Maya's monthly credit allowance, read live from her entitlement.
 *
 * ANNUAL grants 400 *per month*, not per year: the credit period is a fixed
 * 1-month window decoupled from the billing period (see spec, Decision 6).
 * The previous code granted 400 for the entire year.
 */
export function getQuotaForMayaEntitlement(e: {
  source: EntitlementSource;
  plan: SubscriptionPlan | null;
}): number {
  if (e.source === "TRIAL") return 30;
  if (e.source === "CREW" && e.plan === "ANNUAL") return 400;
  return 300;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/maya-quotas.test.ts`
Expected: PASS (6 tests)

> This task will not typecheck until Phase 3 adds the `EntitlementSource` enum to the schema. Either run Phase 3's Task 3.1 (schema only) first, or temporarily inline `type EntitlementSource = "TRIAL" | "AGENT" | "CREW"` and swap it to the Prisma import in Phase 3. Prefer running Task 3.1 first.

---

## Phase 2: Webhook Idempotency Hardening

**This phase must land before Phase 3.** A webhook replay during backfill would otherwise process against half-migrated state.

Two defects are fixed here, both in `billing.webhooks.ts`:
1. `eventId()` synthesizes `` `${type}:${subId}:${timestamp}` `` instead of using Dodo's real event id → a redelivery with a different timestamp is processed twice.
2. `claimWebhookEvent` writes `result: "processing"` and, if the handler then throws, the row stays `"processing"` **forever** — and because the claim is what guards re-entry, **every retry is silently swallowed**. A transient DB blip means the event is lost with no alarm.

### Task 2.1: Use Dodo's real event id and make failures retryable

**Files:**
- Modify: `apps/server/src/modules/billing/billing.webhooks.ts:59-91`
- Modify: `apps/server/src/lib/auth.ts:130-138`
- Test: `apps/server/src/tests/unit/billing-webhook-idempotency.test.ts` (create)

**Interfaces:**
- Produces: `withWebhookEvent<T>(eventId: string, eventType: string, subscriptionId: string | undefined, organizationId: string | null, fn: () => Promise<T>): Promise<T | undefined>`

- [ ] **Step 1: Confirm how the plugin surfaces the webhook id**

The `@dodopayments/better-auth` `webhooks()` plugin verifies signatures via standardwebhooks and passes the parsed payload to `onSubscriptionActive`. Standard webhooks carry the id in the `webhook-id` header.

Run: `cd apps/server && grep -rn "webhook-id\|webhookId\|headers" node_modules/@dodopayments/better-auth/dist/*.js | head -20`

If the plugin does **not** forward the header to the handler, use the fallback in Step 3 and record which applies.

- [ ] **Step 2: Write the failing test**

Create `apps/server/src/tests/unit/billing-webhook-idempotency.test.ts`:

```ts
import { assert, beforeEach, describe, test, vi } from "vitest";

type EventRow = { eventId: string; result: string };
let rows: EventRow[] = [];

const mockPrisma = {
  billingWebhookEvent: {
    create: vi.fn(async ({ data }: { data: EventRow }) => {
      if (rows.some((r) => r.eventId === data.eventId)) {
        const err = Object.assign(new Error("unique"), { code: "P2002" });
        throw err;
      }
      rows.push({ ...data });
      return data;
    }),
    update: vi.fn(async ({ where, data }: { where: { eventId: string }; data: Partial<EventRow> }) => {
      const row = rows.find((r) => r.eventId === where.eventId);
      if (row) Object.assign(row, data);
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { eventId: string } }) => {
      rows = rows.filter((r) => r.eventId !== where.eventId);
    }),
  },
};

vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { withWebhookEvent } = await import("../../modules/billing/billing.webhooks.js");

beforeEach(() => {
  rows = [];
  vi.clearAllMocks();
});

describe("withWebhookEvent", () => {
  test("runs the handler once and records the result", async () => {
    const fn = vi.fn(async () => "applied-active");
    const out = await withWebhookEvent("evt_1", "subscription.active", "sub_1", "org_1", fn);
    assert.equal(out, "applied-active");
    assert.equal(fn.mock.calls.length, 1);
    assert.equal(rows[0].result, "applied-active");
  });

  test("a duplicate delivery of the same event id does not re-run the handler", async () => {
    const fn = vi.fn(async () => "applied-active");
    await withWebhookEvent("evt_1", "subscription.active", "sub_1", "org_1", fn);
    await withWebhookEvent("evt_1", "subscription.active", "sub_1", "org_1", fn);
    assert.equal(fn.mock.calls.length, 1, "handler must not run twice for one event id");
  });

  test("REGRESSION: a handler that throws leaves the event RETRYABLE, not stuck", async () => {
    const failing = vi.fn(async () => { throw new Error("db blip"); });
    await assert.isRejected?.(Promise.resolve()) ?? null; // no-op guard for chai-as-promised absence

    let threw = false;
    try {
      await withWebhookEvent("evt_2", "subscription.active", "sub_2", "org_1", failing);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, "the error must propagate so Dodo retries");

    // The critical assertion: the claim must NOT still be blocking a retry.
    const succeeding = vi.fn(async () => "applied-active");
    const out = await withWebhookEvent("evt_2", "subscription.active", "sub_2", "org_1", succeeding);
    assert.equal(succeeding.mock.calls.length, 1, "the retry must actually run");
    assert.equal(out, "applied-active");
  });

  test("distinct events sharing a timestamp are both processed", async () => {
    const fn = vi.fn(async () => "ok");
    await withWebhookEvent("evt_a", "subscription.active", "sub_1", "org_1", fn);
    await withWebhookEvent("evt_b", "subscription.renewed", "sub_1", "org_1", fn);
    assert.equal(fn.mock.calls.length, 2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-webhook-idempotency.test.ts`
Expected: FAIL — `withWebhookEvent is not exported`

- [ ] **Step 4: Implement**

In `billing.webhooks.ts`, **delete** `eventId()`, `claimWebhookEvent()`, and `finishWebhookEvent()` (lines 59-91) and replace with:

```ts
import { Prisma } from "../../../prisma/generated/prisma/client.js";

/**
 * Idempotency wrapper for webhook handlers.
 *
 * Uses Dodo's real event id (never a synthesized string) so a redelivery is
 * recognised as the same event regardless of timestamp.
 *
 * On handler failure the claim row is REMOVED so Dodo's retry can re-enter.
 * The previous implementation left `result: "processing"` behind, which made
 * the claim permanently reject every retry — silently losing the event.
 */
export async function withWebhookEvent<T>(
  eventId: string,
  eventType: string,
  subscriptionId: string | undefined,
  organizationId: string | null,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    await prisma.billingWebhookEvent.create({
      data: { eventId, eventType, subscriptionId, organizationId, result: "processing" },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return undefined; // already handled (or in flight) — genuine duplicate
    }
    throw err;
  }

  let result: T;
  try {
    result = await fn();
  } catch (err) {
    // Release the claim so the provider's retry is not swallowed.
    await prisma.billingWebhookEvent
      .delete({ where: { eventId } })
      .catch((e) => console.error("[billing] failed to release webhook claim", eventId, e));
    throw err;
  }

  await prisma.billingWebhookEvent.update({
    where: { eventId },
    data: { result: String(result ?? "applied"), ...(organizationId ? { organizationId } : {}) },
  });
  return result;
}
```

Then thread the real event id from `auth.ts`. If Step 1 showed the plugin forwards headers, take `webhook-id` from them. If it does not, fall back to the provider's own id in the payload body:

```ts
// billing.webhooks.ts
function providerEventId(payload: WebhookPayload): string {
  // Prefer the provider's stable event id. Fall back to the business key
  // (type + subscription + period) rather than a wall-clock timestamp, so a
  // redelivery still collides with the original.
  const id = (payload as { id?: string; webhook_id?: string }).id
    ?? (payload as { webhook_id?: string }).webhook_id;
  if (id) return id;
  const period = payload.data.next_billing_date ?? payload.data.current_period_end ?? "no-period";
  return `${payload.type}:${payload.data.subscription_id ?? "none"}:${period}`;
}
```

Rewrite each handler to use it, e.g.:

```ts
export async function handleSubscriptionActive(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? findOrgIdFromPayload(payload);
  if (!orgId) {
    console.warn("[billing] active webhook: no org for customer", payload.data.customer?.customer_id);
    return;
  }
  await withWebhookEvent(
    providerEventId(payload), payload.type, payload.data.subscription_id, orgId,
    async () => { /* ...existing body, returning the result string... */ },
  );
}
```

Apply the same shape to `handleSubscriptionRenewed`, `handleSubscriptionCancelled`, `handleSubscriptionExpired`, `handleSubscriptionFailed`, `handlePaymentFailed`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-webhook-idempotency.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Verify no regression in the existing suite**

Run: `cd apps/server && npm test`
Expected: PASS

---

## Phase 3: Schema & Backfill (Additive Only)

Nothing is dropped in this phase. New tables land alongside the old columns, which keep working until Phase 12.

### Task 3.1: Add the entitlement schema

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/<timestamp>_add_entitlements/migration.sql`

- [ ] **Step 1: Add enums and models**

Add to `schema.prisma` (near the other billing enums, ~line 46):

```prisma
/// Where an entitlement came from.
enum EntitlementSource {
  TRIAL
  AGENT
  CREW
}

/// Lifecycle of a single agent entitlement.
enum EntitlementStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  EXPIRED
  SUPERSEDED
}
```

Add the models:

```prisma
/// Source of truth for agent access. One row per purchase of one agent.
/// Deliberately NOT unique on [organizationId, agent]: overlapping rows are
/// legal and load-bearing (during a Crew upgrade an org briefly holds both an
/// AGENT row and a CREW row for the same agent).
model Entitlement {
  id                    String              @id @default(cuid())
  organizationId        String
  organization          Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  agent                 Agent
  source                EntitlementSource
  status                EntitlementStatus
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean             @default(false)
  /// Cents actually paid for this agent. Drives the Crew upgrade credit, so it
  /// must be the price paid, not today's list price.
  priceCents            Int                 @default(0)
  billingSubscriptionId String?
  billingSubscription   BillingSubscription? @relation(fields: [billingSubscriptionId], references: [id], onDelete: SetNull)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  /// Hot path: the access check.
  @@index([organizationId, agent, currentPeriodEnd])
  /// Sweeper: find lapsed rows.
  @@index([currentPeriodEnd, status])
  @@index([billingSubscriptionId])
  @@map("entitlement")
}

/// One row per Dodo subscription. Bills 1..N entitlements.
model BillingSubscription {
  id                 String             @id @default(cuid())
  organizationId     String
  organization       Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  dodoSubscriptionId String             @unique
  plan               SubscriptionPlan
  status             SubscriptionStatus
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean            @default(false)
  entitlements       Entitlement[]
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  @@index([organizationId])
  @@map("billing_subscription")
}
```

Add to `Organization` (after `unlockedAgents`, ~line 235):

```prisma
  /// When the org's one-and-only trial was started. Non-null = trial already used.
  trialStartedAt       DateTime?
  /// Per-agent entitlements — the source of truth for access.
  entitlements         Entitlement[]
  /// Dodo subscriptions billing this org.
  billingSubscriptions BillingSubscription[]
```

- [ ] **Step 2: Generate the migration WITHOUT touching the live DB**

The live DB has drift; `migrate dev` would try to reconcile it and is unsafe.

```bash
cd apps/server
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/entitlements.sql
```

- [ ] **Step 3: Review the generated SQL by eye**

Open `/tmp/entitlements.sql`. It must contain **only** `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, and `ALTER TABLE "organization" ADD COLUMN "trialStartedAt"`.

**If it contains any `DROP`, stop.** That means drift was picked up and the diff is unsafe to apply. Re-derive it against the real database URL instead.

- [ ] **Step 4: Place and apply the migration**

```bash
mkdir -p prisma/migrations/20260715000000_add_entitlements
cp /tmp/entitlements.sql prisma/migrations/20260715000000_add_entitlements/migration.sql
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

Use `DIRECT_URL` (5432). The 6543 pooler cannot run migrations.

- [ ] **Step 5: Regenerate the client and typecheck**

```bash
cd apps/server && npx prisma generate && npx tsc --noEmit
```

Expected: PASS. Task 1.3's `EntitlementSource` import now resolves.

### Task 3.2: Backfill existing subscriptions

**Files:**
- Create: `apps/server/scripts/backfill-entitlements.ts`

- [ ] **Step 1: Write the backfill as an idempotent, dry-run-first script**

```ts
import { prisma } from "../src/config/prisma.js";
import { getAgentMonthlyPriceCents, getCrewPriceCents, ALL_AGENTS } from "../src/modules/billing/billing.catalog.js";

const DRY_RUN = process.env.APPLY !== "1";

async function main() {
  const subs = await prisma.subscription.findMany();
  let entitlementsPlanned = 0;
  let billingSubsPlanned = 0;

  for (const sub of subs) {
    const existing = await prisma.entitlement.count({ where: { organizationId: sub.organizationId } });
    if (existing > 0) continue; // idempotent: never double-backfill an org

    if (sub.status === "TRIALING" && sub.trialEndsAt) {
      entitlementsPlanned += ALL_AGENTS.length;
      if (!DRY_RUN) {
        await prisma.$transaction([
          prisma.entitlement.createMany({
            data: ALL_AGENTS.map((agent) => ({
              organizationId: sub.organizationId,
              agent,
              source: "TRIAL" as const,
              status: "TRIALING" as const,
              currentPeriodStart: sub.createdAt,
              currentPeriodEnd: sub.trialEndsAt!,
              priceCents: 0,
            })),
          }),
          prisma.organization.update({
            where: { id: sub.organizationId },
            data: { trialStartedAt: sub.createdAt },
          }),
        ]);
      }
      continue;
    }

    // Paid (or lapsed-paid) orgs: one BillingSubscription + one Entitlement per selected agent.
    if (!sub.dodoSubscriptionId || !sub.currentPeriodEnd) continue;

    const isCrew = sub.entitlementMode === "CREW";
    const agents = isCrew ? ALL_AGENTS : sub.selectedAgents;
    if (agents.length === 0) continue;

    const plan = sub.plan ?? "MONTHLY";
    // Snapshot the price AT MIGRATION TIME. For CREW we divide the bundle price
    // across agents so the upgrade credit can never exceed the Crew price.
    const priceFor = (agent: (typeof agents)[number]) =>
      isCrew ? Math.floor(getCrewPriceCents(plan) / ALL_AGENTS.length) : getAgentMonthlyPriceCents(agent);

    billingSubsPlanned += 1;
    entitlementsPlanned += agents.length;

    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        const bs = await tx.billingSubscription.create({
          data: {
            organizationId: sub.organizationId,
            dodoSubscriptionId: sub.dodoSubscriptionId!,
            plan,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd!,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          },
        });
        await tx.entitlement.createMany({
          data: agents.map((agent) => ({
            organizationId: sub.organizationId,
            agent,
            source: (isCrew ? "CREW" : "AGENT") as "CREW" | "AGENT",
            status: sub.status === "CANCELLED" ? ("ACTIVE" as const) : (sub.status as never),
            currentPeriodStart: sub.updatedAt,
            currentPeriodEnd: sub.currentPeriodEnd!,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd || sub.status === "CANCELLED",
            priceCents: priceFor(agent),
            billingSubscriptionId: bs.id,
          })),
        });
      });
    }
  }

  console.log(JSON.stringify({
    mode: DRY_RUN ? "DRY_RUN" : "APPLIED",
    subscriptionsScanned: subs.length,
    billingSubsPlanned,
    entitlementsPlanned,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
```

> **Two decisions worth understanding:**
> - **`CANCELLED` maps to `ACTIVE` + `cancelAtPeriodEnd: true`.** In the new model `CANCELLED` is not an entitlement state — "cancelled but still in period" is exactly `ACTIVE` with the flag set. Access continues to `currentPeriodEnd`, which matches today's behavior (`deriveEntitlementFields` maps `CANCELLED → entitlementExpiresAt = currentPeriodEnd`).
> - **Crew `priceCents` is the bundle price ÷ 6, floored.** If each Crew agent were stamped at full list price, an org would carry a $64 credit against a $39 Crew price and every upgrade quote would be permanently ineligible. Flooring keeps Σ ≤ Crew price.

- [ ] **Step 2: Dry run against production**

```bash
cd apps/server && npx tsx scripts/backfill-entitlements.ts
```

Expected: JSON with `"mode": "DRY_RUN"` and non-zero counts. Sanity-check `entitlementsPlanned` against `SELECT count(*) FROM subscription WHERE status <> 'EXPIRED'`.

- [ ] **Step 3: Apply**

```bash
cd apps/server && APPLY=1 npx tsx scripts/backfill-entitlements.ts
```

- [ ] **Step 4: Verify parity between old and new models**

This query must return **zero rows**. Each row is an org whose new entitlements disagree with its old `unlockedAgents`:

```sql
SELECT o.id,
       o."unlockedAgents" AS old_agents,
       array_agg(e.agent ORDER BY e.agent) AS new_agents
FROM organization o
LEFT JOIN entitlement e
  ON e."organizationId" = o.id
 AND e."currentPeriodEnd" > now()
 AND e.status IN ('TRIALING','ACTIVE','PAST_DUE')
WHERE o."subscriptionStatus" IN ('TRIALING','ACTIVE','PAST_DUE','CANCELLED')
GROUP BY o.id, o."unlockedAgents"
HAVING array_agg(e.agent ORDER BY e.agent) IS DISTINCT FROM
       (SELECT array_agg(a ORDER BY a) FROM unnest(o."unlockedAgents") a);
```

**Do not proceed to Phase 4 until this returns zero rows.** Phase 4 swaps the read path onto these rows; any disagreement here is a customer losing access they paid for.

---

## Phase 4: Entitlement Read Path

### Task 4.1: Entitlement service + middleware swap

**Files:**
- Create: `apps/server/src/modules/billing/entitlement.service.ts`
- Modify: `apps/server/src/middlewares/entitlement.middleware.ts`
- Test: `apps/server/src/tests/unit/entitlement-access.test.ts` (create)

**Interfaces:**
- Produces:
  ```ts
  export const ACCESS_STATUSES: EntitlementStatus[]; // ["TRIALING","ACTIVE","PAST_DUE"]
  export async function getActiveEntitlements(organizationId: string): Promise<Entitlement[]>;
  export async function hasAgentAccess(organizationId: string, agent: Agent): Promise<boolean>;
  export async function getMayaEntitlement(organizationId: string): Promise<Entitlement | null>;
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/tests/unit/entitlement-access.test.ts`:

```ts
import { assert, beforeEach, describe, test, vi } from "vitest";

type Ent = {
  organizationId: string; agent: string; source: string; status: string;
  currentPeriodEnd: Date; priceCents: number;
};
let ents: Ent[] = [];

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where }: never) => {
      const w = where as {
        organizationId: string; agent?: string;
        currentPeriodEnd: { gt: Date }; status: { in: string[] };
      };
      return ents.filter((e) =>
        e.organizationId === w.organizationId &&
        (!w.agent || e.agent === w.agent) &&
        e.currentPeriodEnd > w.currentPeriodEnd.gt &&
        w.status.in.includes(e.status));
    }),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { hasAgentAccess, getActiveEntitlements } =
  await import("../../modules/billing/entitlement.service.js");

const future = new Date(Date.now() + 10 * 86400_000);
const past   = new Date(Date.now() - 1 * 86400_000);

beforeEach(() => { ents = []; vi.clearAllMocks(); });

describe("hasAgentAccess", () => {
  test("ACTIVE and unexpired → access", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), true);
  });

  test("REGRESSION: ACTIVE but period lapsed → NO access even without a webhook", async () => {
    // The old model set entitlementExpiresAt=null for ACTIVE, so a missed
    // `subscription.expired` webhook granted access forever.
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: past, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
  });

  test("PAST_DUE within period → access (dunning grace)", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "PAST_DUE", currentPeriodEnd: future, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), true);
  });

  test("SUPERSEDED → no access", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "SUPERSEDED", currentPeriodEnd: future, priceCents: 1900 }];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
  });

  test("CREW row grants access to an agent with no AGENT row", async () => {
    ents = [{ organizationId: "o1", agent: "VEGA", source: "CREW", status: "ACTIVE", currentPeriodEnd: future, priceCents: 650 }];
    assert.equal(await hasAgentAccess("o1", "VEGA" as never), true);
  });

  test("overlapping rows: expired AGENT + active CREW → access", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "SUPERSEDED", currentPeriodEnd: past,   priceCents: 1900 },
      { organizationId: "o1", agent: "MAYA", source: "CREW",  status: "ACTIVE",     currentPeriodEnd: future, priceCents: 650 },
    ];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), true);
  });

  test("agents are independent: Maya lapsed does not affect Rex", async () => {
    ents = [
      { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE", currentPeriodEnd: past,   priceCents: 1900 },
      { organizationId: "o1", agent: "REX",  source: "AGENT", status: "ACTIVE", currentPeriodEnd: future, priceCents: 900 },
    ];
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
    assert.equal(await hasAgentAccess("o1", "REX"  as never), true);
    assert.equal((await getActiveEntitlements("o1")).length, 1);
  });

  test("no rows → no access", async () => {
    assert.equal(await hasAgentAccess("o1", "MAYA" as never), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/entitlement-access.test.ts`
Expected: FAIL — cannot find module `entitlement.service.js`

- [ ] **Step 3: Implement the service**

Create `apps/server/src/modules/billing/entitlement.service.ts`:

```ts
import { prisma } from "../../config/prisma.js";
import { Agent, EntitlementStatus } from "../../../prisma/generated/prisma/client.js";

/**
 * Statuses that grant access. PAST_DUE is included deliberately: it IS the
 * dunning grace window, and the grace is the remainder of the already-paid
 * period — ended early only by a `subscription.failed` webhook flipping the
 * row to EXPIRED. SUPERSEDED never grants access.
 */
export const ACCESS_STATUSES: EntitlementStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

/** Every entitlement currently granting access. */
export async function getActiveEntitlements(organizationId: string) {
  return prisma.entitlement.findMany({
    where: {
      organizationId,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
    orderBy: { currentPeriodEnd: "asc" },
  });
}

/**
 * Access check for one agent. Any covering row grants access — overlapping
 * rows (an AGENT row and a CREW row for the same agent) are legal.
 */
export async function hasAgentAccess(organizationId: string, agent: Agent): Promise<boolean> {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId,
      agent,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
    take: 1,
  });
  return rows.length > 0;
}

/**
 * Maya's governing entitlement, used for quota lookup. When rows overlap the
 * most generous one wins, so a mid-period Crew upgrade raises the ceiling
 * rather than lowering it: CREW outranks AGENT outranks TRIAL, and among
 * equals the later period end wins.
 */
export async function getMayaEntitlement(organizationId: string) {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId,
      agent: "MAYA",
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
  });
  if (rows.length === 0) return null;
  const rank = { CREW: 3, AGENT: 2, TRIAL: 1 } as const;
  return rows.sort((a, b) =>
    rank[b.source] - rank[a.source] ||
    b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime())[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/entitlement-access.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Swap the middleware onto entitlements**

Rewrite `apps/server/src/middlewares/entitlement.middleware.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { Agent } from "../../prisma/generated/prisma/client.js";
import { getActiveEntitlements } from "../modules/billing/entitlement.service.js";

/**
 * Gates /agents/* on live entitlement rows rather than the denormalized
 * Organization cache. The cache could not express per-agent expiry, and its
 * ACTIVE → entitlementExpiresAt=null encoding meant a missed webhook granted
 * access forever. Reading the rows makes expiry structural.
 */
export function entitlementMiddlewareForAgent(agent?: Agent) {
  return async function entitlementMiddleware(req: Request, res: Response, next: NextFunction) {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "No active organization" });
    }

    const active = await getActiveEntitlements(orgId);

    if (active.length === 0) {
      // Distinguish "never started" from "lapsed" so the UI can route the user
      // to the trial CTA vs the billing page.
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { trialStartedAt: true },
      });
      return res.status(StatusCodes.PAYMENT_REQUIRED).json({
        error: org?.trialStartedAt ? "Subscription expired" : "Trial not started",
      });
    }

    // No specific agent (the shared /agents messages route): any entitlement passes.
    if (!agent) return next();

    const covering = active.filter((e) => e.agent === agent);
    if (covering.length === 0) {
      return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "Agent not purchased" });
    }

    if (covering.some((e) => e.status === "PAST_DUE") && !covering.some((e) => e.status !== "PAST_DUE")) {
      // Still inside the paid period, so allow through, but let the client
      // surface a dunning banner.
      res.setHeader("X-Billing-State", "past_due");
    }

    return next();
  };
}

export const entitlementMiddleware = entitlementMiddlewareForAgent();
```

`router.ts:44-51` needs **no change** — the exported signatures are unchanged.

- [ ] **Step 6: Verify the full suite and typecheck**

Run: `cd apps/server && npm test && npx tsc --noEmit`
Expected: PASS

### Task 4.2: Rewrite the trial onto entitlements

Implements spec Decision 8. A trial involves no Dodo subscription, so this is not gated on the Phase 0 spike.

**Files:**
- Modify: `apps/server/src/modules/billing/billing.service.ts:143-275`
- Modify: `apps/server/src/modules/billing/billing.controller.ts:63-73`
- Test: `apps/server/src/tests/unit/billing-trial-entitlements.test.ts` (create)

**Interfaces:**
- Produces: `startTrialForOrg(organizationId: string): Promise<{ trialEndsAt: Date; agents: Agent[] }>` — **note the removed `inputAgents` parameter**

- [ ] **Step 1: Write the failing test**

```ts
import { assert, beforeEach, describe, test, vi } from "vitest";

let ents: Array<Record<string, unknown>> = [];
let org: { id: string; trialStartedAt: Date | null } = { id: "o1", trialStartedAt: null };

const mockPrisma = {
  organization: {
    findUnique: vi.fn(async () => org),
    update: vi.fn(async ({ data }: never) => Object.assign(org, data)),
  },
  entitlement: {
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      ents.push(...data); return { count: data.length };
    }),
  },
  mayaUsage: { create: vi.fn(async () => ({})) },
  subscription: { findUnique: vi.fn(async () => null) },
  $transaction: vi.fn(async (fn: never) => (fn as (tx: unknown) => unknown)(mockPrisma)),
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../lib/dodo.js", () => ({
  dodoClient: { customers: { create: vi.fn(async () => ({ customer_id: "cus_1" })) } },
}));

const { startTrialForOrg } = await import("../../modules/billing/billing.service.js");

beforeEach(() => { ents = []; org = { id: "o1", trialStartedAt: null }; vi.clearAllMocks(); });

describe("startTrialForOrg", () => {
  test("grants all six agents — there is no agent selection at trial time", async () => {
    await startTrialForOrg("o1");
    const agents = ents.map((e) => e.agent).sort();
    assert.deepEqual(agents, ["LEX", "MAYA", "REX", "SAGE", "SCOUT", "VEGA"]);
  });

  test("trial rows are TRIAL/TRIALING with zero price and no billing subscription", async () => {
    await startTrialForOrg("o1");
    for (const e of ents) {
      assert.equal(e.source, "TRIAL");
      assert.equal(e.status, "TRIALING");
      assert.equal(e.priceCents, 0);
      assert.equal(e.billingSubscriptionId ?? null, null);
    }
  });

  test("the trial runs 7 days", async () => {
    const out = await startTrialForOrg("o1");
    const days = Math.round((out.trialEndsAt.getTime() - Date.now()) / 86400_000);
    assert.equal(days, 7);
  });

  test("stamps trialStartedAt", async () => {
    await startTrialForOrg("o1");
    assert.isNotNull(org.trialStartedAt);
  });

  test("REGRESSION: a second trial is refused — this is the anti-farming guard", async () => {
    org.trialStartedAt = new Date("2026-01-01");
    await startTrialForOrg("o1").then(
      () => assert.fail("a second trial must not be granted"),
      (e) => assert.match(String(e), /trial-already-used/),
    );
    assert.equal(ents.length, 0);
  });

  test("an EXPIRED past trial still blocks a new one (once ever, not once concurrently)", async () => {
    org.trialStartedAt = new Date("2020-01-01");
    await startTrialForOrg("o1").then(
      () => assert.fail("expired trials must not permit a fresh trial"),
      (e) => assert.match(String(e), /trial-already-used/),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-trial-entitlements.test.ts`
Expected: FAIL — the current `startTrialForOrg` takes `inputAgents` and writes `Subscription.selectedAgents`

- [ ] **Step 3: Implement**

Replace `startTrialForOrg` and `createTrialSubscription` (`billing.service.ts:143-202`):

```ts
const TRIAL_DAYS = 7;

/**
 * Starts the org's one-and-only trial: all six agents, 7 days, no card.
 *
 * There is deliberately NO agent selection — the trial is all-or-nothing — and
 * it is once-per-org FOREVER (guarded by trialStartedAt, not by whether a trial
 * is currently running). Per-agent or repeatable trials would be farmable into
 * ~6 weeks of free access by staggering agents, with Maya's 30 credits the
 * obvious target and orgs free to create.
 */
export async function startTrialForOrg(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { trialStartedAt: true },
  });
  if (!org) throw new BadRequestError("no-organization");
  if (org.trialStartedAt) throw new ConflictError("trial-already-used");

  // Ensure the Dodo customer exists now so later checkout has one to attach to.
  await ensureBillingCustomerForOrg(organizationId);

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.entitlement.createMany({
      data: ALL_AGENTS.map((agent) => ({
        organizationId,
        agent,
        source: "TRIAL" as const,
        status: "TRIALING" as const,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        priceCents: 0,
      })),
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: { trialStartedAt: now },
    });
    await tx.mayaUsage.create({
      data: { organizationId, periodStart: now, periodEnd: trialEndsAt },
    });
  });

  return { trialEndsAt, agents: ALL_AGENTS };
}
```

Delete `startOrExtendTrial` (`billing.service.ts:226-275`) — its entire purpose was keeping the denormalized `Organization` cache in sync with `Subscription`, a problem that no longer exists. Its admin caller (`admin-extend-trial`) must instead extend the trial entitlements directly:

```ts
/** Admin action: push an org's trial out by `days` from now. */
export async function extendTrialForOrg(organizationId: string, days = 7) {
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.entitlement.updateMany({
    where: { organizationId, source: "TRIAL" },
    data: { status: "TRIALING", currentPeriodEnd: trialEndsAt },
  });
  if (count === 0) throw new BadRequestError("no-trial-to-extend");
  return { trialEndsAt };
}
```

> Note this intentionally re-TRIALs rows the sweeper may already have marked `EXPIRED` — that is what "extend an expired trial" means. It does **not** reset `MayaUsage.creditsUsed`, preserving the existing behavior documented at `billing.service.ts:238-243` (extending a trial must not silently hand back credits already spent).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-trial-entitlements.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Update the controller to stop accepting agents**

```ts
// billing.controller.ts — the `agents` body param is gone; trials are all-or-nothing.
export async function startTrial(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const result = await startTrialForOrg(orgId);
  res.status(StatusCodes.CREATED).json({
    status: "TRIALING",
    trialEndsAt: result.trialEndsAt,
    agents: result.agents,
  });
}
```

- [ ] **Step 6: Update the existing trial test and verify**

`src/tests/unit/billing-trial.test.ts` and `src/tests/unit/admin-extend-trial.test.ts` both exercise the old signatures. Update them to the new ones — `startTrialForOrg(orgId)` with no agents, and `extendTrialForOrg` in place of `startOrExtendTrial`.

Run: `cd apps/server && npm test && npx tsc --noEmit`
Expected: PASS

---

## Phase 5: Per-Agent Checkout Flows

Phase 0 established one subscription per checkout. Each agent is bought on its
own, producing its own Dodo subscription anchored on its own purchase date.

### Task 5.1: Single-agent checkout with edge-case guards

**Files:**
- Modify: `apps/server/src/modules/billing/billing.service.ts:277-343`
- Test: `apps/server/src/tests/unit/billing-checkout-guards.test.ts` (create)

**Interfaces:**
- Consumes: `getActiveEntitlements` (Task 4.1), `agentProductId` (Task 1.1), `resumeAgentAutoPay` (Task 7.1)
- Produces: `assertAgentPurchasable(active: ActiveEntitlement[], agent: Agent): void` — throws `ConflictError` with `crew-covers-all-agents` / `already-entitled:<AGENT>`

> **Ordering note:** Step 5 calls `resumeAgentAutoPay`, which Task 7.1 creates.
> Implement Task 7.1 before this step, or stub the resume branch to throw
> `ConflictError("already-entitled:<AGENT>")` and wire it when 7.1 lands.

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/tests/unit/billing-checkout-guards.test.ts`:

```ts
import { assert, describe, test } from "vitest";
import { assertAgentPurchasable } from "../../modules/billing/billing.service.js";

const future = new Date(Date.now() + 10 * 86400_000);
const ent = (agent: string, source: string, extra: Record<string, unknown> = {}) => ({
  agent, source, status: "ACTIVE", currentPeriodEnd: future,
  cancelAtPeriodEnd: false, priceCents: 900, ...extra,
} as never);

describe("assertAgentPurchasable", () => {
  test("buying an un-owned agent is allowed", () => {
    assert.doesNotThrow(() => assertAgentPurchasable([ent("MAYA", "AGENT")], "REX" as never));
  });

  test("buying with nothing owned is allowed", () => {
    assert.doesNotThrow(() => assertAgentPurchasable([], "MAYA" as never));
  });

  test("re-buying an actively owned agent is rejected", () => {
    assert.throws(
      () => assertAgentPurchasable([ent("MAYA", "AGENT")], "MAYA" as never),
      /already-entitled:MAYA/,
    );
  });

  test("buying any agent while Crew is active is rejected", () => {
    assert.throws(
      () => assertAgentPurchasable([ent("REX", "CREW")], "MAYA" as never),
      /crew-covers-all-agents/,
    );
  });

  test("an agent cancelled-but-unexpired is repurchasable (resume, not double-charge)", () => {
    assert.doesNotThrow(
      () => assertAgentPurchasable([ent("MAYA", "AGENT", { cancelAtPeriodEnd: true })], "MAYA" as never),
    );
  });

  test("an agent held only via TRIAL is purchasable (converting to paid)", () => {
    assert.doesNotThrow(
      () => assertAgentPurchasable([ent("MAYA", "TRIAL")], "MAYA" as never),
    );
  });

  test("owning Maya and Sage does not block buying Rex", () => {
    assert.doesNotThrow(
      () => assertAgentPurchasable([ent("MAYA", "AGENT"), ent("SAGE", "AGENT")], "REX" as never),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-checkout-guards.test.ts`
Expected: FAIL — `assertAgentPurchasable is not exported`

- [ ] **Step 3: Implement the guard**

Add to `billing.service.ts`, exported so it is unit-testable without a database:

```ts
type ActiveEntitlement = {
  agent: Agent;
  source: "TRIAL" | "AGENT" | "CREW";
  cancelAtPeriodEnd: boolean;
};

/**
 * Rejects purchases that would double-charge. Pure — takes the already-fetched
 * active entitlements so it can be tested without a database.
 *
 * A TRIAL row does not block purchase (that is the conversion path), and an
 * AGENT row with cancelAtPeriodEnd does not block either — repurchasing is how
 * the user resumes auto-pay, handled charge-free in createCheckoutForOrg.
 */
export function assertAgentPurchasable(active: ActiveEntitlement[], agent: Agent): void {
  if (active.some((e) => e.source === "CREW")) {
    throw new ConflictError("crew-covers-all-agents");
  }
  const blocking = active.find(
    (e) => e.agent === agent && e.source === "AGENT" && !e.cancelAtPeriodEnd,
  );
  if (blocking) throw new ConflictError(`already-entitled:${agent}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-checkout-guards.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Rewrite `createCheckoutForOrg` for a single agent**

Replace `billing.service.ts:277-343` entirely. The `ACTIVE_BILLING_STATUSES` block at line 290 — the guard that caused the reported bug — is **deleted**, and `ACTIVE_BILLING_STATUSES` (line 34) becomes unused and should be removed.

```ts
export async function createCheckoutForOrg(
  organizationId: string,
  input: { agent?: unknown; cadence?: unknown; crew?: boolean },
) {
  const sub = await ensureBillingCustomerForOrg(organizationId);
  const active = await getActiveEntitlements(organizationId);

  if (input.crew) {
    return createCrewCheckout(organizationId, sub, active, normalizePlan(input.cadence));
  }

  // normalizeAgents gives slug ("rex") and enum ("REX") handling plus validation
  // for free; we just require exactly one. Dodo rejects multi-subscription carts
  // (422), so buying several agents is several checkouts, not one.
  const agent = normalizeAgents([input.agent])[0];
  if (!agent) throw new BadRequestError("agent-required");

  // Resuming a cancelled-but-unexpired agent must NOT create a second
  // subscription — the user already has one, it is merely flagged to stop.
  const resumable = active.find(
    (e) => e.agent === agent && e.source === "AGENT" && e.cancelAtPeriodEnd,
  );
  if (resumable) {
    await resumeAgentAutoPay(organizationId, agent);
    return { resumed: true as const, url: null };
  }

  assertAgentPurchasable(active, agent);

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  const session = await dodoClient.checkoutSessions.create({
    product_cart: [{ product_id: agentProductId(agent), quantity: 1 }],
    customer: { customer_id: sub.dodoCustomerId } as never,
    // Second and later purchases reuse the card saved on the first, so only the
    // first checkout requires card entry.
    show_saved_payment_methods: true,
    return_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=cancelled`,
    metadata: { organizationId, kind: "AGENT", agent },
  });

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");
  await prisma.pendingCheckout.create({
    data: { organizationId, sessionId: session.session_id, kind: "AGENT", agent, plan: "MONTHLY" },
  });
  return { resumed: false as const, url: session.checkout_url };
}
```

> **Why resume short-circuits before `assertAgentPurchasable`:** the guard
> deliberately lets a cancelled-but-unexpired agent through so the user can
> re-enable it — but sending them to Dodo would mint a *second* subscription for
> an agent they already pay for. Flipping `cancel_at_next_billing_date` back off
> is the correct, charge-free action.

Add the `PendingCheckout` model to `schema.prisma` (replacing the six `pending*` columns on `Subscription`, which drop in Phase 12) and migrate it with the same `migrate diff` + `migrate deploy` procedure from Task 3.1:

```prisma
enum CheckoutKind { AGENT  CREW  CREW_UPGRADE }

/// A checkout awaiting provider confirmation. Replaces Subscription.pending*.
/// Holds a SINGLE agent: Dodo permits one subscription per checkout.
model PendingCheckout {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sessionId      String       @unique
  kind           CheckoutKind
  agent          Agent?       // null for CREW / CREW_UPGRADE
  plan           SubscriptionPlan
  discountCode   String?
  createdAt      DateTime     @default(now())

  @@index([organizationId, createdAt])
  @@map("pending_checkout")
}
```

Add `pendingCheckouts PendingCheckout[]` to `Organization`.

- [ ] **Step 6: Update the controller**

```ts
// billing.controller.ts
export async function createCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const checkout = await createCheckoutForOrg(orgId, {
    agent: req.body?.agent,
    cadence: req.body?.cadence,
    crew: req.body?.crew,
  });
  res.status(StatusCodes.OK).json(checkout);
}
```

- [ ] **Step 7: Verify**

Run: `cd apps/server && npm test && npx tsc --noEmit`
Expected: PASS

### Task 5.2: Crew checkout and the credited upgrade

**Files:**
- Modify: `apps/server/src/modules/billing/billing.service.ts`
- Modify: `apps/server/src/modules/billing/billing.controller.ts`
- Modify: `apps/server/src/modules/billing/billing.routes.ts`

**Interfaces:**
- Consumes: `quoteCrewUpgrade` (Task 1.2), `getActiveEntitlements` (Task 4.1)
- Produces: `getUpgradeQuoteForOrg(organizationId, plan): Promise<UpgradeQuote>`, `createCrewCheckout(...)`

- [ ] **Step 1: Implement the quote endpoint**

```ts
import { quoteCrewUpgrade, type UpgradeQuote } from "./billing.upgrade.js";

/**
 * Prices a Crew upgrade from the org's live entitlements. Credit uses each
 * row's stored priceCents (what was actually paid), never today's list price,
 * so a catalog change cannot retroactively move an existing customer's credit.
 */
export async function getUpgradeQuoteForOrg(
  organizationId: string,
  plan: SubscriptionPlan,
): Promise<UpgradeQuote> {
  const active = await getActiveEntitlements(organizationId);
  if (active.some((e) => e.source === "CREW")) {
    return { eligible: false, creditCents: 0, reason: "already-on-crew" };
  }
  const owned = active.filter((e) => e.source === "AGENT").map((e) => e.priceCents);
  return quoteCrewUpgrade(owned, plan);
}
```

Controller + route:

```ts
// billing.controller.ts
export async function getUpgradeQuote(req: Request, res: Response) {
  const organizationId = req.organizationId;
  if (!organizationId) throw new BadRequestError("No active organization selected");
  const plan = normalizePlan(req.query.cadence ?? "MONTHLY");
  res.status(StatusCodes.OK).json(await getUpgradeQuoteForOrg(organizationId, plan));
}
```

```ts
// billing.routes.ts
router.get("/upgrade-quote", (req, res, next) => getUpgradeQuote(req, res).catch(next));
```

- [ ] **Step 2: Implement Crew checkout with the single-cycle discount**

```ts
async function createCrewCheckout(
  organizationId: string,
  sub: { dodoCustomerId: string },
  active: Array<{ source: string; priceCents: number }>,
  plan: SubscriptionPlan,
) {
  const owned = active.filter((e) => e.source === "AGENT").map((e) => e.priceCents);
  const quote = quoteCrewUpgrade(owned, plan);

  let discountCode: string | undefined;
  if (quote.eligible) {
    // Dodo supports percentage discounts only (UNSUPPORTED_DISCOUNT_TYPE for
    // flat amounts). subscription_cycles:1 confines it to the first cycle, so
    // renewals bill full price without any action from us.
    const discount = await dodoClient.discounts.create({
      type: "percentage",
      amount: quote.discountBasisPoints,
      name: `Crew upgrade credit — org ${organizationId}`,
      usage_limit: 1,
      subscription_cycles: 1,
      restricted_to: [crewProductId(plan)],
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    discountCode = discount.code;
  }

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  const session = await dodoClient.checkoutSessions.create({
    product_cart: [{ product_id: crewProductId(plan), quantity: 1 }],
    customer: { customer_id: sub.dodoCustomerId } as never,
    return_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=cancelled`,
    ...(discountCode ? { discount_code: discountCode } : {}),
    metadata: {
      organizationId,
      kind: quote.eligible ? "CREW_UPGRADE" : "CREW",
      plan,
    },
  });

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");
  await prisma.pendingCheckout.create({
    data: {
      organizationId,
      sessionId: session.session_id,
      kind: quote.eligible ? "CREW_UPGRADE" : "CREW",
      agents: ALL_AGENTS,
      plan,
      discountCode,
    },
  });
  return { url: session.checkout_url };
}
```

- [ ] **Step 3: Verify against Dodo test mode end to end**

Buy Maya, then Rex, then upgrade to Crew. Confirm the checkout page shows **$11.00**, and that the resulting subscription's next invoice previews at **$39.00**.

Run: `cd apps/server && npx tsc --noEmit && npm test`
Expected: PASS

---

## Phase 6: Webhook Write Path

### Task 6.1: Provision entitlements from webhooks

**Files:**
- Modify: `apps/server/src/modules/billing/billing.webhooks.ts`
- Test: `apps/server/src/tests/unit/billing-webhook-provision.test.ts` (create)

- [ ] **Step 1: Write the failing test**

The regression that matters most is defect 2 — buying Rex must not erase Maya.

```ts
import { assert, beforeEach, describe, test, vi } from "vitest";

let ents: Array<Record<string, unknown>> = [];
let billingSubs: Array<Record<string, unknown>> = [];

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async () => ents),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      ents.push(data); return data;
    }),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      ents.push(...data); return { count: data.length };
    }),
    updateMany: vi.fn(async ({ where, data }: never) => {
      const w = where as { billingSubscriptionId?: string };
      for (const e of ents) if (e.billingSubscriptionId === w.billingSubscriptionId) Object.assign(e, data);
      return { count: 1 };
    }),
  },
  billingSubscription: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `bs_${billingSubs.length + 1}`, ...data };
      billingSubs.push(row); return row;
    }),
    findUnique: vi.fn(async ({ where }: { where: { dodoSubscriptionId: string } }) =>
      billingSubs.find((b) => b.dodoSubscriptionId === where.dodoSubscriptionId) ?? null),
  },
  pendingCheckout: { findUnique: vi.fn(), delete: vi.fn() },
  billingWebhookEvent: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(async (fn: never) => (fn as (tx: unknown) => unknown)(mockPrisma)),
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { applyAgentActivation } = await import("../../modules/billing/billing.webhooks.js");

beforeEach(() => { ents = []; billingSubs = []; vi.clearAllMocks(); });

describe("applyAgentActivation", () => {
  test("REGRESSION: buying Rex does not erase Maya", async () => {
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",
              currentPeriodEnd: new Date(Date.now() + 20 * 86400_000), billingSubscriptionId: "bs_maya" }];

    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: new Date(Date.now() + 30 * 86400_000),
    });

    const agents = ents.map((e) => e.agent).sort();
    assert.deepEqual(agents, ["MAYA", "REX"], "Maya must survive Rex's purchase");
  });

  test("Maya and Rex keep independent period ends", async () => {
    const mayaEnd = new Date(Date.now() + 20 * 86400_000);
    const rexEnd  = new Date(Date.now() + 30 * 86400_000);
    ents = [{ organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",
              currentPeriodEnd: mayaEnd, billingSubscriptionId: "bs_maya" }];

    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: rexEnd,
    });

    const maya = ents.find((e) => e.agent === "MAYA")!;
    const rex  = ents.find((e) => e.agent === "REX")!;
    assert.equal((maya.currentPeriodEnd as Date).getTime(), mayaEnd.getTime());
    assert.equal((rex.currentPeriodEnd  as Date).getTime(), rexEnd.getTime());
  });

  test("stamps the price paid for each agent", async () => {
    process.env.AGENT_PRICE_REX_MONTHLY_CENTS = "900";
    await applyAgentActivation({
      organizationId: "o1", dodoSubscriptionId: "sub_rex",
      agent: "REX" as never, periodEnd: new Date(Date.now() + 30 * 86400_000),
    });
    assert.equal(ents[0].priceCents, 900);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-webhook-provision.test.ts`
Expected: FAIL — `applyAgentActivation is not exported`

- [ ] **Step 3: Implement**

```ts
/**
 * Provisions the entitlement for a newly-activated single-agent subscription.
 *
 * Crucially this only ADDS a row for THIS agent. The old handler wrote
 * Subscription.selectedAgents wholesale, so a second purchase erased the first.
 *
 * One agent per subscription is a platform constraint, not a choice: Dodo
 * rejects multi-subscription carts (422, verified Phase 0).
 */
export async function applyAgentActivation(input: {
  organizationId: string;
  dodoSubscriptionId: string;
  agent: Agent;
  periodEnd: Date;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const bs = await tx.billingSubscription.create({
      data: {
        organizationId: input.organizationId,
        dodoSubscriptionId: input.dodoSubscriptionId,
        plan: "MONTHLY", // individual agents are MONTHLY-only by design
        status: "ACTIVE",
        currentPeriodEnd: input.periodEnd,
      },
    });
    await tx.entitlement.create({
      data: {
        organizationId: input.organizationId,
        agent: input.agent,
        source: "AGENT",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: input.periodEnd,
        priceCents: getAgentMonthlyPriceCents(input.agent),
        billingSubscriptionId: bs.id,
      },
    });
    return bs;
  });
}

/**
 * Provisions Crew: six CREW rows, and supersedes any AGENT rows the upgrade
 * credited. Their Dodo subs are told to stop at period end so the customer is
 * never charged twice — the already-paid time is what the upgrade discount
 * credited them for.
 *
 * SUPERSEDED (not delete) keeps this reversible if the Crew payment is later
 * refunded or reversed.
 */
export async function applyCrewActivation(input: {
  organizationId: string;
  dodoSubscriptionId: string;
  plan: SubscriptionPlan;
  periodEnd: Date;
}) {
  const now = new Date();
  const perAgentCents = Math.floor(getCrewPriceCents(input.plan) / ALL_AGENTS.length);

  const superseded = await prisma.$transaction(async (tx) => {
    const bs = await tx.billingSubscription.create({
      data: {
        organizationId: input.organizationId,
        dodoSubscriptionId: input.dodoSubscriptionId,
        plan: input.plan,
        status: "ACTIVE",
        currentPeriodEnd: input.periodEnd,
      },
    });

    const priorAgentRows = await tx.entitlement.findMany({
      where: {
        organizationId: input.organizationId,
        source: "AGENT",
        status: { in: ["ACTIVE", "PAST_DUE"] },
        currentPeriodEnd: { gt: now },
      },
      select: { id: true, billingSubscriptionId: true },
    });

    await tx.entitlement.createMany({
      data: ALL_AGENTS.map((agent) => ({
        organizationId: input.organizationId,
        agent,
        source: "CREW" as const,
        status: "ACTIVE" as const,
        currentPeriodStart: now,
        currentPeriodEnd: input.periodEnd,
        priceCents: perAgentCents,
        billingSubscriptionId: bs.id,
      })),
    });

    await tx.entitlement.updateMany({
      where: { id: { in: priorAgentRows.map((r) => r.id) } },
      data: { status: "SUPERSEDED" },
    });

    return [...new Set(priorAgentRows.map((r) => r.billingSubscriptionId).filter(Boolean))] as string[];
  });

  // Stop the superseded subs at their period end. Outside the transaction:
  // these are external calls and must not hold a DB lock. Failure here is
  // recoverable (the reconciler retries) and must not roll back the Crew grant
  // the customer has already paid for.
  for (const bsId of superseded) {
    const bs = await prisma.billingSubscription.findUnique({ where: { id: bsId } });
    if (!bs) continue;
    await dodoClient.subscriptions
      .update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: true })
      .catch((e) => console.error("[billing] failed to stop superseded sub", bs.dodoSubscriptionId, e));
    await prisma.billingSubscription.update({
      where: { id: bsId }, data: { cancelAtPeriodEnd: true },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-webhook-provision.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Dispatch `handleSubscriptionActive` to the right provisioner**

Nothing calls `applyAgentActivation` / `applyCrewActivation` yet. Rewrite `handleSubscriptionActive` (`billing.webhooks.ts:98-162`) to resolve the intent from the `PendingCheckout` row written at checkout time, falling back to product-id resolution when the row is missing (an unlikely-but-possible race where the webhook beats our own write).

```ts
export async function handleSubscriptionActive(payload: WebhookPayload) {
  const dodoSubId = payload.data.subscription_id;
  const periodEnd = parsePeriodEnd(payload.data);
  const orgId = findOrgIdFromPayload(payload)
    ?? (await findOrgIdByCustomer(payload.data.customer?.customer_id));

  if (!orgId || !dodoSubId || !periodEnd) {
    console.warn("[billing] active webhook: unresolved", {
      orgId, dodoSubId, hasPeriodEnd: Boolean(periodEnd),
    });
    return;
  }

  await withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, orgId, async () => {
    // Idempotency beyond the event ledger: if this Dodo sub is already
    // provisioned, a replay must not create a second BillingSubscription.
    const existing = await prisma.billingSubscription.findUnique({
      where: { dodoSubscriptionId: dodoSubId },
    });
    if (existing) return "ignored-already-provisioned";

    const sessionId = payload.data.metadata?.checkout_session_id;
    const pending = sessionId
      ? await prisma.pendingCheckout.findUnique({ where: { sessionId } })
      : null;

    const kind = pending?.kind
      ?? (payload.data.metadata?.kind as "AGENT" | "CREW" | "CREW_UPGRADE" | undefined)
      ?? (payload.data.product_id && resolveCrewPlanFromProductId(payload.data.product_id)
            ? "CREW" : "AGENT");

    if (kind === "CREW" || kind === "CREW_UPGRADE") {
      const plan = pending?.plan
        ?? (payload.data.product_id ? resolveCrewPlanFromProductId(payload.data.product_id) : null)
        ?? "MONTHLY";
      await applyCrewActivation({ organizationId: orgId, dodoSubscriptionId: dodoSubId, plan, periodEnd });
    } else {
      // Prefer the agent we recorded at checkout; fall back to the product id on
      // the payload. Never fall back to a default agent.
      const agent = pending?.agent
        ?? (payload.data.product_id ? resolveAgentFromProductId(payload.data.product_id) : null);

      if (!agent) return "ignored-unresolved-agent";

      await applyAgentActivation({
        organizationId: orgId,
        dodoSubscriptionId: dodoSubId,
        agent,
        periodEnd,
      });
    }

    if (pending) {
      await prisma.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});
    }
    return kind === "AGENT" ? "applied-agent" : "applied-crew";
  });
}
```

> **Why `return "ignored-unresolved-agent"` instead of defaulting:** a defensive default here would silently grant the wrong agent, or every agent for the price of one. Failing closed and alerting is the correct trade — the customer's payment is already captured, so support can provision manually, whereas an over-grant is invisible revenue loss.

- [ ] **Step 6: Rewrite renewal, cancellation, and dunning to be per-subscription**

```ts
export async function handleSubscriptionRenewed(payload: WebhookPayload) {
  const periodEnd = parsePeriodEnd(payload.data);
  const dodoSubId = payload.data.subscription_id;
  if (!dodoSubId || !periodEnd) return;

  await withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, null, async () => {
    const bs = await prisma.billingSubscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
    if (!bs) return "ignored-unknown-subscription";
    // Out-of-order guard: never move a period backwards.
    if (periodEnd <= bs.currentPeriodEnd) return "ignored-stale-period";

    await prisma.$transaction([
      prisma.billingSubscription.update({
        where: { id: bs.id },
        data: { status: "ACTIVE", currentPeriodEnd: periodEnd },
      }),
      // Only THIS subscription's agents move. Other agents are untouched.
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
        data: { status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: periodEnd },
      }),
    ]);
    return "applied-renewed";
  });
}

export async function handlePaymentFailed(payload: WebhookPayload) {
  const dodoSubId = payload.data.subscription_id;
  if (!dodoSubId) return;
  await withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, null, async () => {
    const bs = await prisma.billingSubscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
    if (!bs) return "ignored-unknown-subscription";
    // Scope the failure to THIS subscription's agents only. The old handler set
    // the whole org PAST_DUE, killing all six agents over one bad card.
    await prisma.$transaction([
      prisma.billingSubscription.update({ where: { id: bs.id }, data: { status: "PAST_DUE" } }),
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: "ACTIVE" },
        data: { status: "PAST_DUE" },
      }),
    ]);
    return "applied-payment-failed";
  });
}
```

`handleSubscriptionFailed` and `handleSubscriptionExpired` follow the same shape, setting `EXPIRED` scoped to `billingSubscriptionId: bs.id`.

- [ ] **Step 7: Verify**

Run: `cd apps/server && npm test && npx tsc --noEmit`
Expected: PASS

---

## Phase 7: Per-Agent Cancel & Resume

### Task 7.1: Cancel and resume auto-pay for one agent

**Files:**
- Create: `apps/server/src/modules/billing/billing.cancel.ts`
- Modify: `apps/server/src/modules/billing/billing.controller.ts`, `billing.routes.ts`
- Test: `apps/server/src/tests/unit/billing-cancel.test.ts` (create)

**Interfaces:**
- Produces: `cancelAgentAutoPay(organizationId: string, agent: Agent): Promise<{ activeUntil: Date }>`, `resumeAgentAutoPay(organizationId: string, agent: Agent): Promise<{ renewsOn: Date }>`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, beforeEach, describe, test, vi } from "vitest";

let ents: Array<Record<string, unknown>> = [];
const dodoUpdate = vi.fn(async () => ({}));

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async ({ where }: never) => {
      const w = where as { organizationId: string; agent?: string };
      return ents.filter((e) => e.organizationId === w.organizationId && (!w.agent || e.agent === w.agent));
    }),
    updateMany: vi.fn(async ({ where, data }: never) => {
      const w = where as { billingSubscriptionId?: string };
      for (const e of ents) if (e.billingSubscriptionId === w.billingSubscriptionId) Object.assign(e, data);
      return { count: 1 };
    }),
  },
  billingSubscription: {
    findUnique: vi.fn(async () => ({ id: "bs_1", dodoSubscriptionId: "sub_1" })),
    update: vi.fn(async () => ({})),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../lib/dodo.js", () => ({ dodoClient: { subscriptions: { update: dodoUpdate } } }));

const { cancelAgentAutoPay, resumeAgentAutoPay } =
  await import("../../modules/billing/billing.cancel.js");

const future = new Date(Date.now() + 12 * 86400_000);
beforeEach(() => {
  ents = [{ id: "e1", organizationId: "o1", agent: "REX", source: "AGENT", status: "ACTIVE",
            currentPeriodEnd: future, cancelAtPeriodEnd: false, billingSubscriptionId: "bs_1" }];
  vi.clearAllMocks();
});

describe("cancelAgentAutoPay", () => {
  test("flags the entitlement and tells Dodo to stop at period end", async () => {
    const out = await cancelAgentAutoPay("o1", "REX" as never);
    assert.equal(out.activeUntil.getTime(), future.getTime());
    assert.equal(ents[0].cancelAtPeriodEnd, true);
    assert.deepEqual(dodoUpdate.mock.calls[0], ["sub_1", { cancel_at_next_billing_date: true }]);
  });

  test("access is retained until period end (status stays ACTIVE, not EXPIRED)", async () => {
    await cancelAgentAutoPay("o1", "REX" as never);
    assert.equal(ents[0].status, "ACTIVE", "cancelling auto-pay must not revoke paid-for access");
  });

  test("cancelling an agent the org does not own is rejected", async () => {
    await assert.isRejected?.(cancelAgentAutoPay("o1", "MAYA" as never)) ??
      await cancelAgentAutoPay("o1", "MAYA" as never).then(
        () => assert.fail("should have thrown"),
        (e) => assert.match(String(e), /not-entitled:MAYA/),
      );
  });

  test("a TRIAL entitlement has no auto-pay to cancel", async () => {
    ents[0].source = "TRIAL";
    ents[0].billingSubscriptionId = null;
    await cancelAgentAutoPay("o1", "REX" as never).then(
      () => assert.fail("should have thrown"),
      (e) => assert.match(String(e), /no-subscription-for-agent/),
    );
  });
});

describe("resumeAgentAutoPay", () => {
  test("clears the flag and tells Dodo to keep billing", async () => {
    ents[0].cancelAtPeriodEnd = true;
    const out = await resumeAgentAutoPay("o1", "REX" as never);
    assert.equal(out.renewsOn.getTime(), future.getTime());
    assert.equal(ents[0].cancelAtPeriodEnd, false);
    assert.deepEqual(dodoUpdate.mock.calls[0], ["sub_1", { cancel_at_next_billing_date: false }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-cancel.test.ts`
Expected: FAIL — cannot find module `billing.cancel.js`

- [ ] **Step 3: Implement**

```ts
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { Agent } from "../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { ACCESS_STATUSES } from "./entitlement.service.js";

async function resolveAgentSubscription(organizationId: string, agent: Agent) {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId, agent,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
  });
  const row = rows[0];
  if (!row) throw new BadRequestError(`not-entitled:${agent}`);
  if (!row.billingSubscriptionId) throw new BadRequestError("no-subscription-for-agent");
  const bs = await prisma.billingSubscription.findUnique({ where: { id: row.billingSubscriptionId } });
  if (!bs) throw new BadRequestError("no-subscription-for-agent");
  return { row, bs };
}

/**
 * Stops auto-pay for one agent without touching any other agent.
 *
 * Access is deliberately retained to currentPeriodEnd — the period is already
 * paid for. Only the renewal is cancelled. The sweeper expires the row when
 * the period lapses.
 */
export async function cancelAgentAutoPay(organizationId: string, agent: Agent) {
  const { row, bs } = await resolveAgentSubscription(organizationId, agent);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: true });

  await prisma.$transaction([
    prisma.entitlement.updateMany({
      where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { cancelAtPeriodEnd: true },
    }),
    prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: true } }),
  ]);

  return { activeUntil: row.currentPeriodEnd };
}

export async function resumeAgentAutoPay(organizationId: string, agent: Agent) {
  const { row, bs } = await resolveAgentSubscription(organizationId, agent);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: false });

  await prisma.$transaction([
    prisma.entitlement.updateMany({
      where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { cancelAtPeriodEnd: false },
    }),
    prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: false } }),
  ]);

  return { renewsOn: row.currentPeriodEnd };
}
```

> **Why `updateMany` by `billingSubscriptionId` is correct here:** an `AGENT`
> subscription bills exactly one entitlement (one checkout = one subscription,
> Phase 0), so this can only ever touch the agent being cancelled. For a `CREW`
> subscription it correctly flags all six — cancelling Crew stops the bundle.
> There is no shared-subscription case in which it could over-cancel.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/billing-cancel.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire routes**

```ts
// billing.routes.ts
router.post("/agents/:agent/cancel", (req, res, next) => cancelAgent(req, res).catch(next));
router.post("/agents/:agent/resume", (req, res, next) => resumeAgent(req, res).catch(next));
```

```ts
// billing.controller.ts — both must go through requireOrgOwner
export async function cancelAgent(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const [agent] = normalizeAgents([req.params.agent]);
  res.status(StatusCodes.OK).json(await cancelAgentAutoPay(orgId, agent));
}

export async function resumeAgent(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const [agent] = normalizeAgents([req.params.agent]);
  res.status(StatusCodes.OK).json(await resumeAgentAutoPay(orgId, agent));
}
```

Reusing `normalizeAgents` gives slug (`rex`) and enum (`REX`) handling plus validation for free.

---

## Phase 8: Credits Rework

### Task 8.1: Monthly credit periods anchored on Maya

**Files:**
- Modify: `apps/server/src/modules/agents/maya/maya.usage.service.ts`
- Create: `apps/server/src/modules/agents/maya/maya.period.ts`
- Test: `apps/server/src/tests/unit/maya-period.test.ts` (create)

**Interfaces:**
- Produces: `currentCreditWindow(anchor: Date, now: Date): { periodStart: Date; periodEnd: Date }`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, describe, test } from "vitest";
import { currentCreditWindow } from "../../modules/agents/maya/maya.period.js";

describe("currentCreditWindow", () => {
  test("inside the first month → window is anchor → anchor+1mo", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-20T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-01-10T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-02-10T00:00:00.000Z");
  });

  test("ANNUAL: credits roll monthly even though billing is yearly", () => {
    // 5 months into an annual plan the window is the 6th month, NOT the year.
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-06-15T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-06-10T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-07-10T00:00:00.000Z");
  });

  test("anchored on the 31st, a 30-day month clamps to the last day", () => {
    const w = currentCreditWindow(new Date("2026-01-31T00:00:00Z"), new Date("2026-04-15T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-03-31T00:00:00.000Z");
    assert.equal(w.periodEnd.toISOString(),   "2026-04-30T00:00:00.000Z");
  });

  test("exactly on a boundary starts the new window", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-02-10T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-02-10T00:00:00.000Z");
  });

  test("now before anchor → the anchor window (clock skew must not go negative)", () => {
    const w = currentCreditWindow(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-09T00:00:00Z"));
    assert.equal(w.periodStart.toISOString(), "2026-01-10T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/maya-period.test.ts`
Expected: FAIL — cannot find module `maya.period.js`

- [ ] **Step 3: Implement**

```ts
/**
 * The 1-month credit window containing `now`, anchored on Maya's entitlement
 * start.
 *
 * Deliberately decoupled from the billing period: an ANNUAL plan bills once a
 * year but its credits still reset monthly. The previous code set the usage
 * period to the billing period, so annual customers got one allowance for the
 * entire year.
 *
 * Anchors past the 28th clamp to the target month's last day (Jan 31 → Feb 28),
 * matching how calendar-anniversary billing behaves everywhere.
 */
export function currentCreditWindow(anchor: Date, now: Date): { periodStart: Date; periodEnd: Date } {
  const monthsElapsed = Math.max(
    0,
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth()) -
      (dayOfMonthBefore(now, anchor) ? 1 : 0),
  );
  return {
    periodStart: addMonthsClamped(anchor, monthsElapsed),
    periodEnd:   addMonthsClamped(anchor, monthsElapsed + 1),
  };
}

function dayOfMonthBefore(now: Date, anchor: Date): boolean {
  const anchorDom = anchor.getUTCDate();
  const nowDom = now.getUTCDate();
  const lastDomThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  // If the anchor day doesn't exist this month, the clamped boundary is the
  // last day — so we're only "before" it if we haven't reached that day.
  const effectiveAnchorDom = Math.min(anchorDom, lastDomThisMonth);
  return nowDom < effectiveAnchorDom;
}

function addMonthsClamped(base: Date, months: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + months;
  const lastDom = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year, month, Math.min(base.getUTCDate(), lastDom),
    base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds(),
  ));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/maya-period.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Rewire the usage service onto entitlements**

In `maya.usage.service.ts`, replace every `prisma.subscription.findUnique(...)` + `getTierFromSubscription(sub)` pair with:

```ts
import { getMayaEntitlement } from "../../billing/entitlement.service.js";
import { getQuotaForMayaEntitlement } from "./maya.quotas.js";
import { currentCreditWindow } from "./maya.period.js";

async function resolveMayaWindow(organizationId: string) {
  const ent = await getMayaEntitlement(organizationId);
  if (!ent) throw new BadRequestError("maya-not-entitled");

  // The quota is read LIVE from the entitlement rather than snapshotted onto
  // the period. A mid-period upgrade therefore raises the ceiling on the open
  // window: no reset, so the user loses nothing and nobody can refill by
  // upgrading.
  const plan = ent.billingSubscriptionId
    ? (await prisma.billingSubscription.findUnique({
        where: { id: ent.billingSubscriptionId }, select: { plan: true },
      }))?.plan ?? null
    : null;

  const limit = getQuotaForMayaEntitlement({ source: ent.source, plan });
  const { periodStart, periodEnd } = currentCreditWindow(ent.currentPeriodStart, new Date());

  const usage = await prisma.mayaUsage.upsert({
    where: { organizationId_periodStart: { organizationId, periodStart } },
    create: { organizationId, periodStart, periodEnd },
    update: {},
  });

  return { limit, usage, periodStart, periodEnd };
}
```

The `upsert` replaces `ensurePeriod`'s create-and-catch-P2002 dance, and removes its documented "two concurrent requests can both create a row" race — the unique key `[organizationId, periodStart]` now makes the window deterministic rather than `new Date()`-derived.

`getCurrentUsage`, `checkAndDeductCredits`, `adjustCurrentPeriodUsage`, and `rollbackCredits` all call `resolveMayaWindow` and keep their existing `FOR UPDATE` row-locking against `resolvedPeriod.periodStart`.

- [ ] **Step 6: Delete `getTierFromSubscription`**

Remove it from `maya.quotas.ts` along with the `QuotaTier` type and the `QUOTA` record. `getQuotaForMayaEntitlement` supersedes all three.

Update `src/tests/unit/maya-usage.test.ts`, whose mock returns `subscription.findUnique` — it must now mock `entitlement.findMany`.

- [ ] **Step 7: Verify**

Run: `cd apps/server && npm test && npx tsc --noEmit`
Expected: PASS

---

## Phase 9: Expiry Sweeper

### Task 9.1: Implement the sweeper

**Files:**
- Modify: `apps/server/src/jobs/paymentRetry.job.ts` (currently a `// TODO` stub)
- Test: `apps/server/src/tests/unit/entitlement-sweeper.test.ts` (create)

**Interfaces:**
- Produces: `sweepExpiredEntitlements(now?: Date): Promise<{ expired: number }>`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, beforeEach, describe, test, vi } from "vitest";

let ents: Array<Record<string, unknown>> = [];
const mockPrisma = {
  entitlement: {
    updateMany: vi.fn(async ({ where, data }: never) => {
      const w = where as { currentPeriodEnd: { lt: Date }; status: { in: string[] } };
      let count = 0;
      for (const e of ents) {
        if ((e.currentPeriodEnd as Date) < w.currentPeriodEnd.lt && w.status.in.includes(e.status as string)) {
          Object.assign(e, data); count++;
        }
      }
      return { count };
    }),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { sweepExpiredEntitlements } = await import("../../jobs/paymentRetry.job.js");

const past   = new Date(Date.now() - 86400_000);
const future = new Date(Date.now() + 86400_000);

beforeEach(() => { ents = []; vi.clearAllMocks(); });

describe("sweepExpiredEntitlements", () => {
  test("lapsed rows become EXPIRED", async () => {
    ents = [{ agent: "MAYA", status: "ACTIVE", currentPeriodEnd: past }];
    const out = await sweepExpiredEntitlements();
    assert.equal(out.expired, 1);
    assert.equal(ents[0].status, "EXPIRED");
  });

  test("unexpired rows are untouched", async () => {
    ents = [{ agent: "MAYA", status: "ACTIVE", currentPeriodEnd: future }];
    await sweepExpiredEntitlements();
    assert.equal(ents[0].status, "ACTIVE");
  });

  test("only the lapsed agent expires — others are independent", async () => {
    ents = [
      { agent: "MAYA", status: "ACTIVE", currentPeriodEnd: past },
      { agent: "REX",  status: "ACTIVE", currentPeriodEnd: future },
    ];
    await sweepExpiredEntitlements();
    assert.equal(ents[0].status, "EXPIRED");
    assert.equal(ents[1].status, "ACTIVE");
  });

  test("SUPERSEDED rows are left alone (not resurrected as EXPIRED)", async () => {
    ents = [{ agent: "MAYA", status: "SUPERSEDED", currentPeriodEnd: past }];
    await sweepExpiredEntitlements();
    assert.equal(ents[0].status, "SUPERSEDED");
  });

  test("is idempotent — a second run expires nothing new", async () => {
    ents = [{ agent: "MAYA", status: "ACTIVE", currentPeriodEnd: past }];
    await sweepExpiredEntitlements();
    const out = await sweepExpiredEntitlements();
    assert.equal(out.expired, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/tests/unit/entitlement-sweeper.test.ts`
Expected: FAIL — `sweepExpiredEntitlements is not exported`

- [ ] **Step 3: Implement**

Replace the contents of `paymentRetry.job.ts`:

```ts
import { prisma } from "../config/prisma.js";

/**
 * Flips lapsed entitlements to EXPIRED.
 *
 * Scope note: this is for REPORTING accuracy, not access control. The access
 * check already tests `currentPeriodEnd > now`, so a missed webhook cannot
 * extend access even if this job never runs. Defense in depth.
 *
 * SUPERSEDED is excluded — those rows were retired by a Crew upgrade and must
 * keep that status as an audit trail.
 */
export async function sweepExpiredEntitlements(now = new Date()): Promise<{ expired: number }> {
  const { count } = await prisma.entitlement.updateMany({
    where: {
      currentPeriodEnd: { lt: now },
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
    },
    data: { status: "EXPIRED" },
  });
  if (count > 0) console.log(`[billing] sweeper expired ${count} entitlement(s)`);
  return { expired: count };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run src/tests/unit/entitlement-sweeper.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Schedule it**

Register on the existing BullMQ setup in `src/queues/bullmq.ts`, following the pattern already used by `cleanup.job.ts`, with a repeat of every 15 minutes. Rename the file to `entitlementSweeper.job.ts` — "paymentRetry" no longer describes it, and Dodo drives payment retries natively.

---

## Phase 10: Billing Page

### Task 10.1: Per-agent billing API client

**Files:**
- Modify: `apps/main/src/lib/api/billing.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AgentEntitlement = {
    agent: BillingAgent;
    source: "TRIAL" | "AGENT" | "CREW";
    status: "TRIALING" | "ACTIVE" | "PAST_DUE";
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    priceCents: number;
  };
  export type UpgradeQuoteResponse =
    | { eligible: true;  creditCents: number; payNowCents: number }
    | { eligible: false; creditCents: number; reason: string };

  export function useEntitlements(organizationId?: string | null);
  export function useUpgradeQuote(organizationId?: string | null, cadence?: SubscriptionPlan);
  export function cancelAgent(agent: BillingAgent): Promise<{ activeUntil: string }>;
  export function resumeAgent(agent: BillingAgent): Promise<{ renewsOn: string }>;
  ```

- [ ] **Step 1: Extend `GET /billing/status` additively**

Add `entitlements: AgentEntitlement[]` to the response **without removing** `selectedAgents`, `unlockedAgents`, `entitlementMode`, `plan`, or `currentPeriodEnd`. The old page keeps rendering while the new one is built; the legacy fields are derived from entitlements server-side:

```ts
// billing.controller.ts — getStatus
const active = await getActiveEntitlements(organizationId);
const isCrew = active.some((e) => e.source === "CREW");
res.status(StatusCodes.OK).json({
  subscription: {
    // ...legacy fields, now derived rather than read from Subscription:
    unlockedAgents: [...new Set(active.map((e) => e.agent))],
    selectedAgents: [...new Set(active.map((e) => e.agent))],
    entitlementMode: isCrew ? "CREW" : "CUSTOM",
    currentPeriodEnd: active.length
      ? new Date(Math.max(...active.map((e) => e.currentPeriodEnd.getTime())))
      : null,
    // ...and the new shape:
    entitlements: active.map((e) => ({
      agent: e.agent, source: e.source, status: e.status,
      currentPeriodEnd: e.currentPeriodEnd, cancelAtPeriodEnd: e.cancelAtPeriodEnd,
      priceCents: e.priceCents,
    })),
  },
});
```

- [ ] **Step 2: Add the client hooks**

```ts
export function useEntitlements(organizationId?: string | null) {
  const { data, ...rest } = useBillingStatus(organizationId);
  return { entitlements: data?.subscription?.entitlements ?? [], ...rest };
}

export function useUpgradeQuote(organizationId?: string | null, cadence: SubscriptionPlan = "MONTHLY") {
  return useQuery({
    queryKey: ["billing", "upgrade-quote", organizationId ?? "none", cadence] as const,
    queryFn: () => apiFetch<UpgradeQuoteResponse>(`/billing/upgrade-quote?cadence=${cadence}`),
    enabled: Boolean(organizationId),
  });
}

export function cancelAgent(agent: BillingAgent) {
  return apiFetch<{ activeUntil: string }>(`/billing/agents/${agent.toLowerCase()}/cancel`, { method: "POST" });
}

export function resumeAgent(agent: BillingAgent) {
  return apiFetch<{ renewsOn: string }>(`/billing/agents/${agent.toLowerCase()}/resume`, { method: "POST" });
}
```

- [ ] **Step 3: Widen `createCheckout` to express a Crew purchase**

The existing signature (`billing.ts:58-66`) takes `{ agents, cadence }` only, so there is no way to say "buy Crew" other than passing all six agents — which the server would have to re-derive. Replace it with a discriminated union matching the server's `input: { agents?, cadence?, crew? }` from Task 5.1:

```ts
export type CheckoutInput =
  | { crew: true;  cadence: SubscriptionPlan; agent?: never }
  | { crew?: false; agent: BillingAgent };

export type CheckoutResult =
  | { resumed: true;  url: null }
  | { resumed: false; url: string };

export function createCheckout(input: CheckoutInput) {
  return apiFetch<CheckoutResult>("/billing/checkout", { method: "POST", body: input });
}
```

The union encodes the model in the type system: an individual purchase names exactly one agent and has no cadence to choose (agents are MONTHLY-only), while Crew names a cadence and never an agent. An annual individual-agent plan — and a multi-agent purchase — become *unrepresentable* rather than merely rejected at runtime.

`CheckoutResult` is a union because buying a cancelled-but-unexpired agent resumes auto-pay instead of charging, returning `url: null`. Callers must handle that branch rather than blindly assigning `window.location.href`:

```ts
const result = await createCheckout({ agent })
if (result.resumed) {
  toast.success(`${agent} will renew again`)
  await refetch()
} else {
  window.location.href = result.url
}
```

### Task 10.2: Rebuild the billing page

**Files:**
- Modify: `apps/main/src/app/(dashboard)/settings/billing/page.tsx` (533 lines)
- Create: `apps/main/src/components/billing/AgentEntitlementRow.tsx`
- Create: `apps/main/src/components/billing/CrewUpgradeCard.tsx`
- Create: `apps/main/src/components/billing/AgentBuyCard.tsx`

> The page is already 533 lines and this adds per-agent state, upgrade quoting, and cancel/resume. Extracting the three components above keeps each file focused — follow the existing `components/billing/UsageBar.tsx` precedent.

- [ ] **Step 1: Create `AgentEntitlementRow`**

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cancelAgent, resumeAgent, type AgentEntitlement } from "@/lib/api/billing"

const AGENT_IMAGES: Record<string, string> = {
  MAYA: "/agents/maya.jpeg", SAGE: "/agents/sage.jpeg", LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg", SCOUT: "/agents/scout.jpeg", VEGA: "/agents/vega.jpeg",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function AgentEntitlementRow({
  entitlement, onChanged,
}: { entitlement: AgentEntitlement; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { agent, source, status, currentPeriodEnd, cancelAtPeriodEnd } = entitlement

  // Crew and trial agents have no independent auto-pay to toggle: Crew is one
  // subscription for all six, and a trial has no subscription at all.
  const togglable = source === "AGENT"

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try { await fn(); toast.success(ok); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong") }
    finally { setBusy(false); setConfirmOpen(false) }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="relative size-10 overflow-hidden rounded-full border bg-muted">
          <Image src={AGENT_IMAGES[agent]} alt={`${agent} portrait`} fill sizes="40px" className="object-cover" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize">{agent.toLowerCase()}</span>
            {source === "TRIAL" && <Badge variant="secondary">Trial</Badge>}
            {source === "CREW" && <Badge variant="secondary">Crew</Badge>}
            {status === "PAST_DUE" && <Badge variant="destructive">Payment failed</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {cancelAtPeriodEnd
              ? `Access until ${formatDate(currentPeriodEnd)}`
              : source === "TRIAL"
                ? `Trial ends ${formatDate(currentPeriodEnd)}`
                : `Renews ${formatDate(currentPeriodEnd)}`}
          </p>
        </div>
      </div>

      {togglable && (
        cancelAtPeriodEnd ? (
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => run(() => resumeAgent(agent), `${agent} will renew again`)}>
            Resume auto-pay
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmOpen(true)}>
              Cancel auto-pay
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel auto-pay for {agent.toLowerCase()}?</AlertDialogTitle>
                  {/* State the exact date: the user keeps the time they already
                      paid for, and must not read this as losing access today. */}
                  <AlertDialogDescription>
                    You&apos;ll keep access until <strong>{formatDate(currentPeriodEnd)}</strong>, the end of
                    the period you&apos;ve already paid for. It won&apos;t renew after that. Your other agents
                    aren&apos;t affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep auto-pay</AlertDialogCancel>
                  <AlertDialogAction disabled={busy}
                    onClick={() => run(() => cancelAgent(agent), `${agent} won't renew`)}>
                    Cancel auto-pay
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `CrewUpgradeCard`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createCheckout, useUpgradeQuote } from "@/lib/api/billing"

function money(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`
}

export function CrewUpgradeCard({ organizationId }: { organizationId?: string | null }) {
  const { data: quote } = useUpgradeQuote(organizationId, "MONTHLY")
  const [busy, setBusy] = useState(false)

  // Only eligible orgs see this at all. Ineligible reasons are deliberately not
  // rendered as an error: "you already own more than Crew costs" is not a
  // failure the user needs to action, and we don't refund the difference.
  if (!quote?.eligible) return null

  async function upgrade() {
    setBusy(true)
    try {
      const { url } = await createCheckout({ crew: true, cadence: "MONTHLY" })
      window.location.href = url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the upgrade")
      setBusy(false)
    }
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Upgrade to the Crew plan
        </CardTitle>
        <CardDescription>
          Get all six agents. We&apos;ll credit everything you&apos;ve already paid for this month.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <dl className="text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Crew plan</dt>
            <dd>{money(quote.payNowCents + quote.creditCents)}/mo</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Agents you already own</dt>
            <dd className="text-green-600">−{money(quote.creditCents)}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-8 border-t pt-1 font-semibold">
            <dt>Due today</dt>
            <dd>{money(quote.payNowCents)}</dd>
          </div>
        </dl>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button onClick={upgrade} disabled={busy}>
            {busy ? "Opening checkout..." : `Upgrade for ${money(quote.payNowCents)}`}
          </Button>
          {/* Never show the discounted figure alone — it would misrepresent the
              recurring price. subscription_cycles:1 means only month one is credited. */}
          <p className="text-xs text-muted-foreground">
            Then {money(quote.payNowCents + quote.creditCents)}/mo from next month.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create `AgentBuyCard`**

Replaces the multi-select cart. Each un-owned agent gets its own card with its
own buy button going straight to that agent's checkout — no basket, no totals,
no batching. This mirrors the platform constraint honestly rather than building
a cart UI that cannot be fulfilled.

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createCheckout, type BillingAgent } from "@/lib/api/billing"
import { AGENTS } from "@/lib/config/agents"

const AGENT_IMAGES: Record<string, string> = {
  MAYA: "/agents/maya.jpeg", SAGE: "/agents/sage.jpeg", LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg", SCOUT: "/agents/scout.jpeg", VEGA: "/agents/vega.jpeg",
}

export function AgentBuyCard({
  agent, priceCents, disabled, disabledReason, onResumed,
}: {
  agent: BillingAgent
  priceCents: number
  disabled?: boolean
  disabledReason?: string
  onResumed?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const meta = AGENTS.find((a) => a.id.toUpperCase() === agent)

  async function buy() {
    setBusy(true)
    try {
      const result = await createCheckout({ agent })
      // A cancelled-but-unexpired agent resumes instead of charging, and returns
      // no URL. Assigning window.location.href = null would navigate to "null".
      if (result.resumed) {
        toast.success(`${meta?.name ?? agent} will renew again`)
        onResumed?.()
        return
      }
      window.location.href = result.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="relative size-12 overflow-hidden rounded-full border bg-muted">
          <Image src={AGENT_IMAGES[agent]} alt={`${meta?.name ?? agent} portrait`}
                 fill sizes="48px" className="object-cover" />
        </div>
        <div>
          <div className="text-sm font-semibold">{meta?.name ?? agent}</div>
          <div className="text-xs text-muted-foreground">{meta?.role}</div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{meta?.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">
          ${priceCents / 100}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">/mo</span>
        </span>
        <Button size="sm" onClick={buy} disabled={busy || disabled}
                title={disabled ? disabledReason : undefined}>
          {busy ? "Opening..." : "Buy"}
        </Button>
      </div>
    </div>
  )
}
```

> **No cadence control and no quantity:** individual agents are MONTHLY-only, and
> one card buys exactly one agent. Both rules are structural here rather than
> validated — there is no control capable of expressing the illegal state.

- [ ] **Step 4: Annual is Crew-only in the UI** — the MONTHLY/ANNUAL toggle lives inside the Crew card only. Delete the `checkoutCadence = crew ? cadence : "MONTHLY"` coercion at `page.tsx:184`; the cart has no cadence to choose.

- [ ] **Step 5: Replace the portal-only management path** — delete `hasPortalManagedSubscription` (`page.tsx:187`) and the "Manage in billing portal" button that currently stands in for cancellation. Keep `handlePortal` solely for invoices/payment-method updates, relabelled "View invoices". Per-agent cancel now lives in-app.

- [ ] **Step 6: Verify the flows by hand**

Run: `cd apps/main && npm run dev`

Walk each case and confirm: buy Maya → buy Rex 10 days later (both rows, different dates) → cancel Rex auto-pay (Rex shows "Access until", Maya unaffected) → upgrade to Crew (quote shows the right delta) → own ≥ $39 (upgrade card absent).

---

## Phase 11: Usage, Dashboard & Admin

### Task 11.1: Per-agent usage page

**Files:**
- Modify: `apps/main/src/app/(dashboard)/settings/usage/page.tsx`
- Create: `apps/main/src/components/billing/AgentPeriodList.tsx`

- [ ] **Step 1: Add the per-agent period list** — each entitled agent with its own period, expiry, and cadence, sourced from `useEntitlements()`.

- [ ] **Step 2: Fix the now-wrong billing cycle label** — `usage/page.tsx:46-55` derives one org-wide `billingCycleLabel`/`billingCycleDate` from `sub.plan`/`sub.currentPeriodEnd`. With staggered agents there is no single org cycle. Scope the label to Maya's own entitlement, since the card is Maya's credits.

- [ ] **Step 3: Correct the tier labels** — `TIER_LABELS` (`usage/page.tsx:19-24`) keys off the removed `MayaUsageTier`. Replace with a label derived from Maya's entitlement `source`/`plan`, and make the annual copy read "400 credits/month" — the old model granted 400/year, and the label must not carry that lie forward.

- [ ] **Step 4: Update `MayaUsageCard`** — `apps/main/src/components/dashboard/MayaUsageCard.tsx` consumes `useMayaUsage`; confirm its period display now reads the monthly window rather than the billing period. Adjust `MayaUsageCardSkeleton` if row counts change.

- [ ] **Step 5: Admin org detail** — `apps/admin/src/app/(portal)/organizations/[id]/page.tsx` reads `unlockedAgents`/`subscriptionStatus`. Point it at the entitlement list so support can see per-agent expiry. Also check `apps/admin/src/components/orgs/OrgsClient.tsx`, `overview/AttentionList.tsx`, `overview/ChurnRiskTable.tsx`, `overview/OverviewClient.tsx`, and `usage/UsageClient.tsx` — all six read the legacy fields and must be migrated before Phase 12 drops them.

- [ ] **Step 6: Verify admin queries** — `apps/server/src/modules/admin/admin.charts.ts`, `admin.health.ts`, and `admin.repository.ts` all query `subscriptionStatus`/`unlockedAgents`. Migrate them to entitlements and confirm `src/tests/unit/admin-charts.test.ts` still passes.

Run: `cd apps/server && npm test`
Expected: PASS

---

## Phase 12: Drop Legacy Columns

**Do not start until Phases 3-11 have been in production long enough to trust the backfill.** This is the irreversible step.

### Task 12.1: Remove the superseded model

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/<timestamp>_drop_legacy_billing/migration.sql`

- [ ] **Step 1: Confirm nothing reads the legacy fields**

```bash
cd "D:/Projects/veqiro"
grep -rn "unlockedAgents\|entitlementExpiresAt\|subscriptionStatus\|entitlementMode\|selectedAgents\|pendingCheckoutSessionId" \
  --include="*.ts" --include="*.tsx" apps/server/src apps/main/src apps/admin/src | grep -v node_modules
```

Expected: **no results**. Any hit is a consumer that Phase 11 missed — fix it before proceeding.

- [ ] **Step 2: Drop from `Subscription`**

Remove `status`, `plan`, `entitlementMode`, `selectedAgents`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `trialEndsAt`, `dodoSubscriptionId`, and all six `pending*` columns. `Subscription` retains only `id`, `organizationId`, `dodoCustomerId`, `createdAt`, `updatedAt` — it is now purely the org's Dodo customer link.

- [ ] **Step 3: Drop from `Organization`**

Remove `subscriptionStatus`, `entitlementExpiresAt`, `unlockedAgents`, and the three indexes referencing them (`schema.prisma:248-250`).

- [ ] **Step 4: Drop the now-unused enum**

`SubscriptionEntitlementMode` has no remaining consumers. Remove it. Keep `SubscriptionStatus` — `BillingSubscription` still uses it.

- [ ] **Step 5: Generate, review, apply**

```bash
cd apps/server
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/drop-legacy.sql
```

Review `/tmp/drop-legacy.sql` by eye — it must drop **only** the columns listed above. Then:

```bash
mkdir -p prisma/migrations/20260901000000_drop_legacy_billing
cp /tmp/drop-legacy.sql prisma/migrations/20260901000000_drop_legacy_billing/migration.sql
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
npx prisma generate && npx tsc --noEmit && npm test
```

Expected: PASS

- [ ] **Step 6: Delete dead code**

- `billing.types.ts`: `deriveEntitlementFields`, `SubscriptionLike`, `DerivedEntitlement`, `resolvePlan`, `resolveEntitlementMode`, `parseEntitlementModeMetadata` — all superseded.
- `billing.service.ts`: `syncOrgEntitlement` (the whole denormalization mechanism), `ACTIVE_BILLING_STATUSES`.
- `billing.test.ts`: the `deriveEntitlementFields` and `resolvePlan` describe blocks.
- `billing.catalog.ts`: `sumAgentMonthlyPriceCents` — introduced in Task 1.1 only to keep the old `quantity`-hack call site compiling. Task 5.1 replaced that call site with real per-agent products, so verify it has no remaining consumers (`grep -rn "sumAgentMonthlyPriceCents" apps/`) and delete it if not.
- `lib/dodo.ts`: `PRODUCT_BY_SLUG` / `PlanSlug` — they name only the two legacy Pro products.
- `lib/auth.ts:122-129`: the `checkout()` sub-plugin's `products` array lists `pro-monthly`/`pro-annual` slugs that no longer exist. Update to the 8-product catalog or drop the sub-plugin if unused.

---

## Verification Checklist

Walk these end-to-end against Dodo test mode before calling the work done. Each maps to a requirement.

- [ ] Buy Maya day 0, buy Rex day 10 → **both active, different expiry dates** (the reported bug)
- [ ] Rex's purchase does not alter Maya's period end
- [ ] Maya renews on day 30 without touching Rex's day-40 row
- [ ] Cancel Rex auto-pay → Rex shows "access until day 40"; Maya keeps renewing
- [ ] Resume Rex auto-pay before day 40 → Rex renews normally
- [ ] Rex's card fails → only Rex is `PAST_DUE`; Maya still works
- [ ] Re-buying active Maya → `409 already-entitled:MAYA`; UI never offers the button
- [ ] Buying an agent on Crew → `409 crew-covers-all-agents`; buy buttons hidden
- [ ] Buying a cancelled-but-unexpired Rex → **resumes auto-pay, no charge, no second subscription** (`resumed: true`, `url: null`)
- [ ] Second agent purchase reuses the saved card (no re-entry) via `show_saved_payment_methods`
- [ ] Upgrade with Maya+Rex owned → charged **$11.00**, next invoice previews **$39.00**
- [ ] Upgrade with ≥ $39 owned → no upgrade card, no refund
- [ ] After upgrade, Maya's and Rex's old subs do not charge again
- [ ] Trial → all 6 agents, 7 days; second trial attempt → `409 trial-already-used`
- [ ] Maya credits reset monthly on an **annual** plan (not yearly) — the 400/yr bug
- [ ] Mid-period upgrade raises the credit ceiling without resetting `creditsUsed`
- [ ] Duplicate webhook delivery is a no-op; a failed handler retries successfully
- [ ] Sweeper expires a lapsed row and leaves `SUPERSEDED` rows alone
- [ ] Annual is unreachable for individual agents anywhere in the UI or API
- [ ] No multi-agent checkout exists anywhere — no cart, no multi-select, no basket total
- [ ] Cancelling one agent never alters any other agent's subscription or period
