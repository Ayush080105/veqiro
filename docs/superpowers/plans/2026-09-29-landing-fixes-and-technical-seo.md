# Landing Fixes, Em-Dash Cleanup & Technical SEO/GEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (native execution in this session, per explicit user direction to plan then implement without a separate approval pause). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two reported UI bugs (desktop nav missing "Agents", invisible prompt text on agent pages), remove every em dash from user-facing copy across `apps/landing`, and bring `apps/landing`'s technical SEO/GEO up to current best practice — without changing a single word of visible page content.

**Architecture:** `apps/landing` is a Next.js 16 (App Router) marketing site. SEO already has real infrastructure (`lib/seo.ts::buildPageMetadata`, `lib/jsonld.ts`, `components/veqiro/json-ld.tsx`, `sitemap.ts`, `robots.ts`, `public/llms.txt`) — this plan extends and repairs that infrastructure rather than replacing it. The two UI bugs are isolated to `nav-shared.tsx` and `agent-page.tsx`. The em-dash cleanup is a mechanical sweep across ~60 files, split into batches, each verified by a grep with zero remaining matches. New "technical SEO" work is additive: new files (`opengraph-image.tsx` × 3, one shared OG template) plus small edits to existing metadata/sitemap/robots/llms.txt files — no JSX returned by any page component changes, and no visible string is altered except swapping the `—` character itself.

**Tech Stack:** Next.js 16.2.1 (App Router, async `params`), React 19, TypeScript, `next/og` (`ImageResponse`) for dynamic OG images, Playwright for the existing `e2e/` smoke test.

**Spec:** This document — user request quoted in the task history: (1) desktop nav is missing the "Agents" item that mobile has, (2) the "Things to ask {agent}, try saying this" boxes on agent pages have invisible text until selected, (3) remove em dashes site-wide (they read as AI-generated), (4) audit and modernize technical SEO + GEO/AI-visibility (sitemap, robots, structured data, OG images, `llms.txt`) without changing any visible page content or wording.

## Global Constraints

- Do not change any visible page copy, headings, body text, or wording anywhere in `apps/landing` — the only permitted text edit is replacing the literal `—` (em dash, U+2014) character itself, using a comma/period/colon/rewording-of-punctuation-only as needed to stay grammatical.
- Do not touch code comments when sweeping for em dashes — comments are not user-facing and are out of scope.
- No git commits — the user handles all git operations themselves (per standing preference).
- Every new SEO file must be reusable/prop-driven where more than one route needs the same shape (OG image template takes `{ eyebrow, title, subtitle, accent }` props).
- Windows/PowerShell environment (Git Bash tool available) — verification commands must work from `apps/landing` as CWD.
- `apps/landing/AGENTS.md`: this Next.js version has breaking changes vs. training data — any new file-convention code (`opengraph-image.tsx`) must match the on-disk docs in `node_modules/next/dist/docs/`, already confirmed for the async-`params` OG image convention used in Task 6.

## Review Focus

- A page whose `generateMetadata`/`metadata` explicitly sets `openGraph.images`/`twitter.images` silently overrides the new file-convention OG image — every explicit hardcoded `/og-image.png` (or per-slug) reference must be removed, not just left alongside the new file, or the fix is invisible.
- The em-dash sweep must not touch `.md` code fences or inline code spans that legitimately contain a `—` as example CLI/text output (unlikely here, but check before batch-replacing blog content) — verify by rendering one changed blog post.
- `llms.txt` and any other metadata mentioning price/plan must match the real pricing model in `lib/site-config.ts` (`agentPricing`, from **$9/agent/month**, no `$39` bundle) — an AI answer engine repeating a wrong price is worse than no listing at all.
- The mobile drawer's "Agents" section must stay untouched (it already works) — the desktop fix must add a parallel affordance without duplicating or diverging from `EMPLOYEES` data.
- After removing the `T.line2`/`T.ink2` mis-tokened colors on the dark "Things to ask" section, contrast must be checked against the actual dark background (`T.dark2` / `T.ink`), not assumed — verify visually, not just "it's a lighter token now."

---

## Task 1: Desktop nav — add the missing "Agents" menu

**Files:**
- Modify: `apps/landing/src/components/veqiro/nav-shared.tsx`

**Interfaces:**
- Consumes: `EMPLOYEES` from `./data` (already imported at the top of the file for the mobile drawer — `key`, `name`, `role`, `color`).
- Produces: no new exports; purely internal JSX addition to `NavShared`.

