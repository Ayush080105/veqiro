# Veqiro — Landing → Main Theme Migration & Landing Production Prep

## Context

The monorepo has two in-scope apps:

- `apps/landing` — currently a **hybrid**: a beautiful static marketing page at `/` PLUS dynamic routes (`/onboarding`, `/dashboard`, `/(auth)/*`) that were built there as rapid prototypes. It carries the **finalised visual theme** for the whole product: cream (`#EFE7D6`) background, 3px black borders, hard offset shadows, playful display fonts (Bagel Fat One / Archivo Black), six per‑agent colours, rotated "sticker" accents.
- `apps/main` — the real product shell: Next.js 16 + better‑auth + shadcn/ui + 6 AI agents with backend‑wired chat (`/assistants/[id]`), brand kit (`/brain`), settings, workspace pages. It currently uses a **clean minimal olive/shadcn theme** — none of the Veqiro character.

The problem this plan solves:

1. **Landing is not production‑ready.** It ships auth/onboarding/chat — work that must live only in `main`. It must be reduced to pure marketing before deploy.
2. **Main has no visual identity yet.** It must inherit the landing theme end‑to‑end so the product feels like the brand the landing page promises.
3. **Dynamic flows prototyped in landing** (onboarding wizard, chat UI, auth forms) need to be ported into main and wired to real backends (better‑auth, brand‑kit API, real agent chat), replacing main's current shadcn‑style versions.

**Out of scope**: `apps/ai`, `apps/server` (other teammates).

Both apps run on **Next.js 16** (new file/API conventions per `apps/*/AGENTS.md`). Don't assume old Next.js behaviour — consult `node_modules/next/dist/docs/` when a detail matters.

---

## Goals

**A. Production‑ready landing.** `apps/landing` becomes a static marketing site only. No auth, no onboarding, no dashboard, no better‑auth client. Links point out to `main`.

**B. Full theme adoption in main.** The Veqiro visual system (colors, fonts, borders, shadows, stickers, character avatars) becomes main's native aesthetic, applied consistently across every page.

**C. Port dynamic prototypes from landing into main.** Onboarding, chat UI treatment, and the brand‑kit profile modal all move to main. The localStorage mock in landing is replaced by main's real backend APIs (`lib/api/brain.ts` etc.).

**D. Theme any remaining unthemed pages/components in main.** Every route that currently renders shadcn defaults gets re‑skinned with the Veqiro system. Any unfinished pages/blocks get completed in the new theme.

**E. Cross‑app linking.** Landing CTAs (Hire them now, Start free, Login) navigate to the correct pages in `main`.

---

## Current state (verified)

### Landing — to trim

Routes:
- `/` — **KEEP (static)** — `src/app/page.tsx` orchestrates Hero, Marquee, CrewSection, DeskPanel, HowItWorks, Pricing, FAQ, FinalCTA, Footer.
- `/onboarding` — **REMOVE** — 6‑step wizard, `useState` + localStorage. Move to main.
- `/dashboard` — **REMOVE** — mocked chat UI; inspiration for main's real chat.
- `/(auth)/{login,signup,forgot-password,reset-password,verify}` — **REMOVE** — already duplicated in main.

Files that support the dynamic pages (to delete after migration):
- `src/components/forms/auth/*`
- `src/components/oauth-buttons.tsx`, `src/components/login-bg.tsx`, `src/components/logo.tsx` (if only used in auth)
- `src/lib/auth-client.ts`
- `src/models/auth/*`
- `src/components/ui/*` (shadcn primitives — only used by auth forms; confirm before delete)

Package deps to remove from `apps/landing/package.json`:
- `better-auth`, `@hookform/resolvers`, `react-hook-form`, `zod`, `sonner`, `@base-ui/react`, `class-variance-authority`, `@repo/transactional`

Files to **keep and polish** for production:
- `src/app/page.tsx` — landing
- `src/app/globals.css` — theme + keyframes + noise/desk/stats grids
- `src/app/layout.tsx` — font loaders (trim to only fonts actually used on the landing page)
- `src/components/veqiro/*` — hero, crew, sections, characters, data, shared — the design system source of truth

