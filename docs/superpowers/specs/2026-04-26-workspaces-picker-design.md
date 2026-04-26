# Workspaces Picker & Org Switcher — Design

**Date:** 2026-04-26
**Status:** Approved (pending implementation plan)
**Scope:** Post-login workspace picker, in-dashboard org switcher dropdown, and the auth/proxy plumbing that drives both.

---

## Goal

When a user logs in, route them to a picker page (`/workspaces`) that shows all of their organizations and a "+ Create new workspace" option. Selecting an org sets it active and routes onward to `/dashboard` or `/onboarding` based on that org's `onboarded` flag. The same affordances exist inside the dashboard via a sidebar dropdown that replaces the current active-org display card.

## Non-goals

- Multi-org invitation acceptance / pending-invite UI (out of scope; existing org plugin behavior is unchanged).
- Org settings management beyond the picker/switcher itself.
- Inline workspace creation modals — creation always routes to `/onboarding/step1`.
- Persisting "last active workspace" across sessions — every login forces a fresh picker visit when the user has ≥1 orgs.

---

## High-level routing flow

The proxy middleware (`apps/main/src/proxy.ts`) is the single source of truth for "where should this user be?". It receives the session payload (enriched server-side by `customSession`) and decides the destination.

```
Authenticated user lands on a protected path
│
├─ Has activeOrganization?
│    ├─ yes & onboarded   → /dashboard (allow /workspaces; bounce away from /onboarding)
│    └─ yes & !onboarded  → /onboarding (bounce away from /dashboard)
│
└─ No activeOrganization?
     ├─ memberships ≥ 1   → /workspaces (the picker)
     └─ memberships === 0 → /onboarding/step1 (fresh signup, unchanged)
```

Unauthenticated users continue to bounce to `/login` for any protected path including `/workspaces`.

---

## Server-side changes — `apps/server/src/lib/auth.ts`

### Change 1: Remove the `session.create.before` auto-default hook

**Current code (lines 75-94):** auto-defaults `activeOrganizationId` to the user's oldest membership on every fresh session.

**Action:** delete the entire `databaseHooks` block.

**Rationale:** with the picker as the explicit choice point, there is no async race for "default to first" to lose; every fresh login starts with `activeOrganizationId = null`, the proxy sees no active org, and the user is routed to `/workspaces`. The race that hook was guarding against (the redirect-loop fix described in its comment) does not apply in the new flow because the picker — not the dashboard — is what authenticated users without an active org land on.

### Change 2: Extend `customSession` to include memberships

**Current return shape:**
```ts
{ user, session, activeOrganization }
```

**New return shape:**
```ts
{
  user,
  session,
  activeOrganization,        // unchanged — { id, name, slug, onboarded } | null
  memberships: Array<{
    id: string;              // organization id
    name: string;
    slug: string;
    onboarded: boolean;
    role: string;            // owner | admin | member (the member.role column)
  }>,
}
```

**Implementation:** inside the `customSession` callback, query `prisma.member.findMany({ where: { userId: session.userId }, include: { organization: { select: { id: true, name: true, slug: true, onboarded: true } } } })` and shape the result. Order by `member.createdAt asc` for stable card ordering.

**Why include it in the session payload:** the proxy already fetches `/api/v1/auth/get-session` on every protected page load. Co-locating memberships avoids a second round trip in middleware. The picker page and the sidebar dropdown both need this list, and reading it from `useSession()` gives a single source of truth client-side.

---

## Middleware changes — `apps/main/src/proxy.ts`

### Updated session type

```ts
type SessionResponse = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
  memberships?: Array<{ id: string }> | null;
};
```

### Updated authenticated branch

Replace the current logic (lines 48-68) with the four-state decision:

```
const onboarded = !!payload.activeOrganization?.onboarded;
const hasActive = !!payload.activeOrganization;
const hasMemberships = (payload.memberships?.length ?? 0) > 0;

isOnLogin || isOnRoot:
  hasActive && onboarded     → redirect /dashboard
  hasActive && !onboarded    → redirect /onboarding
  !hasActive && hasMemberships → redirect /workspaces
  !hasActive && !hasMemberships → redirect /onboarding   (lands on step1 via index page)

isOnWorkspaces:
  !hasMemberships            → redirect /onboarding   (no orgs yet — go create the first)
  otherwise                  → allow

isOnOnboarding:
  hasActive && onboarded     → redirect /dashboard   (existing behavior)
  otherwise                  → allow

isOnDashboard:
  !hasActive && hasMemberships → redirect /workspaces
  !hasActive && !hasMemberships → redirect /onboarding
  hasActive && !onboarded    → redirect /onboarding   (existing behavior)
  hasActive && onboarded     → allow
```

