# Admin Portal — Design Spec
**Date:** 2026-06-05  
**Status:** Approved

---

## Context

Veqiro is a multi-tenant AI-agents SaaS (6 specialized agents per org: Maya, Rex, Scout, Sage, Lex, Vega). There is currently no admin interface — the team has no way to monitor signups, view subscription health, manage users, or investigate issues without writing raw DB queries. This spec defines a lean, internal-only admin portal that covers the things the team actually needs day-to-day.

**Goals:**
- See subscription and growth health at a glance
- Look up any org or user for support
- Ban/unban users
- Drill into an org's subscription and usage

**Non-goals (v1):**
- Chat history viewer (deferred)
- Content moderation
- Billing overrides beyond extending trials
- Decorative charts (charts are included only where they provide genuine insight not readable from number cards alone)

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| App framework | Next.js (same version as `apps/main`) | Consistency across monorepo; reuse shared packages |
| Styling | Tailwind CSS v4 + shadcn/ui | Already installed; zero extra setup |
| Auth | Better Auth (`admin()` plugin already enabled) | `User.role` field already exists; ban/list/impersonate built-in |
| API data | Custom admin routes in `apps/server` | All DB logic stays in one place |
| Port | 3002 (dev) | 3001 = main, 5000 = server |

---

## Project Structure

```
apps/
  admin/                        ← new Next.js app
    src/
      app/
        (auth)/
          login/page.tsx         ← admin login (Better Auth)
        (portal)/
          layout.tsx             ← checks user.role === 'admin', redirects if not
          overview/page.tsx
          organizations/
            page.tsx             ← orgs table
            [id]/page.tsx        ← org detail
          users/page.tsx
      lib/
        auth-client.ts           ← Better Auth client (admin plugin enabled)
        api.ts                   ← typed fetch wrapper pointing to apps/server
      components/
        stat-card.tsx            ← reusable number card
        status-badge.tsx         ← subscription status badge
        charts/
          signups-chart.tsx      ← bar chart: new orgs per week
          health-chart.tsx       ← stacked bar: subscription status trend
          agent-chart.tsx        ← horizontal bar: agent message counts

apps/server/src/modules/
  admin/
    admin.middleware.ts          ← checks user.role === 'admin' (no org context)
    admin.routes.ts              ← Express router mounted at /api/v1/admin
    admin.controller.ts
    admin.repository.ts          ← Prisma queries for admin data
```

---

## Authentication & Authorization

- Admin logs in via the same Better Auth endpoint used by `apps/main`
- The `(portal)/layout.tsx` calls `auth.getSession()` and checks `user.role === 'admin'`; if not admin, redirects to `/login`
- First admin: set `role = 'admin'` directly in the DB once (or via a seed script)
- Better Auth `admin()` plugin provides: `listUsers`, `banUser`, `unbanUser`, `revokeUserSessions`, `impersonateUser` — all usable directly from the admin app's auth client without custom endpoints
- Custom admin routes on `apps/server` use a new `adminMiddleware` that reads the Better Auth session and checks `user.role === 'admin'`

---

## Pages

### 1. Overview (`/overview`)

**Section A — Stat Cards (8 numbers)**

| Card | Data source |
|---|---|
| Total organizations | `COUNT(Organization)` |
| Active subscriptions | `COUNT WHERE subscriptionStatus = ACTIVE` |
| Trialing | `COUNT WHERE subscriptionStatus = TRIALING` |
| Trials expiring ≤ 7 days | `COUNT WHERE TRIALING AND entitlementExpiresAt < now + 7d` |
| Past-due | `COUNT WHERE subscriptionStatus = PAST_DUE` |
| Cancelled / Expired | `COUNT WHERE status IN [CANCELLED, EXPIRED]` |
| New orgs this week | `COUNT WHERE createdAt >= 7 days ago` |
| Total users | `COUNT(User)` |

**Section B — Three Meaningful Charts**

These three charts surface trends and patterns the number cards cannot show alone:

**1. New Org Signups (bar chart, last 12 weeks)**
- X: week label, Y: count of orgs created that week
- Answers: Is growth accelerating, flat, or declining? Immediately actionable — a dip tells you something broke in acquisition/onboarding.
- Data: `GROUP BY DATE_TRUNC('week', createdAt)` on `Organization`

**2. Subscription Health Trend (stacked bar, last 12 weeks)**
- Stacks: Active (green), Trialing (blue), Past-Due (amber), Cancelled/Expired (red)
- Answers: Are trials converting to paid over time? Is churn growing? These two questions are the heartbeat of an early SaaS — numbers alone don't show the trend.
- Data: `COUNT` grouped by `subscriptionStatus` per week (snapshotted from `Organization`)

