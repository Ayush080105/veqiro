# Remove Crew Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Crew (bundled all-6-agents) subscription plan entirely — database, backend, apps/main, apps/landing — leaving individually-purchased, independently-billed agents as the only purchasable unit.

**Architecture:** This is a removal layered on an already-correct per-agent entitlement model (`Entitlement`/`BillingSubscription` rows, one per agent purchase). Crew was implemented as `Entitlement.source = "CREW"` (6 rows sharing one `BillingSubscription`) plus a handful of crew-only functions/files/UI layered on top. Each task deletes or trims exactly those layers; the generic per-agent checkout/cancel/renewal code is not touched because it was never crew-specific.

**Tech Stack:** Express + Prisma 7 + PostgreSQL (Supabase) on the backend (`apps/server`), Next.js + React Query on `apps/main` and `apps/landing`, vitest for backend unit tests.

**Reference spec:** `docs/superpowers/specs/2026-07-28-remove-crew-plans-design.md`

## Global Constraints

- **Never run `git add`/`git commit`/any git command as part of executing this plan.** The user reviews and commits all changes themselves. Steps below stop at "verify it works" — do not add a commit step even though the general plan-writing convention includes one.
- No production Crew subscribers exist (confirmed) — the schema migration includes a defensive `DELETE` for any dev/test rows using the enum values being removed, since Postgres cannot drop an enum value that is still referenced by a row.
- Backend tests run from `apps/server` via `npm test` (= `vitest run`). Run a single file with `npx vitest run src/tests/unit/<file>.test.ts`.
- `apps/main` and `apps/landing` have no unit test suite. Verify changes there with `npm run build` (type-checks as part of `next build`) and `npm run lint` from the respective app directory, plus the manual browser pass in the final task.
- `apps/main` and `apps/landing` each carry an `AGENTS.md` stating this is a non-standard Next.js version with breaking changes from training data, instructing you to check `node_modules/next/dist/docs/` before writing Next.js-specific code. This plan's edits are component-level (no routing/config changes), so this is unlikely to be triggered, but keep it in mind if something behaves unexpectedly.
- The Prisma migration must run with `DATABASE_URL` pointed at the direct connection (port 5432), not the pgbouncer pooler (port 6543) — `apps/server/prisma.config.ts` reads only `DATABASE_URL` (no separate `DIRECT_URL` wiring), so temporarily point that env var at the direct connection before running `migrate deploy`, then restore it.
- Dodo's live `crew_monthly`/`crew_annual` products in the dashboard are left alone — out of scope, per the design doc.

---

### Task 1: Database schema — remove Crew enum values

**Files:**
- Modify: `apps/server/prisma/schema.prisma:52-61` (enums), `apps/server/prisma/schema.prisma:304` (default), `apps/server/prisma/schema.prisma:406-409` (enum)
- Create: `apps/server/prisma/migrations/<timestamp>_remove_crew_plan/migration.sql`

**Interfaces:**
- Produces: `EntitlementSource = TRIAL | AGENT` (was `TRIAL | AGENT | CREW`), `CheckoutKind = AGENT | MAYA_TOPUP` (was `AGENT | CREW | CREW_UPGRADE | MAYA_TOPUP`), `SubscriptionEntitlementMode = CUSTOM` (was `CREW | CUSTOM`). Every later task that imports these Prisma-generated types picks up the narrowed unions automatically after `prisma generate`.

- [ ] **Step 1: Edit schema.prisma's three enums and the entitlementMode default**

In `apps/server/prisma/schema.prisma`, change:

```prisma
/// Billing entitlement shape.
enum SubscriptionEntitlementMode {
  CREW
  CUSTOM
}

/// Where an entitlement came from.
enum EntitlementSource {
  TRIAL
  AGENT
  CREW
}
```

to:

```prisma
/// Billing entitlement shape.
enum SubscriptionEntitlementMode {
  CUSTOM
}

/// Where an entitlement came from.
enum EntitlementSource {
  TRIAL
  AGENT
}
```

Then change (around line 304):

```prisma
  entitlementMode    SubscriptionEntitlementMode @default(CREW)
```

to:

```prisma
  entitlementMode    SubscriptionEntitlementMode @default(CUSTOM)
```

Then change (around line 406-409):

```prisma
/// Kind of checkout a PendingCheckout row is waiting on.
enum CheckoutKind {
  AGENT
  CREW
  CREW_UPGRADE
  /// One-time Maya credit top-up purchase (not a subscription).
  MAYA_TOPUP
}
```

to:

```prisma
/// Kind of checkout a PendingCheckout row is waiting on.
enum CheckoutKind {
  AGENT
  /// One-time Maya credit top-up purchase (not a subscription).
  MAYA_TOPUP
}
```

- [ ] **Step 2: Write the hand-curated migration SQL**

This project's existing migrations under `apps/server/prisma/migrations/` are hand-curated (not `prisma migrate dev`) because `prisma migrate diff` against the live, drifted database produces unrelated destructive statements — see e.g. `20260716020000_add_maya_topup_checkout_kind/migration.sql`'s comment. Follow that same pattern here.

