# Workspaces Picker & Org Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/workspaces` picker page after login, an in-dashboard org switcher dropdown, and the auth/proxy plumbing that drives both.

**Architecture:** `customSession` (server) gains a `memberships` array. `proxy.ts` (middleware) gets a four-state routing decision extracted into a pure function. New `(auth)/workspaces` page lists memberships. Dashboard sidebar's static active-org card becomes a `DropdownMenu` trigger. Helpers in `organizations.ts` centralize the "switch active org" and "clear active + start new" flows for both UIs.

**Tech Stack:** Better-auth 1.5.6 (organization plugin + customSession), Next.js (custom App Router fork — see `apps/main/AGENTS.md`), Prisma, shadcn/ui (DropdownMenu), Tailwind, sonner for toasts.

**Spec:** [`docs/superpowers/specs/2026-04-26-workspaces-picker-design.md`](../specs/2026-04-26-workspaces-picker-design.md)

**Verification approach:** This codebase has no test runner configured (no vitest/jest/playwright). Each task verifies via curl, the dev server, or `pnpm tsc --noEmit`. Adding a test runner is out of scope; the plan extracts pure functions where possible so tests can be added later as a follow-up.

**Sequencing rationale:** Tasks 1–6 are additive (no behavior change for existing users — the legacy `databaseHooks.session.create.before` keeps auto-defaulting `activeOrganizationId`). Task 7 is the cutover — it removes that hook and switches `proxy.ts` to the four-state logic. Task 8 is end-to-end verification. This means each commit before Task 7 leaves the app fully working.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/server/src/lib/auth.ts` | Better-auth config, `customSession` enrichment | Modify (Tasks 1, 7) |
| `apps/main/src/proxy.ts` | Middleware routing (single source of truth) | Refactor (Task 3), extend (Task 7) |
| `apps/main/src/lib/proxy-routing.ts` | Pure routing decision function | Create (Task 3) |
| `apps/main/src/lib/api/organizations.ts` | Org client helpers | Extend (Task 4) |
| `apps/main/src/components/ui/dropdown-menu.tsx` | shadcn primitive | Install via CLI (Task 2) |
| `apps/main/src/app/(auth)/workspaces/page.tsx` | Picker page UI | Create (Task 5) |
| `apps/main/src/components/layout/AppSidebar.tsx` | Sidebar — replace active-org card with dropdown | Modify (Task 6) |

---

## Task 1: Server — extend `customSession` with memberships

**Files:**
- Modify: `apps/server/src/lib/auth.ts:97-111`

The `customSession` callback today returns `{ user, session, activeOrganization }`. We add a `memberships` array so the proxy and the picker UI both have the user's full org list from the session payload.

- [ ] **Step 1: Replace the `customSession` callback**

Open `apps/server/src/lib/auth.ts`. Replace lines 97-111 (the entire `export const auth = betterAuth({ ... })` block) with:

```ts
export const auth = betterAuth({
  ...options,
  plugins: [
    ...options.plugins,
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

      return { user, session, activeOrganization, memberships };
    }, options),
  ],
});
```

- [ ] **Step 2: Type-check the server**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify via curl**

Start the server: `cd apps/server && pnpm dev` (run in another terminal).

In a browser, log in normally so you have a valid session cookie. Then run:

```bash
curl -sS -b "$(grep -E 'better-auth.session_token|better-auth.session-token' /tmp/cookies.txt 2>/dev/null || echo '')" \
  http://localhost:5000/api/v1/auth/get-session
