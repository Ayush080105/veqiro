# apps/main UI Alignment with apps/landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin `apps/main` from its old neo-brutalist visual system (thick black borders, hard offset shadows, Bagel/Archivo/Space fonts, forced uppercase) onto the same restrained B2B system `apps/landing` already shipped (hairline borders, soft layered elevation, Inter Tight/Inter/JetBrains Mono), and fix a small set of concrete friction points found along the way — all without changing any business logic or behavior.

**Architecture:** A global Phase 0 lands new design tokens, fonts, and re-skins the shared `ui/` primitives (Button, Card, Badge, Sticker, Input, Select, Dialog, AlertDialog, KpiTile) that every page is built from — this is unavoidably global since CSS custom properties can't be scoped per-page. Phases 1–4 then work through the app area by area (Dashboard+Nav → Onboarding+Auth → Chat/Assistants/Runs → Settings+Billing), retiring the hardcoded brutalist inline styles layered on top of those primitives and applying the specific friction fixes identified per area.

**Tech Stack:** Next.js (App Router), Tailwind v4 (`@theme inline` token mapping), `class-variance-authority` for component variants, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-08-30-main-ui-saas-alignment-design.md`

## Global Constraints

- **Visual-only diffs.** Every task touches only `className`, inline `style` objects, CSS custom properties, and font loader calls. No prop signatures, event handlers, data-fetching, conditional rendering, or IA changes anywhere in this plan.
- **No new dependencies, no new components** unless explicitly listed in a task — this is a re-skin, not a rebuild.
- **Palette is unchanged** — `--vq-red`, `--vq-yellow`/`--vq-amber`, `--vq-green`, `--vq-pink`, `--vq-violet`, `--vq-blue` keep their existing hex values. Only borders, shadows, radii, fonts, and casing change.
- **Component variant names and prop shapes stay identical** (e.g. `<Button variant="brand">` keeps compiling and rendering as a "brand" button) unless a task explicitly says a call site's variant/size *choice* changes — never its shape.
- **No automated test suite exists in `apps/main`** (confirmed — no `test`/`e2e` scripts or directories). Verification per task is: `pnpm check-types` and `pnpm lint` (both run from `apps/main/`) plus a manual visual check of the affected page via the dev server. Flag anything that looks behaviorally different, not just visually different, before moving on.
- **Out of scope:** `SettingsNav`'s two commented-out entries stay commented; no dark-mode work; no mobile-specific redesign beyond what exists.

---

## File Structure

**Phase 0 (foundation, touched once):**
- Modify: `apps/main/src/app/globals.css` — new tokens, retire `.noise-overlay`, re-skin `.vq-tour`
- Modify: `apps/main/src/app/layout.tsx` — swap font loaders
- Modify: `apps/main/src/components/ui/button.tsx`
- Modify: `apps/main/src/components/ui/card.tsx`
- Modify: `apps/main/src/components/ui/kpi-tile.tsx`
- Modify: `apps/main/src/components/ui/badge.tsx`
- Modify: `apps/main/src/components/ui/sticker.tsx`
- Modify: `apps/main/src/components/ui/input.tsx`
- Modify: `apps/main/src/components/ui/select.tsx`
- Modify: `apps/main/src/components/ui/dialog.tsx`
- Modify: `apps/main/src/components/ui/alert-dialog.tsx`

**Phase 1 (Dashboard + Nav):**
- Modify: `apps/main/src/components/layout/AppSidebar.tsx`
- Modify: `apps/main/src/app/(dashboard)/dashboard/page.tsx`

**Phase 2 (Onboarding + Auth):**
- Modify: `apps/main/src/app/(onboarding)/onboarding/layout.tsx`
- Modify: `apps/main/src/app/(onboarding)/onboarding/_lib/step-shell.tsx`
- Modify: `apps/main/src/app/(onboarding)/onboarding/_lib/chip.tsx`
- Modify: `apps/main/src/components/auth-shell.tsx`
- Modify: `apps/main/src/components/forms/auth/loginForm.tsx`
- Modify: `apps/main/src/components/oauth-buttons.tsx`
- Modify: `apps/main/src/components/login-bg.tsx`

**Phase 3 (Chat / Assistants / Runs):**
- Modify: `apps/main/src/components/runs/RunPanel.tsx` (loading-fallback colors only)

**Phase 4 (Settings + Billing):**
- Modify: `apps/main/src/components/settings/SettingsNav.tsx`
- Modify: `apps/main/src/components/billing/AgentEntitlementRow.tsx` (avatar border only)
- Modify: `apps/main/src/components/billing/AgentBuyCard.tsx` (avatar border only)

No files are created or deleted. No `lib/fonts.ts` change — its `FONT` export keeps referencing the same CSS variable names (`--font-bagel`, `--font-archivo`, `--font-space`, `--font-mono`); Phase 0 changes what those variables resolve to, not their names, so all ~15 consumers of `FONT.*` pick up the new faces automatically.

---

### Task 1: Foundation tokens in globals.css

**Files:**
- Modify: `apps/main/src/app/globals.css:51-97` (the `:root` block) and `:152-161` (`.noise-overlay`)

**Interfaces:**
- Produces: CSS custom properties `--vq-surface`, `--vq-surface-2`, `--vq-line`, `--vq-line-2`, `--vq-ink-2`, `--vq-ink-3`, `--vq-shadow-sm`, `--vq-shadow`, `--vq-shadow-lg`, `--vq-r-sm`, `--vq-r`, `--vq-r-lg`, `--vq-r-xl` — every later task in this plan references these by name.

- [ ] **Step 1: Add the new token block**

In `apps/main/src/app/globals.css`, inside the existing `:root { ... }` block (after the `--vq-blue: #6FCDE8;` line, before the "shadcn tokens" comment), add:

```css
  /* Surfaces (professional B2B pass — see apps/landing/src/app/globals.css) */
  --vq-surface: #FBF7EF;
  --vq-surface-2: #F5EEE0;

  /* Ink scale */
  --vq-ink-2: #56514A;
  --vq-ink-3: #8B857A;

  /* Hairlines — replace the old solid #111 borders */
  --vq-line: rgba(17, 17, 17, 0.10);
  --vq-line-2: rgba(17, 17, 17, 0.17);

  /* Elevation — replace the old hard offset shadows */
  --vq-shadow-sm: 0 1px 2px rgba(17, 17, 17, 0.05);
  --vq-shadow: 0 1px 3px rgba(17, 17, 17, 0.05), 0 8px 24px -6px rgba(17, 17, 17, 0.09);
  --vq-shadow-lg: 0 2px 6px rgba(17, 17, 17, 0.06), 0 24px 48px -12px rgba(17, 17, 17, 0.14);

  /* Radii */
  --vq-r-sm: 8px;
  --vq-r: 12px;
  --vq-r-lg: 16px;
  --vq-r-xl: 22px;
```