**3. Agent Popularity Across All Orgs (horizontal bar, 6 agents)**
- X: total message count (all time or last 30 days), Y: agent name
- Answers: Which features are users actually using? Which agents are neglected? Directly actionable for product prioritization — if Scout has 5x the messages of Lex, you know where to invest.
- Data: `GROUP BY agent, COUNT(*)` on `Message`

**API endpoint:** `GET /api/v1/admin/overview` (returns stat cards + chart data in one response)

---

### 2. Organizations (`/organizations`)

**Table columns:** Name · Owner email · Status (badge) · Plan · Members · Onboarded ✓ · Created  
**Controls:** Search input (org name or owner email) · Status filter tabs: All | Active | Trialing | Past-Due | Cancelled  
**Pagination:** 25 rows per page

**API endpoint:** `GET /api/v1/admin/organizations?search=&status=&page=`

---

### 3. Org Detail (`/organizations/[id]`)

Four sections:

**Header:** Org name, slug, status badge, created date

**Subscription section:**
- Status, plan (Monthly/Annual), trial end date, period end date
- DodoPayments customer ID + subscription ID (click to copy)
- Action button: "Extend Trial" (adds 7 days to `entitlementExpiresAt`, sets `subscriptionStatus` back to TRIALING if expired)

**Members section:**
- Table: Name, email, role (owner/admin/member)

**Agent Activity section (last 30 days):**
- Table: Agent name, message count
- Rows: Maya, Rex, Scout, Sage, Lex, Vega (show 0 if no messages)
- Simple table only — the overview chart covers cross-org trends; this section is per-org context for support

**Connected Integrations section:**
- Which platforms have a linked `SocialAccount`: Twitter, LinkedIn, Instagram, Google

**API endpoint:** `GET /api/v1/admin/organizations/:id`  
**Action endpoint:** `PATCH /api/v1/admin/organizations/:id/extend-trial`

---

### 4. Users (`/users`)

**Table columns:** Name · Email · Verified ✓ · Orgs (count) · Created · Status (Active / Banned)  
**Controls:** Search input (name or email) · Filter: All | Banned  
**Pagination:** 25 rows per page  
**Row action:** Ban / Unban button (writes `User.banned`, `banReason`, `banExpires`)

**Implementation note:** Use Better Auth admin plugin's built-in `listUsers` and `banUser`/`unbanUser` — no custom server endpoints needed for this page.

---

## Backend — Admin Routes in `apps/server`

New Express router: `apps/server/src/modules/admin/admin.routes.ts`  
Mounted at: `/api/v1/admin`  
Protected by: `adminMiddleware` (checks Better Auth session `user.role === 'admin'`)

| Method | Path | Handler |
|---|---|---|
| GET | `/overview` | `getOverviewStats` |
| GET | `/organizations` | `listOrganizations` (search, status filter, pagination) |
| GET | `/organizations/:id` | `getOrganizationDetail` |
| PATCH | `/organizations/:id/extend-trial` | `extendTrial` |

User management (ban/unban/list) is handled entirely by Better Auth's admin plugin endpoints — no custom routes needed.

---

## `adminMiddleware` (new, in `apps/server`)

```typescript
// apps/server/src/modules/admin/admin.middleware.ts
// Validates Better Auth session and checks user.role === 'admin'.
// Does NOT require an activeOrganizationId — admin operates across all orgs.
```

Distinct from `authMiddleware` (which requires `activeOrganizationId`). The admin acts at system level, not org level.

---

## Verification

1. **Auth gate**: Log in with a non-admin account → should redirect to `/login`. Log in with admin account → should reach `/overview`.
2. **Overview counts**: Compare card numbers against direct DB queries (`SELECT COUNT(*) FROM "Organization" WHERE ...`).
3. **Overview charts**: Verify signups bar chart week totals match `SELECT DATE_TRUNC('week', ...) GROUP BY` counts; verify agent chart totals match `SELECT agent, COUNT(*) FROM "Message" GROUP BY agent`.
3. **Org table**: Search for a known org by name and by owner email — should filter correctly.
4. **Org detail**: Open a specific org and verify subscription dates, member list, and agent message counts match DB records.
5. **Extend trial**: Click "Extend Trial" on an expired org, confirm `entitlementExpiresAt` updates in DB.
6. **Ban user**: Ban a test user from the Users page, confirm `User.banned = true` in DB; Unban and confirm it resets.
7. **Status filter**: Switch between All / Active / Trialing / Past-Due tabs on the Orgs page and confirm correct rows appear.
