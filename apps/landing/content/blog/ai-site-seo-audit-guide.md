---
title: "How to Run a Full-Site SEO Audit with AI: From Crawl to Action Plan"
slug: ai-site-seo-audit-guide
date: "2026-06-11"
description: "A practical guide to AI-powered SEO audits — page-level deep-dives and full-site crawls that surface the issues quietly costing you rankings."
category: agents
agentKey: sage
keywords:
  - ai site audit
  - ai seo audit tool
  - ai technical seo
  - ai page seo audit
  - ai site crawl
  - seo audit for startups
  - technical seo audit ai
  - ai seo specialist
readingTime: 8
faq:
  - q: "What is an AI SEO audit and how is it different from Screaming Frog?"
    a: "Screaming Frog is a crawler — it gives you raw data: status codes, missing tags, response times. An AI SEO audit interprets that data and produces a prioritized action plan. Sage doesn't just tell you that 14 pages have missing H1 tags — she tells you which ones matter, why, and in what order to fix them. The output is a ranked fix list, not a spreadsheet."
  - q: "How often should a startup run a full-site SEO audit?"
    a: "Quarterly for most sites under 200 indexed pages. Monthly if you're publishing new content weekly or making frequent site changes. After any significant technical change (migration, URL restructure, new CMS). The goal is to catch drift — small technical issues that compound into meaningful ranking drag over 3–6 months."
  - q: "What is keyword cannibalization and why does it hurt rankings?"
    a: "Keyword cannibalization is when multiple pages on your site target the same or very similar keywords, splitting your ranking authority across URLs. Google has to choose which page to rank, often picks the wrong one, and your authority is diluted across both. The fix is consolidating to one authoritative page per topic cluster and pointing internal links to it."
  - q: "What are orphan pages and why do they matter for SEO?"
    a: "Orphan pages have no internal links pointing to them. From Google's perspective, they're nearly invisible — no link equity flows to them, they get less crawl budget, and they signal low editorial importance. They often rank poorly even if the content is good. The fix is simple: add internal links from relevant pages."
  - q: "What is E-E-A-T and how does it affect SEO rankings?"
    a: "E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trustworthiness — Google's framework for evaluating content quality. It's particularly important for YMYL (Your Money or Your Life) content: finance, legal, health, and news. E-E-A-T signals include author attribution, expert credentials, source citations, site reputation signals, and trust indicators. A page audit from Sage includes an E-E-A-T score and specific signals to add or improve."
  - q: "What's included in a 30/60/90-day SEO action plan?"
    a: "The 30-day actions are high-impact, low-effort fixes: missing meta descriptions, broken internal links, H1 issues, canonical errors. The 60-day actions require more work but have significant ranking impact: content refreshes, structured data additions, image optimization. The 90-day actions are strategic: content consolidation, link-building targets, topical authority expansion. The timeline reflects effort, not importance — all three categories matter."
---

Most startup SEO strategies have the same blind spot: they focus on creating new content while ignoring what's already broken on the site they have.

The result is a site where some pages don't get crawled, others compete with each other for the same keyword, and a handful of technical issues quietly drag down every page's ranking potential — while the team keeps publishing new posts into the void.

An SEO audit finds and fixes these problems. This is what the audit process looks like with AI, and what to do with the output.

## Two Types of Audit, Two Different Purposes

Before running anything, it helps to understand what each audit type is designed to find.

**A page-level audit** goes deep on a single URL. You run it when you want to understand why a specific page isn't ranking for its target keyword — or when you want to maximize the potential of a page that's already getting some traction.

**A site-wide audit** crawls your entire domain. You run it to find systemic issues: broken pages, orphaned content, cannibalization patterns, and technical drag that affects every page. Think of it as the health check before you start optimizing individual pages.

In practice, you run site-wide audits on a cadence (quarterly for most sites), and page-level audits on demand — whenever a page needs attention or a new piece of content goes live.

## The Page-Level Audit: What Sage Checks

When you ask Sage to audit a specific URL, here's what the analysis covers:

### Technical SEO Factors

- **Canonical tag** — Is it set correctly to the page's own URL? Misconfigured canonicals are one of the most common reasons a page doesn't rank.
- **Page speed signals** — LCP (Largest Contentful Paint), render-blocking resources, image sizing. Google uses Core Web Vitals as a ranking signal.
- **Mobile rendering** — Is the page fully mobile-friendly? A page that renders poorly on mobile loses ranking potential across the majority of search traffic.
- **Crawl directives** — Any accidental noindex or disallow instructions blocking the page from search engines?

### On-Page SEO Factors

