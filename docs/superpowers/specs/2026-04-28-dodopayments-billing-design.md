# DodoPayments Billing — Design

**Date:** 2026-04-28
**Status:** Approved
**Owner:** Mohit Bhalotia

## Summary

Add subscription billing to Veqiro using DodoPayments via the `@dodopayments/better-auth` plugin. Single Pro plan ($39/mo or $29/mo billed annually), 7-day free trial that the org owner explicitly opts into after creating an organization. Trial expiry locks agent routes only; the rest of the dashboard stays usable so owners can keep accessing data while deciding to pay.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Per-organization billing** | App is org-centric (every domain object is scoped to `organizationId`). One paying customer per org, all members get Pro features. |
| 2 | **No `createCustomerOnSignUp`** | Don't create per-user Dodo customers we'll never use. Single Dodo customer per org, created at trial start. |
| 3 | **Plugin sub-plugins used:** `checkout` + `webhooks` | `checkout` makes `authClient.dodopayments.checkoutSession` work. `webhooks` gives us signed webhook handling. `portal()` is dropped — the plugin's portal helper can't target the org's customer; we expose a custom endpoint instead. `usage()` is not needed (flat-fee pricing). |
| 4 | **One plan, two billing intervals** | Pro Monthly $39, Pro Annual $29/mo (= $348/yr). No free tier. |
| 5 | **Trial: 7 days, opt-in after org create, no card required** | Lower-friction onboarding than card-on-file. Local trial only — no Dodo subscription exists during trial. |
| 6 | **Lockout scope: agents only** | When trial expires / payment fails, all six agent routes (`/agents/*`) return 402. Brand kit, integrations, dashboard, settings stay accessible. |
| 7 | **Customer email = org owner's email** | Real human email so Dodo can send invoices and dunning notices. |
| 8 | **Denormalize subscription status onto Organization** | Entitlement check on every agent request reads only the `Organization` row. Avoids joining `Subscription` on the hot path. Webhooks update both rows in a transaction. |

## Architecture

### Data flow

```
User signup → Org create (no billing state)
    │
    ▼
TrialGateModal (frontend, in dashboard layout)
    │
    └─ owner clicks "Start free trial"
        │
        ▼
POST /api/v1/billing/start-trial  (Express)
    ├─ ensureNoExistingSubscription
    ├─ dodoClient.customers.create({ email, name, metadata.organizationId })
    └─ tx: insert Subscription + update Organization
        │
        ▼
Subscription { TRIALING, trialEndsAt = now+7d, dodoCustomerId, dodoSubscriptionId=null }
Organization { subscriptionStatus=TRIALING, entitlementExpiresAt=trialEndsAt }
        │
        ▼
Agent requests → entitlementMiddleware reads Org row → allowed
        │
        ▼
User clicks "Upgrade" on billing page
        │
        ▼
authClient.dodopayments.checkoutSession({ slug, customer: { customer_id } })
    │
    ▼
Dodo-hosted checkout → user pays → redirect to /settings/billing?status=success
                                 ↘
                                  Dodo fires webhook (async)
                                       │
                                       ▼
                              POST /api/v1/auth/dodopayments/webhooks
                              (auto-mounted by better-auth plugin, signature verified)
                                       │
                                       ▼
                              onSubscriptionActive handler
                                  └─ tx: update Subscription + update Organization
                                       │
                                       ▼
                              Subscription { ACTIVE, plan, dodoSubscriptionId, currentPeriodEnd, trialEndsAt=null }
                              Organization { subscriptionStatus=ACTIVE, entitlementExpiresAt=null }
```

### Component boundaries

- **better-auth dodopayments plugin** — used only for: (a) typed `authClient.dodopayments.checkoutSession` (which proxies through better-auth to Dodo), and (b) signed webhook handler at `/api/v1/auth/dodopayments/webhooks`. No per-user customer creation. No client-side portal helper.
- **`apps/server/src/modules/billing/`** (new) — owns `Subscription` lifecycle. Three files: `billing.service.ts` (helpers + `syncOrgEntitlement`), `billing.routes.ts` (`/start-trial`, `/portal`), `billing.webhooks.ts` (the six event handlers).
- **`apps/server/src/middlewares/entitlement.middleware.ts`** (new) — reads only `Organization.subscriptionStatus` + `Organization.entitlementExpiresAt`. Mounted only on `/agents/*` routes.
- **`apps/server/src/lib/auth.ts`** (modified) — wires the plugin, enriches `customSession` with the subscription view.
- **`apps/main/src/components/billing/`** (new) — three components: `TrialGateModal`, `TrialBanner`, `UpgradeRequiredCard`.
- **`apps/main/src/app/(dashboard)/settings/billing/page.tsx`** (rewritten) — replaces all mock data with state-driven UI.
- **`apps/main/src/app/(dashboard)/layout.tsx`** (modified) — mounts `TrialGateModal` and `TrialBanner`.