Note: main's ink color is `#111111` (vs. landing's `#14120E`) — the hairline/shadow rgba values above use `17,17,17` (main's actual ink) rather than copying landing's `20,18,14` literally, so hairlines render against main's real foreground color.

- [ ] **Step 2: Retire the grain overlay**

Replace the `.noise-overlay` rule body (currently `position: fixed; inset: 0; ... background-repeat: repeat;`, lines ~152-161) with:

```css
/* Retired: the grain overlay read as texture-for-texture's-sake once the rest
   of the UI moved to soft elevation. Kept as a no-op so any remaining mount
   (e.g. the onboarding shell) renders nothing instead of a texture. */
.noise-overlay {
  display: none;
}
```

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/`. Both must exit 0 — this step only added CSS custom properties and simplified one rule, so nothing should fail.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/app/globals.css
git commit -m "style(main): add landing's surface/line/shadow/radii tokens, retire grain overlay"
```

---

### Task 2: Swap fonts in layout.tsx

**Files:**
- Modify: `apps/main/src/app/layout.tsx:1-13,26-34`
- Modify: `apps/main/src/app/globals.css` (`:root` block — add one alias line)

**Interfaces:**
- Consumes: nothing new.
- Produces: `--font-bagel` now resolves to Inter Tight, `--font-archivo` aliases to the same Inter Tight variable, `--font-space` now resolves to Inter, `--font-mono` is unchanged (already JetBrains Mono). `lib/fonts.ts`'s `FONT.display/head/body/mono` need no edits.

- [ ] **Step 1: Replace the font imports and loader calls**

In `apps/main/src/app/layout.tsx`, replace:

```tsx
import { JetBrains_Mono, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";
```

with:

```tsx
import { JetBrains_Mono, Inter_Tight, Inter } from "next/font/google";
```

Replace:

```tsx
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const bagelFatOne = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--font-bagel" });
const archivoBl = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
```

with:

```tsx
// Inter Tight carries headings/CTAs, Inter carries body copy — matches
// apps/landing's font stack. JetBrains Mono (labels/eyebrows) is unchanged.
// --font-archivo is aliased to --font-bagel in globals.css so FONT.head
// (apps/main/src/lib/fonts.ts) keeps resolving without any call-site changes.
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-bagel", weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-space", weight: ["400", "500", "600"] });
```

Update the `className={cn(...)}` list on the `<html>` element from:

```tsx
        jetbrainsMono.variable,
        bagelFatOne.variable,
        archivoBl.variable,
        spaceGrotesk.variable,
```

to:

```tsx
        jetbrainsMono.variable,
        interTight.variable,
        inter.variable,
```

- [ ] **Step 2: Alias --font-archivo to the new Inter Tight variable**

In `apps/main/src/app/globals.css`, in the `:root` block, add (next to the new tokens from Task 1):

```css
  /* FONT.head (lib/fonts.ts) reads --font-archivo directly via inline style;
     alias it to the same Inter Tight loaded under --font-bagel instead of
     loading Inter Tight a second time. */
  --font-archivo: var(--font-bagel);
```

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0 (this only changes which Google Fonts are imported and which CSS variable each is assigned to; no type surface changes).

Start the dev server (`pnpm dev` from `apps/main/`) and load `/dashboard`, `/login`, and one onboarding step (`/onboarding/step2`). Confirm headings, body text, and mono labels all render in a font other than the old Bagel Fat One / Archivo Black / Space Grotesk look (no visual regression tooling exists — this is a manual eyeball check).

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/app/layout.tsx apps/main/src/app/globals.css
git commit -m "style(main): swap Bagel/Archivo/Space fonts for Inter Tight/Inter, matching landing"
```

---

### Task 3: Re-skin the Button primitive

**Files:**
- Modify: `apps/main/src/components/ui/button.tsx:9-56`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow`, `--vq-shadow-lg`, `--vq-shadow-sm` (Task 1).
- Produces: no change to `buttonVariants`'s variant/size *names* or the `ButtonProps` type — every existing `<Button variant="..." size="...">` call site keeps compiling unchanged.

- [ ] **Step 1: Drop the brutalist base radius and sharp sizes**

Replace `rounded-none` in the base class string (line 10) with `rounded-md`. In the `size` variants, replace `xs: "h-6 gap-1 rounded-none px-2 ..."` and `sm: "h-7 gap-1 rounded-none px-2.5 ..."` and `"icon-xs": "size-6 rounded-none ..."` and `"icon-sm": "size-7 rounded-none"` — drop `rounded-none` from each (they'll inherit the base `rounded-md`).

- [ ] **Step 2: Re-skin the brand variants**

Replace the four `brand*` variant strings:

```tsx
        brand:
          "rounded-md border-[3px] border-foreground bg-destructive text-foreground font-head uppercase tracking-wider shadow-[5px_5px_0_var(--foreground)] hover:bg-destructive/90 active:not-aria-[haspopup]:translate-x-0.5 active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-[3px_3px_0_var(--foreground)] disabled:opacity-45",
        "brand-dark":
          "rounded-md border-[3px] border-foreground bg-primary text-primary-foreground font-head uppercase tracking-wider shadow-[5px_5px_0_var(--accent)] hover:bg-primary/90 active:not-aria-[haspopup]:translate-x-0.5 active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-[3px_3px_0_var(--accent)] disabled:opacity-45",
        "brand-yellow":
          "rounded-md border-[3px] border-foreground bg-accent text-foreground font-head uppercase tracking-wider shadow-[5px_5px_0_var(--foreground)] hover:bg-accent/90 active:not-aria-[haspopup]:translate-x-0.5 active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-[3px_3px_0_var(--foreground)] disabled:opacity-45",
        "brand-ghost":
          "rounded-md border-[3px] border-foreground bg-transparent text-foreground font-head uppercase tracking-wider hover:bg-foreground/5 active:not-aria-[haspopup]:translate-y-0.5 disabled:opacity-45",
```

with:

```tsx
        brand:
          "rounded-lg border border-[var(--vq-line-2)] bg-destructive text-foreground font-display font-medium shadow-[var(--vq-shadow)] hover:bg-destructive/90 hover:shadow-[var(--vq-shadow-lg)] active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        "brand-dark":
          "rounded-lg border border-[var(--vq-line-2)] bg-primary text-primary-foreground font-display font-medium shadow-[var(--vq-shadow)] hover:bg-primary/90 hover:shadow-[var(--vq-shadow-lg)] active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        "brand-yellow":
          "rounded-lg border border-[var(--vq-line-2)] bg-accent text-foreground font-display font-medium shadow-[var(--vq-shadow)] hover:bg-accent/90 hover:shadow-[var(--vq-shadow-lg)] active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        "brand-ghost":
          "rounded-lg border border-[var(--vq-line-2)] bg-transparent text-foreground font-display font-medium hover:bg-foreground/5 active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
```

Leave `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`, `chat-action`, and `chat-utility` untouched — the first six already read as clean/minimal once the base `rounded-none` is gone, and the chat variants already match landing's soft-pill convention.

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0 (only className string literals changed; `buttonVariants`'s public shape is untouched, so every call site across the app still type-checks).

Start the dev server and visually check a `brand` button (onboarding "Continue →"), a `brand-dark` button (onboarding "Meet the crew →"), and a `default`/`outline` button (any dashboard action) — confirm rounded corners and soft shadows, no more 3px black borders or hard offset shadows on the brand buttons.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/ui/button.tsx
git commit -m "style(main): re-skin Button brand variants with hairline borders and soft elevation"
```

---

### Task 4: Re-skin Card and KpiTile primitives

**Files:**
- Modify: `apps/main/src/components/ui/card.tsx:11-17`
- Modify: `apps/main/src/components/ui/kpi-tile.tsx:11-21`

**Interfaces:**
- Consumes: `--vq-line`, `--vq-line-2`, `--vq-shadow`, `--vq-shadow-sm`, `--vq-r`, `--vq-r-lg` (Task 1).
- Produces: no change to `cardVariants`/`tileVariants` variant names or component props.

- [ ] **Step 1: Re-skin Card's brand variant**

In `apps/main/src/components/ui/card.tsx`, replace:

```tsx
        brand:
          "relative gap-5 rounded-lg border-[3px] border-foreground bg-card py-5 shadow-[5px_5px_0_var(--foreground)] data-[size=sm]:gap-3 data-[size=sm]:py-4 data-[size=sm]:shadow-[4px_4px_0_var(--foreground)]",
```

with:

```tsx
        brand:
          "relative gap-5 rounded-[var(--vq-r-lg)] border border-[var(--vq-line-2)] bg-card py-5 shadow-[var(--vq-shadow)] data-[size=sm]:gap-3 data-[size=sm]:py-4 data-[size=sm]:shadow-[var(--vq-shadow-sm)]",
```

- [ ] **Step 2: Re-skin KpiTile's shape variants**

In `apps/main/src/components/ui/kpi-tile.tsx`, replace:

```tsx
      shape: {
        default: "rounded-none border border-foreground/10 p-3",
        brand:
          "rounded-md border-[3px] border-foreground p-4 shadow-[3px_3px_0_var(--foreground)]",
      },
```

with:

```tsx
      shape: {
        default: "rounded-[var(--vq-r)] border border-[var(--vq-line)] p-3",
        brand:
          "rounded-[var(--vq-r-lg)] border border-[var(--vq-line-2)] p-4 shadow-[var(--vq-shadow)]",
      },
```

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/dashboard` (uses `KpiTile shape="brand"` for the three metric tiles) and `/settings/billing` (uses `Card variant="brand"` in `AgentEntitlementRow`/`AgentBuyCard`) — confirm both render with hairline borders and soft shadows instead of thick black borders and hard offset shadows.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/ui/card.tsx apps/main/src/components/ui/kpi-tile.tsx
git commit -m "style(main): re-skin Card and KpiTile brand variants"
```

---

### Task 5: Re-skin Badge and Sticker primitives

**Files:**
- Modify: `apps/main/src/components/ui/badge.tsx:8-31`
- Modify: `apps/main/src/components/ui/sticker.tsx:7-25`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow-sm` (Task 1).
- Produces: no change to `badgeVariants`/`Sticker`'s exported prop shapes. `Sticker`'s `rotate` prop still exists and still works — Phase 2 decides which call sites still pass a nonzero value.

- [ ] **Step 1: Re-skin Badge**

In `apps/main/src/components/ui/badge.tsx`, in the base class string, replace `rounded-none` with `rounded-md`.

Replace the four brand-ish variants:

```tsx
        brand:
          "h-7 rounded-full border-2 border-foreground bg-accent px-3 font-head text-[10px] uppercase tracking-wider text-foreground shadow-[3px_3px_0_var(--foreground)]",
        "brand-red":
          "h-7 rounded-full border-2 border-foreground bg-destructive px-3 font-head text-[10px] uppercase tracking-wider text-foreground shadow-[3px_3px_0_var(--foreground)]",
        "brand-dark":
          "h-7 rounded-full border-2 border-foreground bg-primary px-3 font-head text-[10px] uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0_var(--accent)]",
        "brand-mono":
          "h-6 rounded-none border border-foreground/20 bg-transparent px-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
```

with:

```tsx
        brand:
          "h-6 rounded-full border border-[var(--vq-line-2)] bg-accent px-3 text-[11px] font-medium text-foreground shadow-[var(--vq-shadow-sm)]",
        "brand-red":
          "h-6 rounded-full border border-[var(--vq-line-2)] bg-destructive px-3 text-[11px] font-medium text-foreground shadow-[var(--vq-shadow-sm)]",
        "brand-dark":
          "h-6 rounded-full border border-[var(--vq-line-2)] bg-primary px-3 text-[11px] font-medium text-primary-foreground shadow-[var(--vq-shadow-sm)]",
        "brand-mono":
          "h-6 rounded-sm border border-foreground/20 bg-transparent px-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
```

(`brand-mono` keeps its mono/uppercase treatment — that already matches landing's `.vq-eyebrow` convention of reserving mono+uppercase for small labels, not general UI.)

- [ ] **Step 2: Re-skin Sticker**

In `apps/main/src/components/ui/sticker.tsx`, replace the `stickerVariants` base string:

```tsx
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border-[3px] border-foreground px-4 py-2 font-head text-xs uppercase tracking-wider text-foreground shadow-[4px_4px_0_var(--foreground)]",
```

with:

```tsx
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[var(--vq-line-2)] px-4 py-2 font-display text-xs font-medium text-foreground shadow-[var(--vq-shadow-sm)]",
```

Leave the `tone` variants (`yellow`, `red`, `green`, `violet`, `blue`, `pink`, `cream`) and the `rotate` prop/behavior exactly as they are — this task only removes the sticker's thick border/hard shadow/forced uppercase; whether a given call site still rotates it is a Phase 2 decision (Task 10).

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/settings/billing` (Badge "Trial"/"Payment failed" via `AgentEntitlementRow`) and `/onboarding/step2` (Sticker "Step 2 of 7") — confirm soft borders/shadows, no forced uppercase on the badges that previously had it.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/ui/badge.tsx apps/main/src/components/ui/sticker.tsx
git commit -m "style(main): re-skin Badge and Sticker primitives"
```

---

### Task 6: Re-skin Input, Select, Dialog, AlertDialog primitives

**Files:**
- Modify: `apps/main/src/components/ui/input.tsx:12-17`
- Modify: `apps/main/src/components/ui/select.tsx:86`
- Modify: `apps/main/src/components/ui/dialog.tsx:56`
- Modify: `apps/main/src/components/ui/alert-dialog.tsx:55`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow`, `--vq-shadow-lg`, `--vq-r`, `--vq-r-lg` (Task 1).
- Produces: no prop/variant shape changes to any of the four components.

- [ ] **Step 1: Re-skin Input**

In `apps/main/src/components/ui/input.tsx`, replace `rounded-none` in the `default` variant with `rounded-md`. Replace the `brand` variant:

```tsx
        brand:
          "h-12 rounded-md border-[3px] border-foreground bg-secondary px-4 py-3 text-base font-body file:h-8 file:text-sm transition-shadow focus-visible:shadow-[4px_4px_0_var(--destructive)] aria-invalid:border-destructive aria-invalid:shadow-[4px_4px_0_var(--destructive)]",
```

with:

```tsx
        brand:
          "h-12 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-secondary px-4 py-3 text-base font-body file:h-8 file:text-sm transition-shadow focus-visible:shadow-[var(--vq-shadow)] aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
```

- [ ] **Step 2: Re-skin Select**

In `apps/main/src/components/ui/select.tsx:86`, within the long className string, replace:

```
rounded-none bg-popover text-popover-foreground border-[3px] border-foreground shadow-[4px_4px_0_0_var(--foreground)]
```

with:

```
rounded-[var(--vq-r)] bg-popover text-popover-foreground border border-[var(--vq-line-2)] shadow-[var(--vq-shadow-lg)]
```

(leave every other class in that string — the `data-[...]` animation classes — untouched).

- [ ] **Step 3: Re-skin Dialog**

In `apps/main/src/components/ui/dialog.tsx:56`, replace:

```
rounded-none bg-popover p-5 text-xs/relaxed text-popover-foreground border-[3px] border-foreground shadow-[6px_6px_0_0_var(--foreground)]
```

with:

```
rounded-[var(--vq-r-lg)] bg-popover p-5 text-xs/relaxed text-popover-foreground border border-[var(--vq-line-2)] shadow-[var(--vq-shadow-lg)]
```

- [ ] **Step 4: Re-skin AlertDialog**

In `apps/main/src/components/ui/alert-dialog.tsx:55`, replace:

```
rounded-none bg-popover p-5 text-popover-foreground border-[3px] border-foreground shadow-[6px_6px_0_0_var(--foreground)]
```

with:

```
rounded-[var(--vq-r-lg)] bg-popover p-5 text-popover-foreground border border-[var(--vq-line-2)] shadow-[var(--vq-shadow-lg)]
```

- [ ] **Step 5: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Open a dialog (e.g. the "Create workspace" flow, or any settings modal) and a select dropdown somewhere in settings — confirm hairline borders and soft shadow, no more thick black border/hard offset shadow. Confirm the dialog still opens/closes and traps focus as before (behavior check, not just visual).

- [ ] **Step 6: Commit**

```bash
git add apps/main/src/components/ui/input.tsx apps/main/src/components/ui/select.tsx apps/main/src/components/ui/dialog.tsx apps/main/src/components/ui/alert-dialog.tsx
git commit -m "style(main): re-skin Input, Select, Dialog, AlertDialog primitives"
```

---

### Task 7: Re-skin the driver.js tour overrides

**Files:**
- Modify: `apps/main/src/app/globals.css:205-296` (the `.vq-tour` block)

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow`, `--vq-shadow-sm` (Task 1).

- [ ] **Step 1: Re-skin the popover chrome**

Replace:

```css
.vq-tour.driver-popover {
  background: #FFF9ED;
  border: 3px solid #111;
  border-radius: 8px;
  box-shadow: 5px 5px 0 #111;
  padding: 20px;
  min-width: 360px;
  max-width: 420px;
  color: #111;
}
```

with:

```css
.vq-tour.driver-popover {
  background: #FFF9ED;
  border: 1px solid var(--vq-line-2);
  border-radius: var(--vq-r);
  box-shadow: var(--vq-shadow-lg);
  padding: 20px;
  min-width: 360px;
  max-width: 420px;
  color: #111;
}
```

- [ ] **Step 2: Re-skin the footer button chrome**

Replace:

```css
.vq-tour .driver-popover-footer button {
  font-family: var(--font-mono), monospace;
  font-size: 10px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  padding: 7px 14px;
  border: 2px solid #111;
  border-radius: 6px;
  box-shadow: 2px 2px 0 #111;
  cursor: pointer;
  background: #EFE7D6;
  color: #111;
  transition: transform 80ms, box-shadow 80ms;
  line-height: 1;
}
.vq-tour .driver-popover-footer button:hover {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 #111;
}
```

with:

```css
.vq-tour .driver-popover-footer button {
  font-family: var(--font-body), sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 7px 14px;
  border: 1px solid var(--vq-line-2);
  border-radius: var(--vq-r-sm);
  box-shadow: var(--vq-shadow-sm);
  cursor: pointer;
  background: #EFE7D6;
  color: #111;
  transition: box-shadow 120ms ease;
  line-height: 1;
}
.vq-tour .driver-popover-footer button:hover {
  box-shadow: var(--vq-shadow);
}
```

Leave `.vq-tour-next-btn`'s dark background/color and `.vq-tour-close-btn`/`.vq-tour-progress-text` rules as they are — they don't carry the thick-border/hard-shadow treatment, only the shared footer-button rule above does.

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0 (CSS-only change).

Trigger the product tour (`localStorage.setItem("veqiro.tour.pending", "1")` then reload `/dashboard`, matching how `OnboardingLayout`'s `onFinish` triggers it — see Task 9's file for that call site) and confirm the popover renders with a hairline border and soft shadow, and still advances/closes correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/app/globals.css
git commit -m "style(main): re-skin driver.js tour popover to match new elevation system"
```

---

### Task 8: Re-skin AppSidebar

**Files:**
- Modify: `apps/main/src/components/layout/AppSidebar.tsx`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow-sm`, `--vq-shadow-lg` (Task 1).
- Produces: no change to any exported symbol; `AppSidebar` remains a zero-prop component.

- [ ] **Step 1: Drop forced uppercase-mono on primary nav labels**

Delete the `monoLabelStyle` constant (lines 59-64) and remove the `style={monoLabelStyle}` prop from both `<Link href={item.href} style={monoLabelStyle} />` occurrences (in the `navItems.map` and `bottomNavItems.map` blocks) — leave everything else in those two `.map()` blocks unchanged. Nav labels now render in the default body font/case instead of forced uppercase mono, matching landing's convention of reserving mono/uppercase for small metadata, not primary nav voice.

- [ ] **Step 2: Re-skin the org-switcher trigger button**

Replace the inline `style` object on the `DropdownMenuTrigger`'s `render` button (currently `background: "#FFF9ED", border: "2px solid #111", borderRadius: 8, boxShadow: "2px 2px 0 #111"`) with:

```tsx
                    style={{
                      padding: "6px 10px",
                      background: "#FFF9ED",
                      border: "1px solid var(--vq-line-2)",
                      borderRadius: 10,
                      boxShadow: "var(--vq-shadow-sm)",
                      cursor: "pointer",
                    }}
```

- [ ] **Step 3: Re-skin the "Free" plan pill**

Replace its inline style (currently `border: "1.5px solid #111"`, `background: "#F5C518"`) with:

```tsx
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    border: "1px solid var(--vq-line-2)",
                    borderRadius: 999,
                    background: "#F5C518",
                    color: "#111",
                  }}
                >
                  Free
                </span>
```

- [ ] **Step 4: Re-skin the DropdownMenuContent border/shadow**

Replace `className="w-64 border-2 border-foreground bg-white p-1 shadow-[4px_4px_0_#111]"` with `className="w-64 border border-[var(--vq-line-2)] bg-white p-1 shadow-[var(--vq-shadow-lg)]"`.

- [ ] **Step 5: Re-skin the footer avatar circle**

Replace the avatar `<div>`'s inline style (currently `border: "2px solid #111"`, `boxShadow: "2px 2px 0 #111"`) with:

```tsx
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#F5C518",
              border: "1px solid var(--vq-line-2)",
              boxShadow: "var(--vq-shadow-sm)",
              display: "grid",
              placeItems: "center",
              fontFamily: FONT.head,
              fontSize: 13,
              color: "#111",
              flexShrink: 0,
              overflow: "hidden",
            }}
```

- [ ] **Step 6: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/dashboard`, open the org switcher dropdown, and confirm: nav labels are no longer all-caps mono, the org switcher/plan pill/avatar all show hairline borders and soft shadow, and switching organizations still works (click through at least one switch or the "Create workspace" item to confirm the dropdown's functional wiring is untouched).

- [ ] **Step 7: Commit**

```bash
git add apps/main/src/components/layout/AppSidebar.tsx
git commit -m "style(main): re-skin AppSidebar chrome, drop forced uppercase nav labels"
```

---

### Task 9: Re-skin the dashboard error banner

**Files:**
- Modify: `apps/main/src/app/(dashboard)/dashboard/page.tsx:121-145`

**Interfaces:**
- Consumes: `--vq-line-2` (Task 1), `Button` variant `"outline"` (already exists, untouched by Task 3).

- [ ] **Step 1: Replace the loud error banner with a calm alert row**

Replace:

```tsx
      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border-[3px] border-foreground bg-card p-4 shadow-[6px_6px_0_var(--destructive)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-widest text-destructive">
              dashboard data unavailable
            </div>
            <p className="m-0 mt-1 font-body text-sm leading-snug text-muted-foreground">
              We could not refresh your dashboard summary. Your workspace is still available.
            </p>
          </div>
          <Button
            type="button"
            variant="brand-dark"
            size="brand-sm"
            onClick={() => refetch()}
            className="self-start sm:self-auto"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}
```

with:

```tsx
      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-destructive">
              Dashboard data unavailable
            </div>
            <p className="m-0 mt-1 font-body text-sm leading-snug text-muted-foreground">
              We could not refresh your dashboard summary. Your workspace is still available.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="self-start sm:self-auto"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}
```

This changes the `Button`'s `variant`/`size` prop *values* (from `brand-dark`/`brand-sm` to `outline`/`sm`, both of which already exist and are untouched by this plan) — the `onClick={() => refetch()}` handler and all data logic are byte-for-byte unchanged.

- [ ] **Step 2: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

The error state only renders when `useDashboardSummary` errors — temporarily force it (e.g. via devtools network throttling/blocking the summary request, or by temporarily setting `isError` in a local override while checking, then reverting) to confirm the calmer banner renders and the Retry button still calls `refetch()` (watch the network tab for a re-fetch on click). Revert any temporary debugging change before committing.

- [ ] **Step 3: Commit**

```bash
git add "apps/main/src/app/(dashboard)/dashboard/page.tsx"
git commit -m "style(main): calm down the dashboard fetch-error banner"
```

---

### Task 10: Re-skin OnboardingHeader, Progress, StepShell, and Chip

**Files:**
- Modify: `apps/main/src/app/(onboarding)/onboarding/layout.tsx`
- Modify: `apps/main/src/app/(onboarding)/onboarding/_lib/step-shell.tsx`
- Modify: `apps/main/src/app/(onboarding)/onboarding/_lib/chip.tsx`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow`, `--vq-shadow-sm`, `--vq-r-lg`, `--vq-r-xl` (Task 1).

- [ ] **Step 1: Re-skin OnboardingHeader's pills (layout.tsx)**

In `apps/main/src/app/(onboarding)/onboarding/layout.tsx`, replace the `<nav>`'s className:

```tsx
    <nav className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-foreground bg-background px-5 py-4 sm:px-8 sm:py-5">
```

with:

```tsx
    <nav className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vq-line-2)] bg-background px-5 py-4 sm:px-8 sm:py-5">
```

Replace the profile button's className:

```tsx
          className="flex max-w-[180px] items-center gap-2 rounded-full border-2 border-foreground bg-white px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-foreground shadow-[2px_2px_0_#111] sm:max-w-[240px]"
```

with:

```tsx
          className="flex max-w-[180px] items-center gap-2 rounded-full border border-[var(--vq-line-2)] bg-white px-3 py-2 text-left text-[13px] text-foreground shadow-[var(--vq-shadow-sm)] sm:max-w-[240px]"
```

Replace the logout button's className:

```tsx
          className="flex items-center gap-2 rounded-full border-2 border-foreground bg-destructive px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground shadow-[2px_2px_0_#111] transition-transform active:translate-x-0.5 active:translate-y-0.5"
```

with:

```tsx
          className="flex items-center gap-2 rounded-full border border-[var(--vq-line-2)] bg-destructive px-3 py-2 text-[13px] text-foreground shadow-[var(--vq-shadow-sm)]"
```

Replace the "Step X / Y" pill's className:

```tsx
        <div className="rounded-full border-2 border-foreground bg-secondary px-3.5 py-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
```

with:

```tsx
        <div className="rounded-full border border-[var(--vq-line-2)] bg-secondary px-3.5 py-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
```

(mono/uppercase stays here — this is exactly the small-metadata-label case landing's own `.vq-eyebrow` convention keeps mono for.)

- [ ] **Step 2: Re-skin the progress bar segments**

Replace:

```tsx
              "h-2.5 flex-1 rounded-full border-2 border-foreground transition-colors duration-200",
```

with:

```tsx
              "h-2.5 flex-1 rounded-full border border-[var(--vq-line-2)] transition-colors duration-200",
```

- [ ] **Step 3: Remove the floating rotated Sticker decorations**

Delete these two blocks entirely from the `<form>` in `layout.tsx`:

```tsx
          <div className="absolute left-[6%] top-40 z-0">
            <Sticker rotate={-14} tone="yellow">
              briefing in progress
            </Sticker>
          </div>
          <div className="absolute right-[6%] top-56 z-0">
            <Sticker rotate={10} tone="red">
              auto-saved ✦
            </Sticker>
          </div>
```

These were purely decorative floating elements (not conveying unique information — "auto-saved" duplicates what the draft-persistence effect already does silently) and their heavy rotation + emoji is exactly the brutalist-playful tone that now clashes with landing's B2B register.

Change the remaining `<Sticker rotate={-4} tone="green">Step {stepIndex} of {TOTAL_STEPS}</Sticker>` (this one carries real information, so it stays) to drop its rotation, since it's no longer sharing the page with other rotated elements and a de-rotated pill reads calmer:

```tsx
                <Sticker tone="green">
                  Step {stepIndex} of {TOTAL_STEPS}
                </Sticker>
```

(Omitting `rotate` uses the component's default of `-4`. To render it fully flat, pass `rotate={0}` explicitly instead.) Use `rotate={0}`:

```tsx
                <Sticker rotate={0} tone="green">
                  Step {stepIndex} of {TOTAL_STEPS}
                </Sticker>
```

- [ ] **Step 4: Re-skin StepShell**

In `apps/main/src/app/(onboarding)/onboarding/_lib/step-shell.tsx`, replace:

```tsx
      className="mx-auto max-w-2xl rounded-2xl border-[3px] border-foreground p-10 shadow-[10px_10px_0_var(--foreground)]"
```

with:

```tsx
      className="mx-auto max-w-2xl rounded-[var(--vq-r-xl)] border border-[var(--vq-line-2)] p-10 shadow-[var(--vq-shadow-lg)]"
```

Replace the emoji badge's className:

```tsx
          <div className="grid size-12 -rotate-6 place-items-center rounded-xl border-[3px] border-foreground bg-[color:var(--vq-yellow)] font-display text-2xl shadow-[3px_3px_0_var(--foreground)]">
```

with:

```tsx
          <div className="grid size-12 place-items-center rounded-xl border border-[var(--vq-line-2)] bg-[color:var(--vq-yellow)] font-display text-2xl shadow-[var(--vq-shadow-sm)]">
```

(dropping `-rotate-6` for the same reason as Step 3 — one less rotated element once the floating stickers are gone).

- [ ] **Step 5: Re-skin Chip**

In `apps/main/src/app/(onboarding)/onboarding/_lib/chip.tsx`, replace:

```tsx
        "cursor-pointer rounded-full border-[2.5px] border-foreground px-4 py-2.5 font-head text-[13px] uppercase tracking-wider text-foreground transition-transform",
        active
          ? "shadow-[3px_3px_0_var(--foreground)] -translate-x-px -translate-y-px"
          : "bg-white shadow-none",
```

with:

```tsx
        "cursor-pointer rounded-full border border-[var(--vq-line-2)] px-4 py-2.5 text-[13px] font-medium text-foreground transition-shadow",
        active
          ? "shadow-[var(--vq-shadow-sm)]"
          : "bg-white shadow-none",
```

- [ ] **Step 6: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Walk through `/onboarding/step1` through the final step in the dev server: confirm the header pills, progress bar, step frame, and any chip pickers (step2/step4/step5 use `Chip`) show hairline borders/soft shadows with no rotation or grain texture, and that Continue/Back navigation between steps and the final "Meet the crew" submit still work exactly as before (this exercises the untouched guard/draft-persistence logic alongside the new styling).

- [ ] **Step 7: Commit**

```bash
git add "apps/main/src/app/(onboarding)/onboarding/layout.tsx" "apps/main/src/app/(onboarding)/onboarding/_lib/step-shell.tsx" "apps/main/src/app/(onboarding)/onboarding/_lib/chip.tsx"
git commit -m "style(main): re-skin onboarding shell, retire rotated sticker decorations"
```

---

### Task 11: Normalize RunGraph's loading fallback tokens

**Files:**
- Modify: `apps/main/src/components/runs/RunPanel.tsx:26-41`

**Interfaces:**
- Consumes: `--vq-line`, `--vq-surface-2`, `--vq-ink-3` (Task 1).

- [ ] **Step 1: Replace the hardcoded literals with the real tokens**

Replace:

```tsx
    <div
      style={{
        height: 180,
        borderRadius: 12,
        border: "1px solid rgba(20,18,14,0.10)",
        background: "#F5EEE0",
        display: "grid",
        placeItems: "center",
        color: "#8B857A",
        fontSize: 13,
      }}
    >
      Drawing the plan…
    </div>
```

with:

```tsx
    <div
      style={{
        height: 180,
        borderRadius: "var(--vq-r)",
        border: "1px solid var(--vq-line)",
        background: "var(--vq-surface-2)",
        display: "grid",
        placeItems: "center",
        color: "var(--vq-ink-3)",
        fontSize: 13,
      }}
    >
      Drawing the plan…
    </div>
```

This is a normalize, not a redesign — the literal values already matched landing's palette almost exactly (main's ink is `#111` vs. landing's `#14120E`, so the rgba/hex literals here were copied from landing verbatim rather than adapted); pointing them at main's own tokens keeps them in sync with any future token tweak instead of drifting again.

- [ ] **Step 2: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Open an assistant run that's mid-planning (or trigger a new one) so `RunGraph`'s dynamic import is loading, and confirm the "Drawing the plan…" placeholder still renders with the same look as before (this is a like-for-like token swap, so it should be visually identical, not different).

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/components/runs/RunPanel.tsx
git commit -m "style(main): point RunGraph's loading fallback at real tokens instead of hardcoded literals"
```

---

### Task 12: Verify chat/assistants/runs surfaces

**Files:** none modified — verification only.

- [ ] **Step 1: Click through the run-approval flow**

Start an agent run through to at least one `AWAITING_PLAN_APPROVAL` or `AWAITING_ACTION_APPROVAL` state (via `/assistants` or `/tasks`, whichever currently has an active or replayable run available in the dev environment). Confirm `RunPanel`'s buttons (approve/reject/cancel, routed through the shared `Button` primitive re-skinned in Task 3) render with soft shadows/hairline borders and that clicking Approve/Reject/Cancel still calls through to `useApproveRun`/`useRejectRun`/`useCancelRun` correctly (watch the network tab, not just the visual).

- [ ] **Step 2: Note any remaining brutalist spot**

If anything in this area still shows a thick border or hard offset shadow that Tasks 1–11 didn't already cover, note the exact file and className for a follow-up — do not fix it ad hoc here, since this task is verification-only and any further edit belongs in a task of its own (per the "no placeholders / no silent scope creep" rule, do not expand this task's diff).

- [ ] **Step 3: Commit**

Nothing to commit if no code changed. If Step 2 surfaced a fix and you (the executor) added one, commit it separately with a message describing exactly what was found and fixed, and flag it in your task report — don't fold an unplanned fix silently into this "verification" task.

---

### Task 13: Re-skin SettingsNav

**Files:**
- Modify: `apps/main/src/components/settings/SettingsNav.tsx`

**Interfaces:**
- Consumes: `--vq-line`, `--vq-line-2`, `--vq-shadow-sm` (Task 1).
- Produces: no change to `SETTINGS_NAV`'s data shape or `SettingsNav`'s exported signature (zero props).

- [ ] **Step 1: Re-skin the nav container**

Replace:

```tsx
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        borderBottom: "3px solid #111",
        paddingBottom: 14,
      }}
```

with:

```tsx
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid var(--vq-line)",
        paddingBottom: 14,
      }}
```

- [ ] **Step 2: Re-skin the nav pills**

Replace:

```tsx
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: "2.5px solid #111",
              background: active ? color : "#FFF9ED",
              boxShadow: active ? "3px 3px 0 #111" : "none",
              color: "#111",
              textDecoration: "none",
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
```

with:

```tsx
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid var(--vq-line-2)",
              background: active ? color : "#FFF9ED",
              boxShadow: active ? "var(--vq-shadow-sm)" : "none",
              color: "#111",
              textDecoration: "none",
              fontFamily: FONT.body,
              fontSize: 13,
              fontWeight: 500,
              transition: "box-shadow 120ms ease",
            }}
