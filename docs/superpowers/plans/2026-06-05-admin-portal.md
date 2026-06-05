# Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lean internal admin portal (`apps/admin`) with an Overview, Organizations, and Users page, backed by new admin routes in `apps/server`.

**Architecture:** New Next.js app (`apps/admin`, port 3002) calls a new `/api/v1/admin` Express router on `apps/server`. Auth is handled by the existing Better Auth `admin()` plugin (already wired in `apps/server/src/lib/auth.ts`) — admin access is gated on `user.role === "admin"` at the system level. Pure chart computation logic is extracted into a tested helper module.

**Tech Stack:** Next.js 16.2.1, TypeScript, Tailwind CSS v4, Recharts, Better Auth admin plugin, Prisma/PostgreSQL (via existing `apps/server` infrastructure), TanStack Query v5, Node `node:test` for server-side unit tests.

---

## ⚠️ Before writing any Next.js code

`apps/main/AGENTS.md` warns: this version of Next.js has **breaking changes** vs. training data. Key one for this plan: `params` in server components is a `Promise` in Next.js 15+.
```typescript
// ✅ Correct — params is a Promise
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```
When in doubt, read `node_modules/next/dist/docs/` inside `apps/admin` after installing.

---

## File Map

**`apps/server` — new files:**
- `src/modules/admin/admin.charts.ts` — pure chart-bucketing helpers (testable)
- `src/modules/admin/admin.middleware.ts` — Express middleware, checks `user.role === "admin"`
- `src/modules/admin/admin.repository.ts` — all Prisma queries for admin data
- `src/modules/admin/admin.controller.ts` — thin request handlers
- `src/modules/admin/admin.routes.ts` — Express router
- `src/tests/unit/admin-charts.test.ts` — unit tests for `admin.charts.ts`

**`apps/server` — modified files:**
- `src/router.ts` — mount admin router
- `src/config/env.ts` — add `ADMIN_URL`
- `src/app.ts` — CORS: add admin origin
- `src/lib/auth.ts` — `trustedOrigins`: add admin origin

**`apps/admin` — new app (all files are new):**
```
apps/admin/
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  .env.local                            (template — not committed)
  src/
    app/
      globals.css
      layout.tsx                        root layout
      page.tsx                          redirects → /overview
      providers/
        QueryProvider.tsx
      (auth)/
        login/page.tsx
      (portal)/
        layout.tsx                      auth gate + sidebar shell
        overview/page.tsx
        organizations/
          page.tsx
          [id]/page.tsx
        users/page.tsx
    lib/
      auth-client.ts
      server-session.ts
      api.ts
      utils.ts
      query-client.ts
    components/
      auth/LoginForm.tsx
      layout/Sidebar.tsx
      StatCard.tsx
      StatusBadge.tsx
      overview/OverviewClient.tsx
      charts/SignupsChart.tsx
      charts/HealthChart.tsx
      charts/AgentChart.tsx
      orgs/OrgsClient.tsx
      orgs/ExtendTrialButton.tsx
      users/UsersClient.tsx
```

---

## Task 1: Server — Pure chart helpers + unit tests

**Files:**
- Create: `apps/server/src/modules/admin/admin.charts.ts`
- Create: `apps/server/src/tests/unit/admin-charts.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/server/src/tests/unit/admin-charts.test.ts
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { buildSignupBuckets, buildHealthBuckets } from "../../modules/admin/admin.charts.js";

// Fixed Sunday anchor so week math is deterministic
const NOW = new Date("2026-06-07T12:00:00Z");

describe("buildSignupBuckets", () => {
  test("returns exactly weekCount buckets", () => {
    const result = buildSignupBuckets([], 4, NOW);
    assert.equal(result.length, 4);
  });

  test("counts orgs in the correct week bucket", () => {
    const orgs = [
      { createdAt: new Date("2026-06-07T10:00:00Z") }, // current week (Sun)
      { createdAt: new Date("2026-06-07T22:00:00Z") }, // current week
      { createdAt: new Date("2026-05-31T10:00:00Z") }, // one week ago
    ];
    const result = buildSignupBuckets(orgs, 3, NOW);
    assert.equal(result[2].count, 2);
    assert.equal(result[1].count, 1);
    assert.equal(result[0].count, 0);
  });

  test("ignores orgs outside the window", () => {
    const orgs = [{ createdAt: new Date("2020-01-01T00:00:00Z") }];
    const result = buildSignupBuckets(orgs, 3, NOW);
    const total = result.reduce((s, b) => s + b.count, 0);
    assert.equal(total, 0);
  });
});

describe("buildHealthBuckets", () => {
  test("returns exactly weekCount buckets", () => {
    const result = buildHealthBuckets([], 4, NOW);
    assert.equal(result.length, 4);
  });

  test("categorises all five statuses correctly", () => {
    const orgs = [
      { createdAt: new Date("2026-06-07T10:00:00Z"), subscriptionStatus: "ACTIVE" },
      { createdAt: new Date("2026-06-07T11:00:00Z"), subscriptionStatus: "TRIALING" },
      { createdAt: new Date("2026-06-07T12:00:00Z"), subscriptionStatus: "PAST_DUE" },
      { createdAt: new Date("2026-06-07T13:00:00Z"), subscriptionStatus: "CANCELLED" },
      { createdAt: new Date("2026-06-07T14:00:00Z"), subscriptionStatus: "EXPIRED" },
    ];
    const [bucket] = buildHealthBuckets(orgs, 1, NOW);
    assert.equal(bucket.active, 1);
    assert.equal(bucket.trialing, 1);
    assert.equal(bucket.pastDue, 1);
    assert.equal(bucket.cancelledExpired, 2); // CANCELLED + EXPIRED combined
  });

  test("null status is silently ignored", () => {
    const orgs = [{ createdAt: new Date("2026-06-07T10:00:00Z"), subscriptionStatus: null }];
    const [bucket] = buildHealthBuckets(orgs, 1, NOW);
    assert.equal(bucket.active + bucket.trialing + bucket.pastDue + bucket.cancelledExpired, 0);
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd apps/server
node --import tsx --test src/tests/unit/admin-charts.test.ts
```
Expected: `Error: Cannot find module '../../modules/admin/admin.charts.js'`