## Data Model

```prisma
model Subscription {
  id                    String              @id @default(cuid())
  organizationId        String              @unique
  organization          Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  dodoCustomerId        String              @unique
  dodoSubscriptionId    String?             @unique  // null during local trial

  status                SubscriptionStatus  @default(TRIALING)
  plan                  SubscriptionPlan?   // null while TRIALING

  trialEndsAt           DateTime?           // set on trial start, cleared once paid
  currentPeriodEnd      DateTime?           // mirrors Dodo's billing cycle end
  cancelAtPeriodEnd     Boolean             @default(false)

  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@map("subscription")
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum SubscriptionPlan {
  MONTHLY  // $39/mo
  ANNUAL   // $29/mo billed annually = $348/yr
}
```

Add to `Organization`:

```prisma
model Organization {
  // existing fields...
  subscriptionStatus     SubscriptionStatus?
  entitlementExpiresAt   DateTime?
  subscription           Subscription?
}
```

**Encoding rules for `Organization.entitlementExpiresAt`:**

| Subscription state | `entitlementExpiresAt` value |
|---|---|
| `TRIALING` | `Subscription.trialEndsAt` |
| `CANCELLED` (still in paid period) | `Subscription.currentPeriodEnd` |
| `ACTIVE` / `PAST_DUE` / `EXPIRED` | `null` |

A helper `syncOrgEntitlement(orgId, subState)` derives these two Org fields from a Subscription row state, used by every code path that mutates a Subscription row to prevent drift.

## Server Configuration

[apps/server/src/lib/auth.ts](../../apps/server/src/lib/auth.ts) — additions to the existing better-auth setup.

```ts
import DodoPayments from "dodopayments";
import { dodopayments, checkout, webhooks } from "@dodopayments/better-auth";
import {
  handleSubscriptionActive, handleSubscriptionRenewed,
  handleSubscriptionCancelled, handleSubscriptionExpired,
  handleSubscriptionFailed, handlePaymentFailed,
} from "../modules/billing/billing.webhooks.js";

const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_ENV === "live" ? "live_mode" : "test_mode",
});

// In the plugins array of `options`:
dodopayments({
  client: dodoClient,
  use: [
    checkout({
      products: [
        { productId: process.env.DODO_PRO_MONTHLY_PRODUCT_ID!, slug: "pro-monthly" },
        { productId: process.env.DODO_PRO_ANNUAL_PRODUCT_ID!,  slug: "pro-annual"  },
      ],
      successUrl: "/settings/billing?status=success",
      authenticatedUsersOnly: true,
    }),
    webhooks({
      webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET!,
      onSubscriptionActive:    handleSubscriptionActive,
      onSubscriptionRenewed:   handleSubscriptionRenewed,
      onSubscriptionCancelled: handleSubscriptionCancelled,
      onSubscriptionExpired:   handleSubscriptionExpired,
      onSubscriptionFailed:    handleSubscriptionFailed,
      onPaymentFailed:         handlePaymentFailed,
    }),
  ],
}),
```

`customSession` is extended to include a `subscription` view:

```ts
const sub = activeOrganization
  ? await prisma.subscription.findUnique({ where: { organizationId: activeOrganization.id } })
  : null;

const subscriptionView = sub && {
  status: sub.status,
  plan: sub.plan,
  dodoCustomerId: sub.dodoCustomerId,
  trialEndsAt: sub.trialEndsAt,
  currentPeriodEnd: sub.currentPeriodEnd,
  cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  daysRemaining: sub.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / 86400000))
    : null,
  isEntitled:
    sub.status === "ACTIVE"
    || (sub.status === "TRIALING" && sub.trialEndsAt! > new Date())
    || (sub.status === "CANCELLED" && sub.currentPeriodEnd! > new Date()),
};

return { user, session, activeOrganization, memberships, subscription: subscriptionView };
```

[apps/main/src/lib/auth-client.ts](../../apps/main/src/lib/auth-client.ts) — add the dodopayments client plugin:

```ts
import { dodopaymentsClient } from "@dodopayments/better-auth";

plugins: [
  organizationClient({ /* existing */ }),
  dodopaymentsClient(),
],
```

## Endpoints