```

(dropping the forced mono/uppercase for the same reason as the sidebar nav in Task 8 — this is primary settings navigation, not an eyebrow label).

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/settings`, click through Profile/Integrations/Billing/Usage tabs, confirm the active tab still highlights correctly (with a soft shadow instead of a hard one) and that navigation between tabs still works.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/settings/SettingsNav.tsx
git commit -m "style(main): re-skin SettingsNav as a standard tab bar"
```

---

### Task 14: Re-skin billing card avatars

**Files:**
- Modify: `apps/main/src/components/billing/AgentEntitlementRow.tsx:28`
- Modify: `apps/main/src/components/billing/AgentBuyCard.tsx:53`

**Interfaces:**
- Consumes: `--vq-line-2` (Task 1). `Card variant="brand"` in both files already picks up Task 4's re-skin automatically — no edit needed to the `<Card>` usage itself.

- [ ] **Step 1: Soften the avatar border in AgentEntitlementRow**

Replace `className="relative size-10 overflow-hidden rounded-full border-2 border-foreground bg-muted"` with `className="relative size-10 overflow-hidden rounded-full border border-[var(--vq-line-2)] bg-muted"`.

- [ ] **Step 2: Soften the avatar border in AgentBuyCard**

Replace `className="relative size-12 overflow-hidden rounded-full border-2 border-foreground bg-muted"` with `className="relative size-12 overflow-hidden rounded-full border border-[var(--vq-line-2)] bg-muted"`.

- [ ] **Step 3: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/settings/billing`. Confirm every agent card (both entitled-agent rows and buyable-agent cards) shows the Task 4 Card re-skin (hairline border, soft shadow) plus a hairline avatar ring instead of a solid 2px one, and that the "Buy" button still calls `createCheckout` correctly (click through at least once in a test/staging billing environment, or confirm via network tab that the request fires — do not complete a real charge).

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/components/billing/AgentEntitlementRow.tsx apps/main/src/components/billing/AgentBuyCard.tsx
git commit -m "style(main): soften billing card avatar borders to match new hairline system"
```

---

### Task 15: Re-skin AuthShell, LoginForm, and OAuthButtons

**Files:**
- Modify: `apps/main/src/components/auth-shell.tsx`
- Modify: `apps/main/src/components/forms/auth/loginForm.tsx`
- Modify: `apps/main/src/components/oauth-buttons.tsx`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow`, `--vq-shadow-sm` (Task 1).
- Produces: no change to any exported component's props.

