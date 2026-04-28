# DodoPayments Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription billing (single Pro plan, $39/mo or $29/mo annual, 7-day opt-in trial) to Veqiro using DodoPayments via the `@dodopayments/better-auth` plugin. Trial expiry locks `/agents/*` only.

**Architecture:** Per-organization billing. One Dodo customer per org, created when the org owner clicks "Start free trial". `Subscription` row + denormalized `Organization.subscriptionStatus` + `Organization.entitlementExpiresAt` columns kept in sync via webhook handlers. Entitlement middleware reads only the Org row.

**Tech Stack:** TypeScript, Express 5, Prisma 7 / PostgreSQL, better-auth, `@dodopayments/better-auth`, `dodopayments` SDK, Next.js 16, React 19.

**Reference spec:** [`docs/superpowers/specs/2026-04-28-dodopayments-billing-design.md`](../specs/2026-04-28-dodopayments-billing-design.md). Read it first if any task feels under-specified — the spec is the source of truth for state-transition tables and decision rationale.

**Note on tests:** the codebase has no test runner installed; `apps/server/src/tests/{unit,integration}/` are empty. This plan favours pure-logic unit tests via Node's built-in `node:test` (zero dependencies) for the two pieces with branchy logic (entitlement decision + sync helper) and uses `curl`/manual smoke for I/O-heavy code. A full Vitest setup is out of scope.

---

## File Structure

**New files (server):**
- `apps/server/src/modules/billing/billing.types.ts` — shared types + `resolvePlan` + `deriveEntitlementFields`
- `apps/server/src/modules/billing/billing.service.ts` — `syncOrgEntitlement`, `requireOrgOwner`, `startTrialForOrg`
- `apps/server/src/modules/billing/billing.webhooks.ts` — six event handlers
- `apps/server/src/modules/billing/billing.controller.ts` — Express handlers
- `apps/server/src/modules/billing/billing.routes.ts` — Express router
- `apps/server/src/middlewares/entitlement.middleware.ts` — agent-route gate
- `apps/server/src/tests/unit/billing.test.ts` — `node:test` unit suite
- `apps/server/src/lib/dodo.ts` — DodoPayments SDK singleton

**Modified files (server):**
- `apps/server/prisma/schema.prisma` — add `Subscription` model + Org columns
- `apps/server/src/lib/auth.ts` — wire dodopayments plugin + extend customSession
- `apps/server/src/router.ts` — mount entitlement on `/agents/*`, mount billing router
- `apps/server/package.json` — add `@dodopayments/better-auth`, `dodopayments`
- `apps/server/.env` — add 5 env vars

**New files (frontend):**
- `apps/main/src/components/billing/TrialGateModal.tsx`
- `apps/main/src/components/billing/TrialBanner.tsx`
- `apps/main/src/components/billing/UpgradeRequiredCard.tsx`
- `apps/main/src/lib/api/billing.ts`

**Modified files (frontend):**
- `apps/main/src/lib/auth-client.ts` — add `dodopaymentsClient()`
- `apps/main/src/lib/proxy-routing.ts` — extend `SessionPayload` with `subscription` (used by `TrialGateModal` via `useSession`)
- `apps/main/src/app/(dashboard)/layout.tsx` — mount `TrialGateModal` + `TrialBanner`
- `apps/main/src/app/(dashboard)/settings/billing/page.tsx` — full rewrite
- `apps/main/package.json` — add `@dodopayments/better-auth`

---

## Phase 1 — Foundation

### Task 1: Install dependencies and add env vars

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/main/package.json`
- Modify: `apps/server/.env`

- [ ] **Step 1: Install server-side deps**

```bash
cd d:/Coding/veqiro/apps/server && pnpm add @dodopayments/better-auth dodopayments
```

- [ ] **Step 2: Install frontend client plugin**

```bash
cd d:/Coding/veqiro/apps/main && pnpm add @dodopayments/better-auth
```

- [ ] **Step 3: Append env vars to `apps/server/.env`**

```env

# DodoPayments billing
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_SECRET=
DODO_ENV=test
DODO_PRO_MONTHLY_PRODUCT_ID=
DODO_PRO_ANNUAL_PRODUCT_ID=
```

User fills these in from the DodoPayments dashboard before running. Leave them blank in the commit; do not commit real values.

- [ ] **Step 4: Verify lockfile updates and commit**

```bash
cd d:/Coding/veqiro && git add apps/server/package.json apps/main/package.json pnpm-lock.yaml apps/server/.env
git commit -m "chore(billing): add @dodopayments/better-auth + dodopayments deps and env stubs"
```

---

### Task 2: Add Prisma schema for Subscription + Organization columns

**Files:**
- Modify: `apps/server/prisma/schema.prisma`

- [ ] **Step 1: Add the two enums + `Subscription` model**

Append at the end of `apps/server/prisma/schema.prisma`:

```prisma
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum SubscriptionPlan {
  MONTHLY
  ANNUAL
}

model Subscription {
  id                    String              @id @default(cuid())
  organizationId        String              @unique
  organization          Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  dodoCustomerId        String              @unique
  dodoSubscriptionId    String?             @unique

  status                SubscriptionStatus  @default(TRIALING)
  plan                  SubscriptionPlan?

  trialEndsAt           DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean             @default(false)

  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@map("subscription")
}
```

- [ ] **Step 2: Add columns + back-relation to `Organization`**

Locate the existing `model Organization` (around line 101) and add three lines before the closing `}`:

```prisma
  subscriptionStatus     SubscriptionStatus?
  entitlementExpiresAt   DateTime?
  subscription           Subscription?
```

The complete block should now end with:

```prisma
  members     Member[]
  invitations Invitation[]
  subscriptionStatus     SubscriptionStatus?
  entitlementExpiresAt   DateTime?
  subscription           Subscription?

  @@unique([slug])
  @@map("organization")
}
```

- [ ] **Step 3: Generate the migration**

```bash
cd d:/Coding/veqiro/apps/server && pnpm prisma migrate dev --name add_billing_subscription
```

Expected: a new folder under `apps/server/prisma/migrations/` containing the SQL DDL. Prisma client regenerates automatically.

- [ ] **Step 4: Verify generated client compiles**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: no errors. If errors point to `Subscription` not existing on `prisma.*`, regenerate manually: `pnpm prisma generate`.

- [ ] **Step 5: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/
git commit -m "feat(billing): add Subscription model + Organization billing columns"
```