[apps/server/src/modules/billing/billing.routes.ts](../../apps/server/src/modules/billing/billing.routes.ts) — mounted at `/api/v1/billing` in the main router (no entitlement middleware on this prefix; billing must work even when expired).

### `POST /api/v1/billing/start-trial`

Creates the Dodo customer and the `Subscription` row, flips Org status to `TRIALING`.

- **Auth:** signed-in, must be `owner` of active org.
- **Idempotency:** if `Subscription` already exists for the org, returns `409 Conflict` with the existing state. Never extends or restarts a trial.
- **Steps:**
  1. `requireOrgOwner(req)` → returns `orgId` or throws.
  2. Reject if `prisma.subscription.findUnique({ where: { organizationId: orgId } })` exists.
  3. Look up owner: `prisma.member.findFirst({ where: { organizationId: orgId, role: "owner" }, include: { user: true } })`.
  4. Create Dodo customer: `dodoClient.customers.create({ email, name, metadata: { organizationId: orgId, type: "organization" } })`.
  5. `prisma.$transaction([subscription.create(...), organization.update(...)])` with `trialEndsAt = now + 7 * 24 * 60 * 60 * 1000`.
  6. Return subscription view (same shape as customSession).

### `POST /api/v1/billing/portal`

Opens a Dodo-hosted customer portal session for the org's customer.