Still needed to ship landing:
- Proper metadata / OG tags / favicon
- `next.config.ts` (currently empty) — image/remote patterns if any, turbopack config if relevant under Next 16
- `robots.txt`, `sitemap.ts`
- Env var for main's URL: `NEXT_PUBLIC_MAIN_APP_URL`
- Replace NavBar's internal `/onboarding` `/dashboard` links with external links to `${MAIN_APP_URL}/login`, `${MAIN_APP_URL}/signup`

### Main — to restyle end‑to‑end

Already solid:
- Full auth (better‑auth + Google OAuth): `/(auth)/{login,signup,forgot-password,reset-password,verify}`
- Dashboard shell: `(dashboard)/layout.tsx` with `components/layout/AppSidebar.tsx`
- Agents: `/assistants` list + `/assistants/[id]` chat; per‑agent cards/forms in `components/agents/{maya,rex,scout,sage,lex,vega}/`
- Brain/brand kit: `/brain` + `components/brain/*`
- Settings: 5 subpages under `/settings`
- Workspace: `/workspace/{briefing,content,leads}`
- API layer: `lib/api/{assistants,brain,briefing,content,leads,org}.ts`

Missing:
- `/onboarding` route
- Veqiro theme variables, fonts, design primitives
- Theme character avatars (SVG)
- Any landing‑style chat treatment on `/assistants/[id]`
- Per‑agent colour mapping (currently uses `chart-1..5` shadcn tokens; should be the 6 Veqiro brand colours)

`globals.css` in both apps has an identical shadcn/oklch token block — so we only need to **add** the Veqiro system into main, not replace anything core.

---

## Target architecture

```
apps/landing (marketing only, static)
 ├── src/app/
 │   ├── page.tsx                 ← hero, marquee, crew, desk demo, pricing, faq, cta, footer
 │   ├── layout.tsx               ← fonts used by landing only
 │   └── globals.css              ← Veqiro theme (source of truth lives here)
 ├── src/components/veqiro/*      ← design system + characters
 └── public/                      ← static assets, OG images, favicon

apps/main (full product, Veqiro‑skinned)
 ├── src/app/
 │   ├── (auth)/                  ← login, signup, forgot, reset, verify  (restyled)
 │   ├── (onboarding)/            ← NEW: 6‑step wizard, session‑gated
 │   │   └── onboarding/page.tsx
 │   └── (dashboard)/             ← dashboard, assistants, brain, settings, workspace (restyled)
 ├── src/components/
 │   ├── veqiro/                  ← COPIED from landing: shared.tsx, characters.tsx, data.ts
 │   ├── layout/AppSidebar.tsx    ← restyled in Veqiro
 │   ├── chat/*                   ← restyled as Veqiro chat bubbles
 │   └── ui/*                     ← shadcn — kept but visually tuned via CSS vars
 └── src/app/globals.css          ← shadcn tokens + Veqiro tokens + keyframes
```

Principle: **landing is the theme source; main consumes it.** The design system (`components/veqiro/shared.tsx` + `characters.tsx` + `data.ts` + the CSS variables) is duplicated into main today. A later refactor can extract it to `packages/ui` if we want a single source of truth, but that's not required for this plan.

---

## Phased work plan

### Phase 0 — Pre‑flight (30 min)

0.1. Lock decisions on the Open Questions section below (with user).
0.2. Decide port/URL for each app in dev (proposed: landing on `3000`, main on `3001`). Add `.env.local` entries:
   - `apps/landing/.env.local` → `NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3001`
   - `apps/main/.env.local` → `NEXT_PUBLIC_LANDING_URL=http://localhost:3000`
0.3. Create a scratch `THEME_MIGRATION_PLAN.md` at repo root (post plan approval) so the plan is visible in the project.

### Phase 1 — Theme transplant into main (the foundation)

