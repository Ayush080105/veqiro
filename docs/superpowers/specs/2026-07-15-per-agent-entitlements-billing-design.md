# Per-Agent Entitlements, Subscriptions & Credits — Design

**Date:** 2026-07-15
**Status:** Approved
**Supersedes:** parts of `2026-04-28-dodopayments-billing-design.md` (see [Superseded decisions](#superseded-decisions))

## Summary

Rebuild billing so that **each agent is an independently-billed entitlement** with its own period anchored to its own purchase date, its own renewal, and its own auto-pay toggle. Crew remains a single bundled subscription, reachable via an upgrade that credits the full list price of agents already owned.

The central change is **inverting the source of truth**: entitlement stops being derived from one `Subscription` row and becomes per-agent `Entitlement` rows. Dodo subscriptions become a billing detail pointing at those rows.

## Problem

The current model cannot express the requirement. `Subscription` is one row per org (`organizationId @unique`) with a single `currentPeriodEnd`, a single `dodoSubscriptionId @unique`, and a flat `selectedAgents Agent[]`. There is physically nowhere to record a second agent's purchase date.

Every reported symptom follows from this:

| # | Defect | Location |
|---|---|---|
| 1 | Second purchase is **refused outright** — this is the reported bug | `billing.service.ts:290` |
| 2 | If that guard were removed, `selectedAgents` is written wholesale → buying Rex **erases Maya** | `billing.webhooks.ts:137` |
| 3 | Custom price is a `quantity = cents/100` hack on a $1 product; invoice reads "28 × $1"; Dodo cannot know which agents were bought, so per-agent cancel and `changePlan` are impossible by construction | `billing.service.ts:306` |
| 4 | Annual credits ~9× under-provisioned: `ANNUAL_CREW = 400` but `MayaUsage.periodEnd = next_billing_date` (a year out) → 400/yr vs monthly's 3,600/yr | `maya.quotas.ts:8`, `billing.webhooks.ts:155` |
| 5 | `ACTIVE → entitlementExpiresAt = null` → an ACTIVE org never expires locally; one missed webhook = permanent free access. No sweeper (`paymentRetry.job.ts` is a `// TODO` stub) | `billing.types.ts:89` |
| 6 | Webhook idempotency key is synthesized (`type:subId:timestamp`), not Dodo's event id → redelivery reprocesses. On handler throw the row stays `"processing"` forever, **silently swallowing every retry** | `billing.webhooks.ts:60,63` |
| 7 | One failed card sets the whole org `PAST_DUE`, killing all six agents | `billing.webhooks.ts:240` |
| 8 | `ANNUAL`+`CUSTOM` half-blocked: service rejects it, but the env var, `resolvePlan`, and the annual branch of `calculateAgentSelectionPriceCents` still support it | `billing.service.ts:286` vs `billing.types.ts:27` |
| 9 | Per-agent cancel impossible — `cancelAtPeriodEnd` is one boolean for the whole org | `schema.prisma:291` |

## Verified platform constraints

Established against the Dodo SDK (v2.28.2) and live docs. These bound the design.

| Capability | Status | Consequence |
|---|---|---|
| `subscriptions.update({ cancel_at_next_billing_date })` | ✅ Available | Per-agent auto-pay cancel |
| `subscriptions.update({ next_billing_date })` | ✅ Available | Billing anchors are settable |
| `changePlan({ proration_billing_mode, effective_at })` | ✅ Available | Plan transitions |
| Discount `subscription_cycles` (v1.47.0) | ✅ Available | Discount scoped to first cycle only |
| **Flat/fixed-amount discounts** | ❌ **Percentage only** — `UNSUPPORTED_DISCOUNT_TYPE` | Crew upgrade must use a computed percentage |
| **Customer payment-method listing** | ❌ **No API** | Off-session `subscriptions.create` is **not** a viable fallback |
| **Multiple subscription products in one cart** | ❌ **REJECTED** — `422 Only one subscription product allowed per checkout` | **One checkout = one subscription.** No multi-agent cart. |
| `products.create` over the API | ✅ Available | (Considered for composite products; rejected — see below) |
| Minimum subscription price | $1 | All upgrade deltas ≥ $2 — satisfied |

### Resolved by spike (2026-07-15)

The docs were ambiguous — every example showed one subscription product, the v1.67.0 changelog read "One-Time **and** Subscription Products" (singular), and no error code confirmed or denied it. A test-mode spike settled it definitively:

```
POST /checkouts  product_cart: [maya_monthly, rex_monthly]
→ 422 Only one subscription product allowed per checkout
```

Combined with the absent payment-method API (no off-session `subscriptions.create` fallback), this makes **one subscription per checkout** a hard platform constraint. The design below is built on it rather than around it.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **`Entitlement` rows are the source of truth** | Only structure that can hold per-agent periods. Deletes defects 1, 2, 9 at the root. |
| 2 | **Access is a live query, not a cache** | Middleware queries `Entitlement` directly. Deletes defect 5 — no cache left to go stale. Replaces one indexed `Organization` read with one indexed `Entitlement` read: cost-neutral. |
| 3 | **No cart. One agent = one checkout = one subscription.** | Forced by the 422, and independently the right model: it scales **linearly** with the agent count. Buying three agents is three checkouts (2nd/3rd reuse the saved card). |
| 3a | **`BillingSubscription` groups 1..N entitlements** | An `AGENT` subscription bills exactly 1; a `CREW` subscription bills all 6. One model covers both. |
| 4 | **8 real Dodo products** (6 agent-monthly, crew-monthly, crew-annual) | Kills the `quantity` hack (defect 3). Prerequisite for per-agent cancel. Grows to N+2, not 2^N. |
| 5 | **Crew upgrade = discounted first cycle, then real Crew** | User pays `crew − Σ(owned list price)` once, then $39/mo as one subscription on one date. Never pays twice. Avoids the pricing exploit described under [Rejected alternatives](#rejected-alternatives). |
| 6 | **Credit period decoupled from billing period** | Fixed 1-month window anchored on Maya's entitlement. Fixes defect 4 and is required for staggered agents regardless. |
| 7 | **Quota evaluated live from the Maya entitlement** | Mid-period upgrade raises the ceiling on the current window — no reset. No lost credits for the user, no "upgrade to refill" exploit. |
| 8 | **One trial per org, ever — all 6 agents, 7 days** | No agent selection at trial time. Only shape that can't be farmed. |
| 9 | **Annual is Crew-only** | Enforced in one place; all contradictory dead paths deleted (defect 8). |

### Rejected alternatives

**Crew upgrade — "bundle top-up"** (Crew stays a label; Maya renews $19 day 30, Rex $9 day 40, other four an $11/mo line day 45). Steady state also totals $39/mo and it matches the literal requirement, but it is **exploitable**: buy Maya+Rex ($28), upgrade ($11), cancel Maya+Rex auto-pay → **$11/mo for four agents that list at $36/mo**. Rejected for that hole.

**Crew upgrade — true proration.** Credit the *unused* portion (Maya 15/30 × $19 = $9.50, Rex 25/30 × $9 = $7.50 → pay $22). Textbook, but contradicts the specified rule (credit is full list price, not unused portion) and the specified $11.

**Per-agent trials.** Farmable into ~6 weeks of free access by staggering agents; Maya (30 free credits) is the obvious target, and orgs are free to create.

**Multi-agent cart via composite products.** After the 422, the cart could have been preserved by lazily creating a Dodo product per *combination* (`{Maya,Rex}` → one "Maya + Rex" product at $28/mo), with per-agent cancel implemented as `changePlan` to the remaining-subset product. Both primitives were verified to exist. **Rejected on scaling:** the product space is 2^N − 1. At today's 6 agents that is 63 products; at a planned 10+ agents it is **1,023**, and every cancellation becomes a subset lookup against a combinatorial catalog. Each new agent would double the surface. Linear beats exponential, and the constraint pushed us toward the model we'd want anyway.

**Multi-agent cart where cancel drops the whole batch.** Cancelling Sage from a `{Lex,Sage}` subscription would stop the entire subscription at period end, forcing the user to re-checkout Lex. Rejected: cancelling one agent must never put another at risk — that is the requirement, not a nice-to-have.

### Accepted trade-off

Crediting the **full** list price means upgrading on day 29, with one day of Maya left, still credits $19 — Crew costs $20 that month. Bounded (≈ one agent's price, once per upgrade) and a direct consequence of the specified rule. **Accepted knowingly.**

### Superseded decisions

- **April Decision #8 — "Denormalize subscription status onto Organization"** (avoid joining `Subscription` on the hot path). Reversed. The denormalized cache is the *cause* of defect 5: it cannot represent per-agent expiry, and `ACTIVE → entitlementExpiresAt = null` means it never expires. The premise — that the join is expensive — does not hold: it was always a single indexed read, and it remains one.
- **April Decision #6 — "Lockout scope: agents only"** — **retained unchanged.**

## Data model

```prisma
enum EntitlementSource { TRIAL  AGENT  CREW }
enum EntitlementStatus { TRIALING  ACTIVE  PAST_DUE  EXPIRED  SUPERSEDED }

/// Source of truth for agent access. One row per purchase of one agent.
model Entitlement {
  id                    String   @id @default(cuid())
  organizationId        String
  agent                 Agent
  source                EntitlementSource
  status                EntitlementStatus
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime          // per-agent, from ITS purchase date
  cancelAtPeriodEnd     Boolean  @default(false)
  priceCents            Int               // what was paid — drives upgrade credit
  billingSubscriptionId String?           // null for TRIAL
  billingSubscription   BillingSubscription? @relation(...)

  @@index([organizationId, agent, currentPeriodEnd])
  @@index([currentPeriodEnd, status])     // sweeper
}

/// One row per Dodo subscription. Bills 1..N entitlements.
model BillingSubscription {
  id                 String   @id @default(cuid())
  organizationId     String
  dodoSubscriptionId String   @unique
  plan               SubscriptionPlan
  status             SubscriptionStatus
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean  @default(false)
  entitlements       Entitlement[]
}
```

**No `@@unique([organizationId, agent])`.** Overlapping rows are legal and load-bearing: during a Crew upgrade the org briefly holds both a Maya `AGENT` row (day 0→30) and a Maya `CREW` row (day 15→45). Multiple rows over time are the natural purchase history.

**Access rule** — an agent is unlocked iff **any** row satisfies:
```
organizationId = org AND agent = X
  AND currentPeriodEnd > now
  AND status IN (TRIALING, ACTIVE, PAST_DUE)
```
`PAST_DUE` is included deliberately: it *is* the dunning grace window. The grace is not a separate configurable duration — it is the remainder of the already-paid period, ended early only by `subscription.failed`. `SUPERSEDED` is excluded.

`Subscription` keeps only `organizationId` + `dodoCustomerId`. `status`, `plan`, `entitlementMode`, `selectedAgents`, `currentPeriodEnd`, `cancelAtPeriodEnd`, and all six `pending*` columns move out. `Organization.subscriptionStatus` / `entitlementExpiresAt` / `unlockedAgents` are dropped from the hot path; `Organization.trialStartedAt` is added to enforce once-ever trials.

## Flows

### Trial
`POST /billing/trial` → guard on `trialStartedAt` (409 `trial-already-used`) → 6 `TRIAL` entitlements, now→+7d, no `BillingSubscription`. The `agents` parameter on `startTrialForOrg` is removed.

### Buy one agent
`POST /billing/checkout { agent }` — a single agent, always `MONTHLY`. One checkout, one Dodo subscription, one entitlement, anchored on today.

- Already actively entitled → `409 already-entitled:<AGENT>`
- Crew active → `409 crew-covers-all-agents`
- Cancelled-but-unexpired period → **resumes auto-pay**, no new charge

Buying several agents means several checkouts. The second and subsequent ones reuse the customer's saved payment method (`show_saved_payment_methods: true`), so only the first requires card entry. Each purchase independently anchors its own period — which is exactly the requirement, obtained for free rather than engineered around.

### Upgrade to Crew
`GET /billing/upgrade-preview` → `{ eligible, creditCents, payNowCents }`.

- `credit = Σ priceCents` of agents currently entitled via `AGENT`
- `credit >= crewPrice` → `{ eligible: false }` (no-refund rule)
- else → mint discount: `type: percentage`, `amount = round(credit / crewPrice × 10000)` bp, `usage_limit: 1`, `subscription_cycles: 1`, `restricted_to: [crewProduct]`, `expires_at: now + 1h`

On `subscription.active`: write 6 `CREW` entitlements (now → +30d / +1y); set superseded `AGENT` rows' Dodo subs to `cancel_at_next_billing_date: true`; mark those rows `SUPERSEDED`.

`SUPERSEDED` (not delete) keeps the transition reversible if the Crew payment later fails or is refunded.

**Rounding is exact for every reachable delta** (verified — Dodo rounds to nearest cent):

| Owned | Credit | bp | Charged |
|---|---|---|---|
| Rex $9 | $9 | 2308 | $30.00 |
| Rex+Lex $18 | $18 | 4615 | $21.00 |
| Maya $19 | $19 | 4872 | $20.00 |
| Sage+Lex+Rex $27 | $27 | 6923 | $12.00 |
| Maya+Rex $28 | $28 | 7179 | **$11.00** |
| 4×$9 = $36 | $36 | 9231 | $3.00 |
| Maya+Rex+Lex $37 | $37 | 9487 | $2.00 |

Baskets ≥ $39 (e.g. Maya+3 = $46) are ineligible by rule, so no delta below $2 is reachable — Dodo's $1 minimum holds.

### Cancel / resume auto-pay
`POST /billing/agents/:agent/cancel` | `/resume`. Sets `cancelAtPeriodEnd`, calls `subscriptions.update(id, { cancel_at_next_billing_date })`. Access continues to `currentPeriodEnd` — the period is already paid for; only the renewal stops.

Because an `AGENT` subscription bills exactly one agent, this is unambiguous: no subset arithmetic, no `changePlan`, and no possibility of collaterally cancelling a neighbouring agent. Cancelling Crew stops all six together, which is what Crew means.

### Renewal
`subscription.renewed` → resolve `BillingSubscription` by `dodoSubscriptionId` → extend **only that sub's** entitlements. Maya's day-30 renewal cannot touch Rex's day-40 row. Independence is structural, not maintained.

### Dunning
`payment.failed` → only that sub's entitlements → `PAST_DUE`. Access continues to `currentPeriodEnd` (the period was already paid for) with a banner shown. Dodo drives retries natively. `subscription.failed` → `EXPIRED` for those entitlements only, ending access early.

### Sweeper
Cron (15 min): `currentPeriodEnd < now AND status != EXPIRED` → `EXPIRED`.

Scope note: this is for **reporting accuracy, not access**. Access already tests `currentPeriodEnd > now`, so a missed webhook cannot extend access even with the sweeper down. Defense in depth.

### Webhook hardening
- Idempotency key = Dodo's real `webhook-id` header, not the synthesized string
- Handler throw → mark `failed`, allow retry (today: stuck at `"processing"`, retries silently swallowed)
- Ignore payloads whose period predates stored state (out-of-order delivery)

## Credits

- **Period:** fixed 1-month window anchored on Maya's entitlement start. Annual bills yearly; Maya's credits still reset monthly. A Maya-only customer resets on *Maya's* anniversary.
- **Quota, read live from the Maya entitlement:** `TRIAL → 30`, `AGENT|CREW monthly → 300`, `CREW annual → 400`. Replaces `getTierFromSubscription`, which reads the org subscription that no longer exists.
- **No reset on plan change** — a mid-period upgrade raises the ceiling on the open window. Follows from evaluating the limit live.
- **No Maya entitlement → no credits** (402).
- `CREDITS_PER_IMAGE = 2` / `CREDITS_PER_VIDEO_SECOND = 4` already single-sourced in `maya.quotas.ts`; unchanged.
- **Out of scope:** `topup-dialog.tsx` is a frontend stub with no backend. Stays hidden rather than half-wired.

## Surfaces

- **Billing** — owned agents render as rows with their own renewal date and auto-pay toggle; un-owned agents render as cards with a single "Buy $X/mo" button that goes straight to that agent's checkout. No cart, no multi-select, no basket total. Crew upgrade CTA with computed price. Annual only under Crew.
- **Pricing page** — per-agent buy buttons mirroring the same model, so pricing and billing tell one story.
- **Usage** — per-agent period/expiry list beside Maya's credit card.
- **Dashboard** (`MayaUsageCard`) and **admin org detail** — read the same entitlement list.

## Migration

Live DB has drift; migrations must use `DIRECT_URL` (5432), not the 6543 pooler — `migrate dev` is unsafe. Use `prisma migrate diff` + curated `migrate deploy`.

Backfill: each existing `Subscription` → one `BillingSubscription` + one `Entitlement` per `selectedAgents` member, all inheriting `currentPeriodEnd`, `priceCents` from the catalog at migration time. `TRIALING` orgs → 6 `TRIAL` entitlements at `trialEndsAt`, `trialStartedAt` backfilled from `createdAt`. Existing columns dropped only after backfill verifies.

## Risks

| Risk | Mitigation |
|---|---|
| Users expect a multi-select cart | Buying N agents is N checkouts. Mitigated by saved payment methods (only the first needs card entry) and by per-agent buy buttons that never imply batching. |
| Backfill mis-prices `priceCents` | Snapshot catalog at migration; verify counts before dropping columns |
| Dodo discount rounding drifts if prices change | All current deltas verified exact; add a unit test over the price matrix |
| Webhook replay during migration | Real `webhook-id` idempotency lands before backfill |

## Out of scope

Top-ups. Refunds/proration credits. Downgrade Crew → individual agents. Multi-currency. Per-agent credits for non-Maya agents. Multi-agent checkout (blocked by the platform; revisit only if Dodo lifts the one-subscription-per-checkout limit).
