# Billing — Pending Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`) tracking.

**Context:** The per-agent entitlements billing rebuild (branch `billing-per-agent-entitlements`, plan `2026-07-15-per-agent-entitlements-billing.md`) is functionally complete: 20 commits, both apps typecheck clean, 285 tests / 282 pass / 3 known-red baseline, migrations + backfill applied to production. This plan covers the small, well-bounded work that remains.

**Prerequisite the user owns (NOT in this plan):** the 8 Dodo product env vars must be set or every checkout throws `missing-product-id:*`. See "Task 4" for an optional helper to create them, but the env values themselves are the user's to fill in.

## Global Constraints

- **No git operations unless a task says to commit.** The user handles merges/pushes.
- **Never run `prisma migrate dev` / `db push` / `migrate diff` against the live datasource.** The DB has drifted; the generated diff wants to `DROP TABLE community_comment, community_post, conversation_memories, post_analytics, rag_chunks` + 15 DROP INDEX + 4 DROP FOREIGN KEY. If a migration is ever needed, hand-write it (additive only) and apply with `DATABASE_URL=$DIRECT_URL npx prisma migrate deploy` (port 5432, not the 6543 pooler). No task here needs a migration.
- **Tests:** Vitest. Gate = `cd apps/server && npm test` → exactly 3 failures (maya-publish ×2, rex-csv ×1 — pre-existing, unrelated). A 4th failure is yours.
- **ESM:** relative imports end in `.js` even from `.ts` sources.
- **apps/admin is explicitly OUT OF SCOPE** (user deferred it). See "Deferred" section.

---

## The scheduling decision (answers "should we use BullMQ?")

**Use `node-cron`. Do NOT introduce BullMQ/Redis.** Evidence from the codebase:

- `node-cron@4` is already a dependency and already used by 5 jobs (`maya.cron.ts`, `rex.cron.ts`, `vega.cron.ts`, `tasks.cron.ts`, `system.cron.ts`).
- The server is a **persistent process** (`Dockerfile`, `app.listen()` in `server.ts`), and `startSystemCrons()` is already called at boot. In-process cron works.
- BullMQ **requires Redis** — a separate paid/hosted service. There is no `REDIS_URL` anywhere. `bullmq.ts` and `cleanup.job.ts` are abandoned `// TODO`/`export {}` stubs; the project moved to node-cron.
- The sweeper is idempotent (`updateMany` on a status filter), so the one node-cron caveat — multiple server instances each firing the tick — is harmless here. The existing crons already accept that trade-off for riskier work (Maya's publisher).

BullMQ would only be justified by retries-with-backoff, cross-machine workers, restart-durable queues, or rate-limited heavy processing. None apply to "flip lapsed rows to EXPIRED every 15 minutes."

---

## Task 1: Schedule the entitlement sweeper via node-cron

**Why:** `sweepExpiredEntitlements` (in `src/jobs/entitlementSweeper.job.ts`) is implemented and tested but nothing calls it, so `EXPIRED` is never stamped. This is reporting-accuracy only — access already checks `currentPeriodEnd > now` on every request, so nobody gets free access while it's unscheduled — but admin views and any status-based reporting see stale `ACTIVE` rows on lapsed entitlements.

**Files:**
- Modify: `apps/server/src/modules/tasks/system.cron.ts`
- Test: `apps/server/src/tests/unit/entitlement-sweeper.test.ts` already exists and passes — no change needed unless you touch the function.

**Interfaces:**
- Consumes: `sweepExpiredEntitlements(now?: Date): Promise<{ expired: number }>` from `../../jobs/entitlementSweeper.job.js`

- [ ] **Step 1: Wire it into `startSystemCrons`**

Add to `system.cron.ts` (follow the existing `cron.schedule` lines exactly):

```ts
import { sweepExpiredEntitlements } from "../../jobs/entitlementSweeper.job.js";

// inside startSystemCrons(), alongside the other schedules:
  // Entitlement expiry sweeper — every 15 min. Reporting accuracy only; the
  // access check already tests currentPeriodEnd > now on every request, so this
  // never gates access. Idempotent, so multi-instance double-firing is a no-op.
  cron.schedule("*/15 * * * *", () => void sweepExpiredEntitlements());
```

Update the trailing `console.log("[system-cron] ...")` summary to mention the sweeper, matching the existing wording style.

- [ ] **Step 2: Verify it wires without breaking boot**

The cron callbacks only run under `NODE_ENV !== "test"` (see `server.ts`), so the suite won't fire it. Confirm:

Run: `cd apps/server && npx tsc --noEmit && npm test`
Expected: clean typecheck; 3 known-red failures, no 4th.

- [ ] **Step 3: Manually confirm the schedule registers**

Run: `cd apps/server && npm run dev` and confirm the startup log now lists the sweeper. Optionally temporarily change the schedule to `"* * * * *"` (every minute) and watch for `[billing] sweeper expired N entitlement(s)` — but revert to `*/15` before committing. (There are currently a handful of lapsed rows in prod, e.g. expired trials, so it should report >0 on first run.)

- [ ] **Step 4: Commit**

```
feat(billing): schedule the entitlement expiry sweeper (node-cron, 15min)
```

---

## Task 2: Delete the abandoned BullMQ/cleanup stubs

**Why:** `src/queues/bullmq.ts` and `src/jobs/cleanup.job.ts` are `// TODO` + `export {}` stubs the project never built out (it uses node-cron instead). They mislead — the previous plan's Task 9.1 assumed BullMQ infra existed because these files are named as if it does. Leaving them invites the next person to wire Redis needlessly.

**Files:**
- Delete: `apps/server/src/queues/bullmq.ts`
- Delete: `apps/server/src/jobs/cleanup.job.ts`
- Check: `apps/server/src/queues/processors/` (only a `.gitkeep`) and `src/queues/` — remove if now empty except gitkeep, or leave the gitkeep.

- [ ] **Step 1: Confirm nothing imports them**

```bash
cd apps/server
grep -rn "queues/bullmq\|jobs/cleanup" src/ | grep -v node_modules
```
Expected: no results. If anything imports them, STOP and report — do not delete a live import.

- [ ] **Step 2: Delete the two stub files.** Leave `src/queues/processors/.gitkeep` alone (harmless).

- [ ] **Step 3: Verify**

Run: `cd apps/server && npx tsc --noEmit && npm test`
Expected: clean; 3 known-red, no 4th.

- [ ] **Step 4: Commit**

```
chore(billing): remove abandoned BullMQ/cleanup stubs (project uses node-cron)
```

---

## Task 3: Fix `getOrganizationById` throwing for orgs without a Maya entitlement

**Why:** `admin.repository.ts:501` does `const mayaCredits = org.subscription ? await getCurrentUsage(id) : null;`. After Task 8.1, `getCurrentUsage` throws `no-subscription` when the org has **no Maya entitlement** (it now reads `getMayaEntitlement`, not the legacy Subscription row). But the guard checks `org.subscription` — the legacy Dodo-customer-link row, which almost every org has. So an org that holds a Subscription row but no active Maya entitlement (bought only Rex, or trial lapsed) makes `getOrganizationById` throw, 500-ing the admin org-detail endpoint.

Note this is server-side (`apps/server/src/modules/admin/`), which is a shared module — this fix is in scope even though the admin *frontend* (`apps/admin`) is deferred. It's a one-function safety fix, not the admin migration.

**Files:**
- Modify: `apps/server/src/modules/admin/admin.repository.ts` (~line 501)
- Test: `apps/server/src/tests/unit/admin-*.test.ts` — add or extend the nearest admin repository test if one exercises `getOrganizationById`; otherwise add a focused test.

- [ ] **Step 1: Write a failing test**

Mock an org that has a `subscription` row but whose `getCurrentUsage` throws `no-subscription` (no Maya entitlement). Assert `getOrganizationById` resolves with `mayaCredits: null` rather than throwing. (Follow the Prisma-mock pattern in the existing admin tests / `maya-usage.test.ts`.)

- [ ] **Step 2: Run it — confirm it throws today (RED).**

- [ ] **Step 3: Make the credits lookup fault-tolerant**

Replace line 501 with a guard that treats "no Maya entitlement" as "no credits to show" rather than an error:

```ts
  // getCurrentUsage throws `no-subscription` when the org has no Maya
  // entitlement (bought other agents only, or trial lapsed). That is a normal
  // state for an org, not an error — surface it as "no credits" so the admin
  // detail view still renders.
  const mayaCredits = await getCurrentUsage(id).catch(() => null);
```

(Drop the now-redundant `org.subscription ?` guard — the `.catch` covers every no-credits case, including the one the old guard missed.)

- [ ] **Step 4: Run the test — GREEN.** Then full gate.

Run: `cd apps/server && npx tsc --noEmit && npm test`
Expected: clean; 3 known-red, no 4th.

- [ ] **Step 5: Commit**

```
fix(admin): don't 500 org detail when the org has no Maya entitlement
```

---

## Task 4 (OPTIONAL): Dodo product-creation helper script

**Why:** billing cannot function until 8 Dodo products exist and their ids are in `apps/server/.env`. The user said they'll set the env, but creating 8 products by hand in the dashboard is error-prone. This script creates them in whatever mode `DODO_ENV` points at and prints the exact `.env` block. **Skip this task if the user has already created the products.**

**Files:**
- Create: `apps/server/scripts/create-dodo-products.ts` (throwaway-ish; keep it, it's useful for the live-mode cutover too)

- [ ] **Step 1: Write the script**

It must be idempotent-ish (Dodo has no product upsert, so it should list existing products first and skip any whose name already matches, to avoid duplicates on re-run). Prices, all recurring, `tax_category: "saas"`, USD:
- Maya `1900`, Sage/Lex/Rex/Scout/Vega `900` — monthly (`payment_frequency_interval: "Month"`, count 1; `subscription_period_interval: "Month"`, count 1)
- Crew monthly `3900` — same monthly shape
- Crew annual `34800` — `payment_frequency_interval: "Year"` count 1, `subscription_period_interval: "Year"` count 1

Use the shape verified in the spike (see `billing.catalog.ts` prices and the Dodo `RecurringPrice` type). After creating, print:

```
DODO_PRODUCT_AGENT_MAYA=pdt_...
DODO_PRODUCT_AGENT_SAGE=pdt_...
... (all 8)
```

- [ ] **Step 2: Dry-run guard.** Default to listing what it WOULD create; require `APPLY=1` to actually create — same convention as `backfill-entitlements.ts`. Refuse to run against `DODO_ENV=live` without an explicit `ALLOW_LIVE=1`, so a test-mode run can't silently hit production billing.

- [ ] **Step 3: Run in test mode, paste the printed block into `apps/server/.env`.**

- [ ] **Step 4: Commit the script** (not the .env).

```
chore(billing): add Dodo product creation helper
```

---

## End-to-end verification (do this before merging, after products + env exist)

Not a code task — a manual smoke test against Dodo **test mode**. Unit tests and typechecks pass, but no real purchase has been driven through the flow. Walk the plan's verification checklist; at minimum:

- [ ] Buy Maya → lands, entitlement created, access granted
- [ ] Buy Rex a few days later → **both active, independent expiry dates** (the original reported bug)
- [ ] Cancel Rex auto-pay → Rex shows "access until <date>", Maya unaffected
- [ ] Upgrade to Crew with Maya+Rex owned → charged the credited first-month price, Maya/Rex old subs stop
- [ ] New org with nothing owned → can buy Crew from the billing page (the state-1 Crew card)
- [ ] Webhook idempotency: replay a `subscription.active` → no second entitlement

If any fails, capture the request/response and the `pending_checkout` + `entitlement` rows for that org before debugging.

---

## Deferred (NOT in this plan — tracked, with reasons)

1. **apps/admin migration (user-deferred).** 6 admin components + 3 server modules (`admin.charts.ts`, `admin.health.ts`, `admin.repository.ts`) still read the legacy `Organization` cache (`unlockedAgents`, `subscriptionStatus`, `entitlementExpiresAt`) instead of `Entitlement` rows. Those columns still exist and are populated, so admin keeps working — it just can't show per-agent expiry and can drift. `admin.repository.ts` alone is ~1,600 lines / 59 legacy-field refs and is a business-logic rewrite (churn risk, health scoring, chart bucketing). Its own plan.

2. **Phase 12 — drop legacy columns.** Gated on (a) admin migration above finishing, since it still reads them, and (b) production soak time on the new model. Dropping now breaks admin. Do it last, in its own hand-written additive-safe migration.

3. **Restrict Crew upgrades to monthly? (product decision — needs the user).** Annual Crew upgrades quote cents ($312.02 etc.) because percentage-discount basis points don't divide $348 evenly. It's correct (it's what Dodo charges) and bounded (<5¢, tested), but if the user prefers clean pricing, restricting the upgrade path to monthly Crew is a small change. Not a bug — a preference. Confirm before acting.

## Heads-up (not tasks — situational)

- **Org "Nexyth Headgear" loses access ~2026-07-18.** It was `ACTIVE` with no Dodo subscription (admin-granted), riding the old permanent-free-access bug. Backfilled as a trial ending at its own `trialEndsAt`. Expected; a real org that may notice. Decide whether to comp it before then.
- **Two legacy orgs share one Dodo subscription across two agents** (`[MAYA,REX]`, `[MAYA,SAGE]`, from the old quantity hack). Per-agent cancel correctly refuses (`shared-subscription:...`) rather than over-cancelling. They can't be split without re-purchase (Dodo = one subscription per checkout). Fine as-is; only matters if one asks to cancel a single agent.
- **The repo-wide drift is still live.** Anyone running `prisma migrate dev` here drops the 5 tables listed in Global Constraints. Worth fixing the drift itself (baseline the DB, or bring those tables into the Prisma schema) independent of billing.