- [ ] **Step 1: Re-skin AuthShell's BrandLogo mark**

In `apps/main/src/components/auth-shell.tsx`, replace the `BrandLogo` mark's className:

```tsx
      <span className="grid size-[50px] shrink-0 rotate-[-6deg] place-items-center rounded-[12px] bg-foreground shadow-[4px_4px_0_var(--vq-yellow)]">
```

with:

```tsx
      <span className="grid size-[50px] shrink-0 place-items-center rounded-[12px] bg-foreground shadow-[var(--vq-shadow)]">
```

(dropping the rotation, same rationale as the onboarding stickers — a single de-rotated mark reads calmer next to landing's B2B register).

- [ ] **Step 2: Re-skin MobileAgentChips**

Replace:

```tsx
          className="border-[3px] border-foreground bg-card px-3 py-2 shadow-[3px_3px_0_var(--foreground)]"
```

with:

```tsx
          className="border border-[var(--vq-line-2)] bg-card px-3 py-2 shadow-[var(--vq-shadow-sm)]"
```

- [ ] **Step 3: Re-skin the ShowcasePane divider border**

Replace:

```tsx
        "hidden h-full items-stretch overflow-hidden border-foreground lg:flex",
        side === "left" ? "lg:border-r-[3px]" : "lg:border-l-[3px]"
```

with:

```tsx
        "hidden h-full items-stretch overflow-hidden border-[var(--vq-line-2)] lg:flex",
        side === "left" ? "lg:border-r" : "lg:border-l"
```

- [ ] **Step 4: Re-skin LoginForm's inline error alert**

In `apps/main/src/components/forms/auth/loginForm.tsx`, replace:

```tsx
            className="rounded-md border-[3px] border-foreground bg-destructive/15 px-3.5 py-2.5 font-mono text-xs text-foreground shadow-[3px_3px_0_var(--destructive)]"
```

with:

```tsx
            className="rounded-md border border-[var(--vq-line-2)] bg-destructive/15 px-3.5 py-2.5 text-xs text-foreground"
```

(dropping the mono font on the error text — this is a sentence, not a label — and the hard shadow; a hairline border plus the existing destructive tint is enough to read as an error).

- [ ] **Step 5: Re-skin the "remember me" checkbox**

Replace:

```tsx
                  className="peer size-5 cursor-pointer appearance-none border-2 border-foreground bg-card transition-colors checked:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
```

with:

```tsx
                  className="peer size-5 cursor-pointer appearance-none rounded-sm border border-[var(--vq-line-2)] bg-card transition-colors checked:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 6: Re-skin the dashed "or" divider**

Replace both occurrences of `"h-0 flex-1 border-t-2 border-dashed border-foreground/40"` with `"h-0 flex-1 border-t border-dashed border-[var(--vq-line-2)]"`.

- [ ] **Step 7: Re-skin OAuthButtons' hard shadow**

In `apps/main/src/components/oauth-buttons.tsx`, replace:

```tsx
      className="min-h-12 w-full whitespace-normal text-center leading-tight shadow-[5px_5px_0_var(--foreground)] active:not-aria-[haspopup]:shadow-[3px_3px_0_var(--foreground)] sm:whitespace-nowrap"
```

with:

```tsx
      className="min-h-12 w-full whitespace-normal text-center leading-tight sm:whitespace-nowrap"
```

(the `brand-ghost` `Button` variant re-skinned in Task 3 already supplies the correct border/shadow — this call site's own shadow overrides are no longer needed and would otherwise fight the primitive's new soft shadow).

Leave every `font-mono uppercase tracking-wider` label in these three files (the "Forgot?" link, the "Sign up" link, the checkbox label) exactly as-is — those are short label-style strings, consistent with landing's eyebrow convention, not the primary-content uppercase-everywhere problem Task 8/13 fixed on nav.

- [ ] **Step 8: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/login`: confirm the brand mark, mobile agent chips (narrow the viewport to see them), showcase divider, and the Google OAuth button all show hairline borders/soft shadows with no rotation. Force the error alert (submit with a wrong password against a real or test account) and confirm it still displays the server's error message. Submit valid credentials and confirm login still redirects to `/dashboard` — this exercises `authClient.signIn.email` end to end, unchanged by this task.

- [ ] **Step 9: Commit**

```bash
git add apps/main/src/components/auth-shell.tsx apps/main/src/components/forms/auth/loginForm.tsx apps/main/src/components/oauth-buttons.tsx
git commit -m "style(main): re-skin auth shell, login form, and OAuth button chrome"
```

---

### Task 16: Re-skin LoginBg's agent showcase panel

**Files:**
- Modify: `apps/main/src/components/login-bg.tsx`

**Interfaces:**
- Consumes: `--vq-line-2`, `--vq-shadow`, `--vq-shadow-lg`, `--vq-shadow-sm` (Task 1).
- Produces: no change to `LoginBg`'s props (it takes none) or its rotation/interval behavior.

This file is the desktop login screen's right-hand showcase panel — a dense card carousel introducing each AI agent. It carries the heaviest concentration of the old brutalist treatment in the whole app (repeated 2-3px borders, hard offset shadows, and a couple of rotated badges), but none of it is interactive beyond the carousel buttons, so this is a mechanical chrome pass.

- [ ] **Step 1: De-rotate the two badges**

Replace `"inline-flex rotate-[-2deg] items-center gap-2 border-[3px] border-foreground bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] shadow-[4px_4px_0_var(--foreground)]"` with `"inline-flex items-center gap-2 border border-[var(--vq-line-2)] bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] shadow-[var(--vq-shadow)]"`.

Replace `"rotate-2 border-[3px] border-foreground px-3 py-1 font-head text-xs uppercase tracking-wider shadow-[3px_3px_0_var(--foreground)]"` with `"border border-[var(--vq-line-2)] px-3 py-1 font-head text-xs uppercase tracking-wider shadow-[var(--vq-shadow-sm)]"`.

- [ ] **Step 2: Remove the two fake-hard-shadow offset layers**

These two `aria-hidden` sibling `<div>`s exist only to simulate a hard drop-shadow by duplicating the card's silhouette one layer behind it, offset by a few pixels — exactly the technique the new soft-elevation system replaces with a real `box-shadow`. Delete both:

```tsx
            <div
              className="absolute -left-4 top-5 h-full w-full border-[3px] border-foreground opacity-95"
              style={{ backgroundColor: agent.accent }}
              aria-hidden
            />
```

and:

```tsx
                  <div
                    className="absolute -right-3 top-4 h-full w-full border-[3px] border-foreground bg-background"
                    aria-hidden
                  />
```

- [ ] **Step 3: Re-skin the main agent card and portrait frame**

Replace `"relative grid min-h-[420px] grid-cols-[minmax(190px,245px)_minmax(0,1fr)] gap-5 border-[3px] border-foreground bg-card p-5 shadow-[8px_8px_0_var(--foreground)] xl:min-h-[440px] xl:grid-cols-[265px_minmax(0,1fr)]"` with `"relative grid min-h-[420px] grid-cols-[minmax(190px,245px)_minmax(0,1fr)] gap-5 rounded-[var(--vq-r-lg)] border border-[var(--vq-line-2)] bg-card p-5 shadow-[var(--vq-shadow-lg)] xl:min-h-[440px] xl:grid-cols-[265px_minmax(0,1fr)]"` (this now also carries the depth the two deleted offset layers used to provide, plus a soft corner radius the old sharp-cornered card didn't have).

Replace `"relative overflow-hidden border-[3px] border-foreground bg-background shadow-[5px_5px_0_var(--foreground)]"` (the portrait frame) with `"relative overflow-hidden rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-background shadow-[var(--vq-shadow)]"`.

Replace `"absolute bottom-3 left-3 border-[3px] border-foreground px-3 py-1 font-head text-xs uppercase tracking-wider shadow-[3px_3px_0_var(--foreground)]"` (the name tag on the portrait) with `"absolute bottom-3 left-3 rounded-[var(--vq-r-sm)] border border-[var(--vq-line-2)] px-3 py-1 font-head text-xs uppercase tracking-wider shadow-[var(--vq-shadow-sm)]"`.

- [ ] **Step 4: Re-skin the three info panels ("What I handle", "My tasks", "Saves you")**

Replace both occurrences of `"border-[3px] border-foreground bg-background px-4 py-3 shadow-[4px_4px_0_var(--foreground)]"` with `"rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-background px-4 py-3 shadow-[var(--vq-shadow)]"`.

Replace `"mb-3 inline-flex border-2 border-foreground bg-card px-2.5 py-1 font-mono text-[9px] uppercase leading-none tracking-[0.22em] text-foreground/75"` with `"mb-3 inline-flex rounded-full border border-[var(--vq-line-2)] bg-card px-2.5 py-1 font-mono text-[9px] uppercase leading-none tracking-[0.22em] text-foreground/75"`.

Replace `"mt-4 border-t-2 border-dashed border-foreground/25 pt-3 font-body text-[14px] leading-[1.45] text-foreground/70 xl:text-[15px]"` with `"mt-4 border-t border-dashed border-[var(--vq-line-2)] pt-3 font-body text-[14px] leading-[1.45] text-foreground/70 xl:text-[15px]"`.

Replace `"border-[3px] border-foreground p-3 shadow-[4px_4px_0_var(--foreground)]"` (the "Saves you" tile) with `"rounded-[var(--vq-r)] border border-[var(--vq-line-2)] p-3 shadow-[var(--vq-shadow)]"`.

- [ ] **Step 5: Re-skin the carousel strip and its buttons**

Replace `"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-[3px] border-foreground bg-card px-4 py-3 shadow-[4px_4px_0_var(--foreground)]"` with `"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-card px-4 py-3 shadow-[var(--vq-shadow)]"`.

Replace:

```tsx
                  "group grid min-w-0 gap-1 border-2 border-foreground bg-background px-2 py-1 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                  index === active && "translate-y-[-4px] shadow-[3px_3px_0_var(--foreground)]"
```

with:

```tsx
                  "group grid min-w-0 gap-1 rounded-[var(--vq-r-sm)] border border-[var(--vq-line-2)] bg-background px-2 py-1 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                  index === active && "shadow-[var(--vq-shadow-sm)]"
```

(dropping the `hover:-translate-y-0.5`/`translate-y-[-4px]` lift-on-hover-and-active, since that motion was designed to read against a hard shadow; a soft shadow alone is enough to signal the active tile).

Replace `"grid size-6 place-items-center border-2 border-foreground font-head text-[10px] uppercase"` with `"grid size-6 place-items-center rounded-full border border-[var(--vq-line-2)] font-head text-[10px] uppercase"`.

- [ ] **Step 6: Verify**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` — must exit 0.

Load `/login` at a viewport wide enough to show the showcase panel (`lg` breakpoint and up). Confirm: no rotated badges, no doubled offset-rectangle shadow effect, all cards/tiles show hairline borders with soft shadows and rounded corners. Click through a few of the six carousel buttons and confirm the active-agent swap (image, copy, accent color) still works, and that the auto-rotate (every 3s) still runs and still respects `prefers-reduced-motion`.

- [ ] **Step 7: Commit**

```bash
git add apps/main/src/components/login-bg.tsx
git commit -m "style(main): re-skin the login showcase panel, drop the fake hard-shadow layers"
```

---

### Task 17: Full cross-phase verification pass

**Files:** none modified — verification only.

- [ ] **Step 1: Type-check and lint the whole app**

Run `pnpm check-types` and `pnpm lint` from `apps/main/` one more time after all 16 prior tasks — both must exit 0.

- [ ] **Step 2: Click through every area touched by this plan**

In the dev server, walk: `/login` and `/signup` (including the showcase panel and OAuth button) → `/dashboard` (including forcing the error banner once more, and the org switcher) → full onboarding flow step1 through finish → an assistant run through an approval step → `/settings`, `/settings/billing`, `/settings/integrations`, `/settings/usage`. For each, confirm (a) it visually matches the hairline-border/soft-shadow/Inter-Tight-and-Inter system now, and (b) every interactive element (forms submit, dialogs open/close, dropdowns switch state, buttons trigger their handlers) behaves exactly as it did before this plan — this is the final gate on the "don't break any working logic" constraint.

- [ ] **Step 3: Sweep for any remaining hardcoded brutalist literal**

Run:

```bash
grep -rn "border-\[3px\]\|border-\[2px\]\|border-2 border-foreground\|shadow-\[[0-9]*px_[0-9]*px_0" apps/main/src --include="*.tsx"
```

Anything this turns up is outside the four areas this plan covered (e.g. `components/agents/maya/cards.tsx`, `components/agents/lex/cards.tsx`, `components/dashboard/*` beyond the error banner, `app/(auth)/verify/page.tsx`, `app/(auth)/reset-password/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/workspaces/page.tsx`) — these are pages/components this plan's audit didn't reach (the audit covered login specifically, not every `(auth)` route, and covered the dashboard/settings/onboarding/chat surfaces read during planning, not every agent-card component). Report the list to the user as a candidate follow-up plan rather than fixing them here — this task is a sweep-and-report, not a new implementation task.

- [ ] **Step 4: Report**

Summarize for the user: which of the grep hits from Step 3 look like genuine remaining brutalist styling in the four target areas (should have been caught — flag as a gap in this plan) versus areas the plan explicitly didn't cover (auth forms, agent cards, etc. — candidates for a follow-up phase, not a mistake).
