# Design: Google Features "Coming Soon" Lock

**Date:** 2026-06-26  
**Status:** Approved  
**Scope:** `apps/main` (frontend only)

---

## Context

Veqiro is launching but Google API verification (OAuth consent screen, Gmail + Calendar scopes) is still pending. Two feature areas depend entirely on Google APIs:

- **Vega agent** (`/assistants/vega`) — processes inbox, drafts emails, manages calendar
- **Workspace pages** — Briefing (`/workspace/briefing`), Inbox (`/workspace/inbox`), Calendar (`/workspace/calendar`)

Until verification completes, these features must be visually locked with a "coming soon" state so users can discover them but understand they're not yet active. Unlocking must require a single config change with no code surgery.

---

## What We're Building

A **frontend-only, single-toggle feature lock** that:
1. Lets users navigate to all locked pages normally
2. Shows a contextual "coming soon" state instead of live content
3. Disables interactive inputs in the Vega chat
4. Unlocks everything by flipping one environment variable

No backend changes are needed — the existing `GoogleNotConnectedError` handles any edge cases if the API is reached directly.

---

## Architecture

### Toggle Mechanism

One env var in `apps/main/.env.local` (and `.env.production`):

```
NEXT_PUBLIC_GOOGLE_FEATURES_LOCKED=true
```

Read through a config module (`src/lib/config/features.ts`):

```ts
export const GOOGLE_FEATURES_LOCKED =
  process.env.NEXT_PUBLIC_GOOGLE_FEATURES_LOCKED === 'true'
```

**To unlock:** set to `false` or delete the line. Defaults to unlocked when absent.

`NEXT_PUBLIC_` makes it available to both server and client components (baked in at build time — no runtime fetch required).

### UI Component

One new reusable component: `src/components/ui/feature-lock-banner.tsx`

Used in all 4 locked surfaces. Renders a centered coming-soon panel that fills its container (flex-1). Props:
- `title: string` — feature name (e.g. "Smart Inbox")
- `description: string` — one-sentence context on what the feature does / why it's locked

### Visual Design

Consistent with the app's neo-brutalist language (`#111` borders, 4px shadow, warm beige palette):

```
┌──────────────────────────────────────────────────────┐  2.5px #111 border
│                                                      │  4px #111 shadow
│         [Lock icon — 48px, #888]                     │
│                                                      │
│  [ coming soon ] ← Sticker badge (tone=yellow)       │
│                                                      │
│    Google API Verification in Progress               │  font-display, ~32px
│                                                      │
│    [Feature name] requires Gmail & Calendar          │  font-body, muted
│    access. It'll be live as soon as our              │
│    verification completes — usually a few days.      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Background: `#EFE7D6` (same warm beige used in chat/empty states throughout the app).

---

## Integration Points

### Workspace Pages (3 files)

**Inbox** (`workspace/inbox/page.tsx`) and **Calendar** (`workspace/calendar/page.tsx`) are simple ~22-48 line server components. Pattern:

```tsx
import { GOOGLE_FEATURES_LOCKED } from "@/lib/config/features"
import { FeatureLockBanner } from "@/components/ui/feature-lock-banner"

// After PageHeader, replace the content div:
{GOOGLE_FEATURES_LOCKED ? (
  <FeatureLockBanner title="Smart Inbox" description="..." />
) : (
  <div ...><InboxView /></div>
)}
```

**Briefing** (`workspace/briefing/page.tsx`) is a 612-line "use client" component. Add an early return before any state or data fetching runs:

```tsx
if (GOOGLE_FEATURES_LOCKED) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 pb-4">
      <PageHeader ... />
      <FeatureLockBanner title="Daily Briefing" description="..." />
    </div>
  )
}
```

This is safe because hooks cannot run conditionally — the early return is placed *after* all hooks have been declared. Actually: since `GOOGLE_FEATURES_LOCKED` is a build-time constant, React treats this as dead code in one direction, so no conditional hook violation occurs. (The value never changes between renders.)

Wait — more carefully: `GOOGLE_FEATURES_LOCKED` is a module-level constant, not a React hook. Returning early based on it is fine as long as it's placed AFTER all `useState`/`useEffect` hook calls at the top of the component, OR it's truly a constant (same value every render, determined at module load). Since it reads `process.env.*` at module load, it is constant. The safest approach for the briefing "use client" page is to place the early return **after all hook declarations** — the same pattern already used for `if (!agent) return null` in the chat page.

### Vega Chat (`assistants/[id]/page.tsx`)

The page already has `const isVega = agent.id === "vega"` (line 1039). Add the lock state into the existing ternary chain for the content area:

```tsx
// In the main content ternary — add before EmptyState check:
} : isVega && GOOGLE_FEATURES_LOCKED ? (
  <FeatureLockBanner title="Vega" description="..." />
) : historyLoaded && !hasMessages && !isBusy ? (
  <EmptyState ... />
) : (
  <div>...</div>
)
```

Disable ChatInput when locked:

```tsx
<ChatInput
  ...
  disabled={isLoading || (isVega && GOOGLE_FEATURES_LOCKED)}
  placeholder={isVega && GOOGLE_FEATURES_LOCKED ? "Vega is coming soon…" : `Message ${agent.name.toLowerCase()}…`}
/>
```

The ChatInput already accepts `disabled` as a prop.

---

## Unlock Procedure

When Google verifies the account:

1. In `apps/main/.env.local` (local) and `apps/main/.env.production` (or deployment env): set `NEXT_PUBLIC_GOOGLE_FEATURES_LOCKED=false` or remove the line
2. Redeploy (Next.js bakes env vars at build time)
3. All 4 locked surfaces unlock automatically — zero code changes

---

## What Is NOT Changing

- All other agents (Maya, Rex, Scout, Sage, Lex) — unaffected
- Vega settings page (`/settings/vega`) — unaffected  
- Assistants list page (`/assistants`) — Vega still appears, users can click through
- Sidebar navigation — workspace links remain visible and navigable
- Backend routes — no changes; existing `GoogleNotConnectedError` handles edge cases
- Subscription/entitlement gate — unchanged

---

## Files Changed

**New:**
- `apps/main/src/lib/config/features.ts`
- `apps/main/src/components/ui/feature-lock-banner.tsx`

**Modified:**
- `apps/main/.env.local` — add flag
- `apps/main/src/app/(dashboard)/workspace/inbox/page.tsx`
- `apps/main/src/app/(dashboard)/workspace/calendar/page.tsx`
- `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx`
- `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

---

## Verification

1. Start dev server: `npm run dev` from `apps/main`
2. With `NEXT_PUBLIC_GOOGLE_FEATURES_LOCKED=true`:
   - `/workspace/inbox` → PageHeader visible, FeatureLockBanner fills content area
   - `/workspace/calendar` → PageHeader visible, FeatureLockBanner fills content area
   - `/workspace/briefing` → PageHeader visible, FeatureLockBanner fills content area
   - `/assistants/vega` → ChatHeader visible, FeatureLockBanner in message area, ChatInput disabled
   - `/assistants/maya` `/rex` `/lex` `/scout` `/sage` → work normally, unaffected
3. Set `NEXT_PUBLIC_GOOGLE_FEATURES_LOCKED=false` (or remove):
   - All surfaces return to normal live behavior