### Matcher update

Add `/workspaces` to the matcher array.

### Unauthenticated branch

Add `/workspaces` to the set of paths that bounce to `/login`.

---

## Picker page — `apps/main/src/app/(auth)/workspaces/page.tsx`

### Location

Under the `(auth)` route group, alongside `login`, `signup`, `forgot-password`, etc. The `(auth)` layout already provides the right pre-dashboard shell (no sidebar). No new route group needed.

### Layout

```
┌──────────────────────────────────────────────────┐
│   Logo                          Sign out         │
│                                                  │
│           Pick a workspace                       │
│           Signed in as user@example.com          │
│                                                  │
│   ┌────────────────────────────────────────┐     │
│   │ Acme Co.                            →  │     │
│   │ acme-co · Owner · Onboarded            │     │
│   └────────────────────────────────────────┘     │
│   ┌────────────────────────────────────────┐     │
│   │ Lumen Beverage Co.                  →  │     │
│   │ lumen-1234 · Member · Setup needed     │     │
│   └────────────────────────────────────────┘     │
│   ┌────────────────────────────────────────┐     │
│   │  +  Create new workspace               │     │
│   └────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### Per-card content

Each org card shows:
- **Workspace name** (large, primary text)
- **Subline:** `slug · Role · Status` where:
  - `Role` is one of "Owner", "Admin", "Member" (formatted from `membership.role`)
  - `Status` is "Onboarded" (green pill) or "Setup needed" (yellow pill)

### Behavior

- Reads `memberships` array from `authClient.useSession()`.
- Card click → `switchToOrganization(id, router)` (helper described below). Per-card pending state during the call; toast on error.
- "Create new workspace" card → `clearActiveAndStartNew(router)` helper.
- "Sign out" link → `authClient.signOut()` then `window.location.href = LANDING_URL`. Matches the existing pattern in `AppSidebar.tsx:295-303`.
- Empty memberships safety net: a `useEffect` that detects `memberships.length === 0` and `router.replace('/onboarding/step1')`. Only fires if the proxy mis-routes the user here.

### Visual style

Reuses the brand-card aesthetic from the existing onboarding flow (e.g., `step1`): 2px black border, 2px black box-shadow offset, brand background colors (yellow / cream). Matches the neo-brutalist look of the rest of the app.

---

## Sidebar dropdown — `apps/main/src/components/layout/AppSidebar.tsx`

### Replacement

Lines 95-144 (the static yellow active-org card) become the trigger of a `DropdownMenu` (shadcn). Visual styling is preserved — the user sees the same yellow card; the only addition is a small `ChevronDown` icon at the right edge to signal interactivity.

### Dropdown content

```
┌─────────────────────────────────┐
│ Acme Co.                  ✓     │ ← currently active (checkmark)
│ acme-co · Onboarded             │
├─────────────────────────────────┤
│ Lumen Beverage Co.              │
│ lumen-1234 · Setup needed       │
├─────────────────────────────────┤
│ +  Create new workspace         │
├─────────────────────────────────┤
│ ↗  See all workspaces           │ ← navigates to /workspaces
└─────────────────────────────────┘
```

### Behavior

- Memberships list pulled from `authClient.useSession()` (same data path as the picker).
- Inactive org clicked → `switchToOrganization(id, router)`.
- Currently-active org clicked → no-op (close dropdown).
- "Create new workspace" → `clearActiveAndStartNew(router)`.
- "See all workspaces" → `router.push('/workspaces')`.

### Collapsed sidebar state

When sidebar is in `collapsible="icon"` mode, the active-org card is currently hidden via `group-data-[collapsible=icon]:hidden`. Behavior preserved — no dropdown trigger when collapsed. Users expand the sidebar to switch.

---

## Shared helpers — `apps/main/src/lib/api/organizations.ts`

Two new functions extracted from the picker / dropdown to keep behavior identical:

### `switchToOrganization(id: string, router: AppRouterInstance): Promise<void>`

1. Calls `setActiveOrganization(id)` (existing helper).
2. On success, awaits `authClient.getSession({ query: { disableCookieCache: true } })` to invalidate the cached session before navigation. (Mirrors the pattern at `onboarding/layout.tsx:317-323`.)
3. Calls `router.replace('/dashboard')`. Proxy routes onward based on the new active org's `onboarded` flag.
4. On error, surfaces a toast.

### `clearActiveAndStartNew(router: AppRouterInstance): Promise<void>`

1. Calls `clearActiveOrganization()` — a thin wrapper around `authClient.organization.setActive({ organizationId: null })` (or whatever the supported API is in the installed better-auth version; see open question below).
2. On success, awaits a session refresh (same pattern as above).
3. Calls `router.push('/onboarding/step1')`.
4. Step1's existing "auto-redirect to step2 if active org exists" logic does not fire because we've cleared active first.

---

## File-level summary

| File | Change |
|---|---|
| `apps/server/src/lib/auth.ts` | Delete `databaseHooks.session.create.before` block (lines 75-94). Extend `customSession` to include `memberships` array. |
| `apps/main/src/proxy.ts` | Add `/workspaces` to matcher. Update `SessionResponse` type. Rewrite authenticated branch for four-state routing; update unauthenticated branch to bounce `/workspaces`. |
| `apps/main/src/app/(auth)/workspaces/page.tsx` | **NEW** — picker page. |
| `apps/main/src/components/layout/AppSidebar.tsx` | Replace active-org card (lines 95-144) with a `DropdownMenu` trigger + dropdown content. |
| `apps/main/src/lib/api/organizations.ts` | Add `switchToOrganization(id, router)`, `clearActiveAndStartNew(router)`, and `clearActiveOrganization()` helpers. |
| `apps/main/src/app/(onboarding)/onboarding/step1/page.tsx` | No changes. The "+" flow clears active first, so existing "skip if active" logic doesn't fire incorrectly. |
| `apps/main/src/lib/auth-client.ts` | No changes. The new `memberships` field flows through `useSession()` automatically. |

---

## Edge cases

1. **Stale `useActiveOrganization()` cache after switch.** Mitigated by forcing a session refresh inside `switchToOrganization` before navigating (same pattern as `onboarding/layout.tsx:317-323`).
2. **User opens `/workspaces` while having an active org.** Allowed by proxy. The current org is marked with a checkmark; user can still pick another or "Create new".
3. **User reaches `/workspaces` with 0 memberships (proxy bug or race).** Picker page detects empty memberships and `router.replace('/onboarding/step1')`. Belt-and-suspenders.
4. **User loses last membership while on dashboard.** Out of scope (existing app does not handle this).
5. **Concurrent tabs.** Better-auth uses one session row per cookie. setActive in one tab, navigate in another — second tab sees the updated active org on next session fetch. No special handling.

---

## Open questions to resolve during plan writing

1. **Better-auth `setActive` API for clearing active org.** Verify via context7 that `authClient.organization.setActive({ organizationId: null })` (or `''`) is the supported API in the installed version. If not, the `clearActiveOrganization` helper falls back to a small server route that nullifies `session.activeOrganizationId` directly via Prisma.

---

## Testing approach

### Server-side

Unit-test the `customSession` callback with three fixtures:
- User with 0 memberships → `memberships: []`
- User with 1 membership → array of one
- User with N memberships → array ordered by `member.createdAt asc`

### Middleware

Proxy is a pure function of `(pathname, payload)`. Unit-test all combinations:

| activeOrg | memberships | path | expected |
|---|---|---|---|
| null | 0 | `/` | redirect `/onboarding` |
| null | 0 | `/dashboard` | redirect `/onboarding` |
| null | 0 | `/workspaces` | redirect `/onboarding` |
| null | 2 | `/` | redirect `/workspaces` |
| null | 2 | `/dashboard` | redirect `/workspaces` |
| null | 2 | `/workspaces` | allow |
| set, !onb | 2 | `/` | redirect `/onboarding` |
| set, !onb | 2 | `/dashboard` | redirect `/onboarding` |
| set, !onb | 2 | `/workspaces` | allow |
| set, onb | 2 | `/` | redirect `/dashboard` |
| set, onb | 2 | `/onboarding` | redirect `/dashboard` |
| set, onb | 2 | `/workspaces` | allow |

### Picker page

Render with mocked `useSession()` returning various `memberships` shapes; assert:
- Correct number of cards rendered
- Active org marked (if any)
- Click triggers `switchToOrganization`
- "+" triggers `clearActiveAndStartNew`
- Empty memberships triggers redirect

### End-to-end (manual or Playwright)

1. Sign up fresh → land on `/onboarding/step1` (0-orgs path).
2. Create org → finish onboarding → reach `/dashboard`.
3. Log out, log back in → land on `/workspaces` with 1 card.
4. Click the card → `/dashboard`.
5. Open sidebar dropdown → click "Create new workspace" → `/onboarding/step1`. Create org B.
6. Log out, log back in → `/workspaces` shows 2 cards.
7. From dashboard of org A, open dropdown → switch to org B → land on `/onboarding` (org B is mid-setup) or `/dashboard` (if onboarded).
