# Remove Crew Plans — Design

**Date:** 2026-07-28
**Status:** Approved
**Supersedes:** the Crew-plan portions of `2026-07-15-per-agent-entitlements-billing-design.md` (Decisions #4, #5, #9, the Crew upgrade flow, and Crew's row in `pricingTiers`). The per-agent entitlement model that spec introduced is **not** superseded — it's the foundation this design builds on.

## Summary

Remove the Crew (bundled, all-6-agents) subscription plan entirely. Going forward the only purchasable unit is a single agent, independently billed, independently renewed, independently cancelled. No bundle, no upgrade-credit math, no annual cadence (annual was Crew-only).

This is a **removal**, not a redesign: the per-agent `Entitlement`/`BillingSubscription` model already treats each agent's access as its own row with its own period. Crew was implemented as `Entitlement.source = "CREW"` (6 rows sharing one `BillingSubscription`) plus a handful of crew-only functions/files layered on top of that shared model. Deleting those layers leaves the agent-purchase path intact and already correct.

## Why

Crew made the payment flow materially more complex — a second checkout path, upgrade-credit pricing math with cent-level rounding guarantees, a parallel cancel/resume surface, overlapping-entitlement bookkeeping during upgrades, and pricing-page real estate — for a plan with no live subscribers. Removing it simplifies every layer it touched without any migration burden (no real users are on Crew today).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Delete Crew as a purchasable product, checkout path, and entitlement source | No live subscribers; each layer it touches gets strictly simpler without it |
| 2 | No grandfathering / migration path for existing Crew rows | Confirmed no real users hold a Crew subscription; any dev/test rows using `CREW` enum values are cleaned up before the schema migration, not migrated |
| 3 | Keep `Subscription`'s other pre-existing dead fields (`pending*`, `entitlementMode`, `selectedAgents`) untouched | Separate, already-known cleanup; out of scope here to keep this change reviewable |
| 4 | Billing page becomes read-only for status; all cancel/resume/payment-history actions move to Dodo's hosted customer portal | Simplifies apps/main to one surface instead of two (in-app toggle + portal); Dodo's portal already lists subscriptions and invoices per the existing `openBillingPortal()` integration |
| 5 | Dodo dashboard's live `crew_monthly`/`crew_annual` products are left alone | Removing them from `create-dodo-products.ts` stops them from ever being (re)provisioned or checked out against; archiving the dashboard entries themselves is a manual, no-rush step since nothing can reach them once checkout code is gone |
| 6 | Landing pricing page shows a grid of 6 individual agent cards (live monthly price, Buy CTA) alongside the existing $99 Enterprise card | Matches the "buy independently" model; replaces the old Crew-card + Enterprise 2-up layout |
| 7 | Marketing/UX use of "crew" as a team metaphor (dashboard leaderboard, onboarding copy, login screen copy, footer nav, homepage showcase) is left untouched | These describe "your team of 6 agents," unrelated to the billing SKU being removed |

Note on annual cadence: annual billing was gated to Crew only (`SubscriptionPlan.ANNUAL` was reachable exclusively through the Crew path per the prior design's Decision #9). Individual agents were always monthly-only. With Crew gone, no purchasable product offers annual billing at all. `SubscriptionPlan.ANNUAL` stays in the schema (harmless, and BillingSubscription/webhook code is cadence-agnostic) but nothing in the UI or checkout path offers it any longer.

## Scope by layer

### Database schema (`apps/server/prisma/schema.prisma`)

- `EntitlementSource`: `TRIAL | AGENT | CREW` → `TRIAL | AGENT`
- `CheckoutKind`: `AGENT | CREW | CREW_UPGRADE | MAYA_TOPUP` → `AGENT | MAYA_TOPUP`
- `SubscriptionEntitlementMode`: drop the `CREW` value; `Subscription.entitlementMode`'s `@default` moves from `CREW` to `CUSTOM` (the field itself stays per Decision #3)
- Before running the migration: check the dev Supabase DB for rows referencing the `CREW` enum values (test data) and delete/update them — Postgres cannot drop an enum value still referenced by a row
- Migration follows the project's established pattern: `DIRECT_URL` (5432, not the pooler) + `prisma migrate diff` → curated `migrate deploy`, not `migrate dev` (live DB has drift)

### Backend (`apps/server`)

**Deleted entirely:**
- `src/modules/billing/billing.crew-cancel.ts`
- `src/modules/billing/billing.upgrade.ts`
- `billing-crew-checkout.test.ts`, `billing-crew-cancel.test.ts`, `billing-upgrade.test.ts`

**Trimmed (file stays, crew branch removed):**
- `billing.webhooks.ts` — remove `applyCrewActivation()`, the crew branch of `resolveActivationIntent()`, `resolveCrewPlanFromProductId` usage. Renewal/cancel/expire/failed handlers are already generic per-`BillingSubscription`; no change.
- `billing.service.ts` — remove `createCrewCheckout()`, `quoteUpgradeFromActive()`, `getUpgradeQuoteForOrg()`; `createCheckoutForOrg()` simplifies to the agent-only path; `assertAgentPurchasable()` drops its "crew covers all agents" guard.
- `billing.routes.ts` — remove `POST /billing/crew/cancel`, `/billing/crew/resume`, `GET /billing/upgrade-quote`.
- `billing.catalog.ts` / `billing.catalog.controller.ts` — remove `crewProductId`, `getCrewPriceCents`, `resolveCrewPlanFromProductId`, `isCrewSelection`; `GET /billing/catalog` response drops its `crew` key.
- `scripts/create-dodo-products.ts` — `buildSkus()` drops the `crew_monthly`/`crew_annual` entries.
- `maya.quotas.ts` — `getQuotaForMayaEntitlement()` drops the `CREW+ANNUAL → 400` tier, simplifies to `TRIAL → 30, else → 300`.
- `entitlement.service.ts` — `getMayaEntitlement()` drops `CREW` from its source-ranking table (keeps `AGENT > TRIAL`).
- `entitlement-errors.ts` (server-side copy source) — remove `covered-by-crew:`, `crew-covers-all-agents`, `no-crew-subscription` error strings.
- `billing-catalog.test.ts` — update to drop crew assertions, keep agent-catalog assertions.

**Kept as-is (already correct, not crew-specific):** `billing.cancel.ts` (`cancelAgentAutoPay`/`resumeAgentAutoPay`, `resolveAgentSubscription`, `assertNotSharedSubscription`), the entitlement sweeper cron, all renewal/cancel/expire/fail webhook handlers, `entitlement.middleware.ts`.

### apps/main

**Deleted entirely:** `components/billing/CrewUpgradeCard.tsx`, `components/billing/CrewSubscriptionCard.tsx`

**Rewritten:** `app/(dashboard)/settings/billing/page.tsx`
- Remove the `crewActive` branch and both crew cards.
- Per-agent buy cards for unowned agents are always shown (previously hidden while on Crew).
- Per-agent status rows (`AgentEntitlementRow.tsx`) become read-only: status, renewal/expiry date, price — no cancel/resume button.
- A prominent "Manage Billing & Payment History" action links to the Dodo hosted portal (the existing `openBillingPortal()` call, made the primary/only way to cancel or view invoices).

**Trimmed:**
- `AgentEntitlementRow.tsx` — remove the "Crew" badge and the `togglable` cancel logic entirely (no row has a cancel button now).
- `AgentPeriodList.tsx` — remove `SOURCE_LABELS.CREW`.
- `entitlement-errors.ts` — remove crew error-string handling (mirrors backend).
- `lib/api/billing.ts` — `CheckoutInput` simplifies to `{ agent, cadence? }`; remove `cancelCrew`/`resumeCrew`/upgrade-quote client calls.
- `settings/usage/page.tsx` — remove the `source === "CREW"` branch in `billingCycleLabel`; drop `MONTHLY_CREW`/`ANNUAL_CREW` from `TIER_LABELS`.

**Verify, no logic change expected:** `MayaTopUpButton`'s `hasMayaEntitlement()` gate already checks "any entitlement covering MAYA regardless of source," so restricting to active Maya subscribers keeps working once `CREW` stops being a possible source — confirm this in the browser after the schema change lands.

**Left untouched (branding, not billing):** `CrewLeaderboard.tsx`, onboarding/tour copy, login/register page copy, `ChatList.tsx` empty state — all use "crew" as a team-of-6-agents metaphor, not the billing plan.

### apps/landing

- `lib/site-config.ts` — remove the Crew entry from `pricingTiers`; restructure so Enterprise is its own named export rather than an array index. Reword the FAQ entry that currently reassures "no Crew subscription required" (it becomes a confusing dangling reference once Crew doesn't exist as a concept at all) to state plainly that every agent is billed independently.
- `components/veqiro/pricing-page-content.tsx` — replace the Crew-card + Enterprise 2-up layout with: a responsive grid of the 6 individual agent cards (live price from `useBillingCatalog()`, Buy CTA) plus the Enterprise card alongside/beneath it. The current separate "buy individually" section is folded into this grid (no duplicate section).
- `components/veqiro/sections.tsx` `Pricing()` (homepage teaser) — same rework, scaled for the teaser placement.
- `lib/use-billing-catalog.ts` — drop the `crew` field from the type/response handling.
- Left untouched (branding): footer "The Crew" column, `crewReplies`/`crewFollows` demo copy, `CrewSection`/`DeskPanel` homepage showcase, blog content.

### apps/admin

No changes — confirmed zero crew-specific code exists there.

## Verification

- Manual click-through (dev server + browser, not just type-checks): buy one agent → webhook fires → entitlement created with correct period; cancel via Dodo portal → webhook fires → that agent's entitlement flips to cancel-at-period-end while others are unaffected; renewal webhook extends only the renewed subscription's entitlements; Maya top-up button is enabled only when an active Maya entitlement exists; landing pricing page renders live per-agent prices plus the Enterprise card correctly.
- Confirm Dodo's hosted customer portal actually lists each agent's subscription separately and allows per-subscription cancel — the "Dodo portal only" cancel UX in apps/main depends on this being true, not assumed.
- Re-verify webhook handlers are genuinely crew-branch-free and not just reachable-but-dead, since `billing.webhooks.ts` is shared code being edited rather than deleted wholesale.

## Out of scope

Migrating/grandfathering existing Crew subscribers (none exist). Cleaning up `Subscription`'s other pre-existing dead fields. Archiving the live Crew products in the Dodo dashboard. Changing "crew" branding/marketing copy that refers to the team-of-agents concept rather than the billing plan.