Goal: from this phase on, anything we build in main can use Veqiro primitives.

1.1. **Extend `apps/main/src/app/globals.css`** with (copy verbatim from landing):
   - `:root { --vq-bg … --vq-blue … }` Veqiro palette block
   - `@keyframes marquee`, `@keyframes bounce`, `@keyframes pop`
   - `.noise-overlay`, `.desk-grid`, `.stats-grid` utility classes
   - (Optional, pending decision Q1) override the shadcn `--background`, `--foreground`, `--primary`, `--card`, `--border` OKLCH values with Veqiro equivalents so every shadcn component inherits the cream/ink palette automatically

1.2. **Extend `apps/main/src/app/layout.tsx` fonts**: add `Bagel_Fat_One`, `Archivo_Black`, `Space_Grotesk` alongside existing Geist/Lora/JetBrains. Apply variables on `<html>`. Update `metadata.title/description` to Veqiro branding.

1.3. **Copy design primitives** from landing into main:
   - `apps/landing/src/components/veqiro/shared.tsx` → `apps/main/src/components/veqiro/shared.tsx` (FONT, Button, FieldLabel, VqInput, VqTextarea, Sticker; **omit** NavBar — main has its own sidebar).
   - `apps/landing/src/components/veqiro/characters.tsx` → same path in main (6 SVG avatars).
   - `apps/landing/src/components/veqiro/data.ts` → same path in main, BUT **reconcile** with `apps/main/src/lib/config/agents.ts`. Final shape: one merged module exporting `AGENTS` with `{id, name, role, color, ink, tag, quote, stats, skills, llm, personality, specialties, initials}`. Update consumers.

1.4. **Per‑agent colour mapping.** Replace the `chart-1..5 / primary` token mapping in `lib/config/agents.ts` with the Veqiro palette:
   - maya → `var(--vq-red)` / ink `#7A1717`
   - rex → `var(--vq-green)` / ink `#0E5C3F`
   - scout → `var(--vq-yellow)` / ink `#7A5A00`
   - sage → `var(--vq-pink)` / ink `#8E2A6A`
   - lex → `var(--vq-violet)` / ink `#2A2A7A`
   - vega → `var(--vq-blue)` / ink `#0E5C74`

1.5. Smoke test: run `pnpm --filter main dev`, hit `/login`. Confirm the new fonts load and CSS variables are present in DevTools.

### Phase 2 — Auth pages restyle in main

Goal: login/signup/forgot/reset/verify in main get the Veqiro treatment but keep better‑auth logic intact.

2.1. **Restyle `components/forms/auth/loginForm.tsx` and `registerForm.tsx`** in main to use `VqInput`, `FieldLabel`, `Button` from `@/components/veqiro/shared`. Keep `react-hook-form` + `zod` wiring exactly as is. Keep OAuth button; restyle shell (cream card, 3px border, hard shadow).

2.2. **Restyle pages** `(auth)/login/page.tsx`, `(auth)/signup/page.tsx`, etc. — cream page background, decorative `Sticker` accents, the login‑bg illustration reworked to match Veqiro.

