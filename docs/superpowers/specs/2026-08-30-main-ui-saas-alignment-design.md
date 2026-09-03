# apps/main UI Alignment with apps/landing — Design

## Context

`apps/landing` was redesigned (commit `92f20ce`, "professional B2B theme across the site") from a neo-brutalist identity — thick black outlines, hard offset "sticker" shadows, rotated stars/stickers, a grain overlay, and a Bagel Fat One / Archivo Black / Space Grotesk font stack — into a restrained B2B system: hairline borders, soft layered elevation, Inter Tight / Inter / JetBrains Mono, and new surface/ink/line/radii tokens. The color palette itself did not change; it's now used as accent signal rather than flat fill.

`apps/main` (the product) never received this pass. It is still fully on the pre-redesign brutalist system:

- **Fonts:** `Bagel_Fat_One` / `Archivo_Black` / `Space_Grotesk` (`apps/main/src/app/layout.tsx`), vs. landing's `Inter_Tight` / `Inter` / `JetBrains_Mono`.
- **Tokens:** `apps/main/src/app/globals.css` has no surface/line/ink-scale/shadow tokens — just the raw shadcn semantic vars (`--border: #111111`, `--radius: 0.75rem`, etc.) and a live grain-texture `.noise-overlay` (landing turned this into a no-op).
- **Component chrome:** the shared `Button` primitive's base class is `rounded-none`, and its `brand*` variants use 3px solid borders with hard offset box-shadows (`shadow-[5px_5px_0_var(--foreground)]`) and uppercase tracking. This same treatment is duplicated as **hardcoded inline styles** (not shared components) across ~60 files — `AppSidebar`'s org switcher and avatar, `SettingsNav`'s pill nav, the onboarding header's step/logout pills, the dashboard's error banner, and others.
- One file (`RunGraph`'s loading fallback) already hardcodes landing's *new* palette values (`rgba(20,18,14,0.10)`, `#F5EEE0`) directly instead of a token — an ad-hoc partial drift toward the new look that this plan should normalize rather than leave as one-off.

Goal: bring `apps/main` to the same visual language as `apps/landing` — hairline borders, soft elevation, the new font stack and token scale — and, while touching each area, smooth over the specific friction points found below. This is **not** a rebuild: apps/main's structure, loading states (skeletons are already well-implemented on the dashboard), and business logic are sound and are explicitly not in scope.

## Hard constraint: visual-only diffs

Every change in this plan touches only `className`, inline `style` objects, CSS custom properties, and font imports. No prop signatures, event handlers, data-fetching, conditional rendering logic, or IA (nav items, routes, feature flags) change. Where a file mixes styling with logic (e.g. `BillingPage`'s checkout-status polling, `OnboardingLayout`'s step-guard effects), only the JSX/className layer is touched.

Each phase ends with `pnpm check-types` + `pnpm lint` (from `apps/main`) and a manual click-through of that area's key flows before moving to the next phase, so a regression is caught immediately rather than compounding across phases.

## Explicitly out of scope

- No new features, no IA changes — `SettingsNav`'s two commented-out entries (Members, Notifications) stay exactly as commented; that's a product decision, not a styling one.
- No logic or data-fetching changes anywhere.
- No dark-mode work — that's a landing marketing-page concept (dark sections between light sections); apps/main is a single light-surface product and doesn't need it.
- No mobile-specific redesign beyond what exists today, unless a change here visibly breaks something at small width.

## Approach

CSS custom properties in `globals.css` are inherently global, so the token/font/shared-primitive foundation cannot be meaningfully phased — it lands once, as **Phase 0**. What *can* be phased is the ~60 files of hardcoded brutalist inline styling layered on top of those primitives; that work proceeds **area by area**, in priority order, each phase bundling the re-skin with that area's specific friction fixes since it's the same code either way:

0. Foundation — tokens, fonts, shared `ui/` primitives
1. Dashboard + Nav
2. Onboarding + Auth
3. Chat / Assistants / Runs
4. Settings + Billing

## Phase 0 — Foundation

**Tokens** (`apps/main/src/app/globals.css`): add landing's scale as new CSS vars, copied from `apps/landing/src/app/globals.css`:
- `--vq-surface` / `--vq-surface-2` (surface scale)
- `--vq-line` / `--vq-line-2` (hairline borders at 10–17% ink opacity, replacing solid `#111`)
- `--vq-ink-2` / `--vq-ink-3` (muted text scale)
- `--vq-shadow-sm` / `--vq-shadow` / `--vq-shadow-lg` (soft layered elevation, replacing hard offset shadows)
- New radii: `--vq-r-sm` (8px) … `--vq-r-xl` (22px)

Palette hex values (`--vq-red`, `--vq-yellow`/`--vq-amber`, `--vq-green`, etc.) are unchanged — verified identical between the two apps — so no rebrand risk here, just application. Retire `.noise-overlay` the same way landing did (`display: none`), so the grain texture apps/main currently still renders on the onboarding shell goes away without touching whatever mounts it.

**Fonts** (`apps/main/src/app/layout.tsx`): swap `Bagel_Fat_One` / `Archivo_Black` / `Space_Grotesk` for `Inter_Tight` / `Inter` / `JetBrains_Mono`, using the same `next/font/google` variable names landing uses (`--font-display`, `--font-body`, `--font-mono`). `lib/fonts.ts`'s `FONT` export keeps its existing shape, so every consumer (there are dozens, via `FONT.mono` / `FONT.head` / `FONT.body`) picks up the new faces with zero call-site changes — mirrors exactly how landing's own commit handled this.

**Shared primitives** (`apps/main/src/components/ui/`):
- `button.tsx` — drop the base class's `rounded-none`; retire `brand` / `brand-dark` / `brand-yellow` / `brand-ghost`'s 3px borders, hard offset shadows, and forced uppercase in favor of landing's soft-elevation CTA treatment (rounded corners, `--vq-shadow`, no forced case). Variant *names* and *props* stay identical — no call-site changes anywhere that uses `<Button variant="brand">`.
- `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `kpi-tile.tsx`, `page-header.tsx` — same treatment: hairline borders instead of thick solid ones, soft shadow instead of hard offset, new radius scale.
- The `.vq-tour` driver.js override block in `globals.css` (currently 3px borders, hard offset shadows, `--font-archivo`/`--font-space` references) gets the same re-skin plus its now-stale font-var references corrected to the new variable names — the same class of bug landing's commit fixed for its own blog/compare pages.

## Phase 1 — Dashboard + Nav

**Re-skin:**
- `AppSidebar.tsx`'s org switcher trigger, plan badge, and avatar circle — currently hardcoded inline (`border: "2px solid #111"`, `boxShadow: "2px 2px 0 #111"`) — move onto the Phase 0 `Badge`/`Button` primitives so this isn't a bespoke one-off.
- Sidebar nav item labels (`monoLabelStyle`: forced uppercase mono at all times) switch to body font, sentence case. Reserve mono/uppercase for small metadata only (org slug, the "Free" plan pill) — matching landing's convention of mono for eyebrows, not primary UI voice.

**Friction fix:**
- The dashboard's fetch-error banner (`dashboard/page.tsx`) currently uses the `brand-dark` hard-shadow treatment for a non-fatal data error — visually louder than the failure warrants. Replace with a calm bordered alert row (icon + muted text + Retry button), the standard SaaS treatment for "something didn't load, here's a retry."

**No change needed:** the dashboard's skeleton loading states (`MetricCardSkeleton`, `ActivityChartSkeleton`, `CrewLeaderboardSkeleton`, `ContentPipelineSkeleton`) are already a sound, complete pattern — re-skin their placeholder colors only, don't touch structure.

## Phase 2 — Onboarding + Auth

**Re-skin:**
- `OnboardingLayout`'s header ("Step X/Y" pill, logout pill) and the step-progress bar segments — same thick-border/hard-shadow pattern, mostly inherited for free once Phase 0's `Button` lands, plus a direct re-skin of the remaining pill chrome.

**Friction fix:**
- The rotated `Sticker` decorations ("briefing in progress", "auto-saved ✦") and the grain overlay set a playful, joke-forward tone that will now clash with landing's B2B register — a prospect arrives from landing already primed for "professional," then hits stickers and grain mid-signup. Retire the rotation/emoji treatment; keep the encouraging copy, present it via landing's plain eyebrow-label style instead.

**No change needed:** the guard logic — draft persistence to `localStorage`, step-validation redirects, session-expiry bounce — is sound. Nothing here is touched beyond the JSX it renders.

## Phase 3 — Chat / Assistants / Runs

**Re-skin:**
- `RunGraph`'s loading fallback hardcodes the *new* palette ad hoc already (`rgba(20,18,14,0.10)`, `#F5EEE0`, `#8B857A`) — swap these literals for the actual Phase 0 tokens (`var(--vq-line)`, `var(--vq-surface-2)`, `var(--vq-ink-3)`) once they exist. This is a normalize, not a redesign.
- `RunPanel` / `RunActionDialog` and other chat-surface buttons already consume the shared `Button` primitive, so most of this phase is verification — confirm nothing looks broken — rather than new edits.

**No change needed:** run-status copy (`"Waiting for your approval"`, `"Needs your approval"`, etc.) is already good; the dependent-closure approval UX is functional and untouched.

## Phase 4 — Settings + Billing

**Re-skin:**
- `SettingsNav.tsx` is a fully inline-styled pill nav (thick borders, hard shadow, uppercase mono, per-item hardcoded accent color). Re-skin toward a standard SaaS settings tab bar — thin underline or soft active-pill — consistent with the rest of the app.
- `BillingPage` and its card components (`AgentEntitlementRow`, `AgentBuyCard`) — re-skin whatever `Card`/`Badge`/`Button` chrome they use; the checkout-status polling logic (toast + 30s timeout fallback on `?status=success`) is already a sound pattern and stays untouched.

**Explicitly not decided here:** `SettingsNav`'s two commented-out entries (Members, Notifications) are a product/IA call, not a styling one — left exactly as they are.

## Verification

After each phase: `pnpm check-types` and `pnpm lint` from `apps/main/`, plus a manual pass through that area's primary flow (dashboard load + retry, one full onboarding run, one run-approval flow, one billing checkout-status round-trip) to confirm nothing behavioral moved. No automated visual regression tooling exists in this repo today, so this is manual — call it out to the user if a flow looks meaningfully different from before, rather than assuming style-only changes are always inert.
