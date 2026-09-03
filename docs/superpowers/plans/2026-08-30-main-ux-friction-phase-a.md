# apps/main UX Friction Fixes — Phase A Implementation Plan

**Goal:** Remove the concrete responsive and visual friction identified in the Phase A design without changing data flows, mutations, or product behavior.

**Source spec:** `docs/superpowers/specs/2026-08-30-main-ux-friction-phase-a-b-design.md`

**Scope:** Brain responsiveness and save placement, assistant tab-bar wrapping, a targeted responsive spot-check, integrations grouped by connection state, and a visual-only feedback/community refresh.

**Constraints:**

- Preserve all existing business logic, queries, mutations, voting, publishing, and submit flows.
- Reuse the current `Card`, `Button`, `Badge`, `Input`, `Select`, and `Tabs` primitives; add no UI dependency.
- Keep integration filters scoped to disconnected catalog entries and derive grouping from the already-loaded account/connection data.
- Keep the feedback page's information architecture and features intact while consolidating its controls and removing the obsolete hard-shadow treatment.
- Verify at approximately 375px, 768px, and desktop width where an authenticated local session is available; supplement inaccessible routes with static overflow checks and build/lint verification.

## Task 1 — Make the brain page responsive and remove the fixed footer

**Files:**

- Modify: `apps/main/src/components/brain/BrandKitSection.tsx`
- Modify: `apps/main/src/app/(dashboard)/brain/page.tsx`
- Modify if spot-check confirms shell overflow: `apps/main/src/components/ui/sidebar.tsx`

- [x] Put the eight brain tabs in a touch-scrollable, single-line container and prevent triggers from shrinking.
- [x] Convert the backend, onboarding-seed, and empty-state banners from pixel-heavy inline styles to responsive Tailwind/design-token styling.
- [x] Delete the viewport-fixed save bar and render one accessible save-status card in normal page flow below the tab content.
- [x] Reduce the page's now-unnecessary footer padding and keep the manual save/autosave state behavior unchanged.
- [x] Run TypeScript and ESLint after the brain changes.

## Task 2 — Let assistant sub-navigation wrap safely

**File:**

- Modify: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

- [x] Give Lex, Sage, Rex, and Maya tab rows a wrapping flex layout with responsive horizontal padding.
- [x] Keep tab buttons non-shrinking and single-line so labels do not crush.
- [x] Let Maya's credits/top-up cluster move to a full-width, right-aligned second line on very narrow screens.
- [x] Confirm the expanded toolbar remains inside the existing chat shell without changing tab behavior.

## Task 3 — Group integrations by actual connection state

**File:**

- Modify: `apps/main/src/app/(dashboard)/settings/integrations/page.tsx`

- [x] Partition legacy integrations from `accountByPlatform` and catalog entries from `connectedMcpSlugs`; do not add requests.
- [x] Render `Connected` first, including connected native and catalog cards independent of search filters.
- [x] Keep approval policy controls after the connected tools they govern.
- [x] Render `Not connected` below with neutral vendor-free copy, search/category controls, disconnected native entries, and filtered disconnected catalog entries.
- [x] Preserve empty search results and verify `"*"` is displayed as `Every tool` throughout approval-policy UI.

## Task 4 — Restyle the feedback/community page using shared primitives

**File:**

- Modify: `apps/main/src/app/(dashboard)/feedback/page.tsx`

- [x] Replace upcoming-agent, feedback, empty, and error containers with `Card variant="brand"` styling.
- [x] Replace page-local hard-shadow buttons with shared `Button` variants, including vote and filter controls.
- [x] Consolidate category/agent filtering into a compact first row and sort/search/submit into a second row inside one control card.
- [x] Replace category, agent, and status pills on feedback cards with shared, muted `Badge` variants.
- [x] Keep all fetch, filter, sort, vote, dialog, and drawer behavior unchanged.

## Task 5 — Targeted responsive verification

**Areas:** dashboard, assistant/chat shell, integrations, settings, billing, brain, and feedback.

- [x] Run a static scan for fixed widths, nowrap rows, and horizontal overflow in the named areas; fix only concrete clipping found.
- [x] Start `apps/main` and use browser checks at mobile (~375px), tablet (~768px), and desktop widths when authentication/environment data permits.
- [x] Exercise the brain tabs, assistant agent tab bars, integrations filters/sections, and feedback filters at the narrowest width.
- [x] Run final `tsc --noEmit`, ESLint, and a production Next.js build for Phase A.
- [x] Record any environment-only verification limitation before beginning Phase B.

## Verification record

- `pnpm exec tsc --noEmit` passed in `apps/main`.
- `pnpm build` passed in `apps/main`, including route generation for all 33 routes.
- Targeted ESLint passed across every changed `apps/main` TypeScript/TSX/checked-in JavaScript file with zero errors or warnings. Brain's browser-storage hydration now runs in a cancellable microtask rather than synchronously cascading state from the effect.
- Browser checks covered the named dashboard routes at approximately 375px, 768px, and 1440px. They exposed a shared `SidebarInset` width bug at tablet size; changing it from `w-full` to `min-w-0` removed the 1024px document overflow at a 768px viewport.
- The temporary authenticated organization mock exposed the full Brain form. At 375px, the page/main stayed exactly 375px wide while the tab viewport stayed 351px wide and independently scrolled its 854px tab row; no page-level horizontal overflow remained.