- **Keyword placement** — Is the primary keyword in the H1, first paragraph, at least two H2s, the meta title, and the URL slug?
- **Heading hierarchy** — Is the H1→H2→H3 structure logical? Google uses heading structure to understand page architecture.
- **Internal link density** — How many internal links point to this page? How many does it link out to? Are the anchor texts keyword-relevant?
- **Word count** — Is the page competitive with what's currently ranking for the target keyword?

### E-E-A-T Signals

Google's E-E-A-T framework (Experience, Expertise, Authoritativeness, Trustworthiness) is increasingly important for ranking. The page audit checks:

- Author attribution — Is there a named author with credentials or a bio?
- Expert signals — Are claims sourced? Are there expert quotes or references?
- Trust signals — Contact information, privacy policy, security indicators
- Content depth — Is the page genuinely more useful than what's currently ranking?

E-E-A-T matters most for content touching finance, legal, health, and advice-giving topics. For SaaS and startup content, it's increasingly relevant as AI-generated content floods the web and Google tightens quality signals.

### Featured Snippet Opportunities

Some queries trigger a featured snippet — the boxed answer at the top of the SERP, above all organic results. Sage identifies whether your target keyword has a featured snippet opportunity and whether your content structure positions you to win it.

Common snippet formats:
- **Definition snippets** — "What is X?" queries. Target with a 40–60 word direct answer in the first paragraph.
- **List snippets** — "How to X" or "Steps to X" queries. Target with clean H3-numbered steps.
- **Table snippets** — Comparison queries. Target with a clean markdown table near the top of the page.

### Competitor Comparison

The page audit includes a head-to-head against the #1 ranking result for the same keyword: word count, heading structure, internal links, E-E-A-T signals, schema markup, and page speed. This tells you exactly what you're competing against — not an abstract best-practice checklist.

### The 30/60/90-Day Action Plan

Every page audit ends with a prioritized action plan:

**30-day actions** (quick wins, high impact): Fix the canonical, add missing meta description, correct H1, add internal links from 2–3 relevant pages.

**60-day actions** (requires content work): Refresh outdated sections, add structured data (FAQ schema, Article schema), improve image alt text, expand the section where the competitor ranks stronger.

**90-day actions** (strategic): Build 3 relevant backlinks, create a supporting cluster post, consolidate competing content that's splitting authority.

## The Site-Wide Audit: What Sage Crawls

The site-wide audit crawls your full sitemap and returns a domain health overview. Here's what it checks:

### HTTP Status Codes

Every URL in your sitemap gets a status code check:
- **200s** — Fine
- **301/302s** — Redirects: are they correctly pointing where they should?
- **404s** — Broken pages wasting crawl budget and sending link equity to dead ends
- **5xx errors** — Server errors that need immediate investigation

For most sites under 200 pages, fixing every 404 and cleaning up broken redirect chains is a 2–4 hour fix with meaningful SEO impact.

### Orphan Pages

An orphan page has no internal links pointing to it from anywhere on your site. Google's crawlers discover pages by following links. An orphan page either doesn't get crawled or gets crawled infrequently, receives no internal link equity, and ranks poorly regardless of content quality.

The audit identifies every orphan page and suggests which existing pages should link to them — based on topic relevance.

### Keyword Cannibalization

Keyword cannibalization happens when multiple pages compete for the same search query. Your blog post "Best CRM for Small Teams" and your features page both mention "small team CRM" — now Google has to choose which to rank, often alternating unpredictably between them.

The audit identifies cannibalization pairs across your domain and recommends either:
- Consolidating into a single authoritative page (301 redirect the weaker one)
- Differentiating the intent (one targets informational, one targets commercial)
- Adding canonical tags to signal the preferred URL

### Technical Drag Patterns

Beyond individual page issues, site-wide audits surface patterns:

- Duplicate title tags across multiple pages
- Missing or duplicate meta descriptions at scale
- Structured data errors across a content type
- Image optimization gaps across a section
- Thin content clusters (pages under 300 words with no backlinks — candidates for consolidation or deletion)

## Running the Audits with Sage

**Page audit:** "Run a full page audit on [URL] — I want technical, speed, E-E-A-T, and competitor scores."

**Site audit:** "Audit my entire site — sitemap is at [sitemap URL]."

The output for both is a structured report with section-by-section findings and the prioritized action plan at the end.

Most teams run the site-wide audit quarterly, fix the high-priority items, and use page audits tactically — whenever a specific page needs attention or a key landing page is underperforming.

---

The content you publish next month isn't going to work if the technical foundation underneath it is broken. Fix what's broken first. Then compound.

[See how Sage handles SEO audits →](/agents/sage)