```

Or, simpler: open the app in the browser, open DevTools → Network → reload → find the `/get-session` request → inspect the response body.

Expected: response includes a `memberships` array with the user's orgs, each with `{id, name, slug, onboarded, role}`.

If the user has 0 orgs: `memberships: []`. If 1 org: array of one. If multiple: ordered by `createdAt asc`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/auth.ts
git commit -m "$(cat <<'EOF'
feat(auth): include user memberships in customSession payload

Adds a memberships array to the session response so middleware and
client UIs (workspaces picker, sidebar switcher) can read the user's
full org list from a single session fetch instead of a separate API
call.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend — install shadcn `dropdown-menu` component

**Files:**
- Create: `apps/main/src/components/ui/dropdown-menu.tsx` (generated by shadcn CLI)

The sidebar org switcher uses shadcn's `DropdownMenu`. The component isn't installed yet (the codebase has `popover.tsx` and `select.tsx` but not `dropdown-menu.tsx`).

- [ ] **Step 1: Install via shadcn CLI**

Run from the repo root:

```bash
cd apps/main && pnpm dlx shadcn@latest add dropdown-menu
```

If prompted to overwrite `components.json` or any existing files, decline (`n`). The CLI should generate one new file: `apps/main/src/components/ui/dropdown-menu.tsx`.

- [ ] **Step 2: Verify the file exists and exports the expected components**

Run:

```bash
ls apps/main/src/components/ui/dropdown-menu.tsx
grep -E "export (const|function|\{) (DropdownMenu|DropdownMenuTrigger|DropdownMenuContent|DropdownMenuItem|DropdownMenuSeparator|DropdownMenuLabel)" apps/main/src/components/ui/dropdown-menu.tsx
```

Expected: file exists; grep finds at least `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`.

- [ ] **Step 3: Type-check**

Run: `cd apps/main && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/ui/dropdown-menu.tsx apps/main/package.json apps/main/components.json 2>/dev/null
git status
git commit -m "$(cat <<'EOF'
chore(ui): add shadcn dropdown-menu primitive

Adds the DropdownMenu primitive used by the upcoming sidebar
workspace switcher. Generated via the shadcn CLI; no other files
modified beyond what the CLI produces.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> If `pnpm-lock.yaml` was updated, also stage it. If only `dropdown-menu.tsx` was created and nothing else changed, the `git status` step is your truth — commit only what's new.

---

## Task 3: Frontend — extract proxy routing into a pure function

**Files:**
- Create: `apps/main/src/lib/proxy-routing.ts`
- Modify: `apps/main/src/proxy.ts:1-82` (whole file)

We extract the routing decision into a pure function so it's testable in isolation later, and so the Task 7 four-state rewrite changes one focused file. **This task preserves existing behavior** — no functional change.

- [ ] **Step 1: Create `apps/main/src/lib/proxy-routing.ts`**

Write a new file at `apps/main/src/lib/proxy-routing.ts`:

```ts
export type SessionPayload = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
};

export type RouteContext = {
  pathname: string;
};

/**
 * Pure routing decision for the proxy middleware. Returns the path to
 * redirect to, or null to allow the request through.
 *
 * This function preserves the legacy three-state behavior (no
 * activeOrg → /onboarding for protected paths). The four-state version
 * with /workspaces lands in Task 7.
 */
export function routeForUser(
  payload: SessionPayload | null,
  ctx: RouteContext,
): string | null {
  const { pathname } = ctx;
  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnOnboarding = pathname.startsWith("/onboarding");
  const isOnDashboard = pathname.startsWith("/dashboard");

  // Unauthenticated branch
  if (!payload?.user) {
    if (isOnLogin) return null;
    if (isOnOnboarding || isOnDashboard || isOnRoot) return "/login";
    return null;
  }

  const onboarded = !!payload.activeOrganization?.onboarded;

  if (isOnLogin || isOnRoot) {
    return onboarded ? "/dashboard" : "/onboarding";
  }

  if (onboarded && isOnOnboarding) {
    return "/dashboard";
  }

  if (!onboarded && isOnDashboard) {
    return "/onboarding";
  }

  return null;
}
```

- [ ] **Step 2: Rewrite `apps/main/src/proxy.ts` to use the pure function**

Replace the entire contents of `apps/main/src/proxy.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { routeForUser, type SessionPayload } from "@/lib/proxy-routing";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL!;
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";

// Single source of truth for "where should this user be?". The client guards
// (OnboardingGuard, onboarding layout effects) used to race each other and
// produce an infinite /onboarding ↔ /dashboard bounce when react-query cached
// a stale onboarded=false right after finalize. By making this middleware
// authoritative — and trusting the session payload, which `customSession`
// always returns fresh — we kill the race at the source.
export async function proxy(request: NextRequest) {
  const cookie = request.headers.get("cookie") ?? "";

  let payload: SessionPayload | null = null;
  try {
    const res = await fetch(
      `${BETTER_AUTH_URL}/api/${API_VERSION}/auth/get-session`,
      { headers: { cookie }, cache: "no-store" },
    );
    if (res.ok) payload = (await res.json()) as SessionPayload;
  } catch {
    // Treat network failure as unauthenticated.
  }

  const destination = routeForUser(payload, { pathname: request.nextUrl.pathname });
  if (destination) {
    return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Cover root, login, and the protected app surfaces. Excluding API routes
  // and Next internals is implicit because we list explicit paths.
  matcher: [
    "/",
    "/login",
    "/onboarding",
    "/onboarding/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
```