- [ ] **Step 1: Add an "Agents ▾" dropdown to the desktop nav, mirroring the existing "Use cases" dropdown**

  In `nav-shared.tsx`, insert a new `nav-menu-wrap` block for Agents. Place it as the first dropdown, right after the `navLinks.slice(0, 2)` links and before the existing "Use cases" dropdown block (so desktop order becomes Product, How it works, **Agents ▾**, Use cases ▾, Pricing, Resources ▾ — this matches the mobile drawer's order of Agents before Use cases).

  ```tsx
  <div className="nav-menu-wrap">
    <span className="nav-link" tabIndex={0} role="button">Agents <Chevron /></span>
    <div className="nav-menu">
      {EMPLOYEES.map(emp => (
        <Link key={emp.key} href={`/agents/${emp.key}`} className="nav-menu-item">
          <span aria-hidden style={{
            width: 30, height: 30, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            border: `1px solid ${T.line}`, display: 'block',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small static avatar, matches mobile drawer treatment */}
            <img src={`/${emp.name}.jpeg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </span>
          <span style={{ display: 'grid', gap: 1 }}>
            <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {emp.name}
            </span>
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.ink3 }}>{emp.role.replace(/\n/g, ' ')}</span>
          </span>
        </Link>
      ))}
    </div>
  </div>
  ```

  This requires importing `T` from `./tokens` in `nav-shared.tsx` (currently only `FONT, T` are imported from `./shared` — confirm `T` from `./shared` re-exports the same tokens; if `./shared` is a client-only re-export of `./tokens`'s `T`, no new import is needed since the file already does `import { FONT, T } from './shared';` at the top — reuse that, don't add a duplicate import).

- [ ] **Step 2: Run the dev server and visually verify**

  From `apps/landing`: `npm run dev`, open the site at desktop width (≥1024px). Confirm:
  - "Agents ▾" appears in the desktop nav between "How it works" and "Use cases ▾".
  - Hovering/focusing it opens a dropdown listing all six agents with avatar, name, and role, each linking to `/agents/{key}`.
  - The existing mobile hamburger drawer's "Agents" section is unchanged.
  - The `nav-shared.tsx` `<style>` block already has generic `.nav-menu-wrap`, `.nav-menu`, `.nav-menu-item` rules — no new CSS is needed; confirm the new dropdown picks up that styling correctly (min-width, hover states) without visual glitches.

- [ ] **Step 3: Run lint**

  ```bash
  cd apps/landing && npm run lint
  ```
  Expected: no new errors introduced by this change.

---

## Task 2: Fix invisible text in the agent-page "Things to ask" section

**Files:**
- Modify: `apps/landing/src/components/veqiro/agent-page.tsx` (lines ~283–332, the `ACTIONS` section)

**Root cause:** The section's background is `T.ink` (`#14120E`, near-black) and the action cards sit on `T.dark2` (`#1D1A14`, also near-black). Two text colors in this section use **light-background** tokens instead of their dark-background counterparts:
- Line ~288: the "Things to ask {employee.name}" eyebrow uses `color: T.ink2` (`#56514A`, meant for muted text on the light `T.bg`/`T.surface` background) — should be `T.inkInv2` (`#A9A192`), the token this same file already uses correctly for muted text on `T.ink` backgrounds elsewhere (compare the skills ticker at line ~349, which correctly uses `color: T.inkInv2` on a `T.ink` background).
- Line ~323: the action prompt text uses `color: T.line2` (`rgba(20,18,14,0.17)` — a near-black translucent value meant for **borders on light backgrounds**, not text) — this is why it's invisible against the near-black card until text selection (the selection highlight temporarily overrides the rendered color, matching the reported symptom exactly). Should be `T.inkInv2` (matching the eyebrow fix, keeps the same "muted secondary text" visual weight the design clearly intended).

- [ ] **Step 1: Fix the eyebrow color**

  ```diff
    <div style={{
      fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
-     textTransform: 'uppercase' as const, color: T.ink2, marginBottom: 14,
+     textTransform: 'uppercase' as const, color: T.inkInv2, marginBottom: 14,
    }}>
      Things to ask {employee.name}
    </div>
  ```

- [ ] **Step 2: Fix the action-card prompt text color**

  ```diff
    <span style={{
-     fontFamily: FONT.mono, fontSize: 13, color: T.line2,
+     fontFamily: FONT.mono, fontSize: 13, color: T.inkInv2,
      lineHeight: 1.55,
    }}>
      {action}
    </span>
  ```

- [ ] **Step 3: Visually verify on a live agent page**

  With `npm run dev` running, visit `/agents/vega` (or any agent). Scroll to the "Things to ask Vega — Try saying this." section. Confirm every action prompt is legibly readable without selecting the text, and that selecting the text still highlights normally (no regression to selection behavior — this is a color-only change).

  Repeat the check on at least one other agent page (e.g. `/agents/sage`) to confirm the fix applies to all agents (the section is shared via `agent-page.tsx`, driven by `employee.actions` from `data.ts` — one fix covers all six).