- [ ] **Step 3: Implement admin.charts.ts**

```typescript
// apps/server/src/modules/admin/admin.charts.ts

export type WeekBucket = { week: string; count: number };
export type HealthBucket = {
  week: string;
  active: number;
  trialing: number;
  pastDue: number;
  cancelledExpired: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekStart(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() - copy.getUTCDay()); // rewind to Sunday
  return copy;
}

export function buildSignupBuckets(
  orgs: Array<{ createdAt: Date }>,
  weekCount: number,
  now: Date = new Date(),
): WeekBucket[] {
  const currentWeekStart = weekStart(now);
  const firstBucketTime = currentWeekStart.getTime() - (weekCount - 1) * WEEK_MS;

  const buckets: WeekBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    week: new Date(firstBucketTime + i * WEEK_MS).toISOString().slice(0, 10),
    count: 0,
  }));

  for (const org of orgs) {
    const ws = weekStart(org.createdAt).getTime();
    const idx = Math.round((ws - firstBucketTime) / WEEK_MS);
    if (idx >= 0 && idx < weekCount) buckets[idx].count++;
  }
  return buckets;
}

export function buildHealthBuckets(
  orgs: Array<{ createdAt: Date; subscriptionStatus: string | null }>,
  weekCount: number,
  now: Date = new Date(),
): HealthBucket[] {
  const currentWeekStart = weekStart(now);
  const firstBucketTime = currentWeekStart.getTime() - (weekCount - 1) * WEEK_MS;

  const buckets: HealthBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    week: new Date(firstBucketTime + i * WEEK_MS).toISOString().slice(0, 10),
    active: 0,
    trialing: 0,
    pastDue: 0,
    cancelledExpired: 0,
  }));

  for (const org of orgs) {
    const ws = weekStart(org.createdAt).getTime();
    const idx = Math.round((ws - firstBucketTime) / WEEK_MS);
    if (idx < 0 || idx >= weekCount) continue;
    const s = org.subscriptionStatus;
    if (s === "ACTIVE") buckets[idx].active++;
    else if (s === "TRIALING") buckets[idx].trialing++;
    else if (s === "PAST_DUE") buckets[idx].pastDue++;
    else if (s === "CANCELLED" || s === "EXPIRED") buckets[idx].cancelledExpired++;
  }
  return buckets;
}
```

- [ ] **Step 4: Run to confirm PASS**

```bash
cd apps/server
node --import tsx --test src/tests/unit/admin-charts.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/admin/admin.charts.ts apps/server/src/tests/unit/admin-charts.test.ts
git commit -m "feat(server/admin): add chart bucketing helpers with tests"
```

---

## Task 2: Server — Admin middleware

**Files:**
- Create: `apps/server/src/modules/admin/admin.middleware.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/server/src/modules/admin/admin.middleware.ts
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../lib/auth.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new UnauthenticatedError("Unauthorized");
    if (session.user.role !== "admin") {
      res.status(StatusCodes.FORBIDDEN).json({ error: "Forbidden" });
      return;
    }
    req.userId = session.user.id;
    next();
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/modules/admin/admin.middleware.ts
git commit -m "feat(server/admin): add admin session middleware"
```

---

## Task 3: Server — Admin repository