- [ ] **Step 3: Type-check**

Run: `cd apps/main && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke-test in browser**

Restart the dev server (`pnpm dev` in `apps/main`). Verify:

- Visit `/` while signed out → redirects to `/login`. ✓
- Visit `/dashboard` while signed out → redirects to `/login`. ✓
- Sign in → land on `/dashboard` (if onboarded) or `/onboarding` (if not). ✓
- Visit `/onboarding/step3` while onboarded → redirects to `/dashboard`. ✓

(Behavior must match the pre-refactor app exactly. If anything is different, the extraction has a bug.)

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/lib/proxy-routing.ts apps/main/src/proxy.ts
git commit -m "$(cat <<'EOF'
refactor(proxy): extract routing decision into pure function

routeForUser(payload, ctx) returns a destination path or null. The
proxy middleware becomes a thin wrapper that fetches the session and
calls the pure function. Behavior is unchanged; this prepares the
ground for the four-state /workspaces routing in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — add organization helpers

**Files:**
- Modify: `apps/main/src/lib/api/organizations.ts:1-69`

Add three helpers used by the picker page and the sidebar dropdown: clear-active, switch-to, and clear-and-start-new. Centralizing them keeps both UIs in sync.

- [ ] **Step 1: Append helpers to `apps/main/src/lib/api/organizations.ts`**

Open `apps/main/src/lib/api/organizations.ts`. Add these imports at the top (under the existing `import { authClient }` line):

```ts
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { toast } from 'sonner';
```

Then append the following three functions at the end of the file (after the existing `setActiveOrganization` function, line 68):

```ts
/**
 * Clears the session's active organization. After this, useSession()
 * and the proxy middleware see no active org until the user picks one.
 *
 * Better-auth 1.5.6 supports null via setActive's body schema (see
 * node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:340-373).
 */
export async function clearActiveOrganization(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authClient.organization.setActive({ organizationId: null });
    const err = (res as { error?: { message?: string } | null }).error;
    if (err) return { ok: false, message: err.message ?? 'Could not clear active workspace.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not clear active workspace.' };
  }
}

/**
 * Sets `organizationId` as the active org, refreshes the session
 * cache so useActiveOrganization() picks up the change, and
 * navigates to /dashboard. The proxy decides the final destination
 * based on the new org's onboarded flag.
 */
export async function switchToOrganization(
  organizationId: string,
  router: AppRouterInstance,
): Promise<void> {
  const result = await setActiveOrganization(organizationId);
  if (!result.ok) {
    toast.error(result.message ?? 'Could not switch workspace.');
    return;
  }
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    // Proxy will gate the next page anyway.
  }
  router.replace('/dashboard');
}

/**
 * Clears the active org, refreshes the session cache, and navigates
 * to /onboarding/step1 so the user can create a new workspace. Step1
 * sees no active org and renders its create form.
 */