- [ ] **Step 4: Run lint**

  ```bash
  cd apps/landing && npm run lint
  ```

---

## Task 3: Em dash cleanup — policy and mechanical sweep

**Scope:** Every `—` (U+2014) character in a **user-facing string** under `apps/landing/src` and `apps/landing/content`. This includes JSX text, string literals rendered to the page, `<title>`/meta `description` strings (they render in browser tabs and search snippets — still user-facing), and blog Markdown body content. It explicitly **excludes** `//` and `/* */` code comments (not user-facing, out of scope per Global Constraints).

**Replacement policy** (apply the first rule that fits the sentence, to stay grammatical without rewording anything else):
1. `"X — Y"` used as a title/heading separator (e.g. `"Vega — Executive Assistant"`, `"Veqiro — Hire Your AI Crew"`) → replace with a colon or a plain hyphen surrounded by spaces removed to `" - "` is inconsistent with brand tone; use a colon: `"Vega: Executive Assistant"`. For `<title>` tags already using the pattern `"{Name} · Veqiro"` elsewhere (see `layout.tsx`'s `template: "%s · Veqiro"`), prefer matching that existing separator style (`·`) only where it's already the site's established convention (the `template` field) — for standalone titles not using the template, use a colon.
2. `"...clause A — clause B..."` (parenthetical aside mid-sentence) → replace with a comma if the aside is short, or restructure into two sentences with a period if the aside is a full independent clause. Never leave a bare double-hyphen or an en dash in its place (an en dash reads the same "AI-generated" way to a human reader).
3. A standalone `'—'` used as a placeholder for "no value" (e.g. a pricing table cell) → replace with `'-'` (plain hyphen), which is the conventional placeholder glyph and carries no punctuation ambiguity.
4. `"— Name, Role"` as a quote attribution → replace with `"Name, Role"` (drop the dash entirely; attribution lines don't need a leading punctuation mark).

**Files (grouped by area, from the `grep -c` audit):**
- Metadata/config (small, high-value, do first): `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/seo.ts`, `src/lib/jsonld.ts`, `src/lib/site-config.ts`, `src/lib/blog.ts`, `src/lib/blog-categories.ts`, `src/lib/use-billing-catalog.ts`, `src/app/agents/[slug]/page.tsx`, `src/app/blog/page.tsx`, `src/app/compare/page.tsx`, `src/app/about/page.tsx`, `src/app/pricing/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/waitlist/page.tsx`, `src/app/use-cases/**/page.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`.
- Components: `src/components/veqiro/data.ts` (114 occurrences — largest single file, mostly in agent `quote`, `howItHelps`, `faq`, `workflow`, `outcomes` fields), `src/components/veqiro/home/home-data.ts`, `src/components/veqiro/home/story-sections.tsx`, `src/components/veqiro/home/proof-sections.tsx`, `src/components/veqiro/home/hero-work.tsx`, `src/components/veqiro/home/home-ui.tsx`, `src/components/veqiro/sections.tsx` (footer — `enterpriseTier.tag` line and the "Start free — 7 days" CTA), `src/components/veqiro/hero.tsx`, `src/components/veqiro/story.tsx`, `src/components/veqiro/crew.tsx`, `src/components/veqiro/agent-page.tsx`, `src/components/veqiro/pricing-page-content.tsx`, `src/components/veqiro/compare-page-content.tsx`, `src/components/veqiro/waitlist-page-content.tsx`, `src/components/veqiro/use-case-page.tsx`, `src/components/veqiro/integrations-section.tsx`, `src/components/veqiro/native-tools.ts`, `src/components/veqiro/prompt-composer.tsx`, `src/components/veqiro/blog-index-page.tsx`, `src/components/veqiro/blog-post-layout.tsx`, `src/components/veqiro/tool-logo.tsx`, `src/components/veqiro/brand-mark.tsx`.
- Blog content (largest volume, ~280 occurrences total across 16 files): every file in `content/blog/*.md`.
- The footer-specific fix the user called out by name: `src/lib/site-config.ts`'s `footerColumns` array (`'Vega — Executive Assistant'`, `'Scout — Research'`, `'Maya — Content'`, `'Sage — SEO'`, `'Lex — Legal'`, `'Rex — Finance'`) → colon form (`'Vega: Executive Assistant'`, etc.).

- [ ] **Step 1: Metadata/config batch — fix by hand, file by file**

  Work through the metadata/config file list above. For each `—` found (re-grep each file after editing to confirm), apply the replacement policy. Example (`src/app/layout.tsx`):
  ```diff
  - title: { default: "Veqiro — Hire Your AI Crew", ... }
  + title: { default: "Veqiro: Hire Your AI Crew", ... }
  ```
  and (`src/lib/site-config.ts` footer columns):
  ```diff
  - { label: 'Vega — Executive Assistant', href: '/agents/vega' },
  + { label: 'Vega: Executive Assistant', href: '/agents/vega' },
  ```
  Continue through every file in the metadata/config list. This batch is small enough (≈90 occurrences across 19 files) to do directly with the Edit tool, reading each file first.

- [ ] **Step 2: Components batch**

  Same process across the components file list (≈180 occurrences across ~22 files, `data.ts` alone has 114 — read it in full first since agent `quote`/`howItHelps`/`faq`/`workflow`/`outcomes` fields are long-form copy where the aside-vs-title distinction matters most). This batch is large enough to delegate to a background fork to protect context: dispatch one fork per sub-group (e.g. one fork for `data.ts` alone given its size, one fork for the remaining component files), each fork instructed with the exact replacement policy above and told to re-grep its own files afterward to confirm zero remaining `—` characters before reporting done.

- [ ] **Step 3: Blog content batch**

  Same process across all 16 `content/blog/*.md` files (≈280 occurrences). Delegate to one or more forks in parallel (split alphabetically into 2–3 groups if needed), each given the same replacement policy, with the added instruction: markdown body prose should use rule 2 (comma or sentence split) almost exclusively — blog posts don't have the title-separator or quote-attribution patterns as often, so watch for `---` horizontal-rule lines (three hyphens, not an em dash — must not be touched) and any fenced code blocks (skip entirely, they're not prose).

- [ ] **Step 4: Verify zero remaining em dashes in scope**

  ```bash
  cd apps/landing
  printf '\xe2\x80\x94' > /tmp/emdash.txt
  grep -rl -f /tmp/emdash.txt --include="*.tsx" --include="*.ts" --include="*.md" src content | xargs -I{} grep -n -f /tmp/emdash.txt {} | grep -v '^\s*//\|/\*'
  ```
  Expected: empty output (any remaining hits should only be inside comments — inspect any hit manually to confirm before accepting).

- [ ] **Step 5: Spot-check rendering**

  `npm run dev`. Load the home page, one agent page, the pricing page, the footer (any page), and one blog post. Confirm no sentence reads awkwardly or ungrammatically from the punctuation swap, and that no visible wording other than the dash itself changed.

- [ ] **Step 6: Run lint and build**

  ```bash
  cd apps/landing && npm run lint && npm run build
  ```
  Expected: both pass (the build also validates every `generateStaticParams` route still renders, catching any accidental syntax break from the sweep).

---

## Task 4: Fix broken Open Graph images site-wide (dynamic OG image generation)

**Problem confirmed:** `public/og-image.png`, `public/og/{slug}.png`, and `public/og/blog/{slug}.png` are referenced throughout the metadata layer but **none of these files exist** (`public/og/` doesn't exist at all). Every social share of every page on the site currently shows a broken image. Fix with Next's standard `opengraph-image.tsx` file-convention (dynamic generation via `next/og`) instead of hand-designing dozens of static PNGs — this is genuinely current best practice for a data-driven marketing site and keeps images in sync with `data.ts`/blog frontmatter automatically.

**Files:**
- Create: `apps/landing/src/lib/og-image.tsx` (shared card renderer, used by all three routes below)
- Create: `apps/landing/src/app/opengraph-image.tsx` (site-wide default — covers home, about, pricing, compare, use-cases, privacy, terms, waitlist: any route without a more specific `opengraph-image`)
- Create: `apps/landing/src/app/agents/[slug]/opengraph-image.tsx`
- Create: `apps/landing/src/app/blog/[slug]/opengraph-image.tsx`
- Modify: `apps/landing/src/lib/seo.ts` (`buildPageMetadata` — stop defaulting `ogImage` to a hardcoded path)
- Modify: `apps/landing/src/app/page.tsx` (remove hardcoded `/og-image.png` from the manual `openGraph`/`twitter` blocks)
- Modify: `apps/landing/src/app/agents/[slug]/page.tsx` (remove the `ogImage: /og/${slug}.png` override)
- Modify: `apps/landing/src/app/blog/[slug]/page.tsx` (remove the `/og/blog/${slug}.png` fallback)
- Modify: `apps/landing/src/lib/jsonld.ts` (`articleJsonLd` — point `image.url` at the generated OG image route instead of the nonexistent static path)

**Interfaces:**
- Produces: `renderOgCard(props: { eyebrow: string; title: string; subtitle?: string; accent: string }): ReactElement` from `src/lib/og-image.tsx` — a Satori-compatible (flexbox-only) JSX tree sized for a 1200×630 canvas, used as the JSX argument to `new ImageResponse(...)`. Also exports `OG_SIZE = { width: 1200, height: 630 }` and `OG_CONTENT_TYPE = 'image/png'` for the three route files to re-export as `size`/`contentType`.
- Consumes: `EMPLOYEES` from `components/veqiro/data` (agent OG image), `getPostBySlug` from `lib/blog` (blog OG image), `SITE_URL` from `lib/seo`.

- [ ] **Step 1: Write the shared OG card template**

  `apps/landing/src/lib/og-image.tsx`:
  ```tsx
  export const OG_SIZE = { width: 1200, height: 630 };
  export const OG_CONTENT_TYPE = 'image/png';

  const BG = '#14120E';
  const CREAM = '#F2ECE0';
  const MUTED = '#A9A192';

  export function renderOgCard({
    eyebrow,
    title,
    subtitle,
    accent,
  }: {
    eyebrow: string;
    title: string;
    subtitle?: string;
    accent: string;
  }) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 22,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, background: accent }} />
          {eyebrow}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: CREAM, lineHeight: 1.05, letterSpacing: -2 }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 30, color: MUTED, lineHeight: 1.3, maxWidth: 980 }}>{subtitle}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, color: MUTED }}>
          veqiro.com
        </div>
      </div>
    );
  }
  ```
  Colors are pulled directly from the existing design tokens in `globals.css` (`--vq-dark`/`--vq-ink-inv`/`--vq-ink-inv-2`) so the generated image matches the site's actual dark-mode palette rather than inventing new brand colors.

- [ ] **Step 2: Site-wide default OG image**

  `apps/landing/src/app/opengraph-image.tsx`:
  ```tsx
  import { ImageResponse } from 'next/og';
  import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-image';

  export const alt = 'Veqiro — AI employees for lean teams';
  export const size = OG_SIZE;
  export const contentType = OG_CONTENT_TYPE;

  export default function Image() {
    return new ImageResponse(
      renderOgCard({
        eyebrow: 'AI employees for lean teams',
        title: 'Veqiro',
        subtitle: 'Six AI employees. One shared brain. No headcount.',
        accent: '#F5C518',
      }),
      { ...OG_SIZE },
    );
  }
  ```

- [ ] **Step 3: Per-agent OG image**

  `apps/landing/src/app/agents/[slug]/opengraph-image.tsx`:
  ```tsx
  import { ImageResponse } from 'next/og';
  import { EMPLOYEES } from '@/components/veqiro/data';
  import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-image';

  export const size = OG_SIZE;
  export const contentType = OG_CONTENT_TYPE;

  export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const employee = EMPLOYEES.find(e => e.key === slug);
    return new ImageResponse(
      renderOgCard({
        eyebrow: 'Veqiro AI employee',
        title: employee ? employee.name : 'Veqiro',
        subtitle: employee?.role,
        accent: employee?.color ?? '#F5C518',
      }),
      { ...OG_SIZE },
    );
  }
  ```
  Note: no `alt` export here because it must vary per agent — Next.js falls back to a generic alt when the `alt` export is omitted; the page's own `generateMetadata` already sets `openGraph.images[0].alt` separately via `buildPageMetadata`'s `ogImageAlt`, and that stays since `alt` text is metadata, not an image pixel.

- [ ] **Step 4: Per-blog-post OG image**

  `apps/landing/src/app/blog/[slug]/opengraph-image.tsx`:
  ```tsx
  import { ImageResponse } from 'next/og';
  import { getPostBySlug } from '@/lib/blog';
  import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-image';

  export const size = OG_SIZE;
  export const contentType = OG_CONTENT_TYPE;

  export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    return new ImageResponse(
      renderOgCard({
        eyebrow: post?.category ?? 'Veqiro blog',
        title: post?.title ?? 'Veqiro',
        subtitle: post?.description,
        accent: '#6FCDE8',
      }),
      { ...OG_SIZE },
    );
  }
  ```
  Confirm the exact field names (`category`, `title`, `description`) against `src/lib/blog.ts`'s post type before writing this — re-read that file's interface if any name doesn't match.

- [ ] **Step 5: Stop `buildPageMetadata` from hardcoding a nonexistent default image**

  In `apps/landing/src/lib/seo.ts`, change:
  ```diff
    export function buildPageMetadata(i: BuildMetaInput): Metadata {
  -   const ogImage = i.ogImage ?? '/og-image.png';
      const type = i.type ?? 'website';
      const canonical = new URL(i.path, SITE_URL).toString();

      return {
        ...
        openGraph: {
          type,
          url: canonical,
          title: i.title,
          description: i.description,
          siteName: 'Veqiro',
-         images: [
-           {
-             url: ogImage,
-             width: 1200,
-             height: 630,
-             alt: i.ogImageAlt ?? i.title,
-           },
-         ],
+         ...(i.ogImage
+           ? { images: [{ url: i.ogImage, width: 1200, height: 630, alt: i.ogImageAlt ?? i.title }] }
+           : {}),
        },
        twitter: {
          card: 'summary_large_image',
          title: i.title,
          description: i.description,
-         images: [ogImage],
+         ...(i.ogImage ? { images: [i.ogImage] } : {}),
        },
        ...
      };
    }
  ```
  When no caller passes `ogImage`, the returned `Metadata` object now has no `openGraph.images`/`twitter.images` at all, which lets the route's `opengraph-image.tsx` file convention (root-level, or the more specific agent/blog one) populate it automatically — Next.js only uses the file convention as a fallback for fields the resolved metadata doesn't already set.

- [ ] **Step 6: Remove the hardcoded image from the root layout and home page**

  `apps/landing/src/app/layout.tsx` — remove `images: [{ url: '/og-image.png', ... }]` from the `openGraph` block and `images: ['/og-image.png']` from `twitter`, same reasoning as Step 5 (this file builds `Metadata` by hand, not via `buildPageMetadata`).

  `apps/landing/src/app/page.tsx` — remove the `images: [{ url: '/og-image.png', ... }]` line from its `openGraph` block and `images: ['/og-image.png']` from `twitter`. Delete the now-inaccurate comment above it ("A page's openGraph/twitter replace the layout's wholesale, so the share image is repeated here.") since the image no longer needs repeating — replace it with a one-line note that the root `opengraph-image.tsx` now supplies the image automatically, or remove the comment if it no longer explains anything non-obvious.

- [ ] **Step 7: Remove the broken per-agent/per-post overrides**

  `apps/landing/src/app/agents/[slug]/page.tsx`:
  ```diff
    return buildPageMetadata({
      title: `${employee.name} — ${agentMeta.seoTitleSuffix}`,
      description: agentMeta.metaDescription,
      path: `/agents/${slug}`,
-     ogImage: `/og/${slug}.png`,
      ogImageAlt: `${employee.name}, Veqiro's AI ${employee.role}`,
      keywords: agentMeta.keywords,
    });
  ```
  (Note: the title's `—` also gets fixed here as part of Task 3, since Task 3 covers this same file — do not fix it twice; if Task 3 already ran, this diff's context line will already show the colon form.)

  `apps/landing/src/app/blog/[slug]/page.tsx`:
  ```diff
    return buildPageMetadata({
      title: post.title,
      description: post.description,
      path: `/blog/${slug}`,
-     ogImage: post.ogImage ?? `/og/blog/${slug}.png`,
+     ogImage: post.ogImage,
      ogImageAlt: post.ogImageAlt ?? post.title,
      keywords: post.keywords,
      type: 'article',
    });
  ```
  This keeps supporting a real custom image if a future post sets `ogImage` in its frontmatter, while falling through to the generated image when it doesn't (which is every post today).

- [ ] **Step 8: Point `articleJsonLd`'s image field at the generated route instead of the dead static path**

  In `apps/landing/src/lib/jsonld.ts`:
  ```diff
    image: {
      '@type': 'ImageObject',
-     url: `${SITE_URL}${post.ogImage ?? `/og/blog/${post.slug}.png`}`,
+     url: post.ogImage ? `${SITE_URL}${post.ogImage}` : `${SITE_URL}/blog/${post.slug}/opengraph-image`,
      width: 1200,
      height: 630,
    },
  ```
  (The path `/blog/{slug}/opengraph-image` is the URL Next.js serves the generated image at for a colocated `opengraph-image.tsx` — same convention Next uses for the `<meta property="og:image">` tag it injects automatically.)

- [ ] **Step 9: Verify**

  ```bash
  cd apps/landing && npm run build
  ```
  Then `npm run start` (or `next dev`) and check:
  - `curl -I http://localhost:3000/opengraph-image` → `200`, `content-type: image/png`.
  - `curl -I http://localhost:3000/agents/vega/opengraph-image` → `200`.
  - `curl -I http://localhost:3000/blog/{any-real-slug}/opengraph-image` → `200`.
  - View source on `/`, `/agents/vega`, and one blog post — confirm the `<meta property="og:image">` tag now points at one of these generated routes, not `/og-image.png`.