**Files:**
- Create: `apps/server/src/modules/admin/admin.repository.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/server/src/modules/admin/admin.repository.ts
import { prisma } from "../../config/prisma.js";
import { buildSignupBuckets, buildHealthBuckets } from "./admin.charts.js";

const PAGE_SIZE = 25;
const ALL_AGENTS = ["MAYA", "REX", "SCOUT", "SAGE", "LEX", "VEGA"] as const;

export async function getOverviewStats() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const [
    totalOrgs,
    activeCount,
    trialingCount,
    pastDueCount,
    cancelledExpiredCount,
    newOrgsThisWeek,
    totalUsers,
    trialExpiringSoon,
    orgsForCharts,
    agentCounts,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { subscriptionStatus: "ACTIVE" } }),
    prisma.organization.count({ where: { subscriptionStatus: "TRIALING" } }),
    prisma.organization.count({ where: { subscriptionStatus: "PAST_DUE" } }),
    prisma.organization.count({
      where: { subscriptionStatus: { in: ["CANCELLED", "EXPIRED"] } },
    }),
    prisma.organization.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count(),
    prisma.organization.count({
      where: {
        subscriptionStatus: "TRIALING",
        entitlementExpiresAt: { gte: now, lte: sevenDaysFromNow },
      },
    }),
    prisma.organization.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true, subscriptionStatus: true },
    }),
    prisma.message.groupBy({
      by: ["agent"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  return {
    stats: {
      totalOrgs,
      activeSubscriptions: activeCount,
      trialing: trialingCount,
      trialExpiringSoon,
      pastDue: pastDueCount,
      cancelledOrExpired: cancelledExpiredCount,
      newOrgsThisWeek,
      totalUsers,
    },
    charts: {
      signupsPerWeek: buildSignupBuckets(orgsForCharts, 12, now),
      healthPerWeek: buildHealthBuckets(orgsForCharts, 12, now),
      agentPopularity: agentCounts.map((r) => ({
        agent: r.agent.charAt(0) + r.agent.slice(1).toLowerCase(),
        messages: r._count._all,
      })),
    },
  };
}

export async function listOrganizations(params: {
  search?: string;
  status?: string;
  page: number;
}) {
  const { search, status, page } = params;
  const where = {
    ...(status ? { subscriptionStatus: status as any } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            {
              members: {
                some: {
                  role: "owner",
                  user: {
                    email: { contains: search, mode: "insensitive" as const },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        onboarded: true,
        createdAt: true,
        subscriptionStatus: true,
        subscription: { select: { plan: true } },
        members: {
          select: {
            role: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    orgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      onboarded: o.onboarded,
      createdAt: o.createdAt,
      subscriptionStatus: o.subscriptionStatus,
      plan: o.subscription?.plan ?? null,
      memberCount: o.members.length,
      ownerEmail:
        o.members.find((m) => m.role === "owner")?.user.email ?? null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getOrganizationById(id: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [org, agentCounts, socialAccounts] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        onboarded: true,
        createdAt: true,
        subscriptionStatus: true,
        entitlementExpiresAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            dodoCustomerId: true,
            dodoSubscriptionId: true,
          },
        },
        members: {
          select: {
            role: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.message.groupBy({
      by: ["agent"],
      where: { organizationId: id, createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.socialAccount.findMany({
      where: { organizationId: id },
      select: { platform: true, accountName: true },
    }),
  ]);

  const agentMap: Record<string, number> = {};
  for (const r of agentCounts) agentMap[r.agent] = r._count._all;

  return {
    ...org,
    agentActivity: ALL_AGENTS.map((a) => ({
      agent: a,
      messages: agentMap[a] ?? 0,
    })),
    connectedPlatforms: socialAccounts.map((s) => s.platform),
  };
}

export async function extendTrial(id: string) {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return prisma.organization.update({
    where: { id },
    data: {
      subscriptionStatus: "TRIALING",
      entitlementExpiresAt: sevenDaysFromNow,
    },
    select: { id: true, subscriptionStatus: true, entitlementExpiresAt: true },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/modules/admin/admin.repository.ts
git commit -m "feat(server/admin): add admin repository (overview, orgs list, org detail, extend trial)"
```

---

## Task 4: Server — Controller, routes, and wire everything in

**Files:**
- Create: `apps/server/src/modules/admin/admin.controller.ts`
- Create: `apps/server/src/modules/admin/admin.routes.ts`
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/lib/auth.ts`
- Modify: `apps/server/src/router.ts`

- [ ] **Step 1: Create admin.controller.ts**

```typescript
// apps/server/src/modules/admin/admin.controller.ts
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as repo from "./admin.repository.js";

export const overview = async (_req: Request, res: Response) => {
  const data = await repo.getOverviewStats();
  res.status(StatusCodes.OK).json(data);
};

export const listOrgs = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const data = await repo.listOrganizations({
    search: q.search?.trim() || undefined,
    status: q.status || undefined,
    page: Number(q.page) || 1,
  });
  res.status(StatusCodes.OK).json(data);
};

export const getOrg = async (req: Request, res: Response) => {
  const data = await repo.getOrganizationById(req.params.id);
  res.status(StatusCodes.OK).json(data);
};

export const extendTrial = async (req: Request, res: Response) => {
  const data = await repo.extendTrial(req.params.id);
  res.status(StatusCodes.OK).json(data);
};
```

- [ ] **Step 2: Create admin.routes.ts**

```typescript
// apps/server/src/modules/admin/admin.routes.ts
import { Router } from "express";
import { overview, listOrgs, getOrg, extendTrial } from "./admin.controller.js";

const router = Router();

router.get("/overview", overview);
router.get("/organizations", listOrgs);
router.get("/organizations/:id", getOrg);
router.patch("/organizations/:id/extend-trial", extendTrial);