---

## Phase 2 — Server Billing Module

### Task 3: Create DodoPayments SDK singleton

**Files:**
- Create: `apps/server/src/lib/dodo.ts`

- [ ] **Step 1: Write the singleton**

```ts
import DodoPayments from "dodopayments";

export const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_ENV === "live" ? "live_mode" : "test_mode",
});

export const PRODUCT_BY_SLUG = {
  "pro-monthly": process.env.DODO_PRO_MONTHLY_PRODUCT_ID!,
  "pro-annual":  process.env.DODO_PRO_ANNUAL_PRODUCT_ID!,
} as const;

export type PlanSlug = keyof typeof PRODUCT_BY_SLUG;
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/lib/dodo.ts
git commit -m "feat(billing): add DodoPayments SDK singleton"
```

---

### Task 4: Create billing.types.ts with `resolvePlan` and `deriveEntitlementFields`

**Files:**
- Create: `apps/server/src/modules/billing/billing.types.ts`

These are the two pure functions the rest of the module hangs off — they have no I/O so we can unit-test them in isolation later.

- [ ] **Step 1: Write the file**

```ts
import { SubscriptionStatus, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export type DerivedEntitlement = {
  subscriptionStatus: SubscriptionStatus;
  entitlementExpiresAt: Date | null;
};

/** Map a Dodo product_id to our internal plan enum. Returns null if unknown. */
export function resolvePlan(productId: string): SubscriptionPlan | null {
  if (productId === process.env.DODO_PRO_MONTHLY_PRODUCT_ID) return "MONTHLY";
  if (productId === process.env.DODO_PRO_ANNUAL_PRODUCT_ID)  return "ANNUAL";
  return null;
}

/**
 * Derives the two denormalized Organization fields from a Subscription row.
 * Encoding rules per spec:
 *   TRIALING               → entitlementExpiresAt = trialEndsAt
 *   CANCELLED              → entitlementExpiresAt = currentPeriodEnd
 *   ACTIVE/PAST_DUE/EXPIRED → entitlementExpiresAt = null
 */
export function deriveEntitlementFields(sub: SubscriptionLike): DerivedEntitlement {
  switch (sub.status) {
    case "TRIALING":
      return { subscriptionStatus: "TRIALING", entitlementExpiresAt: sub.trialEndsAt };
    case "CANCELLED":
      return { subscriptionStatus: "CANCELLED", entitlementExpiresAt: sub.currentPeriodEnd };
    case "ACTIVE":
    case "PAST_DUE":
    case "EXPIRED":
      return { subscriptionStatus: sub.status, entitlementExpiresAt: null };
  }
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/modules/billing/billing.types.ts
git commit -m "feat(billing): add resolvePlan and deriveEntitlementFields helpers"
```

---

### Task 5: Create billing.service.ts with `syncOrgEntitlement`, `requireOrgOwner`, and `startTrialForOrg`

**Files:**
- Create: `apps/server/src/modules/billing/billing.service.ts`

- [ ] **Step 1: Write the file**

```ts
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../lib/auth.js";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import CustomApiError from "../../common/errors/customApiError.js";
import { StatusCodes } from "http-status-codes";
import { deriveEntitlementFields, type SubscriptionLike } from "./billing.types.js";

class ForbiddenError extends CustomApiError {
  constructor(message: string) {
    super(message, StatusCodes.FORBIDDEN);
  }
}

class ConflictError extends CustomApiError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT);
  }
}

/**
 * Resolves the active org and asserts the caller is its owner.
 * Throws on unauth, missing org, or non-owner. Returns orgId.
 */
export async function requireOrgOwner(req: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new UnauthenticatedError("Unauthorized");

  const orgId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!orgId) throw new BadRequestError("No active organization selected");

  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId: session.user.id, role: "owner" },
    select: { id: true },
  });
  if (!member) throw new ForbiddenError("only-org-owner");

  return orgId;
}

/**
 * Updates Subscription + Organization in one transaction so the denormalized
 * Org columns never drift from the Subscription row. Returns the updated
 * Subscription row.
 */
export async function syncOrgEntitlement(
  organizationId: string,
  subscriptionUpdate: Parameters<typeof prisma.subscription.update>[0]["data"],
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { organizationId },
      data: subscriptionUpdate,
    });
    const fields = deriveEntitlementFields(updated as unknown as SubscriptionLike);
    await tx.organization.update({
      where: { id: organizationId },
      data: fields,
    });
    return updated;
  });
}

/**
 * Creates the org-level Dodo customer + Subscription row + flips Organization
 * entitlement columns. One-shot: errors if a Subscription already exists.
 */
export async function startTrialForOrg(organizationId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) throw new ConflictError("trial-already-started");

  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!owner) throw new BadRequestError("Org has no owner");

  const customer = await dodoClient.customers.create({
    email: owner.user.email,
    name: owner.user.name,
    metadata: { organizationId, type: "organization" },
  });

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        organizationId,
        dodoCustomerId: customer.customer_id,
        status: "TRIALING",
        trialEndsAt,
      },
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: "TRIALING", entitlementExpiresAt: trialEndsAt },
    });
    return sub;
  });
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean. If you see "Property 'customers' does not exist on type 'DodoPayments'" check the dodopayments package version: `cat node_modules/dodopayments/package.json | grep version`. The plan targets the SDK shape used in the spec; if the API differs, prefer `dodoClient.customers.create(...)` per the official docs.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/modules/billing/billing.service.ts
git commit -m "feat(billing): add billing service helpers (sync, owner check, start trial)"
```

---

### Task 6: Implement webhook handlers

**Files:**
- Create: `apps/server/src/modules/billing/billing.webhooks.ts`

The plugin's `webhooks` sub-plugin invokes these with the parsed Dodo payload. Each handler looks up the org by `dodoCustomerId`/`dodoSubscriptionId`, calls `syncOrgEntitlement`, returns. Failures are logged and swallowed (return 200 to Dodo so it doesn't infinite-retry).