---

## Task 5: Sitemap completeness

**Files:**
- Modify: `apps/landing/src/app/sitemap.ts`

**Problem:** `/compare` (linked in the footer and nav "Resources" menu), `/privacy`, and `/terms` are indexable pages (no `noindex`) but are missing from the sitemap entirely.

- [ ] **Step 1: Add the missing entries**

  ```diff
      {
        url: `${SITE_URL}/pricing`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.9,
      },
+     {
+       url: `${SITE_URL}/compare`,
+       lastModified,
+       changeFrequency: "monthly",
+       priority: 0.7,
+     },
      ...AGENT_SLUGS.map(slug => ({
        ...
      })),
  ```
  and near the end, after the blog posts block:
  ```diff
      ...posts.map(post => ({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.updatedDate ?? post.date),
        changeFrequency: "monthly",
        priority: 0.7,
      })),
+     {
+       url: `${SITE_URL}/privacy`,
+       lastModified,
+       changeFrequency: "yearly",
+       priority: 0.3,
+     },
+     {
+       url: `${SITE_URL}/terms`,
+       lastModified,
+       changeFrequency: "yearly",
+       priority: 0.3,
+     },
    ];
  ```
  `/waitlist` is deliberately left out — it's a conditional pre-launch page not linked from primary navigation when the site is live, so including it would list a page most crawlers would treat as thin/duplicate content.