export default router;
```

- [ ] **Step 3: Add ADMIN_URL to env.ts**

In `apps/server/src/config/env.ts`, add one line inside the `env` object:

```typescript
// After CLIENT_URL line, add:
ADMIN_URL: process.env.ADMIN_URL ?? "http://localhost:3002",
```

- [ ] **Step 4: Update CORS in app.ts**

In `apps/server/src/app.ts`, find the `cors({` block and change the `origin` field:

```typescript
// Before:
origin: env.CLIENT_URL,
// After:
origin: [env.CLIENT_URL, env.ADMIN_URL],
```

- [ ] **Step 5: Update trustedOrigins in auth.ts**

In `apps/server/src/lib/auth.ts`, find `trustedOrigins` and update it:

```typescript
// Before:
trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3001"],
// After:
trustedOrigins: [
  process.env.CLIENT_URL || "http://localhost:3001",
  process.env.ADMIN_URL  || "http://localhost:3002",
],
```

- [ ] **Step 6: Mount admin router in router.ts**

In `apps/server/src/router.ts`, add two lines near the top imports and one mount near the other protected routes:

```typescript
// Add import (with the other imports at the top):
import adminRouter from "./modules/admin/admin.routes.js";
import { adminMiddleware } from "./modules/admin/admin.middleware.js";

// Add mount (after the billing route line):
router.use("/admin", adminMiddleware, adminRouter);
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd apps/server
pnpm run build
```
Expected: exit 0, no type errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/modules/admin/admin.controller.ts \
        apps/server/src/modules/admin/admin.routes.ts \
        apps/server/src/config/env.ts \
        apps/server/src/app.ts \
        apps/server/src/lib/auth.ts \
        apps/server/src/router.ts
git commit -m "feat(server/admin): wire admin router with CORS and trusted-origins update"
```

---

## Task 5: Admin app — Scaffold

**Files:** `apps/admin/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create package.json**

```json
// apps/admin/package.json
{
  "name": "admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "eslint"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.99.2",
    "better-auth": "^1.5.6",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^1.7.0",
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@tanstack/react-query-devtools": "^5.99.2",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
// apps/admin/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
// apps/admin/next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Create postcss.config.mjs**

```javascript
// apps/admin/postcss.config.mjs
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

- [ ] **Step 5: Create globals.css**

```css
/* apps/admin/src/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --ring: #18181b;
  --primary: #18181b;
  --primary-foreground: #fafafa;
  --destructive: #ef4444;
}

@layer base {
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  * { box-sizing: border-box; }
}
```

- [ ] **Step 6: Create root layout.tsx**

```tsx
// apps/admin/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import QueryProvider from "@/app/providers/QueryProvider";

export const metadata: Metadata = { title: "Veqiro Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create root page.tsx (redirect)**

```tsx
// apps/admin/src/app/page.tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/overview");
}
```

- [ ] **Step 8: Create .env.local template** (do not commit this file)

```bash
# apps/admin/.env.local
NEXT_PUBLIC_SERVER_URL=http://localhost:5000
NEXT_PUBLIC_API_VERSION=v1
BACKEND_URL=http://localhost:5000
```

- [ ] **Step 9: Install dependencies**

```bash
cd apps/admin
pnpm install
```
Expected: packages installed, no errors.

- [ ] **Step 10: Commit scaffold** (do NOT commit .env.local)

```bash
git add apps/admin/package.json apps/admin/tsconfig.json apps/admin/next.config.ts \
        apps/admin/postcss.config.mjs apps/admin/src/app/globals.css \
        apps/admin/src/app/layout.tsx apps/admin/src/app/page.tsx
git commit -m "feat(admin): scaffold Next.js admin app"
```

---

## Task 6: Admin app — Lib files

**Files:** `lib/utils.ts`, `lib/query-client.ts`, `lib/auth-client.ts`, `lib/server-session.ts`, `lib/api.ts`, `app/providers/QueryProvider.tsx`

- [ ] **Step 1: Create utils.ts**

```typescript
// apps/admin/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create query-client.ts**

```typescript
// apps/admin/src/lib/query-client.ts
import { QueryClient, isServer } from "@tanstack/react-query";
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}
let browserQueryClient: QueryClient | undefined;
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

- [ ] **Step 3: Create auth-client.ts**

```typescript
// apps/admin/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000",
  basePath: `/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}/auth`,
  plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 4: Create server-session.ts**

```typescript
// apps/admin/src/lib/server-session.ts
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface AdminSession {
  userId: string;
  userName: string;
  userEmail: string;
}

interface RawSession {
  user?: { id: string; name: string; email: string; role?: string | null };
}

async function fetchSession(): Promise<RawSession | null> {
  const hdrs = await headers();
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/api/v1/auth/get-session`,
      {
        headers: {
          cookie: hdrs.get("cookie") ?? "",
          "user-agent": hdrs.get("user-agent") ?? "",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as RawSession | null;
    return body?.user ? body : null;
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const sess = await fetchSession();
  if (!sess?.user) redirect("/login");
  if (sess.user.role !== "admin") redirect("/login?error=forbidden");
  return {
    userId: sess.user.id,
    userName: sess.user.name,
    userEmail: sess.user.email,
  };
}
```

- [ ] **Step 5: Create api.ts**

```typescript
// apps/admin/src/lib/api.ts
const BASE = `${process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000"}/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}`;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 6: Create QueryProvider.tsx**

```tsx
// apps/admin/src/app/providers/QueryProvider.tsx
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/query-client";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <QueryClientProvider client={qc}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/lib/ apps/admin/src/app/providers/
git commit -m "feat(admin): add lib utilities and QueryProvider"
```

---

## Task 7: Admin app — Login page

**Files:**
- Create: `apps/admin/src/components/auth/LoginForm.tsx`
- Create: `apps/admin/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create LoginForm.tsx**

```tsx
// apps/admin/src/components/auth/LoginForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Sign in failed");
      setLoading(false);
      return;
    }
    router.push("/overview");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
          {error}
        </p>
      )}
      <div className="space-y-1">
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[var(--primary)] py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create login/page.tsx**

```tsx
// apps/admin/src/app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--border)] bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Veqiro Admin</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Internal access only</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/auth/ apps/admin/src/app/"(auth)"/
git commit -m "feat(admin): add login page"
```

---

## Task 8: Admin app — Portal layout and sidebar

**Files:**
- Create: `apps/admin/src/components/layout/Sidebar.tsx`
- Create: `apps/admin/src/app/(portal)/layout.tsx`

- [ ] **Step 1: Create Sidebar.tsx**

```tsx
// apps/admin/src/components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, Users, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Overview", Icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", Icon: Building2 },
  { href: "/users", label: "Users", Icon: Users },
] as const;

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <aside className="flex h-full w-52 flex-col border-r border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Veqiro Admin</p>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <p className="truncate text-xs text-[var(--muted-foreground)]">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create (portal)/layout.tsx**

```tsx
// apps/admin/src/app/(portal)/layout.tsx
import { requireAdminSession } from "@/lib/server-session";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userEmail={session.userEmail} />
      <main className="flex-1 overflow-y-auto bg-[var(--muted)] p-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/layout/ apps/admin/src/app/"(portal)"/layout.tsx
git commit -m "feat(admin): add portal layout and sidebar"
```

---

## Task 9: Admin app — Shared UI components

**Files:**
- Create: `apps/admin/src/components/StatCard.tsx`
- Create: `apps/admin/src/components/StatusBadge.tsx`
- Create: `apps/admin/src/components/charts/SignupsChart.tsx`
- Create: `apps/admin/src/components/charts/HealthChart.tsx`
- Create: `apps/admin/src/components/charts/AgentChart.tsx`

- [ ] **Step 1: Create StatCard.tsx**

```tsx
// apps/admin/src/components/StatCard.tsx
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  highlight?: "warning" | "danger";
}

export function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-5",
        highlight === "danger" && "border-red-300 bg-red-50",
        highlight === "warning" && "border-amber-300 bg-amber-50",
        !highlight && "border-[var(--border)]",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-bold tabular-nums",
          highlight === "danger" && "text-red-600",
          highlight === "warning" && "text-amber-600",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create StatusBadge.tsx**

```tsx
// apps/admin/src/components/StatusBadge.tsx
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status: string | null }) {
  const color = status ? (COLORS[status] ?? "bg-gray-100 text-gray-600") : "bg-gray-100 text-gray-400";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {status ?? "—"}
    </span>
  );
}
```

- [ ] **Step 3: Create SignupsChart.tsx**

```tsx
// apps/admin/src/components/charts/SignupsChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function SignupsChart({ data }: { data: Array<{ week: string; count: number }> }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold">New Signups (12 weeks)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip
            formatter={(v: number) => [v, "orgs"]}
            labelFormatter={(l: string) => `Week of ${l}`}
          />
          <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create HealthChart.tsx**

```tsx
// apps/admin/src/components/charts/HealthChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

type HealthBucket = {
  week: string;
  active: number;
  trialing: number;
  pastDue: number;
  cancelledExpired: number;
};

export function HealthChart({ data }: { data: HealthBucket[] }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold">Subscription Health (by sign-up week)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip labelFormatter={(l: string) => `Week of ${l}`} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="active" name="Active" stackId="a" fill="#22c55e" />
          <Bar dataKey="trialing" name="Trialing" stackId="a" fill="#3b82f6" />
          <Bar dataKey="pastDue" name="Past-due" stackId="a" fill="#f59e0b" />
          <Bar dataKey="cancelledExpired" name="Churned" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Create AgentChart.tsx**

```tsx
// apps/admin/src/components/charts/AgentChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#18181b", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

export function AgentChart({ data }: { data: Array<{ agent: string; messages: number }> }) {
  const sorted = [...data].sort((a, b) => b.messages - a.messages);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold">Agent Popularity (30 days)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="agent" tick={{ fontSize: 11 }} width={46} />
          <Tooltip formatter={(v: number) => [v, "messages"]} />
          <Bar dataKey="messages" radius={[0, 3, 3, 0]}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/
git commit -m "feat(admin): add StatCard, StatusBadge, and chart components"
```

---

## Task 10: Admin app — Overview page

**Files:**
- Create: `apps/admin/src/components/overview/OverviewClient.tsx`
- Create: `apps/admin/src/app/(portal)/overview/page.tsx`

- [ ] **Step 1: Create OverviewClient.tsx**

```tsx
// apps/admin/src/components/overview/OverviewClient.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { SignupsChart } from "@/components/charts/SignupsChart";
import { HealthChart } from "@/components/charts/HealthChart";
import { AgentChart } from "@/components/charts/AgentChart";

type OverviewData = {
  stats: {
    totalOrgs: number;
    activeSubscriptions: number;
    trialing: number;
    trialExpiringSoon: number;
    pastDue: number;
    cancelledOrExpired: number;
    newOrgsThisWeek: number;
    totalUsers: number;
  };
  charts: {
    signupsPerWeek: Array<{ week: string; count: number }>;
    healthPerWeek: Array<{
      week: string;
      active: number;
      trialing: number;
      pastDue: number;
      cancelledExpired: number;
    }>;
    agentPopularity: Array<{ agent: string; messages: number }>;
  };
};

export function OverviewClient() {
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<OverviewData>("/admin/overview"),
  });

  if (isLoading)
    return <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>;
  if (error || !data)
    return <p className="text-sm text-red-500">Failed to load overview.</p>;

  const { stats, charts } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Orgs" value={stats.totalOrgs} />
        <StatCard label="Active" value={stats.activeSubscriptions} />
        <StatCard label="Trialing" value={stats.trialing} />
        <StatCard label="New This Week" value={stats.newOrgsThisWeek} />
        <StatCard
          label="Trials Expiring (7d)"
          value={stats.trialExpiringSoon}
          highlight={stats.trialExpiringSoon > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Past-Due"
          value={stats.pastDue}
          highlight={stats.pastDue > 0 ? "danger" : undefined}
        />
        <StatCard label="Cancelled / Expired" value={stats.cancelledOrExpired} />
        <StatCard label="Total Users" value={stats.totalUsers} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SignupsChart data={charts.signupsPerWeek} />
        <HealthChart data={charts.healthPerWeek} />
        <AgentChart data={charts.agentPopularity} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create overview/page.tsx**

```tsx
// apps/admin/src/app/(portal)/overview/page.tsx
import { requireAdminSession } from "@/lib/server-session";
import { OverviewClient } from "@/components/overview/OverviewClient";

export default async function OverviewPage() {
  await requireAdminSession();
  return <OverviewClient />;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/overview/ apps/admin/src/app/"(portal)"/overview/
git commit -m "feat(admin): add overview page with stat cards and charts"
```

---

## Task 11: Admin app — Organizations list page

**Files:**
- Create: `apps/admin/src/components/orgs/OrgsClient.tsx`
- Create: `apps/admin/src/app/(portal)/organizations/page.tsx`

- [ ] **Step 1: Create OrgsClient.tsx**

```tsx
// apps/admin/src/components/orgs/OrgsClient.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

type Org = {
  id: string;
  name: string;
  slug: string;
  onboarded: boolean;
  createdAt: string;
  subscriptionStatus: string | null;
  plan: string | null;
  memberCount: number;
  ownerEmail: string | null;
};

type OrgsResponse = { orgs: Org[]; total: number; page: number; pageSize: number };

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Trialing", value: "TRIALING" },
  { label: "Past-Due", value: "PAST_DUE" },
  { label: "Cancelled", value: "CANCELLED" },
];

export function OrgsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentPage = Number(searchParams.get("page") ?? "1");

  const [searchInput, setSearchInput] = useState(currentSearch);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      router.replace(`/organizations?${params.toString()}`);
    },
    [searchParams, router],
  );

  useEffect(() => {
    const t = setTimeout(() => updateParams({ search: searchInput, page: "" }), 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useQuery<OrgsResponse>({
    queryKey: ["admin", "orgs", currentSearch, currentStatus, currentPage],
    queryFn: () => {
      const p = new URLSearchParams();
      if (currentSearch) p.set("search", currentSearch);
      if (currentStatus) p.set("status", currentStatus);
      p.set("page", String(currentPage));
      return apiFetch<OrgsResponse>(`/admin/organizations?${p.toString()}`);
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Organizations</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or owner email…"
            className="w-72 rounded border border-[var(--border)] bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => updateParams({ status: value, page: "" })}
              className={cn(
                "rounded px-3 py-1 text-sm",
                currentStatus === value
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">Failed to load organizations.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                {["Name", "Owner", "Status", "Plan", "Members", "Onboarded", "Created"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data?.orgs.map((org) => (
                <tr key={org.id} className="hover:bg-[var(--muted)]">
                  <td className="px-4 py-2.5">
                    <Link href={`/organizations/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    <p className="text-xs text-[var(--muted-foreground)]">/{org.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {org.ownerEmail ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={org.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {org.plan ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">{org.memberCount}</td>
                  <td className="px-4 py-2.5 text-center">{org.onboarded ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {format(new Date(org.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.orgs.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No organizations found.
            </p>
          )}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--muted-foreground)]">{data.total} total</p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              className="rounded border border-[var(--border)] bg-white p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              className="rounded border border-[var(--border)] bg-white p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create organizations/page.tsx**

```tsx
// apps/admin/src/app/(portal)/organizations/page.tsx
import { requireAdminSession } from "@/lib/server-session";
import { OrgsClient } from "@/components/orgs/OrgsClient";
import { Suspense } from "react";

export default async function OrgsPage() {
  await requireAdminSession();
  return (
    <Suspense>
      <OrgsClient />
    </Suspense>
  );
}
```

Note: `<Suspense>` is required because `OrgsClient` uses `useSearchParams()`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/orgs/OrgsClient.tsx apps/admin/src/app/"(portal)"/organizations/page.tsx
git commit -m "feat(admin): add organizations list page"
```

---

## Task 12: Admin app — Org detail page

**Files:**
- Create: `apps/admin/src/components/orgs/ExtendTrialButton.tsx`
- Create: `apps/admin/src/app/(portal)/organizations/[id]/page.tsx`

- [ ] **Step 1: Create ExtendTrialButton.tsx**

```tsx
// apps/admin/src/components/orgs/ExtendTrialButton.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export function ExtendTrialButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleExtend = async () => {
    setLoading(true);
    try {
      await apiFetch(`/admin/organizations/${orgId}/extend-trial`, {
        method: "PATCH",
      });
      toast.success("Trial extended by 7 days");
      router.refresh();
    } catch {
      toast.error("Failed to extend trial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExtend}
      disabled={loading}
      className="rounded border border-[var(--border)] bg-white px-4 py-1.5 text-sm hover:bg-[var(--muted)] disabled:opacity-50"
    >
      {loading ? "Extending…" : "Extend Trial (+7 days)"}
    </button>
  );
}
```

- [ ] **Step 2: Create organizations/[id]/page.tsx**

```tsx
// apps/admin/src/app/(portal)/organizations/[id]/page.tsx
import { requireAdminSession } from "@/lib/server-session";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ExtendTrialButton } from "@/components/orgs/ExtendTrialButton";

type Member = {
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  onboarded: boolean;
  createdAt: string;
  subscriptionStatus: string | null;
  entitlementExpiresAt: string | null;
  subscription: {
    plan: string | null;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    dodoCustomerId: string;
    dodoSubscriptionId: string | null;
  } | null;
  members: Member[];
  agentActivity: Array<{ agent: string; messages: number }>;
  connectedPlatforms: string[];
};

function fmt(d: string | null) {
  return d ? format(new Date(d), "MMM d, yyyy") : "—";
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;

  const hdrs = await headers();
  const res = await fetch(
    `${process.env.BACKEND_URL}/api/v1/admin/organizations/${id}`,
    {
      headers: {
        cookie: hdrs.get("cookie") ?? "",
        "user-agent": hdrs.get("user-agent") ?? "",
      },
      cache: "no-store",
    },
  );
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Failed to fetch org");
  const org: OrgDetail = await res.json();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/organizations"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">{org.name}</h1>
        <StatusBadge status={org.subscriptionStatus} />
        <span className="text-sm text-[var(--muted-foreground)]">/{org.slug}</span>
        <span className="text-xs text-[var(--muted-foreground)]">
          Created {fmt(org.createdAt)}
        </span>
      </div>

      {/* Subscription */}
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Subscription</h2>
        {org.subscription ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Detail label="Status" value={<StatusBadge status={org.subscriptionStatus} />} />
              <Detail label="Plan" value={org.subscription.plan ?? "—"} />
              <Detail label="Trial ends" value={fmt(org.subscription.trialEndsAt)} />
              <Detail label="Period end" value={fmt(org.subscription.currentPeriodEnd)} />
              <Detail
                label="Entitlement expires"
                value={fmt(org.entitlementExpiresAt)}
              />
              <Detail
                label="Cancel at period end"
                value={org.subscription.cancelAtPeriodEnd ? "Yes" : "No"}
              />
              <Detail
                label="Dodo Customer ID"
                value={
                  <code className="text-xs font-mono">
                    {org.subscription.dodoCustomerId}
                  </code>
                }
              />
              <Detail
                label="Dodo Subscription ID"
                value={
                  <code className="text-xs font-mono">
                    {org.subscription.dodoSubscriptionId ?? "—"}
                  </code>
                }
              />
            </div>
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <ExtendTrialButton orgId={org.id} />
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No subscription record.</p>
        )}
      </section>

      {/* Members */}
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Members ({org.members.length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Name", "Email", "Role", "Joined"].map((h) => (
                <th key={h} className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {org.members.map((m) => (
              <tr key={m.user.id}>
                <td className="py-2 font-medium">{m.user.name}</td>
                <td className="py-2 text-[var(--muted-foreground)]">{m.user.email}</td>
                <td className="py-2 capitalize">{m.role}</td>
                <td className="py-2 text-[var(--muted-foreground)]">{fmt(m.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Agent Activity */}
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Agent Activity (last 30 days)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Agent</th>
              <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {org.agentActivity.map((a) => (
              <tr key={a.agent}>
                <td className="py-2 capitalize">{a.agent.toLowerCase()}</td>
                <td className="py-2 text-right font-mono">{a.messages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Integrations */}
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Connected Integrations</h2>
        {org.connectedPlatforms.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">None connected.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {org.connectedPlatforms.map((p) => (
              <span
                key={p}
                className="rounded border border-[var(--border)] px-3 py-1 text-sm capitalize"
              >
                {p.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/orgs/ExtendTrialButton.tsx \
        "apps/admin/src/app/(portal)/organizations/[id]/page.tsx"
git commit -m "feat(admin): add org detail page with extend-trial action"
```

---

## Task 13: Admin app — Users page

**Files:**
- Create: `apps/admin/src/components/users/UsersClient.tsx`
- Create: `apps/admin/src/app/(portal)/users/page.tsx`

**Note:** Better Auth's `adminClient` is used directly here. Check the exact method signatures in `node_modules/better-auth/dist/` if any TypeScript errors arise — the API may differ slightly from the version in training data.

- [ ] **Step 1: Create UsersClient.tsx**

```tsx
// apps/admin/src/components/users/UsersClient.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

type BaUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  banned?: boolean | null;
  banReason?: string | null;
};

export function UsersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showBanned, setShowBanned] = useState(false);
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<BaUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await (authClient as any).admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset,
          ...(search ? { searchValue: search, searchField: "email" } : {}),
          ...(showBanned ? { filterField: "banned", filterValue: "true" } : {}),
        },
      });
      if (result.error) throw new Error(result.error.message ?? "Unknown error");
      setUsers(result.data?.users ?? []);
      setTotal(result.data?.total ?? 0);
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, [search, showBanned, offset]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleBan = async (user: BaUser) => {
    setBanningId(user.id);
    try {
      if (user.banned) {
        await (authClient as any).admin.unbanUser({ userId: user.id });
        toast.success(`${user.email} unbanned`);
      } else {
        await (authClient as any).admin.banUser({
          userId: user.id,
          banReason: "Banned by admin",
          banExpiresIn: 365 * 24 * 60 * 60,
        });
        toast.success(`${user.email} banned`);
      }
      await load();
    } catch {
      toast.error("Failed to update ban status");
    } finally {
      setBanningId(null);
    }
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email…"
            className="w-64 rounded border border-[var(--border)] bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex gap-1">
          {["All", "Banned"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setShowBanned(tab === "Banned");
                setOffset(0);
              }}
              className={cn(
                "rounded px-3 py-1 text-sm",
                showBanned === (tab === "Banned")
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : fetchError ? (
        <p className="text-sm text-red-500">{fetchError}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                {["Name", "Email", "Verified", "Created", "Status", ""].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    "hover:bg-[var(--muted)]",
                    u.banned && "bg-red-50/50",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">{u.email}</td>
                  <td className="px-4 py-2.5 text-center">{u.emailVerified ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.banned ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleBan(u)}
                      disabled={banningId === u.id}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50",
                        u.banned
                          ? "border border-green-300 text-green-700 hover:bg-green-50"
                          : "border border-red-300 text-red-700 hover:bg-red-50",
                      )}
                    >
                      {banningId === u.id ? "…" : u.banned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No users found.
            </p>
          )}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--muted-foreground)]">{total} users</p>
          <div className="flex items-center gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded border border-[var(--border)] bg-white p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded border border-[var(--border)] bg-white p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create users/page.tsx**

```tsx
// apps/admin/src/app/(portal)/users/page.tsx
import { requireAdminSession } from "@/lib/server-session";
import { UsersClient } from "@/components/users/UsersClient";

export default async function UsersPage() {
  await requireAdminSession();
  return <UsersClient />;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/users/ apps/admin/src/app/"(portal)"/users/
git commit -m "feat(admin): add users page with ban/unban"
```

---

## Task 14: First admin user setup

This is a one-time operation after the server and admin app are running.

- [ ] **Step 1: Set user role in the database**

Run this SQL against your PostgreSQL database (replace the email with your own):

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'your@email.com';
```

Or use Prisma Studio:
```bash
cd apps/server
pnpm exec prisma studio
```
Then find the user row and set `role = admin`.

- [ ] **Step 2: Verify**

Start both server and admin app, log in at `http://localhost:3002/login`. Should reach `/overview` without redirect.

```bash
# Terminal 1
cd apps/server && pnpm dev

# Terminal 2
cd apps/admin && pnpm dev
```

---

## Verification Checklist

Run through these manually after all tasks are done:

- [ ] Non-admin user logs in → immediately redirected to `/login?error=forbidden`
- [ ] Admin user logs in → reaches `/overview`
- [ ] Overview stat cards show numbers that match: `SELECT COUNT(*) FROM "organization" WHERE "subscriptionStatus" = 'ACTIVE'` etc.
- [ ] Signups chart week totals match: `SELECT DATE_TRUNC('week', "createdAt"), COUNT(*) FROM "organization" GROUP BY 1 ORDER BY 1`
- [ ] Agent chart totals match: `SELECT agent, COUNT(*) FROM "message" WHERE "createdAt" > NOW() - INTERVAL '30 days' GROUP BY agent`
- [ ] Search by org name returns correct results
- [ ] Search by owner email returns the org that user owns
- [ ] Status filter tabs correctly filter the table
- [ ] Clicking an org row opens org detail page
- [ ] Org detail shows correct subscription dates, member list, agent counts
- [ ] "Extend Trial (+7 days)" button updates `entitlementExpiresAt` in DB and shows toast
- [ ] Ban a test user → `User.banned = true` in DB, row shows "Banned" badge
- [ ] Unban → `User.banned = false` in DB, row shows "Active" badge
- [ ] Sign out button → redirected to `/login`
- [ ] Visit `/overview` without a session → redirected to `/login`