export async function clearActiveAndStartNew(router: AppRouterInstance): Promise<void> {
  const result = await clearActiveOrganization();
  if (!result.ok) {
    toast.error(result.message ?? 'Could not start new workspace.');
    return;
  }
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    // Proxy will gate the next page anyway.
  }
  router.push('/onboarding/step1');
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/main && pnpm tsc --noEmit`
Expected: no errors.

If the import path for `AppRouterInstance` errors, an alternative is to type the parameter inline:

```ts
type Router = { push: (href: string) => void; replace: (href: string) => void };
```

and use `Router` instead of `AppRouterInstance`. Use this fallback only if the original import fails.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/lib/api/organizations.ts
git commit -m "$(cat <<'EOF'
feat(organizations): add switch / clear-active / start-new helpers

Three new helpers used by the upcoming workspaces picker and sidebar
switcher:
- clearActiveOrganization: nullify session.activeOrganizationId
- switchToOrganization: setActive + session refresh + nav to /dashboard
- clearActiveAndStartNew: clear active + session refresh + nav to step1

Centralizes the post-action plumbing (toast on error, session
invalidation) so both UIs stay in sync.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — create the `/workspaces` picker page

**Files:**
- Create: `apps/main/src/app/(auth)/workspaces/page.tsx`

The picker reads `memberships` from the session, renders a card per org plus a "+ Create new workspace" card, and wires clicks to the helpers from Task 4.

- [ ] **Step 1: Write the picker page**

Create `apps/main/src/app/(auth)/workspaces/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LogOut, Plus, Check, Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import {
  switchToOrganization,
  clearActiveAndStartNew,
} from "@/lib/api/organizations"
import Logo from "@/components/logo"
import { FONT } from "@/lib/fonts"

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3000"

type Membership = {
  id: string
  name: string
  slug: string
  onboarded: boolean
  role: string
}

type SessionWithMemberships = {
  user?: { name?: string | null; email?: string | null } | null
  activeOrganization?: { id: string } | null
  memberships?: Membership[] | null
}

function formatRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
}

