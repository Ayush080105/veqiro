# Landing page fixes & SEO overhaul — what to do after you push (2026-09-29)

This covers the session where we fixed the desktop nav, the invisible agent-page text, removed em dashes site-wide, overhauled technical SEO/GEO, corrected stale $39/mo bundle pricing copy across the use-case pages and two comparison blog posts, and ran a full pre-push review pass. Everything below is either a manual step only you can do (accounts, external tools) or an optional next-level improvement, not a code fix I left undone.

## Pre-push review: what was checked and fixed

Before recommending you push, I ran a fresh `/code-review high` pass on the full diff, plus a manual visual pass in a real browser (desktop, tablet, mobile) and a rebuild + relint + full e2e run. The review caught 4 real issues in the new OG-image system, all now fixed and re-verified:

1. **Long blog titles could overflow the 630px OG image canvas** (no line clamp on the title/subtitle). Fixed: both are now clamped (3 lines / 2 lines) with a bounded max width, verified against the site's longest actual title.
2. **Blog OG images showed the raw category slug** (e.g. "agents") instead of the human label ("Agents") used everywhere else on the site. Fixed: now uses the same `CATEGORY_LABELS` mapping as the blog post page. Verified with a `use-cases` post, which now correctly shows "USE CASES" instead of "USE-CASES".
3. **Sage's agent OG image had a broken mid-word line break.** Her `role` field contains a literal newline (`"The SEO\nSpecialist"`) that every other place in the codebase strips before display, except this new file. Fixed and verified: "The SEO Specialist" now renders on one line.
4. **A future blog post's custom OG image (frontmatter `ogImage` field) would have been silently ignored.** Next.js documents that a colocated `opengraph-image.tsx` file always overrides an explicit `openGraph.images` set in page metadata, so the old code path was dead without anyone noticing. Fixed: the OG image route itself now serves the custom static image when a post sets one, instead of relying on metadata that could never take effect.

Full production build, lint, and the 24-test Playwright suite all pass after these fixes.

## Do these after deploying

1. **Resubmit the sitemap.** `/compare`, `/privacy`, and `/terms` are new to `sitemap.xml`, and every page's Open Graph image is now real instead of broken. In Google Search Console and Bing Webmaster Tools, resubmit `https://veqiro.com/sitemap.xml` so these get (re)crawled sooner than the normal crawl cadence.

2. **Force a re-scrape of link previews.** Social platforms cache the *old, broken* OG image per URL. Once live, run each of these through the relevant debugger to force a fresh pull of the new image:
   - LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
   - Twitter/X Card Validator: https://cards-dev.twitter.com/validator (or just post a link and check the preview)
   - Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
   - Slack unfurls itself; if a link was ever posted in a channel before this fix, it may show the old broken image until Slack's cache expires (usually a few days) — no action needed, but don't be alarmed if an old message still shows it.

3. **Spot-check the generated OG images for real.** They're built with `next/og` at request/build time — verify once live:
   - `https://veqiro.com/opengraph-image`
   - `https://veqiro.com/agents/vega/opengraph-image` (or any agent)
   - `https://veqiro.com/blog/what-is-an-ai-employee/opengraph-image` (or any post)
   
   Each should load as a real PNG, not a 404.

4. **Validate structured data with Google's own tooling**, not just my syntax check: https://search.google.com/test/rich-results — run it against the homepage, one agent page, one blog post, and one use-case page. I confirmed the JSON-LD is syntactically valid and unchanged in structure, but Google's tool is the real arbiter of whether it's eligible for rich results.

5. **Run Lighthouse / PageSpeed Insights against the live production URL**, not localhost — https://pagespeed.web.dev/. Local dev numbers aren't representative (no CDN, no production caching headers). This tells you if the new dynamic OG image routes or anything else affected Core Web Vitals in practice.

## Worth deciding on, not urgent

6. **No analytics is wired up** (`layout.tsx` has no GA/Plausible/PostHog/etc.). Not something I added on my own since it's a real product decision (which tool, cookie-consent implications, what to track) — but without it you have no first-party visibility into whether any of this SEO work is moving the needle. Worth a deliberate decision, not a silent addition.

7. **`llms.txt` accuracy drifts over time.** It's a static file — every new agent, pricing change, or blog post needs a manual update to stay accurate for AI answer engines (this is exactly the kind of staleness I just fixed: a wrong price and a dead link had been sitting there). Worth a periodic 5-minute check whenever pricing or the blog list changes, rather than rediscovering it stale again in six months.

8. **Occasionally prompt ChatGPT/Perplexity/Claude directly** with "what is Veqiro" or "Veqiro vs Sintra" every month or two, once the site's been live and crawled a while. That's the actual test of whether the GEO work (llms.txt, structured data, clear pricing) is translating into AI assistants recommending or accurately describing you.

## Pre-existing issues spotted during final review (not touched, unrelated to this session)

None of these were introduced by this session's changes — confirmed via `git diff` that every line was untouched by any of today's edits. Flagging since you asked me to review everything before you push.

- **`use-case-page.tsx`, hero heading**: renders as "The real job Veqiro does for**founders**." with a missing space between "for" and the persona name, on all four use-case pages. Cosmetic, low priority, easy one-line fix whenever you want it done.
- **9 pre-existing ESLint errors / 3 warnings**, all predate this session:
  - Unescaped `"` / `'` characters in JSX text in `about/page.tsx`, `terms/page.tsx`, `agent-page.tsx` (the pull-quote), and `pricing-page-content.tsx` ("What's included") — cosmetic lint rule, doesn't affect rendering.
  - Two `setState`-inside-`useEffect` warnings in `contact-modal.tsx` and `waitlist-page-content.tsx` (the live countdown timer) — a real React best-practice flag, not a bug you'd notice as a user, but worth a cleanup pass sometime.
  - One unused `Link` import in `blog-post-layout.tsx`, one unused `i` variable in `pricing-page-content.tsx`, one `<img>`-instead-of-`<Image>` warning in `mobile-chat.tsx`.
  
  None of these block the build or affect what a visitor sees. Let me know if you want a dedicated pass to clean them up.

## Already verified, no action needed

- `NEXT_PUBLIC_LANDING_URL` is correctly set in both the production and preview environments on Coolify (checked directly) — the sitemap and canonical URLs will resolve to `https://veqiro.com`, not `localhost`.
- Production build, lint (pre-existing issues only), and the full Playwright e2e suite (24/24) all pass on the final code.
- Structured data (Person/FAQPage/BreadcrumbList) was already present on every agent, blog, and use-case page before this session — confirmed, not something that needed adding.
