# 🚀 Veqiro Main App — Performance Fix Plan

> **Problem**: Every page in `apps/main` loads painfully slowly. Even pages with zero dynamic data show a blank screen / spinner for seconds before any HTML content renders. This happens on dashboard, chat/assistants, brain, onboarding, and settings.

---

## Table of Contents

1. [Root Cause Analysis](#1-root-cause-analysis)
2. [Issue Breakdown — The Waterfall of Doom](#2-issue-breakdown--the-waterfall-of-doom)
3. [Fix Plan — Prioritized](#3-fix-plan--prioritized)
4. [Advanced Optimizations](#4-advanced-optimizations)
5. [Implementation Order](#5-implementation-order)

---

## 1. Root Cause Analysis

After analyzing every file in the app — layouts, guards, pages, API layer, components — **the core problem is clear**:

> **Every single page is 100% client-rendered, blocked behind a sequential waterfall of async auth checks that must complete before ANY HTML is shown to the user.**

Here's what happens on every page load:

```
User navigates to /dashboard
    │
    ▼
[1] Root Layout renders (server) — just a shell with providers
    │
    ▼
[2] QueryProvider mounts (client) — creates query client
    │
    ▼
[3] Dashboard Layout renders — hits SessionGuard
    │
    ▼
[4] SessionGuard: calls authClient.useSession()
    ├── isPending = true → shows SPINNER (blank screen)
    ├── waits for HTTP request to backend /auth/get-session
    └── session arrives → renders children
        │
        ▼
[5] OnboardingGuard: calls BOTH useActiveOrganization() AND useSession() AGAIN
    ├── isPending = true → shows SPINNER (blank screen again!)
    ├── waits for ANOTHER HTTP request
    └── both resolve → renders children
        │
        ▼
[6] DashboardSidebarShell: renders sidebar
    │
    ▼
[7] AppSidebar: calls useSession() AGAIN + useActiveOrganization() AGAIN
    │
    ▼
[8] Dashboard Page: calls useSession() AGAIN + useDashboardSummary()
    ├── isPending = true → shows skeleton
    └── data arrives → finally renders content
```

**That's 3-4 sequential network requests before the user sees ANYTHING.** Each one blocks the next. The user stares at a spinner for the entire duration.

---

## 2. Issue Breakdown — The Waterfall of Doom

### 🔴 Issue #1: Serial Blocking Guards (CRITICAL — Main Cause)

**Files**: `SessionGuard.tsx`, `OnboardingGuard.tsx`

Both guards render a **full-screen spinner** while their auth data loads. They are **nested sequentially** in the dashboard layout:

```tsx
// (dashboard)/layout.tsx
<SessionGuard>          // ← blocks everything until session loads
  <OnboardingGuard>     // ← blocks everything AGAIN until org loads  
    <DashboardSidebarShell>
      {children}        // ← page content only renders after BOTH complete
    </DashboardSidebarShell>
  </OnboardingGuard>
</SessionGuard>
```

**Impact**: 400-1500ms of blank screen BEFORE any page content renders. On slow connections, 2-5 seconds.

**Why this is wrong**: The proxy middleware (`proxy.ts`) already validates auth server-side before the page even loads. These client guards are redundant — they re-verify what the server already confirmed.

---

### 🔴 Issue #2: Redundant `useSession()` / `useActiveOrganization()` Calls (CRITICAL)

**Every component independently calls these hooks**:

| Component | `useSession()` | `useActiveOrganization()` |
|---|---|---|
| SessionGuard | ✅ | ❌ |
| OnboardingGuard | ✅ | ✅ |
| AppSidebar | ✅ | ✅ |
| Dashboard page | ✅ | ❌ |
| Brain page | ❌ | ✅ |
| Chat page | ❌ | ✅ |
| ChatList | ❌ | ✅ |
| Settings page | ✅ | ❌ |
| Onboarding layout | ✅ | ✅ |

That's **5+ calls to `useSession()`** and **5+ calls to `useActiveOrganization()`** on a single page render. While React Query deduplicates in-flight requests, the **guards block rendering until they complete**, creating a serial chain.

---

### 🔴 Issue #3: Every Page is `"use client"` — Zero Server Rendering (CRITICAL)

**Every single page** has `"use client"` at the top:

- `dashboard/page.tsx` → `"use client"`
- `assistants/[id]/page.tsx` → `"use client"`  
- `brain/page.tsx` → `"use client"`
- `onboarding/layout.tsx` → `"use client"`
- `settings/page.tsx` → `"use client"`

This means **Next.js cannot server-render ANY HTML**. The browser receives an empty shell, downloads the JS bundle, hydrates, THEN starts rendering. This completely defeats the purpose of using Next.js.

**What should happen**: Static HTML shell should be server-rendered instantly. Client JS enhances it after hydration.

---

### 🟡 Issue #4: No `loading.tsx` Files — No Instant Feedback (HIGH)

Next.js App Router supports `loading.tsx` files that show **instant loading UI** while the page chunk loads. There are **ZERO `loading.tsx` files** in the entire app.

```
src/app/(dashboard)/dashboard/loading.tsx    ← MISSING
src/app/(dashboard)/assistants/loading.tsx   ← MISSING  
src/app/(dashboard)/brain/loading.tsx        ← MISSING
src/app/(onboarding)/loading.tsx             ← MISSING
```

Without these, route transitions show nothing until the full page JS bundle downloads and executes.

---

### 🟡 Issue #5: Chat Page is a 900-Line Monolith (HIGH)

**File**: `assistants/[id]/page.tsx` — **901 lines, 28KB**

This single file contains:
- `ChatHeader` component
- `EmptyState` component  
- All tab logic for 6 different agents (lex, scout, sage, rex, maya, vega)
- All action handling
- All message rendering
- All state management (13+ `useState` calls)

**Every time you switch between agent chats**, this entire 28KB file re-executes from scratch. The component unmounts completely and remounts because the `[id]` param changes — resetting all state, re-fetching all data, and re-rendering everything.

---

### 🟡 Issue #6: No Code Splitting — Giant Client Bundle (HIGH)

There is **zero use of `next/dynamic`** or `React.lazy()` in the entire app. Every import is static:

```tsx
// assistants/[id]/page.tsx imports ALL agent-specific tabs eagerly
import { LexDocumentsTab } from "@/components/agents/lex/documents-tab"
import { ScoutWatchlistTab } from "@/components/agents/scout/watchlist-tab"
import { SageSavedKeywordsTab } from "@/components/agents/sage/saved-keywords-tab"
import { RexDataTab } from "@/components/agents/rex/data-tab"
import { MayaPublishedPostsTab } from "@/components/agents/maya/published-posts-tab"
```

If the user opens Maya's chat, they still download code for Lex, Scout, Sage, Rex, and Vega tabs. Same for `RunActionDialog` (14KB), `ActionResultRenderer` (5KB), etc.

---

### 🟡 Issue #7: 7 Google Fonts Loaded Simultaneously (MEDIUM)

**File**: `layout.tsx`

```tsx
const loraHeading = Lora({ subsets: ['latin'], variable: '--font-heading' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bagelFatOne = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--font-bagel" });
const archivoBl = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
```

7 fonts = 7 font files to download. While `next/font` optimizes this somewhat, it still adds weight to the initial load. `Lora` and `Geist_Mono` appear unused — only `FONT.display` (Bagel), `FONT.head` (Archivo), `FONT.body` (Space Grotesk), and `FONT.mono` (JetBrains) are used in `fonts.ts`.

---

### 🟡 Issue #8: Proxy Middleware Makes a Blocking Server-Side Fetch (MEDIUM)

**File**: `proxy.ts`

```tsx
const res = await fetch(
  `${BETTER_AUTH_URL}/api/${API_VERSION}/auth/get-session`,
  { headers: { cookie }, cache: "no-store" },
);
```

On EVERY matched route (`/`, `/login`, `/onboarding/*`, `/dashboard/*`), the middleware makes a **blocking fetch to the auth server** before the page even starts rendering. This adds 100-500ms latency to every navigation.

Then the client-side guards make the **same request again**.

---

### 🟢 Issue #9: `next.config.ts` is Empty (LOW)

No performance optimizations configured:
- No `images.remotePatterns` for optimized image loading
- No `experimental.optimizePackageImports` for tree-shaking heavy libraries (lucide-react, recharts, radix-ui)
- No bundle analyzer configured

---

### 🟢 Issue #10: Heavy Libraries Not Tree-Shaken (LOW)

- `recharts` (100KB+) loaded on dashboard even when showing skeletons
- `react-markdown` + `remark-gfm` loaded for every chat message
- `lucide-react` — individual icon imports are fine, but the full package is listed
- `radix-ui` (the umbrella package) instead of individual `@radix-ui/*` packages

---

## 3. Fix Plan — Prioritized

### 🔴 Fix #1: Remove Blocking Guards — Use Server-Side Auth (CRITICAL) — <span style="color:#1DBC87">**✅ DONE**</span>

**Estimated Impact**: **50-70% improvement in perceived load time**

The proxy middleware ALREADY verifies auth. The guards are redundant. Replace them with a non-blocking approach:

**Step A**: Create a shared `SessionContext` that loads auth data ONCE at the layout level and shares it down via React Context — no blocking spinners.

```tsx
// components/layout/SessionProvider.tsx
"use client"
import { createContext, useContext } from "react"
import { authClient } from "@/lib/auth-client"

type SessionCtx = {
  session: ReturnType<typeof authClient.useSession>["data"]
  activeOrg: ReturnType<typeof authClient.useActiveOrganization>["data"]
  isPending: boolean
}

const Ctx = createContext<SessionCtx | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: sp } = authClient.useSession()
  const { data: activeOrg, isPending: op } = authClient.useActiveOrganization()
  
  return (
    <Ctx.Provider value={{ session, activeOrg, isPending: sp || op }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAppSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useAppSession must be used within SessionProvider")
  return ctx
}
```

**Step B**: Replace `SessionGuard` with a non-blocking wrapper that renders children immediately and only redirects if the session check fails:

```tsx
// NEW SessionGuard — non-blocking
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "./SessionProvider"

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { session, isPending } = useAppSession()

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/login")
  }, [session, isPending, router])

  // RENDER CHILDREN IMMEDIATELY — proxy already verified auth
  // Only redirect if session check fails (expired mid-session)
  return <>{children}</>
}
```

**Step C**: Same for `OnboardingGuard` — render children immediately, redirect only if check fails.

**Step D**: Update dashboard layout:

```tsx
// (dashboard)/layout.tsx
import { SessionProvider } from "@/components/layout/SessionProvider"
import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardSidebarShell>{children}</DashboardSidebarShell>
    </SessionProvider>
  )
}
```

---

### 🔴 Fix #2: Add `loading.tsx` Files for Instant Feedback (CRITICAL) — <span style="color:#1DBC87">**✅ DONE**</span>

**Estimated Impact**: **Instant route transitions instead of blank screens**

Create `loading.tsx` files for every route group. These render INSTANTLY (server-side) while the page JS loads:

```tsx
// src/app/(dashboard)/dashboard/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Metrics skeleton */}
      <div className="grid gap-3.5 grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      {/* Chart skeleton */}
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
```

Create similar files for:
- `src/app/(dashboard)/assistants/loading.tsx`
- `src/app/(dashboard)/assistants/[id]/loading.tsx`
- `src/app/(dashboard)/brain/loading.tsx`
- `src/app/(dashboard)/settings/loading.tsx`
- `src/app/(onboarding)/onboarding/loading.tsx`

---

### 🔴 Fix #3: Code-Split the Chat Page (CRITICAL)

**Estimated Impact**: **40-60% faster chat page initial render**

**Step A**: Use `next/dynamic` for agent-specific tabs (only loaded when needed):

```tsx
// assistants/[id]/page.tsx
import dynamic from "next/dynamic"

const LexDocumentsTab = dynamic(() => 
  import("@/components/agents/lex/documents-tab").then(m => ({ default: m.LexDocumentsTab })),
  { loading: () => <TabSkeleton /> }
)
const ScoutWatchlistTab = dynamic(() => 
  import("@/components/agents/scout/watchlist-tab").then(m => ({ default: m.ScoutWatchlistTab })),
  { loading: () => <TabSkeleton /> }
)
// ... same for Sage, Rex, Maya tabs
```

**Step B**: Dynamically import heavy dialogs:

```tsx
const RunActionDialog = dynamic(() => 
  import("@/components/chat/RunActionDialog").then(m => ({ default: m.RunActionDialog })),
  { ssr: false }
)
const AgentInfoPanel = dynamic(() => 
  import("@/components/assistants/AgentInfoPanel").then(m => ({ default: m.default })),
  { ssr: false }
)
```

**Step C**: Split the 901-line page into focused sub-components in separate files:
- `ChatHeader.tsx` (already exists inline — extract)
- `ChatEmptyState.tsx`
- `ChatMessageList.tsx`
- `ChatAgentTabs.tsx`

---

### 🟡 Fix #4: Optimize `next.config.ts` (HIGH) — <span style="color:#1DBC87">**✅ DONE**</span>

```tsx
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake heavy packages
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts", 
      "react-markdown",
      "radix-ui",
      "@base-ui/react",
      "date-fns",
    ],
  },
  
  // Allow optimized images from your CDN
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      // Add your actual CDN/storage domains
    ],
  },
};

export default nextConfig;
```

---

### 🟡 Fix #5: Remove Unused Fonts (HIGH) — <span style="color:#1DBC87">**✅ DONE**</span>

In `layout.tsx`, remove fonts that aren't used via `FONT.*`:

```diff
- import { Geist, Geist_Mono, JetBrains_Mono, Lora, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";
+ import { JetBrains_Mono, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";

- const loraHeading = Lora({ subsets: ['latin'], variable: '--font-heading' });
- const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
- const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
```

Check that `font-heading` and `font-geist-*` CSS variables aren't used elsewhere first. Based on my analysis, only `--font-mono`, `--font-bagel`, `--font-archivo`, and `--font-space` are used via `FONT.*` and Tailwind classes.

---

### 🟡 Fix #6: Prefetch Chat Data on Hover (HIGH)

When the user hovers over an agent in the `ChatList`, prefetch that agent's messages so they're ready instantly when clicked:

```tsx
// ChatList.tsx — in AgentRow
import { useQueryClient } from "@tanstack/react-query"
import { getMessages } from "@/lib/api/assistants"
import { qk } from "@/lib/query-keys"

function AgentRow({ agent, active, status, last, organizationId }) {
  const queryClient = useQueryClient()
  
  const prefetch = () => {
    if (!organizationId) return
    queryClient.prefetchQuery({
      queryKey: qk.chat(agent.id, organizationId),
      queryFn: () => getMessages(agent.id, organizationId),
      staleTime: 30_000,
    })
  }

  return (
    <Link
      href={`/assistants/${agent.id}`}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      // ... rest of the component
    >
```

---

### 🟡 Fix #7: Optimize the Middleware (MEDIUM) — <span style="color:#1DBC87">**✅ DONE**</span>

The proxy middleware currently fetches the session on every navigation. Optimize it:

```tsx
// proxy.ts — skip middleware for client-side navigations
export async function proxy(request: NextRequest) {
  // Skip for prefetch requests (Next.js link prefetching)
  if (request.headers.get("purpose") === "prefetch") {
    return NextResponse.next()
  }
  
  // Skip for RSC requests (client navigation) — guards handle these
  if (request.headers.get("rsc")) {
    return NextResponse.next()
  }
  
  // Only do the full auth check on hard navigations (direct URL entry, refresh)
  // ... existing logic
}
```

---

### 🟡 Fix #8: Dynamically Import Recharts on Dashboard (MEDIUM) — <span style="color:#1DBC87">**✅ DONE**</span>

Recharts is ~100KB. Only load it when the dashboard actually has data:

```tsx
// dashboard/page.tsx
import dynamic from "next/dynamic"

const ActivityChart = dynamic(
  () => import("@/components/dashboard/ActivityChart").then(m => ({ default: m.ActivityChart })),
  { loading: () => <ActivityChartSkeleton />, ssr: false }
)
```

---

### 🟢 Fix #9: Use `placeholderData` Everywhere (LOW) — <span style="color:#1DBC87">**✅ DONE**</span>

Several queries don't use `placeholderData`, causing flashes of empty state. The dashboard query already does this well — replicate it:

```tsx
// assistants.ts — useMessages
export function useMessages(agentSlug: string, organizationId: string) {
  return useQuery({
    queryKey: qk.chat(agentSlug, organizationId),
    queryFn: () => getMessages(agentSlug, organizationId),
    enabled: !!agentSlug && !!organizationId,
    placeholderData: (prev) => prev,  // ← keep previous data during refetch
  })
}
```

---

### 🟢 Fix #10: Add `staleTime` to Auth Queries (LOW) — <span style="color:#1DBC87">**✅ DONE**</span>

The `better-auth` React hooks make fresh network requests on every component mount by default. Configure them to cache:

```tsx
// auth-client.ts
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  basePath: `/api/${process.env.NEXT_PUBLIC_API_VERSION! || "v1"}/auth`,
  fetchOptions: {
    // Cache session responses for 60 seconds
    headers: { "Cache-Control": "max-age=60" },
  },
  plugins: [organizationClient({ /* ... */ })],
});
```

---

## 4. Advanced Optimizations

### 🚀 Server Components for Static Shells

Convert page layouts to use Server Components where possible. The dashboard page header (greeting, date) can be server-rendered:

```tsx
// dashboard/page.tsx — make it a Server Component
// Move the data-fetching parts to a Client Component child

// Server Component (no "use client")
export default function DashboardPage() {
  const today = new Date()
  return (
    <div className="flex flex-col gap-8 pb-10">
      <PageHeader
        kicker={formatDate(today)}
        title="your dashboard"
        subtitle="Here's what your team is working on."
      />
      {/* Client component handles the dynamic parts */}
      <DashboardContent />
    </div>
  )
}
```

### 🚀 Route Group Parallel Loading

Use Next.js parallel routes to load sidebar and content simultaneously:

```
app/(dashboard)/
  @sidebar/        ← parallel route for sidebar
    default.tsx
  @content/        ← parallel route for content
    dashboard/page.tsx
  layout.tsx        ← renders both in parallel
```

### 🚀 Streaming with Suspense

Wrap data-dependent sections in `<Suspense>` boundaries so static content renders immediately while data loads:

```tsx
import { Suspense } from "react"

export default function DashboardPage() {
  return (
    <div>
      <PageHeader ... />  {/* Renders instantly */}
      <Suspense fallback={<MetricCardSkeleton />}>
        <MetricsStrip />   {/* Streams in when data ready */}
      </Suspense>
      <Suspense fallback={<ActivityChartSkeleton />}>
        <ActivityChart />  {/* Streams in independently */}
      </Suspense>
    </div>
  )
}
```

### 🚀 React Query `prefetchQuery` in Server Components

Pre-populate the React Query cache on the server so the client doesn't need to refetch:

```tsx
// dashboard/page.tsx (Server Component)
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"

export default async function DashboardPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["dashboard-summary", "7d", [...]],
    queryFn: () => getDashboardSummary({ range: { kind: "7d" }, agents: ALL_SLUGS }),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardContent />
    </HydrationBoundary>
  )
}
```

---

## 5. Implementation Order

Execute in this exact order for maximum impact with minimum risk:

| Phase | Fix | Impact | Effort | Risk |
|-------|-----|--------|--------|------|
| **1** | Add `loading.tsx` files (Fix #2) | 🟢 Instant | 30 min | None |
| **2** | Remove blocking guards (Fix #1) | 🔴 Huge | 2-3 hrs | Medium |
| **3** | Code-split chat page (Fix #3) | 🔴 Huge | 2 hrs | Low |
| **4** | Optimize `next.config.ts` (Fix #4) | 🟡 Good | 10 min | None |
| **5** | Remove unused fonts (Fix #5) | 🟡 Good | 15 min | Low |
| **6** | Prefetch chat on hover (Fix #6) | 🟡 Good | 30 min | None |
| **7** | Optimize middleware (Fix #7) | 🟡 Good | 30 min | Low |
| **8** | Dynamic import recharts (Fix #8) | 🟡 Decent | 20 min | None |
| **9** | `placeholderData` everywhere (Fix #9) | 🟢 Polish | 15 min | None |
| **10** | Server Components + streaming (Adv.) | 🔴 Huge | 1-2 days | Medium |

### Phase 1 (Do Now — 1 hour)
Fixes #2, #4, #5 — zero-risk, instant improvement. Add loading files, optimize config, remove unused fonts.

### Phase 2 (Do Next — 3-4 hours)  
Fixes #1, #3 — the two biggest wins. Remove blocking guards, code-split the chat page.

### Phase 3 (Do Soon — 2-3 hours)
Fixes #6, #7, #8, #9 — polish and optimization. Prefetching, middleware optimization, dynamic imports.

### Phase 4 (Do Later — 1-2 days)
Advanced optimizations — Server Components, streaming, server-side prefetching. Biggest long-term impact but requires careful refactoring.

---

> **Bottom Line**: The app is slow because it does EVERYTHING on the client and blocks rendering behind sequential auth checks that the server already performed. The fix is: (1) stop blocking, (2) show instant loading states, (3) split the code, (4) leverage Next.js server rendering. Phases 1-2 alone will make the app feel 3-5x faster.