- [ ] **Step 2: Verify**

  ```bash
  cd apps/landing && npm run build && npm run start
  ```
  `curl http://localhost:3000/sitemap.xml` and confirm `/compare`, `/privacy`, and `/terms` are present with the right priorities.

---

## Task 6: robots.txt cleanup

**Files:**
- Modify: `apps/landing/src/app/robots.ts`

**Problem:** The current rule disallows `/favicon.ico`, which serves no purpose (blocking a favicon doesn't protect anything and can suppress the favicon Google sometimes shows next to search results) and looks like a leftover from a scaffold default rather than an intentional decision.

- [ ] **Step 1: Remove the pointless disallow**

  ```diff
    export default function robots(): MetadataRoute.Robots {
      return {
        rules: {
          userAgent: "*",
          allow: "/",
-         disallow: "/favicon.ico",
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
      };
    }
  ```

- [ ] **Step 2: Verify**

  `curl http://localhost:3000/robots.txt` — confirm output is `User-agent: *\nAllow: /\n\nSitemap: .../sitemap.xml\nHost: ...` with no `Disallow` line.

---

## Task 7: `llms.txt` accuracy (GEO / AI-answer-engine correctness)

**Files:**
- Modify: `apps/landing/public/llms.txt`

**Problems found (this file is read directly by AI assistants/answer engines — wrong facts here get repeated as fact by an LLM citing it):**
1. Pricing section says `"$39/mo or $29/mo billed annually"` — the real model (per `src/lib/site-config.ts::agentPricing`) is **per-agent billing from $9/mo**, no `$39` bundle exists anywhere in the product.
2. `## Use Cases` lists `[For Solopreneurs](https://veqiro.com/use-cases/solopreneurs)` — that route doesn't exist (the real fourth use case is `/use-cases/growing-startups`, "Growing Startups"). This is a dead link an AI crawler would surface and then hit a 404 on.

- [ ] **Step 1: Fix the pricing line**

  ```diff
    ## Pricing
  - - [Pricing](https://veqiro.com/pricing): $39/mo or $29/mo billed annually. 7-day free trial. No credit card required.
  + - [Pricing](https://veqiro.com/pricing): Each of the six AI employees is billed independently, from $9/month. 7-day free trial. No credit card required.
  ```

- [ ] **Step 2: Fix the broken use-case link**

  ```diff
    ## Use Cases
    - [For Founders](https://veqiro.com/use-cases/founders): AI tools for founders and early-stage startups
    - [For Marketing Teams](https://veqiro.com/use-cases/marketing-teams): AI tools for marketing teams
    - [For Agencies](https://veqiro.com/use-cases/agencies): AI for agencies managing multiple clients
  - - [For Solopreneurs](https://veqiro.com/use-cases/solopreneurs): AI tools for solopreneurs and solo founders
  + - [For Growing Startups](https://veqiro.com/use-cases/growing-startups): AI tools for Series A/B startups scaling output without adding headcount
  ```

- [ ] **Step 3: Verify**

  Re-read the file after editing; confirm every URL listed matches a real route (`about`, `pricing`, `agents/{vega,scout,maya,sage,lex,rex}`, `use-cases/{founders,marketing-teams,agencies,growing-startups}`, `blog`, and every `blog/{slug}` against `content/blog/*.md` filenames). Fix any other mismatch found during this check.

---

## Task 8: Structured data for agent pages (FAQPage, BreadcrumbList, Person)

**Files:**
- Modify: `apps/landing/src/components/veqiro/agent-page.tsx`

**Problem:** Every other content-bearing page type in this codebase (blog posts, use-case pages) emits JSON-LD (`articleJsonLd`+`faqPageJsonLd` for blog; `faqPageJsonLd` for use-cases). Agent pages — arguably the most commercially important pages on the site — emit **no JSON-LD at all**, despite `data.ts`'s `Employee` type already carrying a `faq: AgentFaq[]` field per agent that's rendered as a visible FAQ section on the page but never exposed as `FAQPage` schema. `lib/jsonld.ts` already has `personAgentJsonLd`, `faqPageJsonLd`, and `breadcrumbJsonLd` — the ability exists, it's just unused here.

- [ ] **Step 1: Add the imports and emit the JSON-LD**

  Near the top of `agent-page.tsx`, add:
  ```tsx
  import { JsonLd } from './json-ld';
  import { personAgentJsonLd, faqPageJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
  import { SITE_URL } from '@/lib/seo';
  ```
  In the component's returned JSX, as the first child (matching the pattern used in `blog-post-layout.tsx` and `use-case-page.tsx`):
  ```tsx
  <JsonLd
    data={[
      personAgentJsonLd(employee),
      faqPageJsonLd(employee.faq),
      breadcrumbJsonLd([
        { name: 'Home', url: SITE_URL },
        { name: employee.name, url: `${SITE_URL}/agents/${employee.key}` },
      ]),
    ]}
  />
  ```
  Confirm `AgentPage`'s function signature already receives the full `employee: Employee` object (it does — `data.ts` shows the component is called as `<AgentPage employee={employee} />`), so no new prop threading is needed.

- [ ] **Step 2: Verify no visible change and valid JSON-LD**

  `npm run dev`, visit `/agents/vega`, view page source, confirm a new `<script type="application/ld+json">` block is present containing a `Person`, `FAQPage`, and `BreadcrumbList` object, and that the visible page is pixel-identical to before this task (JSON-LD is invisible by design). Paste the JSON-LD block into a JSON validator (or `node -e "JSON.parse(...)"`) to confirm it's syntactically valid.

  Repeat for one more agent to confirm the fix generalizes (it's data-driven, so one code change covers all six).

---

## Task 9: Final full verification pass

- [ ] **Step 1: Full build**

  ```bash
  cd apps/landing && npm run build
  ```
  Expected: succeeds, including static generation of all `generateStaticParams` routes (6 agent pages, all blog posts).

- [ ] **Step 2: Full lint**

  ```bash
  cd apps/landing && npm run lint
  ```
  Expected: no errors.

- [ ] **Step 3: Em-dash regression check (repeat of Task 3 Step 4)**

  ```bash
  cd apps/landing
  printf '\xe2\x80\x94' > /tmp/emdash.txt
  grep -rn -f /tmp/emdash.txt --include="*.tsx" --include="*.ts" --include="*.md" src content public/llms.txt | grep -v '^\s*//\|/\*'
  ```
  Expected: empty (only comment-only hits, if any, are acceptable).

- [ ] **Step 4: Playwright smoke test**

  ```bash
  cd apps/landing && npm run test:e2e
  ```
  Expected: `e2e/responsive.spec.ts` still passes (it exercises the nav — confirms Task 1's change didn't break the existing responsive nav test; update the test only if it explicitly asserted the old desktop item count/list, in which case extend its assertions to include "Agents" rather than changing its intent).

- [ ] **Step 5: Manual visual pass on a real browser**

  With `npm run dev` running, check at both desktop and mobile widths: home, one agent page, pricing, compare, about, one blog post, one use-case page, footer on any page. Confirm: desktop nav shows "Agents ▾"; agent-page action prompts are readable; no em dashes visible anywhere; social share preview (can be approximated by inspecting the `og:image` meta tag URL and loading it directly in the browser) renders a real branded image, not a broken-image icon.

---

## What the user needs to do manually (report at the end of implementation)

This section is filled in after implementation, listing anything that needs action outside the codebase (e.g., submitting the sitemap in Google Search Console / Bing Webmaster Tools, verifying the `llms.txt` is crawlable in production, checking real social-share previews on LinkedIn/Twitter's own cache-busting tools after deploy, DNS/CDN cache purge for `/og-image.png`'s old 404 if it was ever cached by a platform, etc.).