Create a new directory `apps/server/prisma/migrations/<YYYYMMDDHHMMSS>_remove_crew_plan/` (use the current UTC timestamp in that format, later than the last existing migration's timestamp) containing `migration.sql`:

```sql
-- Removes the Crew (bundled all-6-agents) subscription plan. No production
-- subscribers exist on Crew, so this is a straight removal, not a backfill.
--
-- HAND-CURATED — same reason as prior migrations in this directory:
-- `prisma migrate diff` against the live, drifted datasource is unusable.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`, so each enum is recreated:
-- rename the old type, create the new type without the removed value(s),
-- cast the column across, drop the old type. Any pre-existing CREW-source
-- rows (dev/test data only — no production Crew subscribers exist) are
-- deleted first, since the cast below would otherwise fail on them.

-- Clean up any dev/test rows using the values being removed.
DELETE FROM "entitlement" WHERE "source" = 'CREW';
DELETE FROM "pending_checkout" WHERE "kind" IN ('CREW', 'CREW_UPGRADE');

-- EntitlementSource: TRIAL | AGENT | CREW -> TRIAL | AGENT
ALTER TYPE "EntitlementSource" RENAME TO "EntitlementSource_old";
CREATE TYPE "EntitlementSource" AS ENUM ('TRIAL', 'AGENT');
ALTER TABLE "entitlement" ALTER COLUMN "source" TYPE "EntitlementSource" USING ("source"::text::"EntitlementSource");
DROP TYPE "EntitlementSource_old";

-- CheckoutKind: AGENT | CREW | CREW_UPGRADE | MAYA_TOPUP -> AGENT | MAYA_TOPUP
ALTER TYPE "CheckoutKind" RENAME TO "CheckoutKind_old";
CREATE TYPE "CheckoutKind" AS ENUM ('AGENT', 'MAYA_TOPUP');
ALTER TABLE "pending_checkout" ALTER COLUMN "kind" TYPE "CheckoutKind" USING ("kind"::text::"CheckoutKind");
DROP TYPE "CheckoutKind_old";

-- SubscriptionEntitlementMode: CREW | CUSTOM -> CUSTOM only. Existing rows
-- default to CREW; repoint them to CUSTOM before narrowing the type. This
-- field is dead (nothing writes it after this migration) but must not be
-- left pointing at a value that no longer exists.
UPDATE "subscription" SET "entitlementMode" = 'CUSTOM' WHERE "entitlementMode" = 'CREW';
ALTER TABLE "subscription" ALTER COLUMN "entitlementMode" DROP DEFAULT;
ALTER TYPE "SubscriptionEntitlementMode" RENAME TO "SubscriptionEntitlementMode_old";
CREATE TYPE "SubscriptionEntitlementMode" AS ENUM ('CUSTOM');
ALTER TABLE "subscription" ALTER COLUMN "entitlementMode" TYPE "SubscriptionEntitlementMode" USING ("entitlementMode"::text::"SubscriptionEntitlementMode");
ALTER TABLE "subscription" ALTER COLUMN "entitlementMode" SET DEFAULT 'CUSTOM';
DROP TYPE "SubscriptionEntitlementMode_old";
```

- [ ] **Step 3: Apply the migration and regenerate the Prisma client**

From `apps/server`, with `DATABASE_URL` temporarily pointed at the direct (port 5432) connection string:

```bash
npx prisma migrate deploy
npx prisma generate
```

Confirm the migration is recorded (no errors) and that `apps/server/prisma/generated/prisma/client.js`'s exported `EntitlementSource`/`CheckoutKind`/`SubscriptionEntitlementMode` no longer include `CREW`/`CREW_UPGRADE` (grep the generated client for `"CREW"` — should return nothing).

- [ ] **Step 4: Confirm the rest of the backend now fails to compile on CREW references**

From `apps/server`, run:

```bash
npx tsc --noEmit
```

Expect a long list of type errors in `billing.crew-cancel.ts`, `billing.upgrade.ts`, `billing.webhooks.ts`, `billing.service.ts`, `billing.controller.ts`, `billing.routes.ts`, `billing.catalog.ts`, `billing.catalog.controller.ts`, `maya.quotas.ts`, `entitlement.service.ts`, `maya.usage.service.ts`, and the test files — this confirms the enum narrowing took effect and gives you the exact file list Tasks 2–7 fix. Do not fix them in this task; that's what the following tasks do.

---

### Task 2: Delete crew-only backend files and their dedicated tests

**Files:**
- Delete: `apps/server/src/modules/billing/billing.crew-cancel.ts`
- Delete: `apps/server/src/modules/billing/billing.upgrade.ts`
- Delete: `apps/server/src/tests/unit/billing-crew-cancel.test.ts`
- Delete: `apps/server/src/tests/unit/billing-crew-checkout.test.ts`
- Delete: `apps/server/src/tests/unit/billing-upgrade.test.ts`

**Interfaces:**
- Consumes: nothing (pure deletion).
- Produces: nothing — these symbols (`cancelCrewAutoPay`, `resumeCrewAutoPay`, `quoteCrewUpgrade`, `UpgradeQuote`, `UpgradeIneligibleReason`) no longer exist; Task 3/4 remove their remaining import sites.

- [ ] **Step 1: Delete the two crew-only source files**

Delete `apps/server/src/modules/billing/billing.crew-cancel.ts` and `apps/server/src/modules/billing/billing.upgrade.ts` in full.

- [ ] **Step 2: Delete the three test files that exclusively test them**

Delete `apps/server/src/tests/unit/billing-crew-cancel.test.ts`, `apps/server/src/tests/unit/billing-crew-checkout.test.ts`, and `apps/server/src/tests/unit/billing-upgrade.test.ts` in full — every test in each of these three files exercises only crew-only code paths (confirmed: `billing-crew-checkout.test.ts` has no non-crew test; `billing-upgrade.test.ts` imports `quoteCrewUpgrade` directly from the deleted module).

- [ ] **Step 3: Confirm nothing outside billing.controller.ts and billing.service.ts still imports the deleted modules**

```bash
grep -rn "billing.crew-cancel\|billing.upgrade" apps/server/src --include=*.ts
```

Expect matches only in `billing.controller.ts` and `billing.service.ts` (Task 3/4 remove those import lines) and the deleted test files (already gone). If anything else references them, note it before proceeding — it means an earlier read missed a consumer.

---

### Task 3: Trim `billing.webhooks.ts` and update its test

**Files:**
- Modify: `apps/server/src/modules/billing/billing.webhooks.ts`
- Modify: `apps/server/src/tests/unit/billing-webhook-provision.test.ts`

**Interfaces:**
- Consumes: `EntitlementSource`, `SubscriptionPlan` from the regenerated Prisma client (Task 1); `ALL_AGENTS`, `getAgentMonthlyPriceCents`, `resolveAgentFromProductId` from `billing.catalog.ts` (unchanged by this task, trimmed in Task 5).
- Produces: `applyAgentActivation` (unchanged signature: `{ organizationId, dodoSubscriptionId, agent, periodEnd }`), `handleSubscriptionActive/Renewed/Cancelled/Expired/Failed`, `handlePaymentFailed`, `handleMayaTopupPaymentSucceeded`, `withWebhookEvent`, `providerEventId` — all unchanged signatures. `applyCrewActivation` no longer exists.

- [ ] **Step 1: Remove the crew imports**

In `apps/server/src/modules/billing/billing.webhooks.ts`, change:

```ts
import {
  ALL_AGENTS,
  getAgentMonthlyPriceCents,
  getCrewPriceCents,
  resolveAgentFromProductId,
  resolveCrewPlanFromProductId,
} from "./billing.catalog.js";
```

to:

```ts
import {
  ALL_AGENTS,
  getAgentMonthlyPriceCents,
  resolveAgentFromProductId,
} from "./billing.catalog.js";
```

- [ ] **Step 2: Narrow the local `CheckoutKind` type and its guard**

Change:

```ts
type CheckoutKind = "AGENT" | "CREW" | "CREW_UPGRADE" | "MAYA_TOPUP";

function isCheckoutKind(value: unknown): value is CheckoutKind {
  return value === "AGENT" || value === "CREW" || value === "CREW_UPGRADE" || value === "MAYA_TOPUP";
}
```

to:

```ts
type CheckoutKind = "AGENT" | "MAYA_TOPUP";

function isCheckoutKind(value: unknown): value is CheckoutKind {
  return value === "AGENT" || value === "MAYA_TOPUP";
}
```

- [ ] **Step 3: Delete `applyCrewActivation` entirely**

Delete the whole function (its doc comment plus body) — currently the block starting at the comment `/**\n * Provisions Crew: six CREW rows, ...` through the closing `}` of `applyCrewActivation`, immediately before `/**\n * Resolves what a \`subscription.active\` webhook is activating.`.

- [ ] **Step 4: Remove the crew branch from `resolveActivationIntent`**

Change:

```ts
function resolveActivationIntent(
  payload: WebhookPayload,
): { kind: CheckoutKind; agent: Agent | null; plan: SubscriptionPlan } | null {
  const metaKind = payload.data.metadata?.kind;
  const kind: CheckoutKind | undefined = (isCheckoutKind(metaKind) ? metaKind : undefined)
    ?? (payload.data.product_id && resolveCrewPlanFromProductId(payload.data.product_id) ? "CREW" : undefined)
    ?? (payload.data.product_id && resolveAgentFromProductId(payload.data.product_id) ? "AGENT" : undefined);

  if (!kind) return null;

  if (kind === "CREW" || kind === "CREW_UPGRADE") {
    const metaPlan = payload.data.metadata?.plan;
    const plan: SubscriptionPlan = (isPlanValue(metaPlan) ? metaPlan : undefined)
      ?? (payload.data.product_id ? resolveCrewPlanFromProductId(payload.data.product_id) : null)
      ?? "MONTHLY";
    return { kind, agent: null, plan };
  }

  const metaAgent = payload.data.metadata?.agent;
  const agent: Agent | null = (isAgentValue(metaAgent) ? metaAgent : null)
    ?? (payload.data.product_id ? resolveAgentFromProductId(payload.data.product_id) : null);

  return { kind: "AGENT", agent, plan: "MONTHLY" };
}
```

to:

```ts
function resolveActivationIntent(
  payload: WebhookPayload,
): { kind: CheckoutKind; agent: Agent | null; plan: SubscriptionPlan } | null {
  const metaKind = payload.data.metadata?.kind;
  const kind: CheckoutKind | undefined = (isCheckoutKind(metaKind) ? metaKind : undefined)
    ?? (payload.data.product_id && resolveAgentFromProductId(payload.data.product_id) ? "AGENT" : undefined);

  if (!kind) return null;

  const metaAgent = payload.data.metadata?.agent;
  const agent: Agent | null = (isAgentValue(metaAgent) ? metaAgent : null)
    ?? (payload.data.product_id ? resolveAgentFromProductId(payload.data.product_id) : null);

  return { kind: "AGENT", agent, plan: "MONTHLY" };
}
```

Also update its doc comment above: remove the sentence `and createCrewCheckout writes \`metadata: { organizationId, kind: "CREW"\n *      | "CREW_UPGRADE", plan }\` on the Dodo checkout session, and Dodo` — leave the rest of the comment describing the AGENT metadata path intact.

- [ ] **Step 5: Remove the crew branch from `handleSubscriptionActive`**

Change:

```ts
    const intent = resolveActivationIntent(payload);
    if (!intent) {
      console.warn("[billing] active webhook: unresolved intent", { orgId, dodoSubId });
      return "ignored-unresolved-agent";
    }

    if (intent.kind === "CREW" || intent.kind === "CREW_UPGRADE") {
      const { supersedeFailedIds } = await applyCrewActivation({
        organizationId: orgId,
        dodoSubscriptionId: dodoSubId,
        plan: intent.plan,
        periodEnd,
      });
      await cleanupPendingCheckouts(orgId, intent);
      // The Crew grant itself always succeeds here regardless of the
      // supersede outcome below — see applyCrewActivation's comment. Encode
      // any failure into the result string (rather than the generic
      // "applied-crew") so a still-billing superseded subscription is
      // greppable in the webhook ledger for manual reconciliation.
      return supersedeFailedIds.length > 0
        ? `applied-crew:supersede-failed:${supersedeFailedIds.join(",")}`
        : "applied-crew";
    }

    // Fail closed: never default to an agent. The payment is already
```

to:

```ts
    const intent = resolveActivationIntent(payload);
    if (!intent) {
      console.warn("[billing] active webhook: unresolved intent", { orgId, dodoSubId });
      return "ignored-unresolved-agent";
    }

    // Fail closed: never default to an agent. The payment is already
```

- [ ] **Step 6: Update the test file — remove the unused import and the four crew-only blocks**

In `apps/server/src/tests/unit/billing-webhook-provision.test.ts`:

1. Remove `applyCrewActivation,` from the destructured import (currently one line inside a multi-line import block).
2. In the shared `beforeEach`, delete these four lines:
   ```ts
   process.env.CREW_MONTHLY_CENTS = "3900";
   process.env.CREW_ANNUAL_CENTS = "34800";
   process.env.DODO_PRODUCT_CREW_MONTHLY = "pdt_crew_monthly";
   process.env.DODO_PRODUCT_CREW_ANNUAL = "pdt_crew_annual";
   ```
3. Delete the entire `describe("applyCrewActivation", () => { ... })` block (creates 6 CREW rows, supersede logic).
4. Inside `describe("handleSubscriptionActive", () => { ... })`, delete these three tests in full: `"dispatches to applyCrewActivation using metadata written at checkout, and cleans up the matching PendingCheckout row"`, `"a supersede failure during Crew activation is encoded into the webhook ledger's result, not swallowed as the generic 'applied-crew'"`, and `"REGRESSION: metadata.plan wins over a stale PendingCheckout row's plan for Crew pricing"`. Keep every other test in that describe (they're AGENT-only or generic and are unaffected).
5. Once those blocks are gone, check whether `updateCalls` (an array) and `mockDodo` (with its `vi.mock("../../lib/dodo.js", ...)`) are referenced anywhere else in the file — they were used only by the deleted blocks to assert on `dodoClient.subscriptions.update` calls during supersede. If `billing.webhooks.ts` no longer imports `dodoClient` at all after Step 3 above (check with `grep -n "dodoClient" apps/server/src/modules/billing/billing.webhooks.ts` — Step 3 removed the only caller, `applyCrewActivation`), remove `updateCalls`, the `vi.mock("../../lib/dodo.js", ...)` block, and the `updateCalls.length = 0;` reset line in `beforeEach` too. If some other surviving code in the file still calls `dodoClient`, keep an empty `vi.mock` stub but still remove `updateCalls` and its reset line.

- [ ] **Step 7: Run the affected tests**

```bash
cd apps/server && npx vitest run src/tests/unit/billing-webhook-provision.test.ts
```

Expect all remaining tests to pass.

---

### Task 4: Trim `billing.service.ts`, `billing.controller.ts`, `billing.routes.ts` and their tests

**Files:**
- Modify: `apps/server/src/modules/billing/billing.service.ts`
- Modify: `apps/server/src/modules/billing/billing.controller.ts`
- Modify: `apps/server/src/modules/billing/billing.routes.ts`
- Modify: `apps/server/src/tests/unit/billing-checkout-guards.test.ts`
- Modify: `apps/server/src/tests/unit/billing-status-derive.test.ts`
- Modify: `apps/server/src/tests/unit/billing-trial.test.ts`

**Interfaces:**
- Consumes: `agentProductId`, `normalizeAgents` from `billing.catalog.js` (Task 5 leaves these unchanged); `ACCESS_STATUSES`, `getActiveEntitlements` from `entitlement.service.js` (unchanged); `resumeAgentAutoPay` from `billing.cancel.js` (unchanged).
- Produces: `createCheckoutForOrg(organizationId, input: { agent?: unknown }): Promise<{ resumed: true; url: null } | { resumed: false; url: string }>` (was `{ agent?, cadence?, crew? }`); `assertAgentPurchasable(active, agent)` (crew guard removed); `requireOrgOwner`, `ensureBillingCustomerForOrg`, `startTrialForOrg`, `extendTrialForOrg` unchanged. `getUpgradeQuoteForOrg`, `quoteUpgradeFromActive`, `createCrewCheckout` no longer exist. `deriveStatusFields(active)` now always returns `entitlementMode: "CUSTOM"`.

- [ ] **Step 1: Trim `billing.service.ts` imports**

Change:

```ts
import {
  ALL_AGENTS,
  normalizeAgents,
  normalizePlan,
  agentProductId,
  crewProductId,
} from "./billing.catalog.js";
import { ACCESS_STATUSES, getActiveEntitlements } from "./entitlement.service.js";
import { resumeAgentAutoPay } from "./billing.cancel.js";
import { quoteCrewUpgrade, type UpgradeQuote } from "./billing.upgrade.js";
import type { Agent, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";
```

to:

```ts
import {
  ALL_AGENTS,
  normalizeAgents,
  agentProductId,
} from "./billing.catalog.js";
import { ACCESS_STATUSES, getActiveEntitlements } from "./entitlement.service.js";
import { resumeAgentAutoPay } from "./billing.cancel.js";
import type { Agent } from "../../../prisma/generated/prisma/client.js";
```

- [ ] **Step 2: Narrow `ActiveEntitlement` and simplify `assertAgentPurchasable`**

Change:

```ts
type ActiveEntitlement = {
  agent: Agent;
  source: "TRIAL" | "AGENT" | "CREW";
  cancelAtPeriodEnd: boolean;
};
```

to:

```ts
type ActiveEntitlement = {
  agent: Agent;
  source: "TRIAL" | "AGENT";
  cancelAtPeriodEnd: boolean;
};
```

Change:

```ts
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

to:

```ts
export function assertAgentPurchasable(active: ActiveEntitlement[], agent: Agent): void {
  const blocking = active.find(
    (e) => e.agent === agent && e.source === "AGENT" && !e.cancelAtPeriodEnd,
  );
  if (blocking) throw new ConflictError(`already-entitled:${agent}`);
}
```

- [ ] **Step 3: Delete `quoteUpgradeFromActive`, `getUpgradeQuoteForOrg`, and `createCrewCheckout` entirely**

Delete all three functions in full (from `quoteUpgradeFromActive`'s doc comment through `createCrewCheckout`'s closing `}`, immediately before the doc comment for `createCheckoutForOrg`).

- [ ] **Step 4: Simplify `createCheckoutForOrg`**

Change:

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

  // normalizeAgents gives slug ("rex") and enum ("REX") handling plus
```

to:

```ts
export async function createCheckoutForOrg(
  organizationId: string,
  input: { agent?: unknown },
) {
  const sub = await ensureBillingCustomerForOrg(organizationId);
  const active = await getActiveEntitlements(organizationId);

  // normalizeAgents gives slug ("rex") and enum ("REX") handling plus
```

(The rest of the function — the resumable check, `assertAgentPurchasable`, the Dodo checkout session, and the `PendingCheckout` write — is unchanged.)

- [ ] **Step 5: Trim `billing.controller.ts` imports and `deriveStatusFields`**

Change:

```ts
import {
  createCheckoutForOrg,
  getUpgradeQuoteForOrg,
  requireOrgOwner,
  startTrialForOrg,
} from "./billing.service.js";
import { cancelAgentAutoPay, resumeAgentAutoPay } from "./billing.cancel.js";
import { cancelCrewAutoPay, resumeCrewAutoPay } from "./billing.crew-cancel.js";
import { createMayaTopupCheckout } from "./billing.topup.js";
import { normalizeAgents, normalizePlan } from "./billing.catalog.js";
```

to:

```ts
import {
  createCheckoutForOrg,
  requireOrgOwner,
  startTrialForOrg,
} from "./billing.service.js";
import { cancelAgentAutoPay, resumeAgentAutoPay } from "./billing.cancel.js";
import { createMayaTopupCheckout } from "./billing.topup.js";
import { normalizeAgents } from "./billing.catalog.js";
```

Change:

```ts
export function deriveStatusFields(active: ActiveEntitlementLike[]) {
  const agents = [...new Set(active.map((e) => e.agent))];
  const isCrew = active.some((e) => e.source === "CREW");
  const trialRows = active.filter((e) => e.source === "TRIAL");
  const trialEndsAt = trialRows.length
    ? new Date(Math.max(...trialRows.map((e) => e.currentPeriodEnd.getTime())))
    : null;

  return {
    entitlementMode: (isCrew ? "CREW" : "CUSTOM") as "CREW" | "CUSTOM",
    unlockedAgents: agents,
```

to:

```ts
export function deriveStatusFields(active: ActiveEntitlementLike[]) {
  const agents = [...new Set(active.map((e) => e.agent))];
  const trialRows = active.filter((e) => e.source === "TRIAL");
  const trialEndsAt = trialRows.length
    ? new Date(Math.max(...trialRows.map((e) => e.currentPeriodEnd.getTime())))
    : null;

  return {
    entitlementMode: "CUSTOM" as const,
    unlockedAgents: agents,
```

- [ ] **Step 6: Simplify `createCheckout`, delete `getUpgradeQuote`, `cancelCrew`, `resumeCrew`**

Change:

```ts
export async function createCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const checkout = await createCheckoutForOrg(orgId, {
    agent: req.body?.agent,
    cadence: req.body?.cadence,
    crew: req.body?.crew,
  });
  res.status(StatusCodes.OK).json(checkout);
}

// Read-only pricing lookup — no owner check, any authenticated org member
// may see what a Crew upgrade would cost.
export async function getUpgradeQuote(req: Request, res: Response) {
  const organizationId = req.organizationId;
  if (!organizationId) throw new BadRequestError("No active organization selected");
  const plan = normalizePlan(req.query.cadence ?? "MONTHLY");
  res.status(StatusCodes.OK).json(await getUpgradeQuoteForOrg(organizationId, plan));
}
```

to:

```ts
export async function createCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const checkout = await createCheckoutForOrg(orgId, { agent: req.body?.agent });
  res.status(StatusCodes.OK).json(checkout);
}
```

Change:

```ts
export async function cancelCrew(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  res.status(StatusCodes.OK).json(await cancelCrewAutoPay(orgId));
}

export async function resumeCrew(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  res.status(StatusCodes.OK).json(await resumeCrewAutoPay(orgId));
}

// Owner-gated like every other checkout-initiating route (createCheckout,
// crew checkout) — this starts a real charge, unlike merely spending
```

to:

```ts
// Owner-gated like every other checkout-initiating route — this starts a
// real charge, unlike merely spending
```

(This leaves the following line, `// already-purchased Maya credits, which any org member may do.`, and the `startMayaTopupCheckout` function below it intact — only remove the two deleted-function bodies and adjust the now-orphaned first line of that comment.)

- [ ] **Step 7: Trim `billing.routes.ts`**

Change:

```ts
import {
  cancelAgent,
  cancelCrew,
  createCheckout,
  dismissPendingCheckout,
  getStatus,
  getUpgradeQuote,
  openPortal,
  resumeAgent,
  resumeCrew,
  startMayaTopupCheckout,
  startTrial,
} from "./billing.controller.js";
```

to:

```ts
import {
  cancelAgent,
  createCheckout,
  dismissPendingCheckout,
  getStatus,
  openPortal,
  resumeAgent,
  startMayaTopupCheckout,
  startTrial,
} from "./billing.controller.js";
```

Change:

```ts
router.get("/status", (req, res, next) => getStatus(req, res).catch(next));
router.get("/upgrade-quote", (req, res, next) => getUpgradeQuote(req, res).catch(next));
router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/checkout",   (req, res, next) => createCheckout(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));
router.post("/agents/:agent/cancel", (req, res, next) => cancelAgent(req, res).catch(next));
router.post("/agents/:agent/resume", (req, res, next) => resumeAgent(req, res).catch(next));
router.post("/crew/cancel", (req, res, next) => cancelCrew(req, res).catch(next));
router.post("/crew/resume", (req, res, next) => resumeCrew(req, res).catch(next));
router.post("/maya/topup/checkout", (req, res, next) => startMayaTopupCheckout(req, res).catch(next));
```

to:

```ts
router.get("/status", (req, res, next) => getStatus(req, res).catch(next));
router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/checkout",   (req, res, next) => createCheckout(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));
router.post("/agents/:agent/cancel", (req, res, next) => cancelAgent(req, res).catch(next));
router.post("/agents/:agent/resume", (req, res, next) => resumeAgent(req, res).catch(next));
router.post("/maya/topup/checkout", (req, res, next) => startMayaTopupCheckout(req, res).catch(next));
```

- [ ] **Step 8: Update `billing-checkout-guards.test.ts`**

Inside `describe("assertAgentPurchasable", () => { ... })`, delete the test `"buying any agent while Crew is active is rejected"` in full (it asserts the now-removed `crew-covers-all-agents` guard against a `source: "CREW"` fixture row). Keep the other 6 tests in that describe.

- [ ] **Step 9: Update `billing-status-derive.test.ts`**

1. In the `ent()` helper's signature, change:
   ```ts
   source: "TRIAL" | "AGENT" | "CREW",
   ```
   to:
   ```ts
   source: "TRIAL" | "AGENT",
   ```
2. Delete the test `"a CREW row sets entitlementMode CREW even alongside AGENT rows"` in full.
3. In the test `"plan comes from the row's own BillingSubscription, not a shared value"`, change:
   ```ts
   ent("MAYA", "CREW", future, { billingSubscription: { plan: "ANNUAL" } }),
   ```
   to:
   ```ts
   ent("MAYA", "AGENT", future, { billingSubscription: { plan: "ANNUAL" } }),
   ```
   (The test's point — that `plan` is read from each row's own `BillingSubscription`, not a shared value — still holds with two differently-sourced-or-agented AGENT rows; no other assertion in this test needs to change.)

- [ ] **Step 10: Update `billing-trial.test.ts`**

1. In the `Row` type, change:
   ```ts
   source: "TRIAL" | "AGENT" | "CREW";
   ```
   to:
   ```ts
   source: "TRIAL" | "AGENT";
   ```
2. Inside `describe("extendTrialForOrg — org-has-paid-entitlement guard", () => { ... })`, delete the test `"an org with an active CREW entitlement + stale TRIAL rows is refused the same way"` in full. Keep the other tests in that describe (they cover the same guard via an AGENT-source fixture).

- [ ] **Step 11: Run the affected tests**

```bash
cd apps/server && npx vitest run src/tests/unit/billing-checkout-guards.test.ts src/tests/unit/billing-status-derive.test.ts src/tests/unit/billing-trial.test.ts
```

Expect all remaining tests to pass.

---

### Task 5: Trim `billing.catalog.ts`, `billing.catalog.controller.ts`, `create-dodo-products.ts` and their tests

**Files:**
- Modify: `apps/server/src/modules/billing/billing.catalog.ts`
- Modify: `apps/server/src/modules/billing/billing.catalog.controller.ts`
- Modify: `apps/server/scripts/create-dodo-products.ts`
- Modify: `apps/server/src/tests/unit/billing-catalog.test.ts`
- Modify: `apps/server/src/tests/unit/billing-catalog-endpoint.test.ts`

**Interfaces:**
- Produces: `buildCatalogPayload(): { agents: Record<Agent, { priceCents: number }>; currency: string }` (was `{ agents, crew, currency }`) — this is what `GET /billing/catalog` returns, consumed by apps/main (Task 9) and apps/landing (Task 12/13/14).
- `crewProductId`, `getCrewPriceCents`, `resolveCrewPlanFromProductId`, `isCrewSelection` no longer exist.

- [ ] **Step 1: Remove the four crew-only exports from `billing.catalog.ts`**

Delete `isCrewSelection` (the `agents.length === ALL_AGENTS.length && ...` function), `getCrewPriceCents`, `crewProductId`, and `resolveCrewPlanFromProductId` in full. Keep everything else (`ALL_AGENTS`, `AGENT_SLUG_TO_ENUM`, `normalizeAgents`, `normalizePlan`, `getAgentMonthlyPriceCents`, `AGENT_PRODUCT_ENV_KEYS`, `agentProductId`, `mayaTopupUnitProductId`, `resolveAgentFromProductId`) unchanged.

- [ ] **Step 2: Simplify `billing.catalog.controller.ts`**

Replace the whole file with:

```ts
import { Request, Response } from "express";
import { ALL_AGENTS, getAgentMonthlyPriceCents } from "./billing.catalog.js";

export function buildCatalogPayload() {
  const agents = Object.fromEntries(
    ALL_AGENTS.map((agent) => [agent, { priceCents: getAgentMonthlyPriceCents(agent) }]),
  );

  return {
    agents,
    currency: "USD",
  };
}

/** Public, unauthenticated — apps/landing and apps/main both read real prices from here. */
export function getBillingCatalog(_req: Request, res: Response) {
  res.status(200).json(buildCatalogPayload());
}
```

- [ ] **Step 3: Trim `create-dodo-products.ts`**

Change the import:

```ts
import {
  ALL_AGENTS,
  AGENT_PRODUCT_ENV_KEYS,
  getAgentMonthlyPriceCents,
  getCrewPriceCents,
} from "../src/modules/billing/billing.catalog.js";
```

to:

```ts
import {
  ALL_AGENTS,
  AGENT_PRODUCT_ENV_KEYS,
  getAgentMonthlyPriceCents,
} from "../src/modules/billing/billing.catalog.js";
```

Change `buildSkus()`:

```ts
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

  // Individual agents are monthly-only by design; annual exists for Crew alone.
  return [
    ...agents,
    {
      kind: "recurring",
      sku: "crew_monthly",
      envKey: "DODO_PRODUCT_CREW_MONTHLY",
      name: "Veqiro Crew — All 6 AI Employees (Monthly)",
      description: "Maya, Sage, Lex, Rex, Scout and Vega. Billed monthly.",
      priceCents: getCrewPriceCents("MONTHLY"),
      interval: "Month",
    },
    {
      kind: "recurring",
      sku: "crew_annual",
      envKey: "DODO_PRODUCT_CREW_ANNUAL",
      name: "Veqiro Crew — All 6 AI Employees (Annual)",
      description: "Maya, Sage, Lex, Rex, Scout and Vega. Billed once yearly.",
      priceCents: getCrewPriceCents("ANNUAL"),
      interval: "Year",
    },
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
```

to:

```ts
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
```

Also update the file's top doc comment: change `"Create the 9 Dodo products the billing system needs (6 agents + Crew\n * monthly/annual + the Maya credit top-up unit)"` to `"Create the 7 Dodo products the billing system needs (6 agents + the Maya\n * credit top-up unit)"`.

- [ ] **Step 4: Update `billing-catalog.test.ts`**

1. Remove the now-unused imports — in the import block, delete these three lines:
   ```ts
   crewProductId,
   resolveCrewPlanFromProductId,
   getCrewPriceCents,
   ```
2. In `beforeEach`, delete:
   ```ts
   process.env.DODO_PRODUCT_CREW_MONTHLY = "pdt_crew_m";
   process.env.DODO_PRODUCT_CREW_ANNUAL = "pdt_crew_a";
   ```
3. In `afterEach`, delete:
   ```ts
   delete process.env.DODO_PRODUCT_CREW_MONTHLY;
   delete process.env.DODO_PRODUCT_CREW_ANNUAL;
   ```
4. Inside `describe("product id mapping", () => { ... })`, delete these three tests in full: `"crew plan → product id"`, `"crew product id does not resolve to an agent"`, `"product id → crew plan"`.
5. In the surviving test `"unknown product id resolves to null, never throws"`, delete the line:
   ```ts
   assert.equal(resolveCrewPlanFromProductId("pdt_bogus"), null);
   ```
6. In the surviving test `"undefined product id resolves to null even when env vars are unset"`, delete these two lines:
   ```ts
   delete process.env.DODO_PRODUCT_CREW_MONTHLY;
   ```
   and:
   ```ts
   assert.equal(resolveCrewPlanFromProductId(undefined as never), null);
   ```
7. In the surviving test `"empty product id resolves to null"`, delete the line:
   ```ts
   assert.equal(resolveCrewPlanFromProductId(""), null);
   ```
8. Inside `describe("prices", () => { ... })`, delete the test `"crew monthly 3900, annual 34800"` in full.

- [ ] **Step 5: Update `billing-catalog-endpoint.test.ts`**

1. In `afterEach`, delete the line:
   ```ts
   delete process.env.CREW_MONTHLY_CENTS;
   ```
2. In the test currently titled `"shape covers all 6 agents plus crew monthly/annual"`, delete these two lines:
   ```ts
   assert.equal(payload.crew.monthly.priceCents, 3900);
   assert.equal(payload.crew.annual.priceCents, 34800);
   ```
   and rename the test title to `"shape covers all 6 agents"`.
3. In the test `"reflects env var overrides"`, delete these two lines:
   ```ts
   process.env.CREW_MONTHLY_CENTS = "4500";
   ```
   and:
   ```ts
   assert.equal(payload.crew.monthly.priceCents, 4500);
   ```

- [ ] **Step 6: Run the affected tests**

```bash
cd apps/server && npx vitest run src/tests/unit/billing-catalog.test.ts src/tests/unit/billing-catalog-endpoint.test.ts
```

Expect all remaining tests to pass.

---

### Task 6: Trim `maya.quotas.ts`, `entitlement.service.ts`, `maya.usage.service.ts` and their tests

**Files:**
- Modify: `apps/server/src/modules/agents/maya/maya.quotas.ts`
- Modify: `apps/server/src/modules/billing/entitlement.service.ts`
- Modify: `apps/server/src/modules/agents/maya/maya.usage.service.ts`
- Modify: `apps/server/src/tests/unit/maya-quotas.test.ts`
- Modify: `apps/server/src/tests/unit/maya-usage.test.ts`
- Modify: `apps/server/src/tests/unit/entitlement-access.test.ts`

**Interfaces:**
- Produces: `getQuotaForMayaEntitlement(e: { source: EntitlementSource; plan: SubscriptionPlan | null }): number` — now `TRIAL → 30, else → 300` (no more 400-credit tier). `getMayaEntitlement(organizationId): Promise<Entitlement | null>` — ranking table now `{ AGENT: 2, TRIAL: 1 }`. `displayTierFor(source: EntitlementSource): "TRIAL" | "MONTHLY_CUSTOM"` (dropped the unused `plan` parameter and the two CREW tiers).

- [ ] **Step 1: Simplify `getQuotaForMayaEntitlement` in `maya.quotas.ts`**

Change:

```ts
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

to:

```ts
/** Maya's monthly credit allowance, read live from her entitlement. */
export function getQuotaForMayaEntitlement(e: {
  source: EntitlementSource;
  plan: SubscriptionPlan | null;
}): number {
  return e.source === "TRIAL" ? 30 : 300;
}
```

- [ ] **Step 2: Simplify `getMayaEntitlement` in `entitlement.service.ts`**

Change:

```ts
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

to:

```ts
/**
 * Maya's governing entitlement, used for quota lookup. When rows overlap the
 * most generous one wins: AGENT outranks TRIAL, and among equals the later
 * period end wins.
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
  const rank = { AGENT: 2, TRIAL: 1 } as const;
  return rows.sort((a, b) =>
    rank[b.source] - rank[a.source] ||
    b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime())[0];
}
```

- [ ] **Step 3: Simplify `displayTierFor` in `maya.usage.service.ts`**

Change:

```ts
type DisplayTier = "TRIAL" | "MONTHLY_CUSTOM" | "MONTHLY_CREW" | "ANNUAL_CREW";

function displayTierFor(source: EntitlementSource, plan: SubscriptionPlan | null): DisplayTier {
  if (source === "TRIAL") return "TRIAL";
  if (source === "CREW") return plan === "ANNUAL" ? "ANNUAL_CREW" : "MONTHLY_CREW";
  return "MONTHLY_CUSTOM"; // source === "AGENT": an individually-purchased agent, always MONTHLY.
}
```

to:

```ts
type DisplayTier = "TRIAL" | "MONTHLY_CUSTOM";

function displayTierFor(source: EntitlementSource): DisplayTier {
  return source === "TRIAL" ? "TRIAL" : "MONTHLY_CUSTOM"; // source === "AGENT": an individually-purchased agent, always MONTHLY.
}
```

And update its one call site a few lines down — change:

```ts
  const tier = displayTierFor(ent.source, plan);
```

to:

```ts
  const tier = displayTierFor(ent.source);
```

(`plan` is still computed just above and still passed to `getQuotaForMayaEntitlement({ source: ent.source, plan })` on the next line — leave that call and the `plan` computation itself untouched, only the now-unnecessary second argument to `displayTierFor` is removed.)

- [ ] **Step 4: Update `maya-quotas.test.ts`**

Inside `describe("getQuotaForMayaEntitlement", () => { ... })`, delete these two tests in full: `"crew monthly → 300"` and `"crew annual → 400 (per month, not per year)"`. Keep the other two tests in that describe.

- [ ] **Step 5: Update `entitlement-access.test.ts`**

1. Inside `describe("hasAgentAccess", () => { ... })`, delete these two tests in full: `"CREW row grants access to an agent with no AGENT row"` and `"overlapping rows: expired AGENT + active CREW → access"`.
2. Inside `describe("entitlementMiddlewareForAgent", () => { ... })`, in the test `"one PAST_DUE row alongside a healthy ACTIVE row → next() called and header NOT set"`, change:
   ```ts
   { organizationId: "o1", agent: "MAYA", source: "CREW",  status: "ACTIVE",   currentPeriodEnd: future, priceCents: 650 },
   ```
   to:
   ```ts
   { organizationId: "o1", agent: "MAYA", source: "AGENT", status: "ACTIVE",   currentPeriodEnd: future, priceCents: 650 },
   ```
   (keep the test — its point is "any healthy covering row suppresses the past-due header," which an AGENT row demonstrates just as well).
3. Inside `describe("getMayaEntitlement", () => { ... })`, delete these four tests in full: `"TRIAL + CREW rows both covering → returns the CREW row"`, `"AGENT + CREW rows both covering → returns the CREW row (mid-period upgrade)"`, `"two CREW rows → returns the one with the later currentPeriodEnd"`, `"an expired CREW row + an active AGENT row → returns the AGENT row (expired rows must not win)"`. Keep `"TRIAL + AGENT rows both covering → returns the AGENT row"` and `"no covering rows → returns null"`.

- [ ] **Step 6: Update `maya-usage.test.ts`**

1. In the `crewEntitlement()` helper function, change:
   ```ts
   source: "CREW",
   ```
   to:
   ```ts
   source: "AGENT",
   ```
   This fixture is called from every test in the file (as a generic "org has an active paid Maya entitlement" fixture) — this one edit fixes every call site, since none of the surviving tests assert anything tier-specific about it.
2. Inside `describe("getCurrentUsage", () => { ... })`, delete these three tests in full: `"CREW + ANNUAL billing subscription → tier ANNUAL_CREW, limit 400 (not the annual billing period)"`, `"CREW + MONTHLY billing subscription → tier MONTHLY_CREW, limit 300"`, `"mid-period upgrade (AGENT → CREW) raises the ceiling on the SAME open window without resetting usage"` (the `ANNUAL_CREW`/`MONTHLY_CREW` tiers and the AGENT→CREW upgrade path no longer exist). Keep every other test in that describe and every other describe in the file — they use `crewEntitlement()` purely as a generic fixture and assert nothing tier-specific.

- [ ] **Step 7: Run the affected tests**

```bash
cd apps/server && npx vitest run src/tests/unit/maya-quotas.test.ts src/tests/unit/entitlement-access.test.ts src/tests/unit/maya-usage.test.ts
```

Expect all remaining tests to pass.

---

### Task 7: Update the two remaining test files with minor crew references

**Files:**
- Modify: `apps/server/src/tests/unit/billing-cancel.test.ts`
- Modify: `apps/server/src/tests/unit/billing-topup.test.ts`

**Interfaces:**
- Consumes: `cancelAgentAutoPay`, `resumeAgentAutoPay` from `billing.cancel.js` (unchanged by Tasks 1–6).

- [ ] **Step 1: Update `billing-cancel.test.ts`**

1. Delete the entire `describe("crew overlap (per-agent cancel must never resolve to a Crew subscription)", () => { ... })` block (tests `source: "CREW"` rows and the now-removed `covered-by-crew:*` error path).
2. Inside `describe("shared-subscription guard (legacy quantity-hack backfill)", () => { ... })`, delete the test `"a CREW-source subscription is refused, not silently cancelled as a bundle"` and the explanatory comment block directly above it (the one starting `// Resolution now filters to source:"AGENT" and refuses before the guard is\n// ever reached, so a CREW-covered agent can never be cancelled this way.`). Keep the other two tests in that describe (they cover the legacy same-subscription-two-AGENT-rows scenario, unaffected).

- [ ] **Step 2: Update `billing-topup.test.ts`**

In the `crewMayaEntitlement()` helper function, change:

```ts
    organizationId: orgId, agent: "MAYA", source: "CREW", status: "ACTIVE",
```

to:

```ts
    organizationId: orgId, agent: "MAYA", source: "AGENT", status: "ACTIVE",
```

This one edit fixes every call site in the file (used only as a generic "Maya has an active covering paid entitlement" fixture; no test asserts anything tier/source-specific).

- [ ] **Step 3: Run the full backend test suite**

```bash
cd apps/server && npm test
```

Expect every test to pass, and confirm no file anywhere under `apps/server/src` still contains the string `CREW`:

```bash
grep -rln "CREW" apps/server/src --include=*.ts
```

Expect no output (aside from files under `apps/server/prisma/generated/` if that grep is run repo-root-relative — restrict to `apps/server/src` as shown, which excludes generated code).

- [ ] **Step 4: Full backend typecheck**

```bash
cd apps/server && npx tsc --noEmit
```

Expect zero errors — this confirms Tasks 2–7 collectively closed every compile error Task 1 surfaced.

---

### Task 8: apps/main — delete crew components, rewrite `AgentEntitlementRow.tsx`, trim `AgentPeriodList.tsx` and `entitlement-errors.ts`

**Files:**
- Delete: `apps/main/src/components/billing/CrewUpgradeCard.tsx`
- Delete: `apps/main/src/components/billing/CrewSubscriptionCard.tsx`
- Modify: `apps/main/src/components/billing/AgentEntitlementRow.tsx`
- Modify: `apps/main/src/components/billing/AgentPeriodList.tsx`
- Modify: `apps/main/src/components/billing/entitlement-errors.ts`

**Interfaces:**
- Produces: `AgentEntitlementRow({ entitlement: AgentEntitlement })` — read-only now, no `onChanged`/`isOwner` props, no cancel/resume button. `billingActionErrorMessage(error, fallback?)` — same signature, fewer branches. Task 10 (billing page rewrite) depends on `AgentEntitlementRow`'s new prop shape.

- [ ] **Step 1: Delete the two crew card components**

Delete `apps/main/src/components/billing/CrewUpgradeCard.tsx` and `apps/main/src/components/billing/CrewSubscriptionCard.tsx` in full.

- [ ] **Step 2: Rewrite `AgentEntitlementRow.tsx` as read-only**

Replace the whole file with:

```tsx
"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AgentEntitlement } from "@/lib/api/billing"
import { money } from "@/lib/format"

const AGENT_IMAGES: Record<string, string> = {
  MAYA: "/agents/maya.jpeg", SAGE: "/agents/sage.jpeg", LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg", SCOUT: "/agents/scout.jpeg", VEGA: "/agents/vega.jpeg",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// Read-only: cancelling or resuming an agent's auto-pay happens through
// Dodo's hosted billing portal now (see settings/billing/page.tsx's "Manage
// billing" button), not an in-app toggle.
export function AgentEntitlementRow({ entitlement }: { entitlement: AgentEntitlement }) {
  const { agent, source, status, currentPeriodEnd, cancelAtPeriodEnd, priceCents } = entitlement

  return (
    <Card variant="brand" size="sm">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative size-10 overflow-hidden rounded-full border-2 border-foreground bg-muted">
            <Image src={AGENT_IMAGES[agent]} alt={`${agent} portrait`} fill sizes="40px" className="object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{agent.toLowerCase()}</span>
              {source === "TRIAL" && <Badge variant="secondary">Trial</Badge>}
              {status === "PAST_DUE" && <Badge variant="destructive">Payment failed</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {cancelAtPeriodEnd
                ? `Access until ${formatDate(currentPeriodEnd)}`
                : source === "TRIAL"
                  ? `Trial ends ${formatDate(currentPeriodEnd)}`
                  : `Renews ${formatDate(currentPeriodEnd)}`}
              {source !== "TRIAL" && <> · {money(priceCents)}/mo</>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Drop the `CREW` label from `AgentPeriodList.tsx`**

Change:

```ts
const SOURCE_LABELS: Record<AgentEntitlement["source"], string> = {
  TRIAL: "Trial",
  AGENT: "Individual",
  CREW: "Crew",
}
```

to:

```ts
const SOURCE_LABELS: Record<AgentEntitlement["source"], string> = {
  TRIAL: "Trial",
  AGENT: "Individual",
}
```

- [ ] **Step 4: Remove crew branches from `entitlement-errors.ts`**

Change:

```ts
  if (message.startsWith("shared-subscription:")) {
    const agents = (message.split(":")[1] ?? "")
      .split(",")
      .filter(Boolean)
      .map((a) => a.charAt(0) + a.slice(1).toLowerCase())
    const list = agents.length ? agents.join(" and ") : "another agent"
    return `This agent's billing is tied together with ${list} on one legacy subscription, so it can't be cancelled on its own. Contact support to split them.`
  }
  if (message.startsWith("covered-by-crew:")) {
    return "This agent is covered by your Crew plan, not its own subscription. Cancel the Crew plan if you want to stop billing for it."
  }
  if (message === "no-subscription-for-agent") {
    return "We couldn't find a billing subscription for this agent. Contact support."
  }
  if (message.startsWith("not-entitled:")) {
    return "You don't currently own this agent."
  }
  if (message === "crew-covers-all-agents") {
    return "Your Crew plan already includes this agent."
  }
  if (message === "no-crew-subscription") {
    return "You don't have an active Crew subscription to cancel."
  }
  if (message.startsWith("already-entitled:")) {
    return "You already own this agent."
  }
```

to:

```ts
  if (message.startsWith("shared-subscription:")) {
    const agents = (message.split(":")[1] ?? "")
      .split(",")
      .filter(Boolean)
      .map((a) => a.charAt(0) + a.slice(1).toLowerCase())
    const list = agents.length ? agents.join(" and ") : "another agent"
    return `This agent's billing is tied together with ${list} on one legacy subscription, so it can't be cancelled on its own. Contact support to split them.`
  }
  if (message === "no-subscription-for-agent") {
    return "We couldn't find a billing subscription for this agent. Contact support."
  }
  if (message.startsWith("not-entitled:")) {
    return "You don't currently own this agent."
  }
  if (message.startsWith("already-entitled:")) {
    return "You already own this agent."
  }
```

Also update the function's doc comment just above (`"Maps the raw error strings billing.cancel.ts / billing.service.ts throw\n * (\`shared-subscription:<AGENTS>\`, \`covered-by-crew:<AGENT>\`, etc.)..."`) — drop the `covered-by-crew:<AGENT>` example from the parenthetical, leaving `shared-subscription:<AGENTS>` as the example.

---

### Task 9: apps/main — trim `lib/api/billing.ts` types

**Files:**
- Modify: `apps/main/src/lib/api/billing.ts`

**Interfaces:**
- Produces: `CheckoutInput = { agent: BillingAgent }` (was a `crew`/`agent` union with `cadence`); `CheckoutResult = { resumed: true; url: null } | { resumed: false; url: string }` (dropped `discountApplied`); `BillingCatalogResponse = { agents: Record<BillingAgent, { priceCents: number }>; currency: string }` (dropped `crew`); `EntitlementSource = "TRIAL" | "AGENT"`; `EntitlementMode = "CUSTOM"`; `MayaUsageTier = "TRIAL" | "MONTHLY_CUSTOM"`. `useUpgradeQuote`, `cancelCrew`, `resumeCrew` no longer exist. Task 8's `AgentEntitlementRow` and Task 10's billing page consume these types; Task 11's usage page consumes `MayaUsageTier`.

- [ ] **Step 1: Narrow `EntitlementMode` and `EntitlementSource`**

Change:

```ts
export type EntitlementMode = "CREW" | "CUSTOM";

export type EntitlementSource = "TRIAL" | "AGENT" | "CREW";
```

to:

```ts
export type EntitlementMode = "CUSTOM";

export type EntitlementSource = "TRIAL" | "AGENT";
```

- [ ] **Step 2: Narrow the `pendingCheckout.kind` union on `BillingSubscription`**

Change:

```ts
  pendingCheckout: {
    kind: "AGENT" | "CREW" | "CREW_UPGRADE" | "MAYA_TOPUP";
    agent: BillingAgent | null;
    plan: SubscriptionPlan;
    createdAt: string;
  } | null;
```

to:

```ts
  pendingCheckout: {
    kind: "AGENT" | "MAYA_TOPUP";
    agent: BillingAgent | null;
    plan: SubscriptionPlan;
    createdAt: string;
  } | null;
```

- [ ] **Step 3: Drop `crew` from `BillingCatalogResponse`**

Change:

```ts
export type BillingCatalogResponse = {
  agents: Record<BillingAgent, { priceCents: number }>;
  crew: { monthly: { priceCents: number }; annual: { priceCents: number } };
  currency: string;
};
```

to:

```ts
export type BillingCatalogResponse = {
  agents: Record<BillingAgent, { priceCents: number }>;
  currency: string;
};
```

- [ ] **Step 4: Simplify `CheckoutInput` and `CheckoutResult`**

Change:

```ts
// Matches the server's `createCheckoutForOrg` input exactly: an individual
// agent purchase is MONTHLY-only and names exactly one agent (no cadence to
// pick), while Crew names a cadence and never an agent. An annual
// individual-agent purchase and a multi-agent purchase are unrepresentable in
// this type, not merely rejected at runtime.
export type CheckoutInput =
  | { crew: true; cadence: SubscriptionPlan; agent?: never }
  | { crew?: false; agent: BillingAgent; cadence?: never };

// Buying a cancelled-but-unexpired agent resumes auto-pay instead of
// charging again, and the server returns `url: null` for that branch — this
// union forces every caller to check `resumed` before touching `.url`, so
// `window.location.href = result.url` on a null (navigating to the literal
// string "null") is a type error, not a runtime surprise.
//
// `discountApplied` is only ever present on a Crew checkout response (never
// on a per-agent one): "applied" | "failed" tells the caller whether the
// credited discount actually got attached, so a failure can be surfaced
// instead of the customer silently being charged full price. "not-eligible"
// means there was no credit to apply in the first place (nothing owned, or
// credit exceeds Crew's price) — not a failure, so no warning is needed.
export type CheckoutResult =
  | { resumed: true; url: null }
  | { resumed: false; url: string; discountApplied?: "applied" | "failed" | "not-eligible" };
```

to:

```ts
// Matches the server's `createCheckoutForOrg` input exactly: an individual
// agent purchase is MONTHLY-only and names exactly one agent — a multi-agent
// purchase is unrepresentable in this type, not merely rejected at runtime.
export type CheckoutInput = { agent: BillingAgent };

// Buying a cancelled-but-unexpired agent resumes auto-pay instead of
// charging again, and the server returns `url: null` for that branch — this
// union forces every caller to check `resumed` before touching `.url`, so
// `window.location.href = result.url` on a null (navigating to the literal
// string "null") is a type error, not a runtime surprise.
export type CheckoutResult =
  | { resumed: true; url: null }
  | { resumed: false; url: string };
```

- [ ] **Step 5: Delete the upgrade-quote section and `cancelCrew`/`resumeCrew`**

Delete the whole block from the `// ─── Per-agent cancel/resume + upgrade pricing ─────────────────────────────` comment through `useUpgradeQuote`'s closing `}` (this removes `UpgradeIneligibleReason`, `UpgradeQuoteResponse`, and `useUpgradeQuote`). Replace the section comment with `// ─── Per-agent cancel/resume ───────────────────────────────────────────────` directly above the surviving `cancelAgent`/`resumeAgent` functions.

Then delete `cancelCrew` and `resumeCrew` in full (the two functions immediately after `resumeAgent`).

- [ ] **Step 6: Narrow `MayaUsageTier`**

Change:

```ts
export type MayaUsageTier = "TRIAL" | "MONTHLY_CUSTOM" | "MONTHLY_CREW" | "ANNUAL_CREW";
```

to:

```ts
export type MayaUsageTier = "TRIAL" | "MONTHLY_CUSTOM";
```

- [ ] **Step 7: Verify no remaining references**

```bash
grep -rn "crew\|Crew\|CREW" apps/main/src/lib/api/billing.ts
```

Expect no output.

---

### Task 10: apps/main — rewrite `settings/billing/page.tsx`

**Files:**
- Modify: `apps/main/src/app/(dashboard)/settings/billing/page.tsx`

**Interfaces:**
- Consumes: `AgentEntitlementRow({ entitlement })` (Task 8's new read-only signature), `AgentBuyCard` (unchanged), `dismissPendingCheckout`, `openBillingPortal`, `useBillingCatalog`, `useBillingStatus`, `BillingAgent` (Task 9's trimmed types).

- [ ] **Step 1: Replace the whole file**

Replace `apps/main/src/app/(dashboard)/settings/billing/page.tsx` in full with:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CreditCard } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { authClient, useSession } from "@/lib/auth-client"
import { AgentEntitlementRow } from "@/components/billing/AgentEntitlementRow"
import { AgentBuyCard } from "@/components/billing/AgentBuyCard"
import { BillingAgent, dismissPendingCheckout, openBillingPortal, useBillingCatalog, useBillingStatus } from "@/lib/api/billing"
import { qk } from "@/lib/query-keys"

const ALL_AGENTS: BillingAgent[] = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"]

// Fallback only, for the brief window before /billing/catalog resolves — the
// real prices always come from the server (single source of truth, shared
// with apps/landing) so this can never drift from what's actually charged.
const DEFAULT_AGENT_MONTHLY_CENTS: Record<BillingAgent, number> = {
  MAYA: 1900,
  SAGE: 900,
  LEX: 900,
  REX: 900,
  SCOUT: 900,
  VEGA: 900,
}

type AugmentedSession = {
  activeOrganization?: { id?: string } | null
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const augmented = session as (AugmentedSession & typeof session) | null
  const organizationId = activeOrg?.id ?? augmented?.activeOrganization?.id
  const { data: billing, refetch, isPending } = useBillingStatus(organizationId)
  const { data: catalog } = useBillingCatalog()
  const { data: activeMemberRole, isPending: isRolePending } = authClient.useActiveMemberRole()
  const queryClient = useQueryClient()
  const sub = billing?.subscription

  // useMayaUsage rides its own query key (qk.mayaUsage), separate from
  // useBillingStatus's — a buy/resume here changes entitlements but never
  // auto-refreshes the Usage page's/Maya credits pill's own query, so it
  // must be invalidated explicitly alongside the billing-status refetch.
  function onEntitlementsChanged() {
    void refetch()
    if (organizationId) void queryClient.invalidateQueries({ queryKey: qk.mayaUsage(organizationId) })
  }
  // Server-side, every mutating billing route (checkout, portal) is
  // owner-gated via requireOrgOwner — a non-owner hitting them gets a 403.
  // Disabling proactively here is better UX than letting them click through
  // to a failed request. Default true while the role is still loading so
  // buttons don't flash disabled-then-enabled for the common owner case.
  const isOwner = isRolePending || activeMemberRole?.role === "owner"

  function getMonthlyPrice(agent: BillingAgent): number {
    return catalog?.agents[agent]?.priceCents ?? DEFAULT_AGENT_MONTHLY_CENTS[agent]
  }

  const [portaling, setPortaling] = useState(false)
  const [syncingCheckout, setSyncingCheckout] = useState(false)

  useEffect(() => {
    if (searchParams.get("status") !== "success") return
    void refetch().then(() => {
      setSyncingCheckout(true)
      toast.info("Payment complete", { description: "Syncing your agent access..." })
      router.replace("/settings/billing")
    })
  }, [searchParams, refetch, router])

  useEffect(() => {
    if (searchParams.get("status") !== "cancelled") return
    toast.info("Checkout cancelled", { description: "No charge was made." })
    router.replace("/settings/billing")
  }, [searchParams, router])

  useEffect(() => {
    if (!syncingCheckout) return
    // Caps the poll at ~30s (15 attempts * 2s) rather than spinning forever
    // if a webhook is lost or delayed — surfaces a "still syncing" state
    // instead of an endless silent loop.
    let attempts = 0
    const interval = window.setInterval(() => {
      attempts += 1
      void refetch().then((result) => {
        if (!result.data?.subscription?.pendingCheckout) {
          setSyncingCheckout(false)
          toast.success("Billing updated", { description: "Your agent access is ready." })
          // A fresh purchase can raise the credit tier — the Usage page /
          // credits pill's own query must not keep showing the pre-purchase
          // limit until its own staleTime happens to lapse.
          if (organizationId) void queryClient.invalidateQueries({ queryKey: qk.mayaUsage(organizationId) })
        } else if (attempts >= 15) {
          setSyncingCheckout(false)
          toast.warning("Still syncing", {
            description: "This is taking longer than usual — refresh the page or contact support if it doesn't update soon.",
          })
        }
      })
    }, 2000)
    return () => window.clearInterval(interval)
  }, [syncingCheckout, refetch, organizationId, queryClient])

  async function handlePortal() {
    setPortaling(true)
    try {
      const res = await openBillingPortal()
      if (res.url) window.location.href = res.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal")
    } finally {
      setPortaling(false)
    }
  }

  const [dismissing, setDismissing] = useState(false)
  // Only offered once a pending checkout has clearly stopped being "in
  // progress" — a real purchase resolves within seconds of a webhook
  // arriving, so anything older than this is genuinely stuck (lost webhook,
  // abandoned checkout) rather than mid-flight.
  const PENDING_CHECKOUT_STUCK_MS = 10 * 60 * 1000
  const pendingCheckoutAgeMs = sub?.pendingCheckout
    ? Date.now() - new Date(sub.pendingCheckout.createdAt).getTime()
    : 0
  const pendingCheckoutStuck = pendingCheckoutAgeMs > PENDING_CHECKOUT_STUCK_MS

  async function handleDismissPendingCheckout() {
    setDismissing(true)
    try {
      await dismissPendingCheckout()
      await refetch()
      toast.success("Cleared", { description: "You can start a new checkout any time." })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear this checkout")
    } finally {
      setDismissing(false)
    }
  }

  const entitlements = useMemo(() => sub?.entitlements ?? [], [sub?.entitlements])
  // TRIAL doesn't count as "owned" for Buy-card purposes — the backend
  // already allows converting a trialing agent to paid early
  // (assertAgentPurchasable explicitly permits this), so treating a TRIAL
  // row as ownership hid every per-agent Buy card for an org's entire 7-day
  // trial, even though buying one mid-trial is a real, working flow.
  const ownedAgents = useMemo(
    () => new Set(entitlements.filter((e) => e.source !== "TRIAL").map((e) => e.agent)),
    [entitlements],
  )
  const unownedAgents = ALL_AGENTS.filter((agent) => !ownedAgents.has(agent))
  const pastDueAgents = entitlements.filter((e) => e.status === "PAST_DUE")
  // Data hasn't arrived yet: don't flash "buy all six" for a paying customer
  // while their real entitlements are still loading.
  const dataReady = Boolean(organizationId) && !isPending

  // sub.status is the legacy Subscription.status column — it can never be
  // "TRIALING" any more (trial state lives on Entitlement rows now, see
  // deriveStatusFields's doc comment in billing.controller.ts), so a fresh
  // trial org's Subscription row sits at its ensureBillingCustomerForOrg
  // default of "EXPIRED" forever and never changes. Everything below derives
  // from entitlements instead.
  const isTrialing = entitlements.some((e) => e.source === "TRIAL")
  const agentCount = ownedAgents.size

  // A Dodo customer (and therefore something for the portal to show) exists
  // from the very first trial-start or checkout — a real, permanent signal,
  // unlike the dead status column this used to read.
  const canManageBilling = Boolean(sub?.dodoCustomerId)

  // "No active plan" is a real, reachable state (not just theoretical): the
  // trial is once-per-org-forever, so an org can sit here indefinitely after
  // it lapses without ever buying anything.
  const statusLabel =
    !sub ? "No subscription"
    : isTrialing ? `Trial · ${sub.daysRemaining ?? 0} days left`
    : agentCount > 0 ? `${agentCount} agent${agentCount === 1 ? "" : "s"} active`
    : "No active plan"

  const hasActiveAccess = isTrialing || agentCount > 0

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Each agent bills on its own — buy, cancel, or resume independently."
        sticker={{ label: "agent billing", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      {pastDueAgents.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Payment failed for {pastDueAgents.map((e) => e.agent.toLowerCase()).join(", ")}. You still have access
          through the paid-for period — update your payment method via &quot;Manage billing&quot; below to keep it renewing.
        </div>
      )}

      <Card variant="brand">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold">Current access</CardTitle>
              <CardDescription>
                {sub ? "Each agent below is its own subscription." : "You haven't purchased any agents yet."}
              </CardDescription>
            </div>
            <Badge variant={hasActiveAccess ? "default" : "secondary"}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        {(sub?.pendingCheckout || canManageBilling) && (
          <CardContent className="flex flex-col gap-4">
            {sub?.pendingCheckout && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-fit">
                    Checkout syncing
                  </Badge>
                  {/* Not gated on syncStalled alone — a pendingCheckout row can
                      also be stale on a completely fresh page load (no active
                      polling session ever started), which previously left this
                      badge permanently stuck with no way to manually recheck. */}
                  {!syncingCheckout && (
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                      Check again
                    </Button>
                  )}
                  {pendingCheckoutStuck && (
                    <Button size="sm" variant="outline" onClick={handleDismissPendingCheckout} disabled={dismissing}>
                      {dismissing ? "Clearing..." : "Not you? Dismiss"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingCheckoutStuck
                    ? "This checkout has been syncing for a while — if you didn't complete it, dismiss it and start again."
                    : "We're waiting for payment confirmation — this usually takes a few seconds."}
                </p>
              </div>
            )}
            {canManageBilling && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <CreditCard className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Manage billing</p>
                      <p className="text-xs text-muted-foreground">
                        View invoices, update your payment method, or cancel any agent — all through Dodo&apos;s secure billing portal.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handlePortal} disabled={portaling}>
                    {portaling ? "Opening..." : "Manage billing"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {!dataReady ? (
        <Card variant="brand">
          <CardContent className="py-6 text-sm text-muted-foreground">Loading your agents...</CardContent>
        </Card>
      ) : (
        <>
          <Card variant="brand">
            <CardHeader>
              <CardTitle className="text-base">Your agents</CardTitle>
              <CardDescription>Each row is its own subscription with its own renewal date.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {entitlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents yet — buy one below to get started.</p>
              ) : (
                entitlements.map((entitlement) => (
                  // Overlapping rows for the same agent are legal (e.g. a
                  // TRIAL row and an AGENT row both covering the same agent
                  // mid-conversion), so `agent` alone isn't a unique key.
                  <AgentEntitlementRow
                    key={`${entitlement.agent}-${entitlement.source}-${entitlement.currentPeriodEnd}`}
                    entitlement={entitlement}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {unownedAgents.length > 0 && (
            <Card variant="brand">
              <CardHeader>
                <CardTitle className="text-base">Add agents</CardTitle>
                <CardDescription>Each purchase is its own checkout — no bundling required.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {unownedAgents.map((agent) => (
                  <AgentBuyCard
                    key={agent}
                    agent={agent}
                    priceCents={getMonthlyPrice(agent)}
                    onResumed={onEntitlementsChanged}
                    disabled={!isOwner}
                    disabledReason="Only the organization owner can manage billing"
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build and lint**

```bash
cd apps/main && npm run lint && npm run build
```

Fix any type errors (expect none, since Tasks 8–9 already narrowed the types this file consumes) before moving on.

---

### Task 11: apps/main — trim `settings/usage/page.tsx`

**Files:**
- Modify: `apps/main/src/app/(dashboard)/settings/usage/page.tsx`

**Interfaces:**
- Consumes: `MayaUsageTier` (Task 9's narrowed `"TRIAL" | "MONTHLY_CUSTOM"`).

- [ ] **Step 1: Narrow `TIER_LABELS`**

Change:

```ts
// These four values are still what the server sends (see
// maya.usage.service.ts's `displayTierFor`) — it's a display-only mapping of
// Maya's governing entitlement's source/plan, kept for this badge. The
// underlying quota is read live from the entitlement (getQuotaForMayaEntitlement),
// never from this tier. ANNUAL_CREW's copy calls out "400 credits/month"
// explicitly: the old model granted 400 credits for the entire YEAR on an
// annual plan — the credit window is now a fixed monthly window decoupled
// from the (annual) billing period, and the label must not carry that lie.
const TIER_LABELS: Record<MayaUsageTier, string> = {
  TRIAL:          "7-day trial",
  MONTHLY_CUSTOM: "Monthly · Maya",
  MONTHLY_CREW:   "Monthly · Crew",
  ANNUAL_CREW:    "Annual · Crew (400 credits/month)",
}
```

to:

```ts
// These two values are what the server sends (see maya.usage.service.ts's
// `displayTierFor`) — a display-only mapping of Maya's governing
// entitlement's source, kept for this badge. The underlying quota is read
// live from the entitlement (getQuotaForMayaEntitlement), never from this tier.
const TIER_LABELS: Record<MayaUsageTier, string> = {
  TRIAL:          "7-day trial",
  MONTHLY_CUSTOM: "Monthly · Maya",
}
```

- [ ] **Step 2: Remove the crew branch from `billingCycleLabel`**

Change:

```ts
  const billingCycleLabel =
    !mayaEntitlement ? null
    : mayaEntitlement.status === "TRIALING" ? `Trial · ${daysUntil(mayaEntitlement.currentPeriodEnd)} days left`
    : mayaEntitlement.status === "PAST_DUE" ? "Payment failed"
    // mayaEntitlement.plan is this row's own BillingSubscription cadence —
    // not the legacy, never-updated top-level sub.plan column, which stays
    // stuck at its creation-time default and would always read "Monthly"
    // even for a Crew Annual subscriber.
    : mayaEntitlement.source === "CREW" ? (mayaEntitlement.plan === "ANNUAL" ? "Annual · Crew" : "Monthly · Crew")
    : "Monthly · Maya"
```

to:

```ts
  const billingCycleLabel =
    !mayaEntitlement ? null
    : mayaEntitlement.status === "TRIALING" ? `Trial · ${daysUntil(mayaEntitlement.currentPeriodEnd)} days left`
    : mayaEntitlement.status === "PAST_DUE" ? "Payment failed"
    : "Monthly · Maya"
```

- [ ] **Step 3: Build and lint**

```bash
cd apps/main && npm run lint && npm run build
```

Expect no errors. Also grep the whole app for any remaining crew reference in billing-adjacent code:

```bash
grep -rln "crew\|Crew\|CREW" apps/main/src/components/billing apps/main/src/lib/api/billing.ts apps/main/src/app/\(dashboard\)/settings/billing apps/main/src/app/\(dashboard\)/settings/usage
```

Expect no output.

---

### Task 12: apps/landing — restructure `site-config.ts` and `use-billing-catalog.ts`

**Files:**
- Modify: `apps/landing/src/lib/site-config.ts`
- Modify: `apps/landing/src/lib/use-billing-catalog.ts`

**Interfaces:**
- Produces: `enterpriseTier: PricingTier` (replaces the `pricingTiers` array export). `BillingCatalog = { agents: Record<string, { priceCents: number }>; currency: string }` (dropped `crew`). Task 13 and Task 14 both import `enterpriseTier` instead of `pricingTiers`.

- [ ] **Step 1: Replace the `pricingTiers` export with a single `enterpriseTier` export**

Change:

```ts
export const pricingTiers: PricingTier[] = [
  {
    name: 'Crew',
    monthly: 39,
    yearly: 29,
    tag: 'the full gang',
    color: '#F06464',
    includes: [
      'Your 6-Member AI Team (All Included)',
      'Lex, Maya, Rex, Sage, Scout & Vega — Ready to Work',
      'Everything Stays Connected (Shared Context)',
      'Faster Than Traditional Workflows',
      'Speaks Exactly Like Your Brand',
      'Works With Your Existing Tools',
      'Maya: 300 Credits/mo (400/mo Billed Annually) — Every Other Agent Unlimited',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    monthly: 99,
    yearly: 0,
    tag: 'built around your team',
    color: '#8A8AF0',
    includes: [
      'Custom SLAs',
      'Dedicated onboarding & support',
      'Custom integrations',
      'Volume / seat-based pricing',
      'Priority support channel',
      'Dedicated account manager',
    ],
    custom: true,
  },
];
```

to:

```ts
export const enterpriseTier: PricingTier = {
  name: 'Enterprise',
  monthly: 99,
  yearly: 0,
  tag: 'built around your team',
  color: '#8A8AF0',
  includes: [
    'Custom SLAs',
    'Dedicated onboarding & support',
    'Custom integrations',
    'Volume / seat-based pricing',
    'Priority support channel',
    'Dedicated account manager',
  ],
  custom: true,
};
```

- [ ] **Step 2: Reword the FAQ entry that references "no Crew subscription required"**

Change:

```ts
  { q: 'Can I buy just one agent?', a: "Yes — every agent is available on its own starting at $9/mo, no Crew subscription required. Add more whenever you're ready." },
```

to:

```ts
  { q: 'Can I buy just one agent?', a: "Yes — every agent is billed independently starting at $9/mo. Pick only the ones you need, and add more whenever you're ready." },
```

Leave every other `PRICING_FAQ` entry unchanged (the "billed annually"/"cancel anytime" entries describe billing mechanics that still make sense; nothing else in that array names Crew).

- [ ] **Step 3: Update the `siteConfig` object**

Change:

```ts
export const siteConfig = {
  consoleUrl,
  landingUrl,
  contact,
  social,
  nav,
  marqueeItems,
  marqueeRedItems,
  howItWorksSteps,
  agentPricing,
  pricingTiers,
  faqItems,
  crewReplies,
  crewFollows,
  footerColumns,
  footerBottom,
};
```

to:

```ts
export const siteConfig = {
  consoleUrl,
  landingUrl,
  contact,
  social,
  nav,
  marqueeItems,
  marqueeRedItems,
  howItWorksSteps,
  agentPricing,
  enterpriseTier,
  faqItems,
  crewReplies,
  crewFollows,
  footerColumns,
  footerBottom,
};
```

(`crewReplies`, `crewFollows`, and the `nav`/`footerColumns` "The Crew" entries are branding — the team-of-agents metaphor, not the billing plan — and are intentionally left untouched, per the design doc.)

- [ ] **Step 4: Drop `crew` from `use-billing-catalog.ts`**

Change:

```ts
export interface BillingCatalog {
  agents: Record<string, { priceCents: number }>;
  crew: { monthly: { priceCents: number }; annual: { priceCents: number } };
  currency: string;
}
```

to:

```ts
export interface BillingCatalog {
  agents: Record<string, { priceCents: number }>;
  currency: string;
}
```

- [ ] **Step 5: Grep for remaining consumers of `pricingTiers`**

```bash
grep -rln "pricingTiers" apps/landing/src
```

Expect matches only in `pricing-page-content.tsx` and `sections.tsx` — Task 13 and Task 14 fix those next. If any other file appears, read it before proceeding (it means a consumer wasn't accounted for).

---

### Task 13: apps/landing — rewrite the pricing section of `pricing-page-content.tsx`

**Files:**
- Modify: `apps/landing/src/components/veqiro/pricing-page-content.tsx`

**Interfaces:**
- Consumes: `enterpriseTier` (Task 12), `agentPricing`, `useBillingCatalog` (Task 12's trimmed shape), `EMPLOYEES` from `./data`, `CHARACTER_COMPONENTS` from `./characters` (both unchanged).

- [ ] **Step 1: Update the import line**

Change:

```ts
import { agentPricing, pricingTiers, consoleUrl, isPreLaunch, waitlistUrl, contact, PRICING_FAQ } from '@/lib/site-config';
```

to:

```ts
import { agentPricing, enterpriseTier, consoleUrl, isPreLaunch, waitlistUrl, contact, PRICING_FAQ } from '@/lib/site-config';
```

- [ ] **Step 2: Simplify the component's top-of-function state**

Change:

```ts
export default function PricingPageContent() {
  // Real prices come from the server catalog; site-config's hardcoded
  // numbers are only the fallback shown until the fetch resolves.
  const catalog = useBillingCatalog();
  const priceByAgent: Record<string, number | null> = catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([key, value]) => [key.toLowerCase(), Math.round(value.priceCents / 100)]))
    : STATIC_PRICE_BY_AGENT;
  const tier = catalog
    ? { ...pricingTiers[0], monthly: Math.round(catalog.crew.monthly.priceCents / 100), yearly: Math.round(catalog.crew.annual.priceCents / 100 / 12) }
    : pricingTiers[0];
  const custom = pricingTiers.find(t => t.custom);
  const [yearly, setYearly] = useState(false);
  const price = yearly ? tier.yearly : tier.monthly;
  const [isContactOpen, setIsContactOpen] = useState(false);
```

to:

```ts
export default function PricingPageContent() {
  // Real prices come from the server catalog; site-config's hardcoded
  // numbers are only the fallback shown until the fetch resolves.
  const catalog = useBillingCatalog();
  const priceByAgent: Record<string, number | null> = catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([key, value]) => [key.toLowerCase(), Math.round(value.priceCents / 100)]))
    : STATIC_PRICE_BY_AGENT;
  const [isContactOpen, setIsContactOpen] = useState(false);
```

- [ ] **Step 3: Update the hero paragraph's pricing claim**

Change:

```html
          <p style={{
            fontFamily: FONT.body, fontSize: 'clamp(13px, 1.8vw, 15px)', color: '#888',
            marginTop: 14, lineHeight: 1.6, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Veqiro pricing is simple: one subscription gets you all six AI employees — executive assistant, researcher, content writer, SEO specialist, legal reviewer, and financial analyst. $39/mo, or $29/mo billed annually. No per-seat fees, no tier decisions.
          </p>
```

to:

```html
          <p style={{
            fontFamily: FONT.body, fontSize: 'clamp(13px, 1.8vw, 15px)', color: '#888',
            marginTop: 14, lineHeight: 1.6, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Veqiro pricing is simple: every AI employee bills independently, starting at $9/mo — executive assistant, researcher, content writer, SEO specialist, legal reviewer, and financial analyst. Pick one or hire the whole team. No bundle, no tier decisions.
          </p>
```

- [ ] **Step 4: Replace both the "PRICING CARD" section and the "BUY INDIVIDUALLY" section with one unified section**

Replace the entire block from the `{/* ── PRICING CARD ── */}` comment through the end of the `{/* BUY INDIVIDUALLY ... */}` section's closing `</section>` (i.e., everything between the hero section's closing `</section>` and the `{/* ── WHO YOU GET ── */}` section's opening comment) with:

```tsx
      {/* ── PRICING ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>
              [ PICK YOUR AGENTS ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(38px, 6vw, 76px)', margin: 0, lineHeight: 0.92 }}>
              start with one.<br />
              <span style={{ background: '#6FCDE8', border: '3px solid #111', borderRadius: 8, boxShadow: '5px 5px 0 #111', padding: '0 14px', display: 'inline-block' }}>
                add the rest later.
              </span>
            </h2>
            <p style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.6, color: '#444', maxWidth: 620, margin: '18px auto 0' }}>
              Every agent bills and renews on its own — no bundle, no tiers. Pick one, or hire the whole team.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 32 }}>
            {EMPLOYEES.map(emp => {
              const Comp = CHARACTER_COMPONENTS[emp.key];
              const monthlyPrice = priceByAgent[emp.key];
              return (
                <div
                  key={emp.key}
                  style={{
                    textAlign: 'left',
                    border: '3px solid #111',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '5px 5px 0 #111',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden', background: emp.color, borderBottom: '3px solid #111' }}>
                    <Comp size="100%" />
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <div style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 1, color: emp.color }}>
                      {emp.name}
                    </div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: '#777', marginTop: 6, lineHeight: 1.5 }}>
                      <TwoLineBlurb text={AGENT_BLURBS[emp.key]} />
                    </div>
                    <div style={{ fontFamily: FONT.display, fontSize: 24, color: '#111', marginTop: 12 }}>
                      {monthlyPrice == null ? '—' : `$${monthlyPrice}`}
                      <span style={{ fontFamily: FONT.body, fontSize: 12, color: '#888', marginLeft: 4 }}>/mo</span>
                    </div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 10, color: '#1DBC87', marginTop: 4 }}>
                      {emp.key === 'maya' ? '300 credits/mo included' : 'Unlimited generations'}
                    </div>
                    <a
                      href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
                      style={{
                        marginTop: 12, display: 'block', textAlign: 'center',
                        padding: '10px 14px', background: '#111', color: '#EFE7D6',
                        fontFamily: FONT.head, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                        border: '3px solid #111', borderRadius: 8, textDecoration: 'none',
                        boxSizing: 'border-box',
                      } as React.CSSProperties}
                    >
                      Start with {emp.name} →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enterprise — separate from per-agent pricing, not a per-agent card */}
          <div style={{
            border: '3px solid #111', borderRadius: 20, overflow: 'hidden',
            boxShadow: `10px 10px 0 ${enterpriseTier.color}`,
            display: 'flex', flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 260px', background: enterpriseTier.color, padding: 'clamp(22px, 4vw, 32px) clamp(20px, 5vw, 36px)', borderRight: '3px solid #111' }}>
              <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(36px, 6vw, 52px)', margin: 0, lineHeight: 1, color: '#111' }}>
                {enterpriseTier.name}
              </h2>
              <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#111', margin: '8px 0 0', opacity: 0.7 }}>
                {enterpriseTier.tag}
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 20 }}>
                <div style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 8vw, 56px)', color: '#111', lineHeight: 1 }}>
                  ${enterpriseTier.monthly}+
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 15, color: '#111', opacity: 0.7, paddingBottom: 6 }}>
                  /mo and up
                </div>
              </div>
            </div>
            <div style={{ flex: '2 1 360px', background: '#FFF9ED', padding: 'clamp(20px, 4vw, 28px) clamp(20px, 5vw, 36px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {enterpriseTier.includes.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#1DBC87', fontFamily: FONT.head, fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 14, color: '#111', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <div>
                <a
                  href={`mailto:${contact.email}?subject=Custom%20Enterprise%20Pricing`}
                  style={{
                    display: 'inline-block', padding: '14px 24px', background: '#111', color: '#EFE7D6',
                    fontFamily: FONT.head, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1,
                    border: '3px solid #111', borderRadius: 10, textDecoration: 'none',
                    boxShadow: `5px 5px 0 ${enterpriseTier.color}`,
                  } as React.CSSProperties}
                >
                  Talk to sales →
                </a>
                <p style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', marginTop: 10, marginBottom: 0 }}>
                  Response within 1 business day
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
```

(This deletes the old billing-cadence toggle, the Crew tier card, and the old duplicate "buy individually" grid — the new grid replaces both. `EMPLOYEES`, `CHARACTER_COMPONENTS`, `TwoLineBlurb`, `AGENT_BLURBS`, `isPreLaunch`, `waitlistUrl`, `consoleUrl`, `contact` were already imported/defined in this file, so no other import changes are needed here.)

- [ ] **Step 5: Build and lint**

```bash
cd apps/landing && npm run lint && npm run build
```

Expect no errors — this confirms no other part of the file referenced the deleted `tier`/`custom`/`yearly`/`price` locals.

---

### Task 14: apps/landing — rewrite `sections.tsx`'s `Pricing()` homepage teaser

**Files:**
- Modify: `apps/landing/src/components/veqiro/sections.tsx`

**Interfaces:**
- Consumes: `enterpriseTier`, `agentPricing` (Task 12), `useBillingCatalog` (new import), `EMPLOYEES` (new import).

- [ ] **Step 1: Update imports**

Change:

```ts
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { FONT } from './shared';
import {
  consoleUrl,
  isPreLaunch,
  waitlistUrl,
  howItWorksSteps,
  pricingTiers,
  faqItems,
  footerColumns,
  social,
  footerBottom,
  contact,
} from '@/lib/site-config';
import { ContactModal } from './contact-modal';
```

to:

```ts
'use client';
import React from 'react';
import Link from 'next/link';
import { FONT } from './shared';
import {
  consoleUrl,
  isPreLaunch,
  waitlistUrl,
  howItWorksSteps,
  agentPricing,
  enterpriseTier,
  faqItems,
  footerColumns,
  social,
  footerBottom,
  contact,
} from '@/lib/site-config';
import { useBillingCatalog } from '@/lib/use-billing-catalog';
import { EMPLOYEES } from './data';
import { ContactModal } from './contact-modal';
```

(`useState` is dropped from the React import — the new `Pricing()` below has no toggle/animation state. `HowItWorks` in this same file doesn't use `useState` either, so this is safe.)

- [ ] **Step 2: Replace the whole `Pricing()` function**

Replace the entire function — from `export function Pricing() {` through its closing `}` (everything between `HowItWorks`'s closing `}` and the next export in the file) — with:

```tsx
export function Pricing() {
  const catalog = useBillingCatalog();
  const priceByAgent: Record<string, number | null> = catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([key, value]) => [key.toLowerCase(), Math.round(value.priceCents / 100)]))
    : Object.fromEntries(agentPricing.map(item => [item.key, item.monthly]));

  return (
    <section id="pricing" className="vq-section-pad" style={{ background: '#111', color: '#EFE7D6' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#F5C518' }}>
            [ PRICING ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            less than<br /><span style={{ color: '#F5C518' }}>a bad intern.</span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2vw, 18px)', color: '#CFC6B2', marginTop: 20 }}>
            Every agent bills on its own, starting at $9/mo. No bundle required.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 32 }}>
          {EMPLOYEES.map(emp => (
            <div key={emp.key} style={{
              background: '#1a1a1a', border: `3px solid ${emp.color}`, borderRadius: 14,
              padding: '18px 16px', textAlign: 'center', boxShadow: `4px 4px 0 ${emp.color}`,
            }}>
              <div style={{ fontFamily: FONT.head, fontSize: 18, color: emp.color }}>{emp.name}</div>
              <div style={{ fontFamily: FONT.display, fontSize: 28, marginTop: 8 }}>
                {priceByAgent[emp.key] == null ? '—' : `$${priceByAgent[emp.key]}`}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: '#888', marginTop: 2 }}>/month</div>
            </div>
          ))}
        </div>

        <div style={{
          background: '#1a1a1a', color: '#EFE7D6',
          border: `3px solid ${enterpriseTier.color}`, borderRadius: 20,
          padding: 'clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)',
          boxShadow: `10px 10px 0 ${enterpriseTier.color}`,
          display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: FONT.head, fontSize: 24 }}>{enterpriseTier.name}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7, marginTop: 4 }}>{enterpriseTier.tag}</div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 8vw, 56px)', lineHeight: 1, color: enterpriseTier.color }}>${enterpriseTier.monthly}+</span>
              <span style={{ fontFamily: FONT.body, fontSize: 15 }}>/month and up</span>
            </div>
          </div>
          <a href={`mailto:${contact.email}?subject=Custom%20Enterprise%20Pricing`} style={{
            display: 'inline-block', textDecoration: 'none',
            background: '#EFE7D6', color: '#111', padding: '16px 26px',
            border: '3px solid #111', borderRadius: 12, boxShadow: `5px 5px 0 ${enterpriseTier.color}`,
            fontFamily: FONT.head, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1,
          } as React.CSSProperties}>Talk to sales →</a>
        </div>

        <p style={{ textAlign: 'center', fontFamily: FONT.mono, fontSize: 13, marginTop: 32, color: '#EFE7D6', opacity: 0.8 }}>
          Want the whole team?{' '}
          <Link href="/pricing" style={{ color: '#F5C518', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            See every agent →
          </Link>
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build and lint**

```bash
cd apps/landing && npm run lint && npm run build
```

Expect no errors. Then confirm no landing source file references the removed `pricingTiers` export or the billing-plan sense of "crew" anywhere in pricing code:

```bash
grep -rn "pricingTiers\|catalog.crew\|crew:" apps/landing/src
```

Expect no output.

---

### Task 15: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start all three apps locally**

From the repo root (or each app directory per this project's usual dev workflow), start `apps/server`, `apps/main`, and `apps/landing` in dev mode.

- [ ] **Step 2: Verify apps/landing's pricing page**

Open `/pricing` in a browser. Confirm: no Crew card anywhere, all 6 agent cards render with live prices from `/billing/catalog` (check the Network tab — the response should no longer include a `crew` key), the Enterprise card renders correctly, and the homepage `/` pricing teaser section shows the same per-agent grid + Enterprise card.

- [ ] **Step 3: Verify apps/main's billing page**

Log in, go to Settings → Billing. Confirm: no Crew upgrade/subscription cards render, every owned agent shows as a read-only row (no cancel button), unowned agents show Buy cards, and the "Manage billing" button opens Dodo's hosted customer portal.

- [ ] **Step 4: Verify the individual-agent purchase → webhook → entitlement flow**

Buy one agent through the UI (test mode). Confirm the Dodo checkout completes, the webhook fires (check server logs / `BillingWebhookEvent` table for an `applied-agent` result), and the billing page shows the new agent as an active row with the correct renewal date shortly after redirect.

- [ ] **Step 5: Verify cancellation via Dodo's portal is scoped to one agent**

With at least two agents purchased, open the Dodo portal via "Manage billing" and cancel just one agent's subscription there. Confirm (after the `subscription.cancelled` webhook lands) that only the cancelled agent's row shows "Access until <date>" on the billing page, and the other agent's row is unaffected.

- [ ] **Step 6: Verify Maya top-up gating**

As an org with no Maya entitlement, confirm the Usage page's "Top Up" button is disabled with the "available for active Maya subscribers" message. Buy Maya (or use an org that already owns Maya) and confirm the top-up button becomes enabled and a top-up checkout completes successfully.

- [ ] **Step 7: Final grep sweep across all three apps**

```bash
grep -rln "CREW" apps/server/src apps/main/src apps/landing/src --include=*.ts --include=*.tsx
```

Expect no output. (This intentionally excludes generated Prisma client code and does not match lowercase `crew`/`Crew`, which legitimately still appears in branding/marketing copy per the design doc's explicit scope.)