2.3. **Port/replace `login-bg.tsx` and `logo.tsx`** in main to the Veqiro aesthetic (rotated `v` in a black tile with a yellow offset shadow, as used in landing's NavBar).

2.4. Smoke test: email+password login flow end to end; OAuth button click; forgot‑password email flow.

### Phase 3 — Onboarding port to main

Goal: landing's 6‑step wizard runs inside main, session‑gated, persisted to the real backend.

3.1. **Create route**: `apps/main/src/app/(onboarding)/layout.tsx` (minimal chrome — no sidebar) and `apps/main/src/app/(onboarding)/onboarding/page.tsx`. Route recommended: `/onboarding` (outside the `(dashboard)` group so the sidebar isn't rendered, but with a session guard that redirects to `/login` if unauth'd).

3.2. **Copy `apps/landing/src/app/onboarding/page.tsx`** into that file. Modifications:
   - Swap `NavBar` for a minimal onboarding header (logo + "Step N of 6" only).
   - Replace the `localStorage.setItem('veqiro.brandKit', ...)` save path with `setBrandKit()` from `@/lib/api/brain.ts`. Keep localStorage as an intermediate draft buffer so users don't lose work if they refresh mid‑flow.
   - On "Meet the crew →", call `setBrandKit(kit)`, then `router.push('/dashboard')`.
   - Pull session via `authClient.useSession()`; redirect to `/login` if none.

3.3. **Post‑signup redirect**: update `registerForm.tsx` success handler to push `/onboarding` (not `/dashboard`) if the user's brand kit is empty. Use `getBrandKit()` to decide, or a cheap `hasCompletedOnboarding` flag on the session.

3.4. Smoke test: signup → onboarding → dashboard with brand kit populated in backend; refresh mid‑flow preserves draft; re‑signin for a user who already onboarded goes straight to dashboard.

### Phase 4 — Chat UI Veqiro skin on `/assistants/[id]`

Goal: the real chat in main looks like the mock in landing. **No logic changes** — all `sendMessage` / action‑runner code stays.

4.1. Restyle `components/chat/ChatMessage.tsx`:
   - Bubble shape: user `borderRadius: '16px 16px 4px 16px'`, assistant `'16px 16px 16px 4px'`.
   - Border: `2.5px solid #111`, `boxShadow: '3px 3px 0 #111'`.
   - User bg: `#111` with cream text; assistant bg: per‑agent colour via CSS var.
   - Timestamp: JetBrains Mono, uppercase, size 9, opacity 0.6.
   - Entrance: `animation: pop 240ms`.

4.2. Restyle `components/chat/ChatInput.tsx`:
   - Input: pill shape `borderRadius: 999`, 2.5px border, white bg on cream bar.
   - Send button: dark bg, uppercase mono label, red shadow.
   - Container: `borderTop: '3px solid #111'`, cream bg.

4.3. Restyle `/assistants/[id]/page.tsx` shell:
   - Per‑agent coloured header strip (like landing dashboard) showing avatar + name + role + online dot.
   - "Context strip" beneath header: dashed border, mono "CONTEXT:" label, company + industry + voice + palette swatches (pulled from `getBrandKit()`).
   - Empty state: big avatar + display‑font "Say hi to {Name}" + quick prompts row (pull the prompt set from landing's `quickPrompts` map, stored once in `lib/config/agents.ts`).

4.4. Restyle `/assistants/page.tsx` (the agent list) with the landing CrewSection rotated card treatment.

4.5. Restyle the `ProfileModal` equivalent: landing has one in `dashboard/page.tsx`; the analog in main is any brand‑kit viewer. Port the modal look into `components/brain/BrandKitSection.tsx` or expose it from the sidebar.

4.6. Smoke test: open each agent, send a message, receive a real response. Verify the new bubble styling and that no functional regressions appear.

### Phase 5 — Everything‑else restyle in main

Apply the Veqiro system to the remaining pages. No shape changes, just visual. Pattern: black 3px borders, radius 10–16, cream section bgs, colored stickers for section headers, mono uppercase for labels, display font for H1/H2, hard offset shadows in place of soft shadows.

5.1. `components/layout/AppSidebar.tsx` — cream bg, Veqiro logo tile, `FONT.mono` for nav labels, per‑section stickers.
5.2. `(dashboard)/dashboard/page.tsx` — metric cards, status rows.
5.3. `(dashboard)/brain/*` — brand kit editor, knowledge grid/cards, completion bar, agent readiness.
5.4. `(dashboard)/settings/*` and `SettingsNav.tsx`.
5.5. `(dashboard)/workspace/{briefing,content,leads}/*`.
5.6. Dialogs/modals: `CreateOrgDialog`, `AddKnowledgeDialog`, `ActionDialog`, `RunActionDialog`, `HelpSheet`, `PlusMenu` — all get cream card + hard border + offset shadow + display‑font titles.
5.7. Shadcn primitives in `components/ui/*` — do **not** rewrite these. Either tune them via CSS variables in `globals.css` (radius, border, shadow tokens) OR create a thin `components/veqiro/shadcn-overrides.css` layer. Prefer CSS‑variable tuning so the shadcn components stay upstream‑compatible.

### Phase 6 — Fill gaps / finish incomplete blocks

6.1. Scan each page in main for placeholder content, "TODO" stubs, or unused components. List them. Re‑skin any unthemed bits and wire missing data to the existing `lib/api/*` methods or stub with mock data where backend is still pending.
6.2. Specifically check: billing page (Stripe placeholders?), integrations page, members page invites flow, scout's competitor view, content scheduling modal, briefing generator. If the UI exists without Veqiro skinning, skin it. If a block is missing entirely but referenced elsewhere, implement a minimal version.
6.3. Notifications / toast wrapper (`sonner.tsx`) — make sure toast colours match Veqiro (cream card, black border, shadow).

### Phase 7 — Landing cleanup & production prep

Now that everything dynamic is living in main, strip landing.

7.1. **Delete routes**: `apps/landing/src/app/{onboarding,dashboard}` and `apps/landing/src/app/(auth)/`.
7.2. **Delete files**: `src/components/forms/auth/`, `src/components/oauth-buttons.tsx`, `src/components/login-bg.tsx`, `src/components/logo.tsx` (if unused after auth removal), `src/lib/auth-client.ts`, `src/models/auth/`, `src/components/ui/*` (confirm no landing page imports first — `components/veqiro/*` has its own primitives, so `ui/*` is likely unused post‑auth).
7.3. **Update `apps/landing/src/components/veqiro/shared.tsx::NavBar`**:
   - Drop the `onboarding`/`dashboard` internal links.
   - Add "Login" (outline) and "Start free" (primary) buttons linking to `${NEXT_PUBLIC_MAIN_APP_URL}/login` and `/signup`.
   - Keep sticky behavior.
4. **Update `apps/landing/src/app/page.tsx` CTAs** (in `FinalCTA`, Hero buttons, Pricing tier buttons) to link to main's `/signup` (or `/login` depending on CTA intent).
7.5. **Trim `apps/landing/package.json`** — remove deps listed in Phase 0 mapping. Run `pnpm install` at repo root.
7.6. **Trim `apps/landing/src/app/layout.tsx`** — remove font loaders that aren't used on the public landing (keep Bagel Fat One, Archivo Black, Space Grotesk, JetBrains Mono; drop Geist/Geist Mono if unused by landing pages).
7.7. **Production SEO/meta**:
   - Populate `metadata` in `layout.tsx` with real title, description, keywords, OG image, Twitter card, canonical URL.
   - Add `public/favicon.ico`, `public/og-image.png`.
   - Add `src/app/robots.ts` and `src/app/sitemap.ts` (Next 16 convention — verify against `node_modules/next/dist/docs/`).
7.8. **`next.config.ts`** — add production hardening: `poweredByHeader: false`, image remote patterns if needed, any Next 16 specific config the docs recommend.
7.9. **Build verification**: `pnpm --filter landing build` — must succeed with zero errors, zero warnings you don't understand.

### Phase 8 — Wire landing ↔ main navigation

8.1. In landing: every CTA ("Hire them now", "Meet the crew", "Start free", Pricing tier buttons, Footer "Sign in") → `${NEXT_PUBLIC_MAIN_APP_URL}/...`. "See how it works" scrolls to the `#how-it-works` anchor on the same landing page (no cross‑app nav needed).
8.2. In main: AppSidebar footer or brand logo click → `${NEXT_PUBLIC_LANDING_URL}` (opens landing home).
8.3. Post‑logout in main: `router.push(NEXT_PUBLIC_LANDING_URL)`.

### Phase 9 — End‑to‑end verification

9.1. Run both apps in parallel (`pnpm dev` from repo root — turbo starts both). Visit `http://localhost:3000` (landing), click each CTA, confirm correct main route loads.
9.2. Signup flow: landing "Start free" → main `/signup` → submit → `/onboarding` → 6 steps → backend brand kit is set (check via network tab `POST /api/v1/brand-kit/...`) → `/dashboard`.
9.3. Chat flow: `/assistants` → pick Maya → send "Draft a launch tweet" → verify real backend response + new bubble styling.
9.4. Logout flow → back to landing.
9.5. Theme QA: every page in main renders with Veqiro tokens (no raw shadcn olive/white leaking through anywhere). Run a visual pass on each route in the route inventory in Phase 5.
9.6. `pnpm --filter landing build && pnpm --filter main build` — both produce clean prod builds.
9.7. Lint + typecheck: `pnpm lint && pnpm check-types`.

---

## Critical files (quick reference)

**Landing (source of truth for theme):**
- `D:/Projects/veqiro/apps/landing/src/app/globals.css` — Veqiro tokens + keyframes
- `D:/Projects/veqiro/apps/landing/src/app/layout.tsx` — font loaders
- `D:/Projects/veqiro/apps/landing/src/components/veqiro/shared.tsx` — primitives (FONT, Button, VqInput, VqTextarea, FieldLabel, Sticker, NavBar)
- `D:/Projects/veqiro/apps/landing/src/components/veqiro/characters.tsx` — 6 SVG avatars + gradient/grain filters
- `D:/Projects/veqiro/apps/landing/src/components/veqiro/data.ts` — `EMPLOYEES[]` with color/ink/role/tag/skills/quote/stats
- `D:/Projects/veqiro/apps/landing/src/app/page.tsx` — static landing composition (KEEP)
- `D:/Projects/veqiro/apps/landing/src/app/onboarding/page.tsx` — source of 6‑step wizard (PORT then delete)
- `D:/Projects/veqiro/apps/landing/src/app/dashboard/page.tsx` — reference for chat + sidebar + ProfileModal styling (READ then delete)

**Main (targets for edit):**
- `D:/Projects/veqiro/apps/main/src/app/globals.css` — add Veqiro tokens
- `D:/Projects/veqiro/apps/main/src/app/layout.tsx` — add fonts + metadata
- `D:/Projects/veqiro/apps/main/src/app/(auth)/**` — restyle pages
- `D:/Projects/veqiro/apps/main/src/app/(dashboard)/layout.tsx` — sidebar shell
- `D:/Projects/veqiro/apps/main/src/app/(dashboard)/assistants/[id]/page.tsx` — chat shell
- `D:/Projects/veqiro/apps/main/src/components/chat/{ChatMessage,ChatInput,MarkdownMessage}.tsx` — bubble restyle
- `D:/Projects/veqiro/apps/main/src/components/layout/AppSidebar.tsx` — sidebar restyle
- `D:/Projects/veqiro/apps/main/src/components/forms/auth/{loginForm,registerForm}.tsx` — restyle inputs via Veqiro primitives
- `D:/Projects/veqiro/apps/main/src/lib/config/agents.ts` — swap per‑agent colour tokens to Veqiro palette; merge in `EMPLOYEES` fields (tag, quote, stats, skills)
- `D:/Projects/veqiro/apps/main/src/lib/api/brain.ts` — already exports `getBrandKit`/`setBrandKit`; wire from onboarding
- `D:/Projects/veqiro/apps/main/src/components/brain/*` — restyle brand kit editor in Veqiro

**New to create in main:**
- `apps/main/src/app/(onboarding)/layout.tsx`
- `apps/main/src/app/(onboarding)/onboarding/page.tsx`
- `apps/main/src/components/veqiro/shared.tsx` (copied)
- `apps/main/src/components/veqiro/characters.tsx` (copied)
- `apps/main/src/components/veqiro/data.ts` (copied + merged)

**Reusable existing utilities to NOT reinvent:**
- `apps/main/src/lib/api/brain.ts` — `getBrandKit`, `setBrandKit`
- `apps/main/src/lib/api/assistants.ts` — `sendMessage`
- `apps/main/src/lib/auth-client.ts` — `authClient`, `useSession`
- `apps/main/src/lib/utils.ts` — `cn`
- `apps/main/src/components/ui/*` — shadcn primitives (keep, theme via CSS vars)

---

## Locked decisions

1. **Theme depth in main: full Veqiro everywhere.** Every route in main — auth, onboarding, chat, dashboard, brain, settings, workspace — adopts the full cream/ink/3px‑border/offset‑shadow/display‑font aesthetic. No "calmer" variant for data‑dense pages. Consistency wins.

2. **Onboarding placement: own `(onboarding)` group, post‑signup.** New `apps/main/src/app/(onboarding)/onboarding/page.tsx` with a minimal layout (no sidebar), session‑gated, backend‑persisted via `setBrandKit()`. Post‑signup redirects here automatically when the user's brand kit is empty.

3. **Per‑agent colours: replace with Veqiro palette.** `apps/main/src/lib/config/agents.ts` gets updated:
   - maya → red `var(--vq-red)` / ink `#7A1717`
   - rex → green `var(--vq-green)` / ink `#0E5C3F`
   - scout → yellow `var(--vq-yellow)` / ink `#7A5A00`
   - sage → pink `var(--vq-pink)` / ink `#8E2A6A`
   - lex → violet `var(--vq-violet)` / ink `#2A2A7A`
   - vega → blue `var(--vq-blue)` / ink `#0E5C74`

4. **Dark mode: drop for launch.** Remove the `.dark` variant block from `apps/main/src/app/globals.css`. No toggle. One cream light theme everywhere. `next-themes` stays installed (used by `sonner` toast provider) but no app‑level toggle.

## Remaining defaults (taken without asking — flag if you disagree)

5. **Brand‑kit persistence.** Backend from day 1 via `setBrandKit()` in `lib/api/brain.ts`. localStorage kept only as a draft buffer for mid‑flow refreshes, cleared on successful save.

6. **Cross‑app URL strategy.** Dev: hardcoded `http://localhost:3000` (landing) / `3001` (main). Prod: env vars `NEXT_PUBLIC_MAIN_APP_URL` and `NEXT_PUBLIC_LANDING_URL`.

7. **Design system location.** Inline copy into `apps/main/src/components/veqiro/*` now. Extraction to `packages/ui` is a future refactor, not in scope for this plan.

---

## Handoffs to user (things I can't do alone)

Most file ops I'll do myself. Flag only if I hit a tool permission wall:
- Nothing expected — `apps/landing` and `apps/main` are both under the project tree, so copies and deletes should succeed with the Edit/Write tools.

If I discover anything that can't be automated (e.g. a screenshot you need to view to approve an aesthetic call), I'll call it out inline.

---

## Verification plan (end‑to‑end)

Run from repo root:

```bash
pnpm install                           # after landing package.json trim
pnpm --filter landing build            # landing must produce static prod build
pnpm --filter main build               # main must produce prod build with all new routes
pnpm lint && pnpm check-types          # zero errors
pnpm dev                               # both apps run in parallel
```

Manual:
1. Open `http://localhost:3000` → landing loads in Veqiro theme.
2. Click "Start free" → lands on main `/signup`.
3. Sign up → auto‑redirect to `/onboarding`.
4. Walk 6 steps → "Meet the crew →" → backend saves brand kit → lands on `/dashboard`.
5. Open `/assistants/maya` → send real message → styled bubble response.
6. Navigate every page in main's inventory → confirm Veqiro skin applied uniformly.
7. Logout → returns to landing.

---

## Post‑plan: where to save this

Once approved I'll copy this file to `D:/Projects/veqiro/THEME_MIGRATION_PLAN.md` so it's version‑controlled alongside the code you're executing against. The `.claude/plans/` copy stays as the local plan‑mode artifact.