export default function WorkspacesPickerPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const typedSession = session as SessionWithMemberships | null
  const memberships = typedSession?.memberships ?? []
  const activeOrgId = typedSession?.activeOrganization?.id ?? null
  const userEmail = typedSession?.user?.email ?? ""

  // Empty state safety net: if proxy mis-routed (e.g. race during invalidation),
  // send the user to onboarding step1 to create their first workspace.
  useEffect(() => {
    if (isPending) return
    if (!typedSession?.user) return
    if (memberships.length === 0) {
      router.replace("/onboarding/step1")
    }
  }, [isPending, typedSession?.user, memberships.length, router])

  const onPick = async (id: string) => {
    if (pendingId) return
    setPendingId(id)
    await switchToOrganization(id, router)
    setPendingId(null)
  }

  const onCreate = async () => {
    if (pendingId) return
    setPendingId("__new__")
    await clearActiveAndStartNew(router)
    setPendingId(null)
  }

  const onSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = LANDING_URL
        },
      },
    })
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-foreground" />
      </div>
    )
  }

  return (
    <div
      style={{ background: "#EFE7D6", minHeight: "100vh" }}
      className="px-6 py-10"
    >
      <div className="mx-auto max-w-2xl">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-foreground">
            <Logo className="w-10 h-10" />
            <span className="font-head text-xl tracking-tight">veqiro</span>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </header>

        <div className="mb-7">
          <h1
            style={{
              fontFamily: FONT.head,
              fontSize: 32,
              letterSpacing: -0.5,
              color: "#111",
            }}
          >
            Pick a workspace
          </h1>
          {userEmail && (
            <p
              style={{
                fontFamily: FONT.mono,
                fontSize: 12,
                color: "#555",
                marginTop: 4,
              }}
            >
              Signed in as {userEmail}
            </p>
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {memberships.map((m) => {
            const isActive = m.id === activeOrgId
            const isPicking = pendingId === m.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m.id)}
                  disabled={!!pendingId}
                  className="w-full text-left disabled:opacity-60"
                  style={{
                    padding: "16px 18px",
                    background: "#FFF9ED",
                    border: "2px solid #111",
                    borderRadius: 12,
                    boxShadow: "3px 3px 0 #111",
                    cursor: pendingId ? "wait" : "pointer",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            fontFamily: FONT.head,
                            fontSize: 18,
                            color: "#111",
                            letterSpacing: -0.3,
                          }}
                        >
                          {m.name}
                        </span>
                        {isActive && (
                          <Check
                            className="size-4 text-foreground/70"
                            aria-label="Currently active"
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 11,
                          color: "#555",
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{m.slug}</span>
                        <span>·</span>
                        <span>{formatRole(m.role)}</span>
                        <span>·</span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1.5px solid #111",
                            background: m.onboarded ? "#1DBC87" : "#F5C518",
                            color: "#111",
                            fontSize: 9,
                            letterSpacing: 1.2,
                            textTransform: "uppercase",
                          }}
                        >
                          {m.onboarded ? "Onboarded" : "Setup needed"}
                        </span>
                      </div>
                    </div>
                    {isPicking ? (
                      <Loader2 className="size-4 animate-spin text-foreground" />
                    ) : (
                      <span
                        style={{ fontFamily: FONT.mono, color: "#111" }}
                        aria-hidden
                      >
                        →
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}

          <li>
            <button
              type="button"
              onClick={onCreate}
              disabled={!!pendingId}
              className="w-full disabled:opacity-60"
              style={{
                padding: "16px 18px",
                background: "transparent",
                border: "2px dashed #111",
                borderRadius: 12,
                cursor: pendingId ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#111",
              }}
            >
              {pendingId === "__new__" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Create new workspace
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/main && pnpm tsc --noEmit`
Expected: no errors.

If `@/lib/fonts` import errors (FONT helper), inspect `apps/main/src/lib/fonts.ts`. The codebase uses this helper widely (`AppSidebar.tsx:37`, `onboarding/layout.tsx:21`), so it should resolve.

- [ ] **Step 3: Smoke-test in the browser**

Run `pnpm dev` in `apps/main`. Sign in with an account that has at least one org. Navigate manually to `http://localhost:3001/workspaces` (the proxy isn't yet routing there automatically — Task 7 does that).

Expected:
- Page renders with logo header, "Sign out" link, "Pick a workspace" heading, "Signed in as <email>" subline.
- One card per org with name, slug, role, status pill (green "Onboarded" or yellow "Setup needed").
- A dashed "+ Create new workspace" card at the bottom.
- Clicking an org card → navigates to `/dashboard` (or `/onboarding` if not onboarded).
- Clicking "+ Create new workspace" → clears active and lands on `/onboarding/step1`.

If the user has 0 orgs and lands here, the page should auto-redirect to `/onboarding/step1` (the safety-net useEffect).

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/app/\(auth\)/workspaces/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): add /workspaces picker page

Authenticated users with multiple orgs land here to pick one. Also
exposes a "+ Create new workspace" card that clears active and drops
the user into /onboarding/step1.

Reads memberships from useSession(). Empty-memberships safety net
redirects to step1 if reached unexpectedly. Routing through the
proxy is wired in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Frontend — replace AppSidebar active-org card with dropdown

**Files:**
- Modify: `apps/main/src/components/layout/AppSidebar.tsx:95-144`

The static yellow card becomes the trigger of a `DropdownMenu`. Same visual style; clicking opens a list of all orgs plus "+ Create new workspace" and "See all workspaces".

- [ ] **Step 1: Update imports in `AppSidebar.tsx`**

Open `apps/main/src/components/layout/AppSidebar.tsx`. Update the imports block at the top to add `useRouter`, three new lucide icons, the `DropdownMenu*` primitives, and the org helpers:

Replace lines 1-38 (existing imports) with:

```tsx
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  FileText,
  Newspaper,
  Users2,
  ChevronDown,
  LogOut,
  Plus,
  Check,
  ArrowUpRight,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Logo from "@/components/logo"
import { FONT } from "@/lib/fonts"
import { authClient } from "@/lib/auth-client"
import {
  switchToOrganization,
  clearActiveAndStartNew,
} from "@/lib/api/organizations"
```

- [ ] **Step 2: Add a typed-session helper near the existing constants**

In the same file, just below the `monoLabelStyle` const (around line 56-61), add:

```tsx
type Membership = {
  id: string
  name: string
  slug: string
  onboarded: boolean
  role: string
}

type SessionWithMemberships = {
  memberships?: Membership[] | null
}
```

- [ ] **Step 3: Update the `AppSidebar` component to use `useRouter` and read memberships**

Inside `AppSidebar()`, find the existing `const { data: session } = authClient.useSession()` line (it sits between the `usePathname()` line and the `useActiveOrganization()` line — line numbers may have shifted after Step 1's import expansion). Replace just that one line with:

```tsx
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const memberships =
    (session as SessionWithMemberships | null | undefined)?.memberships ?? []
```

- [ ] **Step 4: Replace the static active-org card with a dropdown**

Find the block in the `<SidebarHeader>` that starts with `{activeOrg && (` and ends at the matching `)}` just before the next `<SidebarSeparator />`. (Originally lines 95-144 in `AppSidebar.tsx`; line numbers will have shifted after Step 1.) Replace the entire `{activeOrg && ( ... )}` block with:

```tsx
        {activeOrg && (
          <div className="group-data-[collapsible=icon]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left transition-transform active:translate-y-px"
                  style={{
                    padding: "6px 10px",
                    background: "#FFF9ED",
                    border: "2px solid #111",
                    borderRadius: 8,
                    boxShadow: "2px 2px 0 #111",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#1DBC87",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      color: "#111",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {activeOrg.name}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      border: "1.5px solid #111",
                      borderRadius: 999,
                      background: "#F5C518",
                      color: "#111",
                    }}
                  >
                    Free
                  </span>
                  <ChevronDown className="size-3 text-foreground/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {memberships.map((m) => {
                  const isCurrent = m.id === activeOrg.id
                  return (
                    <DropdownMenuItem
                      key={m.id}
                      disabled={isCurrent}
                      onSelect={() => {
                        if (isCurrent) return
                        void switchToOrganization(m.id, router)
                      }}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          style={{
                            fontFamily: FONT.head,
                            fontSize: 13,
                            color: "#111",
                          }}
                        >
                          {m.name}
                        </span>
                        {isCurrent && (
                          <Check className="size-3.5 text-foreground/70" />
                        )}
                      </div>
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          color: "#555",
                        }}
                      >
                        {m.slug} · {m.onboarded ? "Onboarded" : "Setup needed"}
                      </span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void clearActiveAndStartNew(router)}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    Create new workspace
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push("/workspaces")}
                  className="gap-2"
                >
                  <ArrowUpRight className="size-4" />
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    See all workspaces
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
```

The wrapping `<div className="group-data-[collapsible=icon]:hidden">` preserves the existing behavior of hiding the active-org area when the sidebar is collapsed to icons.

- [ ] **Step 5: Type-check**

Run: `cd apps/main && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Smoke-test in the browser**

Run `pnpm dev`. Sign in (with an onboarded org) → land on `/dashboard`.

Expected:
- Sidebar header shows the same yellow card as before, now with a small chevron at its right edge.
- Click the card → dropdown opens with all your orgs listed (current org has a checkmark and is non-clickable).
- Click another org → setActive runs, page navigates to `/dashboard` (which may proxy-redirect to `/onboarding` if that org isn't onboarded).
- Click "+ Create new workspace" → lands on `/onboarding/step1`.
- Click "See all workspaces" → lands on `/workspaces`.

Run with **only one org** in the account: dropdown still opens and shows that one org (disabled, with checkmark) plus the create / see-all items.

- [ ] **Step 7: Commit**

```bash
git add apps/main/src/components/layout/AppSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): replace static active-org card with dropdown switcher

The yellow active-org card now opens a DropdownMenu listing all the
user's orgs (current marked with a check), plus "Create new workspace"
and "See all workspaces" entries that route to step1 and the picker.

Switching calls switchToOrganization helper which sets active,
refreshes the session, and navigates to /dashboard so the proxy
handles the onboarded-vs-not routing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Cutover — four-state proxy routing + remove server hook

**Files:**
- Modify: `apps/main/src/lib/proxy-routing.ts`
- Modify: `apps/main/src/proxy.ts:30-42` (matcher and SessionPayload type) — though only the matcher in this file
- Modify: `apps/server/src/lib/auth.ts:75-94` (remove databaseHooks block)

This is the cutover. After this commit, fresh logins land on `/workspaces` (when the user has ≥1 orgs) instead of bouncing through the auto-defaulted active org.

- [ ] **Step 1: Update `routeForUser` to four-state logic**

Replace the entire contents of `apps/main/src/lib/proxy-routing.ts` with:

```ts
export type SessionPayload = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
  memberships?: Array<{ id: string }> | null;
};

export type RouteContext = {
  pathname: string;
};

/**
 * Pure routing decision for the proxy middleware. Returns the path to
 * redirect to, or null to allow the request through.
 *
 * Four-state authenticated routing:
 *   active && onboarded     → /dashboard (allow), bounce away from /onboarding
 *   active && !onboarded    → /onboarding (allow), bounce away from /dashboard
 *   no active, has orgs     → /workspaces (picker)
 *   no active, no orgs      → /onboarding (lands on step1 via the index page)
 */
export function routeForUser(
  payload: SessionPayload | null,
  ctx: RouteContext,
): string | null {
  const { pathname } = ctx;
  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnOnboarding = pathname.startsWith("/onboarding");
  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnWorkspaces = pathname === "/workspaces";

  // Unauthenticated branch
  if (!payload?.user) {
    if (isOnLogin) return null;
    if (isOnOnboarding || isOnDashboard || isOnRoot || isOnWorkspaces) return "/login";
    return null;
  }

  const hasActive = !!payload.activeOrganization;
  const onboarded = !!payload.activeOrganization?.onboarded;
  const hasMemberships = (payload.memberships?.length ?? 0) > 0;

  // /, /login → always pick the right home
  if (isOnLogin || isOnRoot) {
    if (hasActive && onboarded) return "/dashboard";
    if (hasActive && !onboarded) return "/onboarding";
    if (!hasActive && hasMemberships) return "/workspaces";
    return "/onboarding"; // 0 memberships → fresh signup, lands on step1
  }

  if (isOnWorkspaces) {
    if (!hasMemberships) return "/onboarding";
    return null;
  }

  if (isOnOnboarding) {
    if (hasActive && onboarded) return "/dashboard";
    return null;
  }

  if (isOnDashboard) {
    if (!hasActive && hasMemberships) return "/workspaces";
    if (!hasActive && !hasMemberships) return "/onboarding";
    if (!onboarded) return "/onboarding";
    return null;
  }

  return null;
}
```

- [ ] **Step 2: Add `/workspaces` to the proxy matcher**

In `apps/main/src/proxy.ts`, update the `config.matcher` array (around lines 73-82) to include `/workspaces`. The full block becomes:

```ts
export const config = {
  matcher: [
    "/",
    "/login",
    "/onboarding",
    "/onboarding/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/workspaces",
  ],
};
```

- [ ] **Step 3: Remove the auto-default `databaseHooks` block from server auth**

Open `apps/server/src/lib/auth.ts`. Delete lines 70-94 entirely (the comment from line 70 plus the entire `databaseHooks: { ... }` block). The `options` const should now end with `plugins: [ ... ]` followed directly by the closing `} satisfies BetterAuthOptions;` on the next line.

After the edit, the relevant section of `auth.ts` reads:

```ts
  plugins: [
    admin(),
    organization({
      schema: {
        organization: {
          additionalFields: {
            onboarded: {
              type: "boolean",
              input: false,
              defaultValue: false,
            },
          },
        },
      },
    }),
  ],
} satisfies BetterAuthOptions;
```

(The `customSession` enrichment from Task 1 stays — it's in the separate `auth = betterAuth(...)` block below.)

- [ ] **Step 4: Type-check both apps**

Run in parallel:
```bash
cd apps/server && pnpm tsc --noEmit
cd apps/main && pnpm tsc --noEmit
```
Expected: no errors in either.

- [ ] **Step 5: Restart both dev servers**

Stop and restart both `pnpm dev` processes (server + main). The server change requires a full restart because it's compiled.

- [ ] **Step 6: Smoke-test the new routing**

In a new private/incognito window:

1. Visit `/dashboard` while signed out → redirects to `/login`. ✓
2. Sign in with an account that has ≥1 orgs → lands on `/workspaces`. ✓ (was `/dashboard` before)
3. From `/workspaces`, click an onboarded org → lands on `/dashboard`. ✓
4. Sign out and sign back in → again lands on `/workspaces` (fresh login, no auto-default). ✓
5. From `/workspaces`, click "+ Create new workspace" → lands on `/onboarding/step1`.
6. With the existing test account that has 0 orgs (or create a fresh signup): sign up → verify email → lands on `/onboarding/step1` directly (skips `/workspaces` because `memberships.length === 0`). ✓

- [ ] **Step 7: Commit**

```bash
git add apps/main/src/lib/proxy-routing.ts apps/main/src/proxy.ts apps/server/src/lib/auth.ts
git commit -m "$(cat <<'EOF'
feat(auth): cutover to /workspaces picker for multi-org users

Changes the post-login flow:
- Server: removes the session.create.before hook that auto-defaulted
  activeOrganizationId to the user's oldest org. Fresh sessions now
  start with activeOrganizationId=null.
- Middleware: routeForUser() gains a fourth state — authenticated
  with no active org but ≥1 memberships → /workspaces. Adds the
  picker route to the matcher.

Users with 0 orgs (fresh signups) continue to land on /onboarding
/step1 unchanged. Users with ≥1 orgs land on the picker on every
fresh login.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: End-to-end verification

**Files:** none (verification only)

Walk through the full flow on a clean dev environment, ticking each scenario.

- [ ] **Step 1: Start fresh dev servers**

```bash
cd apps/server && pnpm dev   # terminal 1
cd apps/main && pnpm dev     # terminal 2
```

- [ ] **Step 2: Run the full scenario matrix**

Open an incognito window for each scenario to keep cookies isolated.

**Scenario A — Brand-new signup (0 orgs):**
1. Go to `/signup`. Create an account with a fresh email.
2. Verify email (check the dev mail output).
3. Auto sign-in lands on… **expect: `/onboarding/step1`**.
4. Create an org. Walk through onboarding. Land on `/dashboard`.

**Scenario B — Existing user, single onboarded org:**
1. Open a private window. Sign in with the account from Scenario A.
2. Expect: `/workspaces` (one card, marked with checkmark? — no, on a fresh login activeOrgId is null so no checkmark).
3. Click the org card.
4. Expect: navigation to `/dashboard`. Sidebar shows the org name in the dropdown trigger.

**Scenario C — Switch via sidebar:**
1. From `/dashboard`, open the sidebar dropdown.
2. Click "+ Create new workspace".
3. Expect: navigation to `/onboarding/step1`. Create a second org, finish onboarding.
4. Land on `/dashboard` (now with org B as the active org per onboarding's setActive on create).
5. Open the sidebar dropdown. Expect: both orgs listed; org B has the checkmark; org A is clickable.
6. Click org A. Expect: navigation to `/dashboard` (org A is onboarded). Dropdown trigger now shows org A's name.

**Scenario D — Picker after multi-org login:**
1. Sign out (sidebar footer logout button).
2. Sign back in.
3. Expect: `/workspaces` showing both org cards. Neither has a checkmark (activeOrgId is null on fresh login).
4. Pick org B → land on `/dashboard` for org B.

**Scenario E — Sidebar "See all workspaces":**
1. From any dashboard page, open dropdown → "See all workspaces".
2. Expect: navigation to `/workspaces`. Currently active org has the checkmark.

**Scenario F — Onboarded gating still works:**
1. Create org C via "+ Create new workspace" but quit halfway through onboarding (close the tab).
2. Sign out, sign back in.
3. Expect: `/workspaces` showing all orgs. Pick org C (status pill: "Setup needed").
4. Expect: navigation to `/onboarding/<first incomplete step>`.

- [ ] **Step 3: Type-check both apps once more**

```bash
cd apps/server && pnpm tsc --noEmit
cd apps/main && pnpm tsc --noEmit
```

- [ ] **Step 4: Build both apps**

```bash
cd apps/server && pnpm build
cd apps/main && pnpm build
```

Expected: both builds complete without errors. (Catches any runtime-only issues that `tsc --noEmit` misses, like missing exports.)

- [ ] **Step 5: No commit needed if all scenarios passed**

If a scenario fails, fix the issue inline and commit the fix as a follow-up. Do not amend prior task commits.

---

## Open follow-ups (out of scope for this plan)

These are deliberately not in the plan but worth tracking:

1. **Add a test runner.** Vitest + happy-dom would make `routeForUser` and the picker page directly testable. Worth a separate plan.
2. **Persist last-active workspace.** Right now every fresh login forces a picker visit. If users complain, add a `lastActiveOrganizationId` column on `User` and have a session hook default to it (a softer version of the hook we just removed).
3. **Org settings page** — managing members, leaving an org. The org plugin supports both; we just don't have UI yet.
4. **Pending-invitations UI on the picker.** Show invitations alongside memberships so users can accept and switch in one place.