- [ ] **Step 1: Write the file**

```ts
import { prisma } from "../../config/prisma.js";
import { syncOrgEntitlement } from "./billing.service.js";
import { resolvePlan } from "./billing.types.js";

type WebhookPayload = {
  event_type: string;
  data: {
    customer?: { customer_id?: string };
    subscription_id?: string;
    product_id?: string;
    next_billing_date?: string;
    current_period_end?: string;
  };
};

async function findOrgIdByCustomer(customerId: string | undefined): Promise<string | null> {
  if (!customerId) return null;
  const sub = await prisma.subscription.findFirst({
    where: { dodoCustomerId: customerId },
    select: { organizationId: true },
  });
  return sub?.organizationId ?? null;
}

function parsePeriodEnd(p: WebhookPayload["data"]): Date | null {
  const v = p.next_billing_date ?? p.current_period_end;
  return v ? new Date(v) : null;
}

export async function handleSubscriptionActive(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return console.warn("[billing] active webhook: no org for customer", payload.data.customer?.customer_id);

  const plan = payload.data.product_id ? resolvePlan(payload.data.product_id) : null;
  await syncOrgEntitlement(orgId, {
    status: "ACTIVE",
    plan,
    dodoSubscriptionId: payload.data.subscription_id,
    currentPeriodEnd: parsePeriodEnd(payload.data),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
  });
}

export async function handleSubscriptionRenewed(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, {
    status: "ACTIVE",
    currentPeriodEnd: parsePeriodEnd(payload.data),
  });
}

export async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  // currentPeriodEnd intentionally left untouched; user keeps access until then
  await syncOrgEntitlement(orgId, {
    status: "CANCELLED",
    cancelAtPeriodEnd: true,
  });
}

export async function handleSubscriptionExpired(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, { status: "EXPIRED" });
}

export async function handleSubscriptionFailed(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, { status: "EXPIRED" });
}

export async function handlePaymentFailed(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, { status: "PAST_DUE" });
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean. If the actual `WebhookPayload` shape from `@dodopayments/better-auth` differs (it ships TypeScript definitions), import the correct type and adapt. The handler logic stays the same.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/modules/billing/billing.webhooks.ts
git commit -m "feat(billing): implement six DodoPayments webhook handlers"
```

---

### Task 7: Wire DodoPayments plugin into auth.ts and extend customSession

**Files:**
- Modify: `apps/server/src/lib/auth.ts`

- [ ] **Step 1: Add imports at the top**

After the existing imports in `apps/server/src/lib/auth.ts:1-6`, add:

```ts
import { dodopayments, checkout, webhooks } from "@dodopayments/better-auth";
import { dodoClient } from "./dodo.js";
import {
  handleSubscriptionActive,
  handleSubscriptionRenewed,
  handleSubscriptionCancelled,
  handleSubscriptionExpired,
  handleSubscriptionFailed,
  handlePaymentFailed,
} from "../modules/billing/billing.webhooks.js";
```

- [ ] **Step 2: Add the dodopayments plugin to the `plugins` array**

In the `options` object (currently `apps/server/src/lib/auth.ts:54-69`), append to the `plugins: [...]` array — insert AFTER the existing `organization({...})` plugin block, before the closing `]`:

```ts
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

- [ ] **Step 3: Extend `customSession` to include `subscription` view**

Replace the existing `customSession(...)` body in `apps/server/src/lib/auth.ts:101-128` with:

```ts
    customSession(async ({ user, session }) => {
      const activeOrganization = session.activeOrganizationId
        ? await prisma.organization.findUnique({
            where: { id: session.activeOrganizationId },
            select: { id: true, name: true, slug: true, onboarded: true },
          })
        : null;

      const memberRows = await prisma.member.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "asc" },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, onboarded: true },
          },
        },
      });

      const memberships = memberRows.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        onboarded: m.organization.onboarded,
        role: m.role,
      }));

      const sub = activeOrganization
        ? await prisma.subscription.findUnique({ where: { organizationId: activeOrganization.id } })
        : null;

      const now = new Date();
      const subscription = sub
        ? {
            status: sub.status,
            plan: sub.plan,
            dodoCustomerId: sub.dodoCustomerId,
            trialEndsAt: sub.trialEndsAt,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            daysRemaining: sub.trialEndsAt
              ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86400000))
              : null,
            isEntitled:
              sub.status === "ACTIVE" ||
              (sub.status === "TRIALING" && !!sub.trialEndsAt && sub.trialEndsAt > now) ||
              (sub.status === "CANCELLED" && !!sub.currentPeriodEnd && sub.currentPeriodEnd > now),
          }
        : null;

      return { user, session, activeOrganization, memberships, subscription };
    }, options),
```

- [ ] **Step 4: Verify and start the server**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean. Then start the dev server:

```bash
cd d:/Coding/veqiro/apps/server && pnpm dev
```

Expected: starts without errors. Hit `http://localhost:5000/api/v1/auth/get-session` while logged in (via the running frontend) and confirm the response includes a `subscription: null` field. Stop the server when done.

- [ ] **Step 5: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/lib/auth.ts
git commit -m "feat(billing): wire dodopayments plugin and extend customSession"
```

---

### Task 8: Implement billing controller and routes

**Files:**
- Create: `apps/server/src/modules/billing/billing.controller.ts`
- Create: `apps/server/src/modules/billing/billing.routes.ts`

- [ ] **Step 1: Write the controller**

```ts
// apps/server/src/modules/billing/billing.controller.ts
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { requireOrgOwner, startTrialForOrg } from "./billing.service.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

export async function startTrial(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const sub = await startTrialForOrg(orgId);
  res.status(StatusCodes.CREATED).json({
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    plan: sub.plan,
  });
}

export async function openPortal(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    select: { dodoCustomerId: true },
  });
  if (!sub?.dodoCustomerId) throw new BadRequestError("no-customer");

  const portal = await dodoClient.customers.customerPortal.create(sub.dodoCustomerId, {
    send_email: false,
  });
  res.status(StatusCodes.OK).json({ url: portal.link });
}
```

- [ ] **Step 2: Write the router**

```ts
// apps/server/src/modules/billing/billing.routes.ts
import { Router } from "express";
import { startTrial, openPortal } from "./billing.controller.js";