- **Auth:** signed-in, must be `owner` of active org.
- **Steps:**
  1. `requireOrgOwner(req)` → `orgId`.
  2. Read `Subscription.dodoCustomerId`. If null, return `400 { error: "no-customer" }` (caller hasn't started trial).
  3. `dodoClient.customers.customerPortal.create(dodoCustomerId, { send_email: false })`.
  4. Return `{ url: portal.link }`.

### Auto-mounted webhook route

`/api/v1/auth/dodopayments/webhooks` — mounted by the better-auth plugin. Signature verification is built in via `webhookKey`. We register the six event handlers (next section).

## Webhook Handlers

[apps/server/src/modules/billing/billing.webhooks.ts](../../apps/server/src/modules/billing/billing.webhooks.ts)

Each handler:
1. Extracts `customer_id` (and `subscription_id` if present) from the payload.
2. Looks up the local `Subscription` row by `dodoCustomerId` (or `dodoSubscriptionId` once known).
3. If no row found, logs warn + returns `200` (don't trigger Dodo retries; reconciliation will happen on next event).
4. Runs `prisma.$transaction([subscription.update(...), organization.update(...)])` via `syncOrgEntitlement`.

### State transitions

| Event | Subscription update | Organization update | Notes |
|---|---|---|---|
| `onSubscriptionActive` | `status=ACTIVE`, `plan=resolvePlan(product_id)`, `dodoSubscriptionId`, `currentPeriodEnd`, `trialEndsAt=null`, `cancelAtPeriodEnd=false` | `subscriptionStatus=ACTIVE`, `entitlementExpiresAt=null` | First successful payment + on-hold resume |
| `onSubscriptionRenewed` | `status=ACTIVE`, `currentPeriodEnd=<new>` | `subscriptionStatus=ACTIVE`, `entitlementExpiresAt=null` | Recurring charge succeeded; clears `PAST_DUE` if it was set |
| `onSubscriptionCancelled` | `status=CANCELLED`, `cancelAtPeriodEnd=true`, `currentPeriodEnd` unchanged | `subscriptionStatus=CANCELLED`, `entitlementExpiresAt=currentPeriodEnd` | User stays entitled until period end |
| `onSubscriptionExpired` | `status=EXPIRED` | `subscriptionStatus=EXPIRED`, `entitlementExpiresAt=null` | Cancelled period actually ended |
| `onSubscriptionFailed` | `status=EXPIRED` | `subscriptionStatus=EXPIRED`, `entitlementExpiresAt=null` | Subscription creation/recurring billing fully failed |
| `onPaymentFailed` | `status=PAST_DUE` | `subscriptionStatus=PAST_DUE`, `entitlementExpiresAt=null` | One charge failed; Dodo retries per dunning |

`resolvePlan(productId)` returns `MONTHLY` | `ANNUAL` by comparing against `DODO_PRO_MONTHLY_PRODUCT_ID` / `DODO_PRO_ANNUAL_PRODUCT_ID`. Throws if no match (logged + 200 response so Dodo doesn't retry forever).

**Idempotency:** all handlers use targeted `update`, so re-delivery is a no-op. Optional follow-up: a `BillingWebhookEvent` audit table keyed by Dodo event ID for debugging.

## Entitlement Middleware

[apps/server/src/middlewares/entitlement.middleware.ts](../../apps/server/src/middlewares/entitlement.middleware.ts)

```ts
export async function entitlementMiddleware(req, res, next) {
  const orgId = req.session?.activeOrganizationId;
  if (!orgId) return res.status(403).json({ error: "no-active-organization" });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, entitlementExpiresAt: true },
  });

  const status = org?.subscriptionStatus;
  if (!status) return res.status(402).json({ error: "trial-not-started" });

  if (status === "ACTIVE") return next();

  if (status === "TRIALING" || status === "CANCELLED") {
    if (org!.entitlementExpiresAt && org!.entitlementExpiresAt > new Date()) return next();
    return res.status(402).json({
      error: status === "TRIALING" ? "trial-expired" : "subscription-expired",
    });
  }

  if (status === "PAST_DUE") return res.status(402).json({ error: "payment-failed" });
  return res.status(402).json({ error: "subscription-expired" });
}
```

**Mount points** in [apps/server/src/router.ts](../../apps/server/src/router.ts) — only on agent routes:

```ts
router.use("/agents/sage",  authMiddleware, entitlementMiddleware, sageRouter);
router.use("/agents/rex",   authMiddleware, entitlementMiddleware, rexRouter);
router.use("/agents/scout", authMiddleware, entitlementMiddleware, scoutRouter);
router.use("/agents/maya",  authMiddleware, entitlementMiddleware, mayaRouter);
router.use("/agents/lex",   authMiddleware, entitlementMiddleware, lexRouter);
router.use("/agents/vega",  authMiddleware, entitlementMiddleware, vegaRouter);
router.use("/agents",       authMiddleware, entitlementMiddleware, messagesRouter);
```

`/dashboard`, `/brand-kit`, `/uploads`, `/integrations`, `/billing` are **not** gated.

A `TRIALING` row past `trialEndsAt` is treated as expired the moment a request arrives — no row flip needed. Webhooks are the only thing that mutates state.

## Frontend

### Trial gate modal

[apps/main/src/components/billing/TrialGateModal.tsx](../../apps/main/src/components/billing/TrialGateModal.tsx)

Mounted in [apps/main/src/app/(dashboard)/layout.tsx](../../apps/main/src/app/(dashboard)/layout.tsx). Renders when `session.subscription === null`. Non-dismissible. One CTA: **Start 7-day free trial**.

```ts
async function startTrial() {
  const r = await fetch("/api/v1/billing/start-trial", { method: "POST", credentials: "include" });
  if (!r.ok) return toast.error("Couldn't start trial");
  await authClient.getSession({ query: { disableCookieCache: true } });
  // session re-fetch unmounts the modal because subscription is no longer null
}
```

For non-owners: alternate copy "Your organization owner needs to start the trial". No CTA.

### Trial banner

[apps/main/src/components/billing/TrialBanner.tsx](../../apps/main/src/components/billing/TrialBanner.tsx)

Slim bar at the top of dashboard pages. Renders when `subscription.status === 'TRIALING'`:

> X days left in your trial · **Upgrade now** →

- Dismissible per session (sessionStorage flag).
- Reappears regardless of dismissal when `daysRemaining ≤ 2`.

### Billing page rewrite

[apps/main/src/app/(dashboard)/settings/billing/page.tsx](../../apps/main/src/app/(dashboard)/settings/billing/page.tsx)

State-driven render based on `subscription.status`:

| State | UI |
|---|---|
| `null` | Not-started card + "Start free trial" button (gate modal usually catches first) |
| `TRIALING` | "Trial · X days left" banner card + plan picker (Monthly $39 / Annual $29) + "Upgrade" buttons |
| `ACTIVE` | Current plan card with plan name + next billing date + **Manage billing** button (opens portal) |
| `CANCELLED` | "Cancelled — access until <currentPeriodEnd>" + **Resume** button (opens portal) |
| `PAST_DUE` | Red alert "Payment failed — update card to keep your subscription" + **Update payment** button (opens portal) |
| `EXPIRED` | "Subscription expired" card + plan picker + **Reactivate** button |

Plan picker calls:

```ts
async function upgrade(plan: "pro-monthly" | "pro-annual") {
  const { data, error } = await authClient.dodopayments.checkoutSession({
    slug: plan,
    customer: { customer_id: subscription.dodoCustomerId },
    metadata: { organizationId: activeOrganization.id },
  });
  if (error) return toast.error("Couldn't start checkout");
  if (data) window.location.href = data.url;
}
```

Manage button calls:

```ts
async function openPortal() {
  const r = await fetch("/api/v1/billing/portal", { method: "POST", credentials: "include" });
  const { url } = await r.json();
  window.location.href = url;
}
```

Mocked invoice table is deleted. Invoices live in the Dodo portal.

### Post-checkout return handling

Dodo redirects to `/settings/billing?status=success`. The page detects the query param on mount:
1. Refetches session with `disableCookieCache: true`.
2. Shows a "Welcome to Pro" toast.
3. If subscription is still `TRIALING` (webhook in flight), polls 3× at 1s intervals before giving up. The webhook is the source of truth — UI catches up on next session refresh either way.

### Locked agent state

[apps/main/src/components/billing/UpgradeRequiredCard.tsx](../../apps/main/src/components/billing/UpgradeRequiredCard.tsx)

When an agent fetch returns 402, the React Query error handler swaps the chat UI for this card. Copy varies by `error` field:

- `trial-not-started` → "Start your free trial to use this agent"
- `trial-expired` → "Your trial has ended. Upgrade to keep using agents."
- `subscription-expired` → "Your subscription has ended. Reactivate to continue."
- `payment-failed` → "Your last payment failed. Update your card to continue."

Every state's CTA links to `/settings/billing`.

## Environment Variables

Added to [apps/server/.env](../../apps/server/.env):

```env
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_SECRET=
DODO_ENV=test                          # "test" | "live"
DODO_PRO_MONTHLY_PRODUCT_ID=
DODO_PRO_ANNUAL_PRODUCT_ID=
```

No new env vars on the frontend (`apps/main`) — checkout is brokered through the better-auth client which talks to the existing `NEXT_PUBLIC_BETTER_AUTH_URL`.

## Testing

### Server unit tests — `apps/server/src/tests/billing/`

- **`entitlement.middleware.test.ts`** — table-driven against the seven Org states (`null` / `TRIALING` valid / `TRIALING` expired / `ACTIVE` / `CANCELLED` valid / `CANCELLED` expired / `PAST_DUE` / `EXPIRED`). Verifies status code + error code per state.
- **`billing.webhooks.test.ts`** — feed each webhook payload shape; assert Subscription + Organization rows match the state transitions table. Use captured Dodo test_mode payloads as fixtures (`fixtures/subscription.active.json`, etc.).
- **`billing.service.test.ts`** — `syncOrgEntitlement`: input subscription state → output denormalized fields are correct (especially `entitlementExpiresAt` derivation).

### Server integration tests — same directory, against the test database

- **`start-trial.test.ts`** — owner can start trial (creates Dodo customer + DB rows atomically); non-owner gets 403; second call returns 409; trialEndsAt is exactly `now + 7d`.
- **`portal.test.ts`** — owner with `dodoCustomerId` set gets URL back; org without customer gets 400.

The Dodo SDK is mocked in unit tests; integration tests use `test_mode` against real Dodo with a sandboxed test customer.

### Frontend tests

- **`TrialGateModal`** — renders for owner; alternate copy for non-owner; unmounts after start-trial mutation.
- **`TrialBanner`** — correct day count; hidden when `ACTIVE`; reappears in last 2 days even after dismissal.

### Manual end-to-end (Dodo `test_mode`)

1. Sign up → create org → modal blocks dashboard ✓
2. Click "Start trial" → modal closes, agents work, banner shows "7 days left" ✓
3. Click "Upgrade" → Dodo checkout → pay with test card → return to billing page → after webhook, UI shows ACTIVE Pro Monthly ✓
4. "Manage billing" → Dodo portal → cancel subscription → return → UI shows CANCELLED with `currentPeriodEnd` ✓
5. Trigger expiration in Dodo dashboard → webhook flips org to EXPIRED → next agent call returns 402 → upgrade card renders ✓

## Out of scope (explicit non-goals)

- **Per-user billing or hybrid billing models.** Decided per-org-only.
- **Metered/usage-based billing.** Flat fee only. The `usage()` sub-plugin is not used.
- **Free tier.** No free plan exists; non-trial non-paying orgs cannot use agents.
- **Trial extensions.** `start-trial` is one-shot per org. No backfill, no manual extensions in v1.
- **Plan migration UI.** Switching between Monthly and Annual is done via the Dodo portal, not in our app.
- **Invoice rendering in our app.** Invoices live in the Dodo portal.
- **Audit/event log table.** `BillingWebhookEvent` is mentioned as a v1.1 follow-up.
- **Daily cron to flip stale `TRIALING` rows to `EXPIRED`.** Computed on read; cron is a reporting nicety, not load-bearing.
- **Coupon codes / discounts.** Configurable in the Dodo dashboard if needed; no in-app code.
- **Multi-currency display.** Dodo handles billing currency; our UI displays USD only.