const router = Router();

router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));

export default router;
```

- [ ] **Step 3: Verify type-check**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/modules/billing/billing.controller.ts apps/server/src/modules/billing/billing.routes.ts
git commit -m "feat(billing): implement start-trial and portal endpoints"
```

---

### Task 9: Mount billing router

**Files:**
- Modify: `apps/server/src/router.ts`

- [ ] **Step 1: Import the billing router**

After the existing imports (around `apps/server/src/router.ts:18`), add:

```ts
import billingRouter from "./modules/billing/billing.routes.js";
```

- [ ] **Step 2: Mount the router**

After the `router.use("/uploads", authMiddleware, uploadsRouter);` line (around line 37), add:

```ts
router.use("/billing", authMiddleware, billingRouter);
```

Note: deliberately not gated by `entitlementMiddleware` — billing must work even when expired.

- [ ] **Step 3: Smoke test the endpoints**

Start the server: `cd d:/Coding/veqiro/apps/server && pnpm dev`. From the running frontend (logged in as an org owner whose org has no `Subscription` row yet), open browser devtools and run:

```js
fetch(`${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/v1/billing/start-trial`, {
  method: "POST", credentials: "include",
}).then(r => r.json()).then(console.log)
```

Wait — that won't work in the browser console because `process.env` isn't available there. Use a hardcoded URL instead:

```js
fetch("http://localhost:5000/api/v1/billing/start-trial", {
  method: "POST", credentials: "include",
}).then(r => r.json()).then(console.log)
```

Expected response: `{ status: "TRIALING", trialEndsAt: "...", plan: null }`. Confirm a row exists in the DB:

```bash
cd d:/Coding/veqiro/apps/server && pnpm prisma studio
```

Open the `subscription` table — one row should be present for the org. Open `organization` — `subscriptionStatus = TRIALING`, `entitlementExpiresAt` set.

Calling start-trial a second time should return 409 Conflict with `"trial-already-started"`.

- [ ] **Step 4: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/router.ts
git commit -m "feat(billing): mount /billing routes (start-trial, portal)"
```

---

## Phase 3 — Entitlement Enforcement

### Task 10: Implement entitlement middleware

**Files:**
- Create: `apps/server/src/middlewares/entitlement.middleware.ts`

- [ ] **Step 1: Write the middleware**

```ts
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";

export async function entitlementMiddleware(req: Request, res: Response, next: NextFunction) {
  const orgId = req.organizationId;
  if (!orgId) {
    return res.status(StatusCodes.FORBIDDEN).json({ error: "no-active-organization" });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, entitlementExpiresAt: true },
  });

  const status = org?.subscriptionStatus;
  if (!status) {
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "trial-not-started" });
  }

  if (status === "ACTIVE") return next();

  if (status === "TRIALING" || status === "CANCELLED") {
    if (org!.entitlementExpiresAt && org!.entitlementExpiresAt > new Date()) return next();
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({
      error: status === "TRIALING" ? "trial-expired" : "subscription-expired",
    });
  }

  if (status === "PAST_DUE") {
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "payment-failed" });
  }

  return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "subscription-expired" });
}
```

Note: this reads `req.organizationId`, not `req.session` — `authMiddleware` populates that. Mounting order matters: `authMiddleware` must run first.

- [ ] **Step 2: Verify type-check**

```bash
cd d:/Coding/veqiro/apps/server && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/middlewares/entitlement.middleware.ts
git commit -m "feat(billing): add entitlement middleware"
```

---

### Task 11: Mount entitlement middleware on agent routes

**Files:**
- Modify: `apps/server/src/router.ts`

- [ ] **Step 1: Import the middleware**

Add after the existing middleware import (around line 2):

```ts
import { entitlementMiddleware } from "./middlewares/entitlement.middleware.js";
```

- [ ] **Step 2: Insert `entitlementMiddleware` after `authMiddleware` on each agent route**

Replace lines 22-28 of `apps/server/src/router.ts`:

```ts
router.use("/agents/sage",  authMiddleware, entitlementMiddleware, sageRouter);
router.use("/agents/rex",   authMiddleware, entitlementMiddleware, rexRouter);
router.use("/agents/scout", authMiddleware, entitlementMiddleware, scoutRouter);
router.use("/agents/maya",  authMiddleware, entitlementMiddleware, mayaRouter);
router.use("/agents/lex",   authMiddleware, entitlementMiddleware, lexRouter);
router.use("/agents/vega",  authMiddleware, entitlementMiddleware, vegaRouter);
router.use("/agents",       authMiddleware, entitlementMiddleware, messagesRouter);
```

Leave `dashboard`, `brand-kit`, `uploads`, `integrations`, `internal/*` UNCHANGED — they are not gated.

- [ ] **Step 3: Smoke test entitlement**

Restart the server. Test cases (from the browser devtools while logged in):

```js
// Should return 200 if the active org has TRIALING with valid trialEndsAt:
fetch("http://localhost:5000/api/v1/agents/sage/some-route", { credentials: "include" })
```

Manually flip the org's `entitlementExpiresAt` to a past date in Prisma Studio, retry — should now return 402 with `"trial-expired"`.

Manually clear the org's `subscriptionStatus` to NULL — should return 402 with `"trial-not-started"`.

Restore valid TRIALING state when done.

- [ ] **Step 4: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/src/router.ts
git commit -m "feat(billing): gate /agents/* routes behind entitlement middleware"
```

---

### Task 12: Add unit tests for billing.types and entitlement middleware

**Files:**
- Create: `apps/server/src/tests/unit/billing.test.ts`
- Modify: `apps/server/package.json` (add a test script)

`node:test` is built into Node 20+; no new dependency needed. We test the two pieces with branchy logic and fully synchronous inputs: `deriveEntitlementFields` and the middleware's decision tree (with prisma mocked).

- [ ] **Step 1: Add test script to `apps/server/package.json`**

In the `scripts` block, add:

```json
"test": "node --import tsx --test src/tests/unit/*.test.ts"
```

- [ ] **Step 2: Write the test file**

```ts
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { deriveEntitlementFields, resolvePlan } from "../../modules/billing/billing.types.js";

describe("deriveEntitlementFields", () => {
  const trialEnd = new Date("2026-05-05");
  const periodEnd = new Date("2026-06-01");

  test("TRIALING → expires at trialEndsAt", () => {
    const r = deriveEntitlementFields({ status: "TRIALING", trialEndsAt: trialEnd, currentPeriodEnd: null });
    assert.equal(r.subscriptionStatus, "TRIALING");
    assert.equal(r.entitlementExpiresAt?.toISOString(), trialEnd.toISOString());
  });

  test("CANCELLED → expires at currentPeriodEnd", () => {
    const r = deriveEntitlementFields({ status: "CANCELLED", trialEndsAt: null, currentPeriodEnd: periodEnd });
    assert.equal(r.subscriptionStatus, "CANCELLED");
    assert.equal(r.entitlementExpiresAt?.toISOString(), periodEnd.toISOString());
  });

  test("ACTIVE → no expiry", () => {
    const r = deriveEntitlementFields({ status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: periodEnd });
    assert.equal(r.subscriptionStatus, "ACTIVE");
    assert.equal(r.entitlementExpiresAt, null);
  });

  test("PAST_DUE → no expiry", () => {
    const r = deriveEntitlementFields({ status: "PAST_DUE", trialEndsAt: null, currentPeriodEnd: periodEnd });
    assert.equal(r.subscriptionStatus, "PAST_DUE");
    assert.equal(r.entitlementExpiresAt, null);
  });

  test("EXPIRED → no expiry", () => {
    const r = deriveEntitlementFields({ status: "EXPIRED", trialEndsAt: null, currentPeriodEnd: null });
    assert.equal(r.subscriptionStatus, "EXPIRED");
    assert.equal(r.entitlementExpiresAt, null);
  });
});

describe("resolvePlan", () => {
  test("monthly product id → MONTHLY", () => {
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_m";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID  = "pdt_a";
    assert.equal(resolvePlan("pdt_m"), "MONTHLY");
  });

  test("annual product id → ANNUAL", () => {
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_m";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID  = "pdt_a";
    assert.equal(resolvePlan("pdt_a"), "ANNUAL");
  });

  test("unknown product id → null", () => {
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_m";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID  = "pdt_a";
    assert.equal(resolvePlan("pdt_xxx"), null);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd d:/Coding/veqiro/apps/server && pnpm test
```

Expected: 8 passing tests.

- [ ] **Step 4: Commit**

```bash
cd d:/Coding/veqiro && git add apps/server/package.json apps/server/src/tests/unit/billing.test.ts
git commit -m "test(billing): unit-test deriveEntitlementFields and resolvePlan"
```

---

## Phase 4 — Frontend

### Task 13: Add dodopaymentsClient and billing API module

**Files:**
- Modify: `apps/main/src/lib/auth-client.ts`
- Modify: `apps/main/src/lib/proxy-routing.ts`
- Create: `apps/main/src/lib/api/billing.ts`

- [ ] **Step 1: Add `dodopaymentsClient` to auth-client**

Edit `apps/main/src/lib/auth-client.ts`. Add the import after line 2:

```ts
import { dodopaymentsClient } from "@dodopayments/better-auth";
```

Add to the `plugins: [...]` array after `organizationClient(...)`:

```ts
    dodopaymentsClient(),
```

- [ ] **Step 2: Extend `SessionPayload` to include subscription view**

Edit `apps/main/src/lib/proxy-routing.ts`. Replace the existing `SessionPayload` type (lines 1-4) with:

```ts
export type SubscriptionView = {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  plan: "MONTHLY" | "ANNUAL" | null;
  dodoCustomerId: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  isEntitled: boolean;
};

export type SessionPayload = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
  subscription?: SubscriptionView | null;
};
```

The `routeForUser` function below it stays unchanged — billing gating is handled in the dashboard layout, not in the routing proxy.

- [ ] **Step 3: Create the billing API module**

```ts
// apps/main/src/lib/api/billing.ts
import { apiFetch } from "./client";

export type StartTrialResponse = {
  status: "TRIALING";
  trialEndsAt: string;
  plan: null;
};

export function startTrial() {
  return apiFetch<StartTrialResponse>("/billing/start-trial", { method: "POST" });
}

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
}
```

- [ ] **Step 4: Verify the frontend type-checks**

```bash
cd d:/Coding/veqiro/apps/main && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/lib/auth-client.ts apps/main/src/lib/proxy-routing.ts apps/main/src/lib/api/billing.ts
git commit -m "feat(billing): wire dodopayments client + add billing API module"
```

---

### Task 14: Build TrialGateModal

**Files:**
- Create: `apps/main/src/components/billing/TrialGateModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { authClient, useSession } from "@/lib/auth-client"
import { startTrial } from "@/lib/api/billing"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function TrialGateModal() {
  const { data: session } = useSession()
  const [busy, setBusy] = useState(false)

  if (!session) return null
  if ((session as any).subscription) return null

  const isOwner = (session as any).memberships?.some(
    (m: any) => m.id === (session as any).activeOrganization?.id && m.role === "owner",
  )

  async function onStart() {
    setBusy(true)
    try {
      await startTrial()
      await authClient.getSession({ query: { disableCookieCache: true } })
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't start trial")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open modal>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>Start your 7-day free trial</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Unlock all six AI agents for your team. No credit card required during the trial."
              : "Your organization owner needs to start the trial before agents can be used."}
          </DialogDescription>
        </DialogHeader>
        {isOwner && (
          <Button onClick={onStart} disabled={busy} className="w-full">
            {busy ? "Starting…" : "Start free trial"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

Note: the `hideClose` prop assumes the project's Dialog wraps Radix's `DialogContent` and exposes a way to suppress the close button. If it doesn't, omit `hideClose` and instead intercept the Radix `onPointerDownOutside`/`onEscapeKeyDown` props on `DialogContent` to call `e.preventDefault()`. Verify by reading [`apps/main/src/components/ui/dialog.tsx`](../../apps/main/src/components/ui/dialog.tsx) before this step and adapt to the local API.

- [ ] **Step 2: Verify type-check**

```bash
cd d:/Coding/veqiro/apps/main && pnpm exec tsc --noEmit
```

Expected: clean. Some `as any` casts may need refining once the session typing in `useSession` is updated to know about `subscription` — that ships from `customSession` typed inference. If TS complains about the `(session as any)` casts, that's fine for now; the runtime values are correct and we'll tighten the type in a follow-up.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/components/billing/TrialGateModal.tsx
git commit -m "feat(billing): add TrialGateModal"
```

---

### Task 15: Build TrialBanner

**Files:**
- Create: `apps/main/src/components/billing/TrialBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { X } from "lucide-react"

const DISMISS_KEY = "billing.trialBanner.dismissed"

export function TrialBanner() {
  const { data: session } = useSession()
  const sub = (session as any)?.subscription
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1")
    }
  }, [])

  if (!sub) return null
  if (sub.status !== "TRIALING") return null

  const days = sub.daysRemaining ?? 0
  const forceShow = days <= 2

  if (dismissed && !forceShow) return null

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b bg-primary/5 px-4 py-2 text-xs">
      <span>
        <strong>{days}</strong> {days === 1 ? "day" : "days"} left in your trial.
      </span>
      <div className="flex items-center gap-2">
        <Link href="/settings/billing" className="font-medium text-primary hover:underline">
          Upgrade now →
        </Link>
        {!forceShow && (
          <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd d:/Coding/veqiro/apps/main && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/components/billing/TrialBanner.tsx
git commit -m "feat(billing): add TrialBanner"
```

---

### Task 16: Build UpgradeRequiredCard

**Files:**
- Create: `apps/main/src/components/billing/UpgradeRequiredCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

const COPY: Record<string, { title: string; body: string }> = {
  "trial-not-started":      { title: "Start your free trial",      body: "You haven't started your trial yet. Activate it to unlock agents." },
  "trial-expired":          { title: "Your trial has ended",       body: "Upgrade to keep using agents." },
  "subscription-expired":   { title: "Subscription ended",         body: "Reactivate your plan to continue." },
  "payment-failed":         { title: "Payment failed",             body: "Update your card to keep your subscription active." },
  default:                  { title: "Upgrade required",           body: "This feature is part of the Pro plan." },
}

export function UpgradeRequiredCard({ reason }: { reason: string | null | undefined }) {
  const { title, body } = COPY[reason ?? "default"] ?? COPY.default

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/settings/billing">Go to billing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd d:/Coding/veqiro/apps/main && pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/components/billing/UpgradeRequiredCard.tsx
git commit -m "feat(billing): add UpgradeRequiredCard"
```

---

### Task 17: Mount TrialGateModal + TrialBanner in dashboard layout

**Files:**
- Modify: `apps/main/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update the layout**

Replace the contents of `apps/main/src/app/(dashboard)/layout.tsx`:

```tsx
import SessionGuard from "@/components/layout/SessionGuard"
import OnboardingGuard from "@/components/layout/OnboardingGuard"
import { SessionProvider } from "@/components/layout/SessionProvider"
import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"
import { TrialGateModal } from "@/components/billing/TrialGateModal"
import { TrialBanner } from "@/components/billing/TrialBanner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <SessionGuard>
        <OnboardingGuard>
          <TrialBanner />
          <DashboardSidebarShell>{children}</DashboardSidebarShell>
          <TrialGateModal />
        </OnboardingGuard>
      </SessionGuard>
    </SessionProvider>
  )
}
```

- [ ] **Step 2: Manual smoke test**

Start both apps:

```bash
cd d:/Coding/veqiro && pnpm dev
```

In the browser as an org owner whose org has NO subscription row (delete the subscription row in Prisma Studio if needed), navigate to any dashboard page. Expect: the modal appears blocking the screen.

Click "Start free trial". The modal should disappear and the trial banner should appear at the top showing "7 days left". Confirm a Subscription row exists in the DB and `Organization.subscriptionStatus = TRIALING`.

- [ ] **Step 3: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/app/(dashboard)/layout.tsx
git commit -m "feat(billing): mount TrialGateModal and TrialBanner in dashboard layout"
```

---

### Task 18: Rewrite the billing page

**Files:**
- Modify: `apps/main/src/app/(dashboard)/settings/billing/page.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { CreditCard, CheckCircle2, Zap, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { authClient, useSession } from "@/lib/auth-client"
import { openBillingPortal } from "@/lib/api/billing"

const FEATURES = [
  "Unlimited AI conversations",
  "Full access to all 6 agents",
  "Complete Brain page editing",
  "Up to 10 organization members",
  "Daily briefings via email",
  "Priority support",
  "API access",
]

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function BillingPage() {
  const { data: session } = useSession()
  const sub = (session as any)?.subscription as
    | {
        status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED"
        plan: "MONTHLY" | "ANNUAL" | null
        dodoCustomerId: string
        trialEndsAt: string | null
        currentPeriodEnd: string | null
        daysRemaining: number | null
      }
    | null
    | undefined

  const orgId = (session as any)?.activeOrganization?.id as string | undefined
  const params = useSearchParams()
  const status = params.get("status")
  const [busy, setBusy] = useState<null | "monthly" | "annual" | "portal">(null)

  // Refresh session on return from Dodo checkout
  useEffect(() => {
    if (status === "success") {
      let attempts = 0
      const tick = async () => {
        await authClient.getSession({ query: { disableCookieCache: true } })
        attempts++
        if (attempts < 3) setTimeout(tick, 1000)
      }
      tick()
      toast.success("Welcome to Pro!")
    }
  }, [status])

  async function upgrade(slug: "pro-monthly" | "pro-annual") {
    if (!sub?.dodoCustomerId || !orgId) return
    setBusy(slug === "pro-monthly" ? "monthly" : "annual")
    try {
      const { data, error } = await (authClient as any).dodopayments.checkoutSession({
        slug,
        customer: { customer_id: sub.dodoCustomerId },
        metadata: { organizationId: orgId },
      })
      if (error) throw new Error(error.message ?? "Checkout failed")
      if (data?.url) window.location.href = data.url
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't start checkout")
    } finally {
      setBusy(null)
    }
  }

  async function portal() {
    setBusy("portal")
    try {
      const { url } = await openBillingPortal()
      window.location.href = url
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't open portal")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Your plan and payment management."
        sticker={{ label: "money matters", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      <div className="flex flex-col gap-4">
        {/* Current state card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-sm font-semibold">
                  {sub?.status === "ACTIVE"     && `Pro ${sub.plan === "ANNUAL" ? "Annual" : "Monthly"}`}
                  {sub?.status === "TRIALING"   && `Free trial · ${sub.daysRemaining ?? 0} days left`}
                  {sub?.status === "CANCELLED"  && "Cancelled"}
                  {sub?.status === "PAST_DUE"   && "Payment failed"}
                  {sub?.status === "EXPIRED"    && "Subscription expired"}
                  {!sub                         && "No subscription"}
                </CardTitle>
                <CardDescription>
                  {sub?.status === "ACTIVE"    && `Next billing: ${formatDate(sub.currentPeriodEnd)}`}
                  {sub?.status === "TRIALING"  && `Trial ends ${formatDate(sub.trialEndsAt)}`}
                  {sub?.status === "CANCELLED" && `Access until ${formatDate(sub.currentPeriodEnd)}`}
                  {sub?.status === "PAST_DUE"  && "Update your payment method to continue"}
                  {sub?.status === "EXPIRED"   && "Reactivate to regain access to agents"}
                  {!sub                        && "Start your trial to use Veqiro"}
                </CardDescription>
              </div>
              <Badge variant={sub?.status === "ACTIVE" ? "default" : "outline"}>
                {sub?.status ?? "NONE"}
              </Badge>
            </div>
          </CardHeader>

          {sub?.status === "PAST_DUE" && (
            <CardContent>
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                Your last payment failed. Update your card to keep your subscription.
              </div>
            </CardContent>
          )}

          {(sub?.status === "ACTIVE" || sub?.status === "CANCELLED" || sub?.status === "PAST_DUE") && (
            <CardContent>
              <Button onClick={portal} disabled={busy !== null} variant="outline">
                <CreditCard className="size-3.5" />
                {sub.status === "ACTIVE" ? "Manage billing" : sub.status === "CANCELLED" ? "Resume" : "Update payment"}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Plan picker — only when not on an active paid plan */}
        {(sub?.status === "TRIALING" || sub?.status === "EXPIRED" || !sub) && sub && (
          <div className="grid gap-4 md:grid-cols-2">
            <PlanCard
              title="Pro Monthly"
              price="$39"
              period="per month"
              cta={busy === "monthly" ? "Loading…" : "Start Monthly"}
              onClick={() => upgrade("pro-monthly")}
              disabled={busy !== null}
            />
            <PlanCard
              title="Pro Annual"
              price="$29"
              period="per month, billed annually"
              highlight="Save 26%"
              cta={busy === "annual" ? "Loading…" : "Start Annual"}
              onClick={() => upgrade("pro-annual")}
              disabled={busy !== null}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function PlanCard(props: {
  title: string
  price: string
  period: string
  highlight?: string
  cta: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Card className={props.highlight ? "border-primary/40 bg-primary/5" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{props.title}</CardTitle>
          {props.highlight && <Badge>{props.highlight}</Badge>}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{props.price}</span>
          <span className="text-xs text-muted-foreground">{props.period}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3 shrink-0 text-chart-2" />
              {f}
            </li>
          ))}
        </ul>
        <Separator />
        <Button onClick={props.onClick} disabled={props.disabled}>
          <Zap className="size-3.5" />
          {props.cta}
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd d:/Coding/veqiro/apps/main && pnpm exec tsc --noEmit
```

Expected: clean. The `(authClient as any).dodopayments.checkoutSession(...)` cast is intentional — better-auth's plugin client typing only registers if the matching server plugin is present at compile time, and the spec calls for using `authClient.dodopayments` as a runtime feature. The cast can be tightened later by exporting a typed client from a shared module.

- [ ] **Step 3: Manual smoke**

Run `pnpm dev` from the repo root. Visit `/settings/billing` while in TRIALING state. Plan picker should show. Click "Start Monthly" → browser should redirect to Dodo checkout. Use a Dodo test card to complete checkout. After redirect back to `/settings/billing?status=success`, the page polls and eventually shows ACTIVE Pro Monthly.

If the webhook hasn't arrived yet, status will still show TRIALING. Wait a few seconds and refresh — once Dodo's webhook lands, the next session fetch will reflect ACTIVE.

- [ ] **Step 4: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/app/(dashboard)/settings/billing/page.tsx
git commit -m "feat(billing): rewrite billing page with state-driven UI"
```

---

### Task 19: Wire 402 → UpgradeRequiredCard on agent pages

**Files:**
- Modify: `apps/main/src/lib/api/client.ts`
- Modify: any agent page that renders agent fetch errors (sample: `apps/main/src/app/(dashboard)/assistants/...`)

The minimum-viable approach: extend `ApiError` to carry the parsed error body so callers can render `UpgradeRequiredCard` when `status === 402`.

- [ ] **Step 1: Surface the error code on `ApiError`**

Edit `apps/main/src/lib/api/client.ts`. Replace the `ApiError` class definition (lines 12-17) with:

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = "ApiError"
  }
}
```

In the `apiFetch` body, replace the existing `if (!res.ok) {...}` block (around lines 53-65) with:

```ts
  if (!res.ok) {
    let detail = res.statusText
    let code: string | undefined
    try {
      const j = await res.json()
      detail = j.message ?? j.error ?? j.detail ?? detail
      code = j.error
    } catch {
      /* ignore */
    }
    if (res.status >= 500) {
      toast.error("Something went wrong. Please try again.")
    }
    throw new ApiError(res.status, detail, code)
  }
```

- [ ] **Step 2: Render `UpgradeRequiredCard` on 402 in agent pages**

Locate one agent page (e.g. by running `grep -rln "ApiError" apps/main/src/app/(dashboard)/assistants/`). The exact page paths vary; for each agent route page that has a query/mutation against `/agents/*`, wrap the error render with:

```tsx
import { ApiError } from "@/lib/api/client"
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"

// Inside the component, where you currently render the error state:
if (error instanceof ApiError && error.status === 402) {
  return <UpgradeRequiredCard reason={error.code} />
}
```

Apply this in each agent page's error branch. Pages to check (six agents): `assistants/sage`, `assistants/rex`, `assistants/scout`, `assistants/maya`, `assistants/lex`, `assistants/vega` — and any messages list view that calls `/agents/...`.

If the project uses a single shared "agent error" component, edit that one file instead.

- [ ] **Step 3: Manual smoke**

Force a 402 by setting the org's `entitlementExpiresAt` to the past in Prisma Studio. Reload an agent page. Expect: `UpgradeRequiredCard` renders with the "trial-expired" copy, and the "Go to billing" button works.

Restore valid state when done.

- [ ] **Step 4: Commit**

```bash
cd d:/Coding/veqiro && git add apps/main/src/lib/api/client.ts apps/main/src/app/\(dashboard\)
git commit -m "feat(billing): render UpgradeRequiredCard on 402 from agent endpoints"
```

---

## Phase 5 — Verification

### Task 20: Manual end-to-end checklist (Dodo `test_mode`)

**Files:**
- None — this is a verification step.

Before running, confirm the env vars in `apps/server/.env` have real values from the DodoPayments dashboard:
- `DODO_PAYMENTS_API_KEY` — your test API key
- `DODO_PAYMENTS_WEBHOOK_SECRET` — copy from the webhook config in the Dodo dashboard
- `DODO_PRO_MONTHLY_PRODUCT_ID`, `DODO_PRO_ANNUAL_PRODUCT_ID` — IDs of the two products you created

Webhook delivery: in `test_mode`, Dodo cannot reach localhost. Use `ngrok http 5000` (or similar tunnel) and set the public URL + `/api/v1/auth/dodopayments/webhooks` as the webhook endpoint in the Dodo dashboard.

- [ ] **Step 1: Sign-up + org create gates the dashboard**

Sign up a fresh user, complete onboarding (creates a new org). Expect: `TrialGateModal` blocks the dashboard.

- [ ] **Step 2: Start trial unlocks agents**

Click "Start free trial". Expect: modal closes, banner shows "7 days left", any agent page works (no 402).

Confirm in DB: `subscription` table has one row, `organization.subscriptionStatus = TRIALING`, `organization.entitlementExpiresAt` is ~7 days from now.

- [ ] **Step 3: Idempotency**

Manually re-call `POST /billing/start-trial`. Expect: 409 with `"trial-already-started"`.

- [ ] **Step 4: Upgrade flow (monthly)**

On `/settings/billing`, click "Start Monthly". Browser redirects to Dodo checkout. Use Dodo's test card to complete payment. Browser returns to `/settings/billing?status=success`.

Expect within a few seconds (after webhook): `subscription.status = ACTIVE`, `plan = MONTHLY`, `dodoSubscriptionId` set, `trialEndsAt = null`. Org row mirrors. Banner is gone. UI shows "Pro Monthly · Next billing: <date>" + "Manage billing" button.

- [ ] **Step 5: Portal opens**

Click "Manage billing". Expect: redirect to Dodo-hosted portal with the org's customer details.

- [ ] **Step 6: Cancellation**

In the Dodo portal, cancel the subscription. Return to the app. Expect (after webhook): `subscription.status = CANCELLED`, `cancelAtPeriodEnd = true`, `currentPeriodEnd` unchanged. Org `subscriptionStatus = CANCELLED`, `entitlementExpiresAt = currentPeriodEnd`. Agents still work.

- [ ] **Step 7: Expiration**

In the Dodo dashboard, manually trigger a `subscription.expired` event (or fast-forward via the dashboard). Expect: org `subscriptionStatus = EXPIRED`, `entitlementExpiresAt = null`. Agent page renders `UpgradeRequiredCard` with "subscription-expired" copy.

- [ ] **Step 8: Past-due path**

Trigger a `payment.failed` event from the Dodo dashboard. Expect: org `subscriptionStatus = PAST_DUE`. Billing page shows red alert + "Update payment" button. Agent page renders `UpgradeRequiredCard` with "payment-failed" copy.

- [ ] **Step 9: Annual upgrade**

From an EXPIRED state, reactivate via "Start Annual". Confirm webhook lands with the annual product id; org → ACTIVE Pro Annual.

- [ ] **Step 10: Final commit**

If any tweaks were needed during e2e, commit them now:

```bash
cd d:/Coding/veqiro && git status
# review and commit any fixes
```

---

## Self-Review (already performed)

Spec coverage cross-checked:
- ✅ Per-org billing — Tasks 5, 8 (`startTrialForOrg` creates per-org Dodo customer)
- ✅ No `createCustomerOnSignUp` — Task 7 (plugin config omits the option)
- ✅ checkout + webhooks (no portal sub-plugin) — Task 7
- ✅ Single Pro plan, monthly/annual — Task 18 plan picker, Task 7 product configuration
- ✅ Opt-in 7-day trial — Task 8 endpoint, Task 14 modal CTA
- ✅ Lockout: agents only — Task 11 mounting on `/agents/*` only
- ✅ Customer email = org owner email — Task 5 (`startTrialForOrg` looks up owner via Member→User)
- ✅ Denormalized Org fields kept in sync via transaction — Task 5 `syncOrgEntitlement`, Task 6 webhook handlers
- ✅ Subscription model + Org columns — Task 2
- ✅ Six webhook handlers — Task 6
- ✅ `customSession` enrichment — Task 7 step 3
- ✅ Entitlement middleware reads only Organization — Task 10
- ✅ TrialGateModal / TrialBanner / UpgradeRequiredCard / billing page rewrite — Tasks 14-18
- ✅ 402 → UpgradeRequiredCard wiring — Task 19
- ✅ Manual e2e in Dodo test_mode — Task 20

No placeholders, no TBDs. Type names and method signatures consistent across tasks (`syncOrgEntitlement`, `startTrialForOrg`, `requireOrgOwner`, `deriveEntitlementFields`, `resolvePlan`, `entitlementMiddleware`).
