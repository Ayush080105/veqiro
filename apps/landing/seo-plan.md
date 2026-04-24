
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Veqiro SEO Audit + Strategic SEO Plan — apps/landing

 Context

 Veqiro (https://veqiro.com) is a multi-agent AI SaaS: a single subscription that gives a team six specialized "AI employees" — Vega (Executive Assistant /
  inbox + calendar), Scout (Research & Strategy), Maya (Content & Marketing), Sage (SEO Specialist), Lex (Legal Assistant / contract review), Rex (Data &
 Finance). All agents share a central "Brain" (brand kit / shared context) so output is brand-consistent. Priced at $39/mo (or $29/mo annual). Built in
 Bengaluru, IN.

 - Target audience: founders, operators, and lean teams (2–10 people) at startups/SMBs who can't justify hiring six specialists but still need those
 functions.
 - Positioning (verbatim from copy): "hire your weirdos" / "AI employees with real jobs, real personalities, and zero chill."
 - Direct competitor set: Lindy AI, Sintra AI, Relevance AI, Cognosys, Moveworks (enterprise), Mega (AI marketing agents). Tool-level competitors per
 agent: Jasper/Copy.ai (Maya), SEMrush/Surfer/Clearscope (Sage), SimilarWeb/Crunchbase (Scout), Evisort/LawGeex (Lex), Baremetrics/ChartMogul (Rex),
 Motion/Clockwise (Vega).

 The landing site was just deployed. Metadata, robots.ts, sitemap.ts, and H-tag structure are in place — but there are significant gaps (no JSON-LD,
 missing og-image and favicon, shared canonical across agent pages, thin meta on pricing/agent pages, no blog, no programmatic pages for per-agent /
 comparison / use-case keywords). This plan fixes the gaps and lays out a content strategy to capture organic traffic for the keyword space Veqiro should
 own.

 ▎ ⚠️ Important for implementer: apps/landing/AGENTS.md states this is Next.js 16 with breaking changes from what's in training data. Before touching any
 ▎ file, read node_modules/next/dist/docs/ for the current APIs — do NOT apply patterns from Next 13/14/15 from memory. Metadata API, robots.ts, sitemap.ts
 ▎  shapes, generateMetadata, and params typing may differ.

 ---
 1. Current State Snapshot (what already exists)

 Pages in sitemap (11 URLs total)

 ┌─────────────────────────────────────────┬──────────────────────────────┬────────────────────────┬────────────────────────────┬────────────────────┐
 │                  Route                  │            Title             │    Meta description    │         Canonical          │      OG image      │
 ├─────────────────────────────────────────┼──────────────────────────────┼────────────────────────┼────────────────────────────┼────────────────────┤
 │ /                                       │ "Veqiro — Hire Your AI Crew" │ ✅ in layout           │ SITE_URL (layout default)  │ /og-image.png      │
 │                                         │                              │                        │                            │ (missing file)     │
 ├─────────────────────────────────────────┼──────────────────────────────┼────────────────────────┼────────────────────────────┼────────────────────┤
 │                                         │ "About Veqiro — Six AI       │                        │                            │                    │
 │ /about                                  │ Employees, One Bill ·        │ ✅ page-level          │ SITE_URL (inherited) ⚠️    │ inherited          │
 │                                         │ Veqiro"                      │                        │                            │                    │
 ├─────────────────────────────────────────┼──────────────────────────────┼────────────────────────┼────────────────────────────┼────────────────────┤
 │ /pricing                                │ "Pricing · Veqiro"           │ ❌ inherits layout     │ SITE_URL (inherited) ⚠️    │ inherited          │
 │                                         │                              │ (generic)              │                            │                    │
 ├─────────────────────────────────────────┼──────────────────────────────┼────────────────────────┼────────────────────────────┼────────────────────┤
 │ /privacy                                │ "Privacy Policy | Veqiro"    │ ✅ page-level          │ SITE_URL (inherited) ⚠️    │ inherited          │
 ├─────────────────────────────────────────┼──────────────────────────────┼────────────────────────┼────────────────────────────┼────────────────────┤
 │ /terms                                  │ "Terms of Service | Veqiro"  │ ✅ page-level          │ SITE_URL (inherited) ⚠️    │ inherited          │
 ├─────────────────────────────────────────┼──────────────────────────────┼────────────────────────┼────────────────────────────┼────────────────────┤
 │ /agents/{vega,scout,maya,sage,lex,rex}  │ "{Name} — {Role} | Veqiro"   │ ✅                     │ SITE_URL (inherited) ⚠️    │ no OG image        │
 │ (×6)                                    │ via generateMetadata         │ employee.description   │ all 6 share the same       │ override ⚠️        │
 │                                         │                              │                        │ canonical                  │                    │
 └─────────────────────────────────────────┴──────────────────────────────┴────────────────────────┴────────────────────────────┴────────────────────┘

 Infrastructure currently in place ✅

 - apps/landing/src/app/layout.tsx — global metadata with title template, keywords, OG, Twitter card, canonical (root only), robots: {index: true, follow:
 true}.
 - apps/landing/src/app/robots.ts — User-Agent: * / Allow: / + sitemap pointer. Live at https://veqiro.com/robots.txt.
 - apps/landing/src/app/sitemap.ts — emits 11 URLs with priorities and lastModified. Live at https://veqiro.com/sitemap.xml.
 - apps/landing/src/app/agents/[slug]/page.tsx — generateStaticParams() + generateMetadata() for all 6 agent pages.
 - Proper H1/H2/H3 hierarchy on every page (verified in hero/sections/agent-page).
 - Image alt attributes on the hero image and all 6 agent character components.

 Gaps / defects to fix ❌

 - public/og-image.png is referenced but does not exist → social shares break.
 - No favicon / manifest / touch icons anywhere in public/ or metadata.
 - No JSON-LD schema markup anywhere (Organization, SoftwareApplication, Product, FAQPage, BreadcrumbList, Person for agents).
 - Canonical tag: alternates.canonical: SITE_URL is hardcoded in layout — every page (/about, /pricing, each /agents/{slug}) incorrectly declares the
 homepage as its canonical. Potential deindexation of secondary pages.
 - Agent pages — generateMetadata does not set openGraph.images or twitter, and does not override alternates.canonical. Shares of /agents/vega render with
 the generic OG image + homepage canonical.
 - /pricing has no page-level metadata export → uses default layout description which is generic.
 - No blog / resource / changelog / use-case pages — the footer links to "Blog", "Changelog", "Careers", "Press Kit", "Security" all resolve to a mailto:
 CTA, not real pages.
 - No comparison pages — zero pages targeting "Lindy alternative", "Sintra alternative", etc.
 - No BreadcrumbList structure on secondary/deep pages.
 - image rendering uses <img> tags in some components (characters.tsx) rather than next/image — impacts LCP/CLS.
 - No llms.txt file (useful for AI crawler citability / GEO).

 ---
 2. Keyword Research

 Methodology notes

 Volume and difficulty numbers below are estimates based on category patterns and the 2026 competitive landscape (Lindy, Sintra, Relevance AI are actively
 bidding + ranking in this space). Before committing content investment, Phase 0 task: validate these with a real tool — Google Keyword Planner, Ahrefs,
 SEMrush, or DataForSEO MCP (the seo-cluster skill is set up for this; scripts/keyword_planner.py is available if Google Ads credentials are configured).

 Search intent legend: I = Informational, N = Navigational, C = Commercial, T = Transactional. Difficulty (KD) is 0–100; volume is monthly US Google.

 Cluster 1 — Core category / "AI employees" (Homepage target)

 The positioning battle. Veqiro should own this cluster alongside Sintra/Lindy.

 ┌──────────────────────┬─────────────┬─────┬────────┬─────────────────────────────────────────┐
 │       Keyword        │ Est. Volume │ KD  │ Intent │                  Notes                  │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ ai employees         │ 2,400       │ 45  │ C      │ Primary target for /                    │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ hire ai employees    │ 880         │ 40  │ T      │ Great match for Veqiro's "hire" framing │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ ai workforce         │ 1,900       │ 50  │ C      │                                         │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ ai employee platform │ 320         │ 35  │ C      │ Sweet spot — lower KD, direct intent    │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ digital employees    │ 1,300       │ 48  │ C      │ Competed by Sintra, Lindy               │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ ai agents platform   │ 1,600       │ 52  │ C      │                                         │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ ai team for business │ 210         │ 28  │ C      │ Long-tail, winnable                     │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ autonomous ai agents │ 1,700       │ 55  │ I      │ Partially informational                 │
 ├──────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────────────┤
 │ virtual ai employees │ 170         │ 25  │ C      │ Winnable long-tail                      │
 └──────────────────────┴─────────────┴─────┴────────┴─────────────────────────────────────────┘

 Cluster 2 — Startup / SMB qualifier (Home + /about)

 Where Veqiro differentiates from enterprise (Moveworks) and dev-focused (Cursor) tools.

 ┌─────────────────────────────────────┬─────────────┬─────┬────────┬─────────────────────────────────┐
 │               Keyword               │ Est. Volume │ KD  │ Intent │              Notes              │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ ai agents for startups              │ 720         │ 38  │ C      │ Strong homepage target          │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ ai tools for founders               │ 590         │ 35  │ C      │                                 │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ ai tools for small teams            │ 260         │ 30  │ C      │                                 │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ ai for lean teams                   │ 90          │ 20  │ C      │ Easy win, matches copy verbatim │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ ai assistant for founders           │ 340         │ 32  │ C      │                                 │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ ai platform for small business      │ 480         │ 42  │ C      │                                 │
 ├─────────────────────────────────────┼─────────────┼─────┼────────┼─────────────────────────────────┤
 │ all in one ai platform for startups │ 140         │ 22  │ C      │ Very winnable                   │
 └─────────────────────────────────────┴─────────────┴─────┴────────┴─────────────────────────────────┘

 Cluster 3 — Per-agent keyword clusters (6 dedicated clusters)

 Each /agents/{slug} page should own a tight bundle. These are the highest-ROI clusters — lower competition, extremely high intent.

 3a) Vega — Executive Assistant cluster

 ┌───────────────────────────────────┬──────────┬─────┬────────┐
 │              Keyword              │ Est. Vol │ KD  │ Intent │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ ai executive assistant            │ 1,600    │ 42  │ C      │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ ai assistant for email            │ 880      │ 38  │ C      │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ ai inbox management               │ 390      │ 32  │ C      │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ ai email assistant                │ 2,400    │ 48  │ C      │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ ai scheduling assistant           │ 590      │ 40  │ C      │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ ai calendar assistant             │ 320      │ 30  │ C      │
 ├───────────────────────────────────┼──────────┼─────┼────────┤
 │ virtual ai assistant for founders │ 110      │ 22  │ T      │
 └───────────────────────────────────┴──────────┴─────┴────────┘

 3b) Scout — Research cluster

 ┌─────────────────────────────┬──────────┬─────┬────────┐
 │           Keyword           │ Est. Vol │ KD  │ Intent │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai competitor research tool │ 480      │ 38  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai market research tool     │ 1,900    │ 52  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai competitive intelligence │ 720      │ 45  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai research assistant       │ 3,600    │ 55  │ I/C    │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ competitor analysis ai      │ 210      │ 30  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai for business research    │ 170      │ 28  │ I      │
 └─────────────────────────────┴──────────┴─────┴────────┘

 3c) Maya — Content & Marketing cluster

 ┌────────────────────────────────┬──────────┬─────┬────────┐
 │            Keyword             │ Est. Vol │ KD  │ Intent │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai content generator           │ 8,100    │ 62  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai social media post generator │ 2,900    │ 50  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai content marketing tool      │ 1,600    │ 55  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai copywriter                  │ 3,300    │ 58  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai linkedin post generator     │ 1,300    │ 45  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai twitter post generator      │ 480      │ 35  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ brand voice ai                 │ 170      │ 25  │ C      │
 ├────────────────────────────────┼──────────┼─────┼────────┤
 │ ai content calendar            │ 720      │ 40  │ C      │
 └────────────────────────────────┴──────────┴─────┴────────┘

 3d) Sage — SEO cluster

 ┌──────────────────────────┬──────────┬─────┬────────┐
 │         Keyword          │ Est. Vol │ KD  │ Intent │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ ai seo tool              │ 4,400    │ 60  │ C      │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ ai seo assistant         │ 880      │ 48  │ C      │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ ai keyword research tool │ 1,600    │ 52  │ C      │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ ai blog writer           │ 3,600    │ 58  │ C      │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ ai content briefs        │ 260      │ 32  │ C      │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ ai content audit         │ 140      │ 28  │ C      │
 ├──────────────────────────┼──────────┼─────┼────────┤
 │ seo agent ai             │ 320      │ 35  │ C      │
 └──────────────────────────┴──────────┴─────┴────────┘

 3e) Lex — Legal cluster

 ┌─────────────────────────────┬──────────┬─────┬────────┐
 │           Keyword           │ Est. Vol │ KD  │ Intent │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai contract review          │ 1,900    │ 52  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai legal assistant          │ 1,300    │ 48  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai for contract analysis    │ 590      │ 42  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai contract review software │ 720      │ 45  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai nda review               │ 110      │ 25  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ ai compliance tool          │ 390      │ 38  │ C      │
 ├─────────────────────────────┼──────────┼─────┼────────┤
 │ legal ai for startups       │ 210      │ 30  │ C      │
 └─────────────────────────────┴──────────┴─────┴────────┘

 3f) Rex — Data / Finance cluster

 ┌────────────────────────┬──────────┬─────┬────────┐
 │        Keyword         │ Est. Vol │ KD  │ Intent │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ ai financial analyst   │ 1,300    │ 50  │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ ai for saas metrics    │ 140      │ 28  │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ ai revenue forecasting │ 210      │ 32  │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ ai for startup finance │ 170      │ 25  │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ ai cfo                 │ 590      │ 42  │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ ai kpi dashboard       │ 320      │ 35  │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ mrr tracking ai        │ 90       │ 22  │ C      │
 └────────────────────────┴──────────┴─────┴────────┘

 Cluster 4 — Competitor / alternative pages (highest buying intent)

 Users searching these are ready to switch. A dedicated page per alternative usually ranks within 3–6 months with modest content (1,200–1,800 words + a
 comparison table + reviews + FAQ schema).

 ┌──────────────────────────┬──────────┬─────┬────────┬─────────────────────────────────────┐
 │         Keyword          │ Est. Vol │ KD  │ Intent │             Target URL              │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ lindy ai alternative     │ 590      │ 30  │ T      │ /compare/lindy-alternative          │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ sintra ai alternative    │ 320      │ 28  │ T      │ /compare/sintra-alternative         │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ relevance ai alternative │ 390      │ 32  │ T      │ /compare/relevance-ai-alternative   │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ cognosys alternative     │ 140      │ 22  │ T      │ /compare/cognosys-alternative       │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ jasper alternative       │ 2,900    │ 55  │ T      │ /compare/jasper-alternative (Maya)  │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ copy.ai alternative      │ 1,300    │ 48  │ T      │ /compare/copy-ai-alternative (Maya) │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ veqiro vs lindy          │ 70       │ 15  │ T      │ Same page as lindy alternative      │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ veqiro vs sintra         │ 40       │ 10  │ T      │ Same page as sintra alternative     │
 ├──────────────────────────┼──────────┼─────┼────────┼─────────────────────────────────────┤
 │ zapier ai alternative    │ 590      │ 45  │ T      │ /compare/zapier-agents-alternative  │
 └──────────────────────────┴──────────┴─────┴────────┴─────────────────────────────────────┘

 Rule: one comparison page per competitor (do not create thin splits like "X vs Veqiro" and "alternatives to X" as separate URLs — consolidate with clear
 H2 sections and schema).

 Cluster 5 — Use-case / jobs-to-be-done (long-tail, high intent)

 These feed directly off the marketing copy. High conversion, very low competition.

 ┌──────────────────────────────┬──────────┬─────┬────────┬────────────────────────────┐
 │           Keyword            │ Est. Vol │ KD  │ Intent │         Target URL         │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai agent for founders        │ 170      │ 22  │ C      │ /use-cases/founders        │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai tools for marketing teams │ 720      │ 45  │ C      │ /use-cases/marketing-teams │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai for agencies              │ 480      │ 38  │ C      │ /use-cases/agencies        │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai tools for solopreneurs    │ 590      │ 38  │ C      │ /use-cases/solopreneurs    │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai tools for saas startups   │ 320      │ 35  │ C      │ /use-cases/saas-startups   │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai for sales teams           │ 1,600    │ 48  │ C      │ /use-cases/sales-teams     │
 ├──────────────────────────────┼──────────┼─────┼────────┼────────────────────────────┤
 │ ai for early-stage startups  │ 140      │ 25  │ C      │ (merge into founders)      │
 └──────────────────────────────┴──────────┴─────┴────────┴────────────────────────────┘

 Cluster 6 — Sentence-level / AI-Overviews / GEO queries

 These dominate Google's AI Overviews, ChatGPT answers, Perplexity citations. Winning them doesn't require page-one ranking — it requires structured,
 citable content with FAQ schema and clear direct answers.

 ┌───────────────────────────────────────────┬────────┬─────────────────────────────┐
 │                   Query                   │ Intent │       Where to answer       │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "what is the best AI team for a startup"  │ I      │ Home + About (FAQ schema)   │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "how much does an AI employee cost"       │ I      │ Pricing (FAQ schema)        │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "can AI replace a virtual assistant"      │ I      │ Blog + Vega page            │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "what is an AI agent"                     │ I      │ Blog glossary post          │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "AI employee vs freelancer"               │ I      │ Blog                        │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "how to build an AI team for my startup"  │ I      │ Blog long-form              │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "how do I automate my inbox with AI"      │ I      │ Vega page + Blog            │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "what AI tool should a founder use"       │ I      │ Founders use-case page      │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "is Veqiro safe" / "how secure is Veqiro" │ N      │ Security page (new) + FAQ   │
 ├───────────────────────────────────────────┼────────┼─────────────────────────────┤
 │ "who makes Veqiro"                        │ N      │ About + Organization schema │
 └───────────────────────────────────────────┴────────┴─────────────────────────────┘

 Cluster 7 — Branded (capture now, defend forever)

 ┌────────────────────────┬──────────┬─────┬────────┐
 │        Keyword         │ Est. Vol │ KD  │ Intent │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ veqiro                 │ ramping  │ n/a │ N      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ veqiro ai              │ ramping  │ n/a │ N      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ veqiro pricing         │ ramping  │ n/a │ T      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ veqiro review          │ ramping  │ n/a │ C      │
 ├────────────────────────┼──────────┼─────┼────────┤
 │ veqiro vs [competitor] │ ramping  │ n/a │ T      │
 └────────────────────────┴──────────┴─────┴────────┘

 Branded volume will scale with marketing spend; SEO infra must not fumble these (Organization schema, sitelinks search box, consistent NAP).

 Keyword-to-URL mapping (authoritative routing table)

 ┌───────────────────────────────────┬─────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
 │                URL                │             Primary keyword             │                Secondary keywords (2–3)                 │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /                                 │ ai employees                            │ hire ai employees, ai workforce, ai agents for startups │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /about                            │ who is veqiro / company story           │ made by humans, ai crew origin                          │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /pricing                          │ ai employee pricing / ai agents pricing │ hire ai agents cost, veqiro pricing                     │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /agents/vega                      │ ai executive assistant                  │ ai inbox management, ai email assistant                 │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /agents/scout                     │ ai competitor research tool             │ ai market research, ai competitive intelligence         │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /agents/maya                      │ ai content generator                    │ ai social media post generator, ai copywriter           │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /agents/sage                      │ ai seo tool                             │ ai keyword research tool, ai blog writer                │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /agents/lex                       │ ai contract review                      │ ai legal assistant, ai nda review                       │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /agents/rex                       │ ai financial analyst                    │ ai for saas metrics, ai revenue forecasting             │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /compare/lindy-alternative        │ lindy alternative                       │ veqiro vs lindy                                         │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /compare/sintra-alternative       │ sintra alternative                      │ veqiro vs sintra                                        │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /compare/relevance-ai-alternative │ relevance ai alternative                │ veqiro vs relevance ai                                  │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /compare/jasper-alternative       │ jasper alternative                      │ ai content generator                                    │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /use-cases/founders               │ ai tools for founders                   │ ai agent for founders                                   │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /use-cases/marketing-teams        │ ai tools for marketing teams            │ ai marketing assistant                                  │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /use-cases/agencies               │ ai for agencies                         │ ai tools for agencies                                   │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /use-cases/solopreneurs           │ ai tools for solopreneurs               │ ai assistant for solo founders                          │
 ├───────────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ /blog and /blog/[slug]            │ (varies per post)                       │ (see Phase 3 content calendar below)                    │
 └───────────────────────────────────┴─────────────────────────────────────────┴─────────────────────────────────────────────────────────┘

 ---
 3. Modularity Principle — build once, reuse everywhere

 Core rule: any SEO element that repeats across pages is a shared helper/component, never hand-copied into each page file. Per-page files should only pass
 parameters. This keeps the whole SEO layer maintainable by one person in one afternoon, and makes future changes (e.g., switching OG image style, renaming
  a brand term, adjusting schema fields) a single-file edit instead of 11+.

 3.0.1 Shared metadata builder — src/lib/seo.ts

 Single source of truth for every page's Metadata object. Each page's generateMetadata or static metadata export just calls this with its own params.

 // apps/landing/src/lib/seo.ts
 import type { Metadata } from 'next';

 export const SITE_URL =
   process.env.NEXT_PUBLIC_LANDING_URL || 'https://veqiro.com';

 export type BuildMetaInput = {
   title: string;                       // page-specific title (no "· Veqiro" suffix — template handles it)
   description: string;                 // ≤158 chars
   path: string;                        // e.g. "/agents/vega" — used for canonical + og:url
   ogImage?: string;                    // path relative to /public, defaults to /og-image.png
   ogImageAlt?: string;
   noindex?: boolean;                   // true for /privacy, /terms
   keywords?: string[];                 // optional extra, merged with site defaults
   type?: 'website' | 'article';
 };

 export function buildPageMetadata(i: BuildMetaInput): Metadata {
   const url = new URL(i.path, SITE_URL).toString();
   const ogImage = i.ogImage ?? '/og-image.png';
   return {
     title: i.title,
     description: i.description,
     keywords: [...SITE_KEYWORDS, ...(i.keywords ?? [])],
     alternates: { canonical: url },
     openGraph: {
       type: i.type ?? 'website',
       url,
       title: i.title,
       description: i.description,
       siteName: 'Veqiro',
       images: [{ url: ogImage, width: 1200, height: 630, alt: i.ogImageAlt ?? i.title }],
     },
     twitter: {
       card: 'summary_large_image',
       title: i.title,
       description: i.description,
       images: [ogImage],
     },
     robots: i.noindex
       ? { index: false, follow: true }
       : { index: true, follow: true },
   };
 }

 Every page becomes a two-line metadata declaration:

 // apps/landing/src/app/pricing/page.tsx
 export const metadata = buildPageMetadata({
   title: 'AI Employee Pricing — One Plan, Six Agents',
   description: 'Veqiro pricing: one subscription, all six AI employees...',
   path: '/pricing',
   ogImage: '/og/pricing.png',
 });

 // apps/landing/src/app/agents/[slug]/page.tsx
 export async function generateMetadata({ params }): Promise<Metadata> {
   const { slug } = await params;
   const emp = EMPLOYEES.find(e => e.key === slug);
   if (!emp) return {};
   return buildPageMetadata({
     title: `${emp.name} — ${AGENT_META[slug].seoTitleSuffix}`,
     description: AGENT_META[slug].metaDescription,
     path: `/agents/${slug}`,
     ogImage: `/og/${slug}.png`,
     ogImageAlt: `${emp.name}, Veqiro's AI ${emp.role}`,
   });
 }

 Add an AGENT_META map (keyed by slug) in data.ts or seo.ts holding the 6 SEO-tuned descriptions and title suffixes — so meta tuning is one file, not six.

 3.0.2 Typed JSON-LD builders — src/lib/jsonld.ts

 One function per schema type. Pages call them, pass params, render via the shared <JsonLd> component. No string-concatenation, no hand-rolled schema in
 page files.

 // apps/landing/src/lib/jsonld.ts
 export const organizationJsonLd = () => ({ /* reads site-config */ });
 export const websiteJsonLd = () => ({ /* reads site-config */ });
 export const softwareApplicationJsonLd = () => ({ /* reads site-config */ });
 export const productJsonLd = (tiers: PricingTier[]) => ({ ... });
 export const personAgentJsonLd = (emp: Employee) => ({ ... });
 export const faqPageJsonLd = (items: { q: string; a: string }[]) => ({ ... });
 export const breadcrumbJsonLd = (crumbs: { name: string; url: string }[]) => ({ ... });
 export const articleJsonLd = (post: BlogPost) => ({ ... });

 All input types come from existing files — PricingTier and faqItems from site-config.ts, Employee from data.ts. No duplication.

 3.0.3 <JsonLd> component — src/components/veqiro/json-ld.tsx

 Single server component that renders any JSON-LD object safely. Used everywhere schema is emitted.

 export function JsonLd({ data }: { data: object | object[] }) {
   const payload = Array.isArray(data) ? data : [data];
   return (
     <script
       type="application/ld+json"
       dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
     />
   );
 }

 Pages use it once:

 // in /agents/[slug]/page.tsx
 <JsonLd data={[personAgentJsonLd(emp), breadcrumbJsonLd(crumbs)]} />

 3.0.4 <Breadcrumbs> component — src/components/veqiro/breadcrumbs.tsx

 Renders the visible breadcrumb UI and emits BreadcrumbList JSON-LD from the same prop. One call per page, zero duplication.

 <Breadcrumbs items={[
   { name: 'Home', url: '/' },
   { name: 'Agents', url: '/#crew' },
   { name: emp.name, url: `/agents/${emp.key}` }
 ]} />

 3.0.5 <PageShell> (optional) — src/components/veqiro/page-shell.tsx

 Optional but recommended: wrap every non-home page's JSX in a <PageShell title path breadcrumbs jsonLd={...}> that takes care of breadcrumbs, default nav,
  footer, per-page JSON-LD, and analytics mount. Each new page becomes ~30 lines instead of 100.

 3.0.6 <AgentOgImage> at build time (optional, nice-to-have)

 Next.js supports generating OG images at build time via opengraph-image.tsx files. Instead of hand-designing 6 static PNGs, create ONE file-based
 generator at apps/landing/src/app/agents/[slug]/opengraph-image.tsx that reads the agent from EMPLOYEES and composes an image using Satori/next/og. One
 file = six OG images, automatically regenerated if copy or color changes. (Confirm exact API against Next 16 docs per the AGENTS.md rule.) The static PNG
 fallback listed in the Files-to-Create table can stay — or be dropped if this approach is used.

 3.0.7 Alt-text helper

 Centralize image alt-text construction for anything tied to the crew:

 // apps/landing/src/lib/alt.ts
 export const agentAlt = (emp: Employee) =>
   `${emp.name}, Veqiro's AI ${emp.role}`;

 Used by characters.tsx, agent-page.tsx, about-crew-grid.tsx, OG image generator — one rule, no drift.

 3.0.8 Content constants — reuse what already exists

 Do not re-declare brand name, contact, social links, FAQ Q&As, pricing tiers, or agent data anywhere else. Source of truth:

 - apps/landing/src/lib/site-config.ts → brand, contact, social, FAQ, footer columns, pricing tiers. All Organization/Product/FAQPage JSON-LD reads from
 here.
 - apps/landing/src/components/veqiro/data.ts → per-agent facts. All Person JSON-LD, per-agent meta, per-agent OG image reads from here.

 If a future copy change is needed (e.g., new agent, updated price), it's a one-line edit in one of those two files — and every page, sitemap entry, schema
  block, and OG image picks it up automatically.

 3.0.9 What goes in page files vs. helpers

 ┌──────────────────────────────────────────────┬─────────────────────────────────────────┐
 │              Lives in page file              │             Lives in helper             │
 ├──────────────────────────────────────────────┼─────────────────────────────────────────┤
 │ A single buildPageMetadata({...}) call       │ All Metadata object construction        │
 ├──────────────────────────────────────────────┼─────────────────────────────────────────┤
 │ A single <JsonLd data={[...]} /> call        │ All schema builders                     │
 ├──────────────────────────────────────────────┼─────────────────────────────────────────┤
 │ Page-specific JSX content                    │ Breadcrumbs rendering + schema emission │
 ├──────────────────────────────────────────────┼─────────────────────────────────────────┤
 │ Page-specific headings + hero copy           │ Alt-text formulas, OG image resolution  │
 ├──────────────────────────────────────────────┼─────────────────────────────────────────┤
 │ generateStaticParams (framework requirement) │ Keyword list, SITE_URL, title template  │
 └──────────────────────────────────────────────┴─────────────────────────────────────────┘

 Rule of thumb: if you find yourself writing the same shape of code in two page files, stop and move it to lib/seo.ts or a shared component before
 continuing.

 ---
 4. On-Page SEO Implementation Plan

 4.1 Global fixes — src/app/layout.tsx

 1. Remove alternates.canonical from layout root. A canonical that's hardcoded to SITE_URL overrides every child page. Instead:
   - Set canonical per-page using each page's own metadata export or generateMetadata return.
   - If a global default is desired, use alternates.canonical: "/" (Next resolves relative paths against metadataBase) — but safest is per-page.
 2. Expand keywords array — add: ai executive assistant, ai content generator, ai seo tool, ai contract review, ai financial analyst, ai for founders, ai
 for lean teams, hire ai employees.
 3. Add icons block to metadata:
   - icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png', shortcut: '/favicon-32x32.png' }
 4. Add manifest: '/site.webmanifest' for PWA + search engine signal.
 5. Add authors, creator, publisher (all "Veqiro") and category: "Technology".
 6. Move JSON-LD injection into layout <body> (Organization + WebSite schema — see §5.1).

 4.2 Per-page metadata updates

 Write a dedicated metadata export (or convert Client → Server / add a Server wrapper) for every page that currently lacks one.

 ┌───────────────┬───────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┐
 │     Page      │ Title (rendered, incl. template)  │                                  Meta description (≤158 chars)                                  │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /             │ Veqiro — Hire Your AI Crew (bare  │ (keep current; rewrite to include primary kw) "Veqiro gives you six AI employees — an exec      │
 │               │ — no template)                    │ assistant, SEO, content, research, legal, and finance — for $39/mo. Hire your AI crew today."   │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /about        │ About Veqiro — Six AI Employees,  │ "We built Veqiro because lean teams deserve the same leverage as big ones. Meet the six AI      │
 │               │ One Bill · Veqiro                 │ employees behind your crew."                                                                    │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /pricing      │ AI Employee Pricing — One Plan,   │ "Veqiro pricing: one subscription, all six AI employees. $39/mo (or $29/mo billed yearly).      │
 │               │ Six Agents · Veqiro               │ 7-day free trial. No credit card."                                                              │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /privacy      │ Privacy Policy · Veqiro           │ "How Veqiro collects, uses, and protects your data. GDPR, CCPA compliant." (also robots: {      │
 │               │                                   │ index: false, follow: true } — low-value legal, saves crawl budget)                             │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /terms        │ Terms of Service · Veqiro         │ "The terms governing your use of the Veqiro platform." (same noindex, follow)                   │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /agents/vega  │ Vega — AI Executive Assistant |   │ "Vega runs your inbox, books your calendar, and drafts emails in your voice. An AI executive    │
 │               │ Veqiro                            │ assistant that ships 24/7."                                                                     │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /agents/scout │ Scout — AI Research & Competitive │ "Scout runs competitor teardowns, market scans, and lead research. AI research assistant that   │
 │               │  Intelligence | Veqiro            │ gives you memos, not data dumps."                                                               │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /agents/maya  │ Maya — AI Content Generator &     │ "Maya writes blog posts, ads, and social content in your brand voice. AI content generator      │
 │               │ Social Media Writer | Veqiro      │ built for multi-platform publishing."                                                           │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /agents/sage  │ Sage — AI SEO Specialist & Blog   │ "Sage does keyword research, writes SEO-optimized blog posts, and audits your existing content. │
 │               │ Writer | Veqiro                   │  An AI SEO tool that actually ranks."                                                           │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /agents/lex   │ Lex — AI Legal Assistant &        │ "Lex reviews contracts, flags risky clauses, and drafts legal documents in plain English. AI    │
 │               │ Contract Review | Veqiro          │ contract review for founders."                                                                  │
 ├───────────────┼───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ /agents/rex   │ Rex — AI Financial Analyst for    │ "Rex tracks MRR, burn, CAC, and runway — flags anomalies before they become problems. AI        │
 │               │ Startups | Veqiro                 │ financial analyst for SaaS."                                                                    │
 └───────────────┴───────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────┘

 Rules:
 - Title ≤60 chars where possible; meta desc ≤158 chars.
 - Every page gets an alternates.canonical pointing to its own absolute URL.
 - Every page gets openGraph.url, openGraph.title, openGraph.description, and — for agent pages — a per-agent OG image (see §4.3).

 4.3 Open Graph & Twitter cards

 1. Create base OG image at apps/landing/public/og-image.png — 1200×630, JPG/PNG, <300 KB. Must show: Veqiro wordmark + "Hire your AI crew" + crew group
 image.
 2. Create 6 per-agent OG images at apps/landing/public/og/{vega|scout|maya|sage|lex|rex}.png — 1200×630 each, each featuring the agent's portrait + name +
  role + tagline on the agent's brand color background. This makes shares on LinkedIn/X/Slack visibly distinct and click-worthy.
 3. Create /pricing and /about variants at apps/landing/public/og/pricing.png and apps/landing/public/og/about.png.
 4. Update generateMetadata() in apps/landing/src/app/agents/[slug]/page.tsx to set openGraph.images and twitter.images per-agent. Also set openGraph.url
 and alternates.canonical to ${SITE_URL}/agents/${slug}.
 5. Static OG (landing app/opengraph-image.tsx convention in Next 16 — confirm against the Next 16 docs per the AGENTS.md rule) is an acceptable
 alternative.

 4.4 Heading hierarchy audit (existing pages)

 All current pages have a valid single H1 + hierarchical H2/H3 already. Two fixes needed:
 1. Pricing page currently leads with "less than a bad hire." as H1 — this is great for brand but doesn't contain any keyword. Keep it as the visual
 display headline (<h1>), but ensure the immediate subheading/intro paragraph contains "Pricing for Veqiro — one subscription, all six AI employees" so the
  keyword density is natural. Don't change the visible H1 (brand voice wins over robot-tuning here), but add a short keyword-rich paragraph directly
 underneath.
 2. Agent pages — each page's H1 is just the agent's name (e.g., "Vega"). This is weak for SEO. Add a second-level keyword-loaded subtitle rendered as a
 styled text block (not H2) directly under the H1, e.g., "Your AI Executive Assistant" → make the H1 be Vega — Your AI Executive Assistant and keep the big
  display name as styled typography. Confirm in apps/landing/src/components/veqiro/agent-page.tsx.

 4.5 Image alt text

 - ✅ Hero image (alt="The Veqiro crew") is OK — could be stronger: alt="Veqiro's six AI employees: Vega, Scout, Maya, Sage, Lex, Rex".
 - ✅ Agent character components pass alt={emp.name} — strengthen to alt={\${emp.name}, Veqiro's AI ${emp.role}`}insidecharacters.tsxandagent-page.tsx`.
 - ✅ Decorative SVGs already carry aria-hidden.
 - 🔧 Any new images added for blog/use-case/comparison pages must carry keyword-relevant alt text (not keyword stuffing — descriptive).

 4.6 Internal linking

 Current state: navigation links work, footer has Crew/Product/Company/Legal columns, many footer links point to mailto: placeholders. Gaps:

 1. Agent-to-agent cross-linking: Inside each agent page, add a "The rest of the crew" strip at the bottom linking to the other 5 /agents/{slug} pages.
 Uses existing EMPLOYEES data.
 2. Pricing → Agents: Pricing currently lists all 6 agents with links (good). Add a short paragraph near each agent card linking to their dedicated page.
 3. Home → secondary pages: Add a small inline link from the FAQ section on / to /pricing (anchor answer to "how much does it cost").
 4. Blog → Agent pages: Every Phase 3 blog post must link back to the most relevant /agents/{slug} using exact keyword anchor text (e.g., "our AI SEO
 specialist, Sage" linking to /agents/sage).
 5. Footer fixes: Replace all mailto: placeholder footer links with either real pages (Phase 2) or remove them. Keep only: Vega/Scout/Maya/Sage/Lex/Rex
 (real), Pricing (real), How it Works (anchor), FAQ (anchor), About (real), Privacy (real), Terms (real). Others (Blog, Changelog, Careers, Press kit,
 Security, Cookies) should either be built or removed — shipping placeholder links that go to mailto degrades both UX and the site's link graph.
 6. Breadcrumbs: Add a visible breadcrumb component on /agents/{slug}, /compare/{slug}, /use-cases/{slug}, and all /blog/* — tied to BreadcrumbList schema
 (§5.4).

 4.7 Sitemap updates

 apps/landing/src/app/sitemap.ts currently emits 11 URLs. After Phase 2 update it to include new comparison pages, use-case pages, and any blog index /
 post URLs. Rules:
 - Home: priority 1.0, weekly
 - Agent pages + Pricing: 0.9, weekly (bumping from monthly — these should be re-crawled faster)
 - Comparison + use-case pages: 0.8, monthly
 - About: 0.7, monthly
 - Blog index: 0.8, weekly; individual posts 0.7, monthly
 - Privacy/Terms: 0.3, yearly, or drop from sitemap entirely if they're set to noindex per §4.2.

 4.8 robots.txt updates

 Current apps/landing/src/app/robots.ts is fine. Add:
 - Disallow any future login redirector paths that live under landing (usually none — the app lives on the main subdomain).
 - Explicit Disallow: /privacy and Disallow: /terms is optional — noindex via meta is preferred (still lets bots read, just not rank).
 - Keep the Host: line.

 ---
 5. Technical / Structured Data Implementation Plan

 5.1 Organization + WebSite schema (site-wide)

 Add a <script type="application/ld+json"> inject in layout.tsx body (or a dedicated <JsonLd> server component imported into layout) with two objects:

 Organization:
 {
   "@context": "https://schema.org",
   "@type": "Organization",
   "@id": "https://veqiro.com/#organization",
   "name": "Veqiro",
   "url": "https://veqiro.com",
   "logo": "https://veqiro.com/og/veqiro-logo.png",
   "description": "Veqiro is a crew of six specialized AI employees...",
   "email": "hello@veqiro.com",
   "address": {
     "@type": "PostalAddress",
     "addressLocality": "Bengaluru",
     "addressCountry": "IN"
   },
   "sameAs": [
     "https://twitter.com/veqiro",
     "https://linkedin.com/company/veqiro",
     "https://instagram.com/veqiro",
     "https://github.com/veqiro"
   ]
 }

 WebSite (enables Google sitelinks search box if a search is added later; keep potentialAction only if real search exists):
 {
   "@context": "https://schema.org",
   "@type": "WebSite",
   "@id": "https://veqiro.com/#website",
   "url": "https://veqiro.com",
   "name": "Veqiro",
   "publisher": { "@id": "https://veqiro.com/#organization" }
 }

 Pull values from the existing apps/landing/src/lib/site-config.ts (already has contact, social, etc.) — don't hardcode.

 5.2 SoftwareApplication schema (home + pricing)

 Inject on / and /pricing:
 {
   "@context": "https://schema.org",
   "@type": "SoftwareApplication",
   "name": "Veqiro",
   "operatingSystem": "Web",
   "applicationCategory": "BusinessApplication",
   "description": "A crew of six AI employees for lean teams...",
   "offers": {
     "@type": "Offer",
     "price": "39.00",
     "priceCurrency": "USD",
     "priceSpecification": {
       "@type": "UnitPriceSpecification",
       "price": "39.00",
       "priceCurrency": "USD",
       "billingIncrement": 1,
       "unitCode": "MON"
     }
   },
   "aggregateRating": null,
   "publisher": { "@id": "https://veqiro.com/#organization" }
 }
 Do not fabricate aggregateRating. Add it only when real reviews are collected (Phase 4).

 5.3 Person schema (per agent page)

 On each /agents/{slug} page, inject Person-ish schema (cast as Person with a disambiguatingDescription noting "AI agent" — or use SoftwareApplication if
 you prefer not to anthropomorphize; Person reads more naturally with the crew framing but be accurate):
 {
   "@context": "https://schema.org",
   "@type": "Person",
   "name": "Vega",
   "jobTitle": "Executive Assistant (AI)",
   "description": "Vega runs your inbox, books your calendar...",
   "image": "https://veqiro.com/Vega.jpeg",
   "worksFor": { "@id": "https://veqiro.com/#organization" },
   "knowsAbout": ["email triage", "calendar management", "meeting scheduling"],
   "disambiguatingDescription": "Vega is an AI agent, not a human."
 }
 Pull knowsAbout from employee.skills in data.ts.

 5.4 BreadcrumbList schema

 On every non-home page, emit BreadcrumbList matching the visible breadcrumbs. Example for /agents/vega:
 {
   "@context": "https://schema.org",
   "@type": "BreadcrumbList",
   "itemListElement": [
     { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://veqiro.com" },
     { "@type": "ListItem", "position": 2, "name": "Agents", "item": "https://veqiro.com/#crew" },
     { "@type": "ListItem", "position": 3, "name": "Vega", "item": "https://veqiro.com/agents/vega" }
   ]
 }

 5.5 FAQPage schema

 Veqiro has two real FAQ sections: the home page FAQ (12 Q&As in siteConfig.faqItems) and the Pricing page's pricing-specific FAQ.

 Caveat from the SEO skill's quality-gates: Google restricted FAQ rich results to government & healthcare sites (Aug 2023). FAQ schema on commercial sites
 is unlikely to show as a SERP rich result — but it still benefits AI citability (ChatGPT, Perplexity, Google AI Overviews read it). Recommendation: keep
 it, don't expect a rich snippet.

 Emit FAQPage on / (the 12 Q&As), on /pricing (pricing Q&As), and later on each comparison page.

 5.6 Product / Offer schema on /pricing

 {
   "@context": "https://schema.org",
   "@type": "Product",
   "name": "Veqiro Crew",
   "description": "All six AI employees in one subscription...",
   "brand": { "@id": "https://veqiro.com/#organization" },
   "offers": [
     { "@type": "Offer", "name": "Monthly", "price": "39.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url":
 "https://veqiro.com/pricing" },
     { "@type": "Offer", "name": "Annual", "price": "348.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url":
 "https://veqiro.com/pricing" }
   ]
 }

 5.7 Schema validation gate

 The SEO skill ships a hooks/validate-schema.py hook that lints JSON-LD on save. Implementer should:
 1. Write each schema block into a typed TypeScript object (not a string literal) in a shared helper apps/landing/src/lib/jsonld.ts.
 2. Render via <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />.
 3. Validate with Google's https://search.google.com/test/rich-results after deploy.
 4. Optionally run .claude/skills/seo/hooks/validate-schema.py on the generated output.

 5.8 Favicon + icon suite

 Create in apps/landing/public/:
 - favicon.ico (multi-size: 16, 32, 48)
 - favicon-16x16.png, favicon-32x32.png
 - apple-touch-icon.png (180×180)
 - android-chrome-192x192.png, android-chrome-512x512.png
 - site.webmanifest:
 {
   "name": "Veqiro",
   "short_name": "Veqiro",
   "icons": [
     { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
     { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
   ],
   "theme_color": "#111111",
   "background_color": "#EFE7D6",
   "display": "standalone"
 }
 - Tool: use https://realfavicongenerator.net or generate via /seo image-gen extension if available.

 5.9 llms.txt (AI search / GEO)

 Create apps/landing/public/llms.txt — a plain-text directory for AI crawlers (ChatGPT, Perplexity, Claude, Gemini). Use the structure from llmstxt.org:
 # Veqiro

 > Veqiro is a crew of six specialized AI employees (Vega, Scout, Maya, Sage, Lex, Rex) for lean teams. One subscription, $39/mo.

 ## Agents
 - [Vega — AI Executive Assistant](https://veqiro.com/agents/vega): email, calendar, briefings
 - [Scout — AI Research & Strategy](https://veqiro.com/agents/scout): competitor teardowns, market scans
 - [Maya — AI Content & Marketing](https://veqiro.com/agents/maya): social posts, blogs, ads
 - [Sage — AI SEO Specialist](https://veqiro.com/agents/sage): keyword research, blog generation
 - [Lex — AI Legal Assistant](https://veqiro.com/agents/lex): contract review, compliance
 - [Rex — AI Financial Analyst](https://veqiro.com/agents/rex): MRR/burn/runway, forecasting

 ## Pricing
 - [Pricing](https://veqiro.com/pricing): $39/mo or $29/mo annual. 7-day free trial.

 ## Company
 - [About](https://veqiro.com/about)

 5.10 Performance & Core Web Vitals

 Audit after Phase 1 with /seo performance or Lighthouse. Likely wins:
 - Swap remaining <img> tags in apps/landing/src/components/veqiro/characters.tsx for next/image with explicit width/height → eliminates CLS on agent
 cards.
 - Hero_Image.jpg is 517 KB JPG — re-export as AVIF/WebP at <150 KB.
 - Google Fonts are loaded via next/font (good). Confirm display: 'swap' or use the Next 16 recommended preloading pattern.
 - Defer any third-party tags (analytics, chat widgets) to after interactive.
 - Verify INP (< 200 ms) after hero animations/marquees are running — the current crew carousel animations may cost interaction latency.

 ---
 6. Additional Static Pages to Create

 Each new page targets a specific keyword cluster from §2. Rationale: Veqiro's current 11-URL footprint cannot capture the long-tail, comparison, or
 use-case demand that's where most organic traffic lives for this category. Competitors (Lindy, Sintra, Relevance AI) each run 40–150 indexed pages.

 6.1 Comparison pages (/compare/{competitor}-alternative) — 5 pages

 High-priority. Each ~1,500–2,000 words, with:
 - Intro: what the competitor is, when it's a good fit, when it isn't
 - Side-by-side feature comparison table
 - Pricing comparison
 - 3–5 reasons teams switch to Veqiro
 - Feature/agent spotlight (which of Veqiro's 6 solve the same problem)
 - FAQ (FAQPage schema)
 - CTA

 Pages:
 1. /compare/lindy-alternative
 2. /compare/sintra-alternative
 3. /compare/relevance-ai-alternative
 4. /compare/jasper-alternative (Maya-focused)
 5. /compare/zapier-agents-alternative

 Why they help SEO: Commercial intent is extremely high, competition is moderate, branded searches for competitors drive predictable volume. Expected
 ranking time: 90–180 days with good backlinks.

 6.2 Use-case pages (/use-cases/{audience}) — 4 pages

 Targets the jobs-to-be-done keyword cluster (§2 Cluster 5). Each page reframes the crew through the lens of a specific audience. ~800–1,200 words, with
 testimonial slots, workflow diagram, persona-specific CTA.

 1. /use-cases/founders — "AI tools for founders"
 2. /use-cases/marketing-teams — "AI tools for marketing teams"
 3. /use-cases/agencies — "AI for agencies"
 4. /use-cases/solopreneurs — "AI tools for solopreneurs"

 Why they help SEO: Persona-level queries are high-intent, the content maps directly to existing agent capabilities (no new product claims), and these
 pages become ideal landing destinations for paid ads — which also helps organic CTR through remarketing.

 6.3 Integrations page (/integrations) — 1 page, with children later

 Veqiro already integrates with Gmail, Google Calendar, LinkedIn, Twitter/X, Instagram, Slack, and (per apps/server) Cloudflare R2. An integrations hub
 ranks for "{tool} ai integration" and is a strong cluster for scaling. Phase 2 ships the hub; Phase 3 adds children pages (/integrations/gmail,
 /integrations/linkedin, etc.).

 6.4 Security page (/security) — 1 page

 The landing footer promises "SOC 2 Type II certified" + "Security" as a footer link, but no page exists. Given this claim, a real security page is
 required for credibility (and B2B buyers search "Veqiro security" before signing up). Covers: certifications, encryption, data handling, GDPR/CCPA,
 incident policy. Also boosts E-E-A-T.

 6.5 Changelog page (/changelog) — 1 page

 Footer links there. Fresh-content signal for Google. Reverse-chronological log of releases (MDX or a simple list in code). Good internal linking anchor
 for blog posts.

 6.6 Blog (/blog + /blog/[slug]) — Phase 3

 See Phase 3 content calendar below. Start with 12 posts across the first 90 days, targeting the top Cluster 6 queries + per-agent how-tos.

 6.7 Explicitly NOT recommended

 - HowTo schema-heavy how-to pages — Google deprecated HowTo rich results (Sept 2023). Keep how-to content as blog posts; don't emit HowTo JSON-LD.
 - Programmatic mass "Veqiro for {city}" — Veqiro is a SaaS, not a local service. Programmatic location pages would trip the skill's quality-gate (no
 unique value per page).
 - Separate pages for Vega vs each of its sub-capabilities (e.g., separate /agents/vega/inbox-triage and /agents/vega/calendar). Bloats thin content — keep
  capabilities as H2 sections on the single agent page. Revisit only if traffic justifies.
 - HowTo FAQ separate page — consolidate all FAQ into existing home + pricing FAQs with schema.

 ---
 7. Phased Roadmap

 Aligned to the SEO skill's 4-phase template (§seo-plan/SKILL.md).


 Phase 1 — Fix foundation (Weeks 1–2)

 Goal: Fix the 11 existing pages so they're competitive.

 Step 1 — Build the shared SEO layer FIRST (these are prerequisites for every page change that follows; build them once, then all page edits become 2-line
 calls):

 - Create apps/landing/src/lib/seo.ts with SITE_URL, SITE_KEYWORDS, AGENT_META map, and buildPageMetadata({...}) (§3.0.1).
 - Create apps/landing/src/lib/jsonld.ts — typed builders: organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd, productJsonLd, personAgentJsonLd,
 faqPageJsonLd, breadcrumbJsonLd, articleJsonLd (§3.0.2). All read from site-config.ts and data.ts — no duplication of brand/FAQ/agent content.
 - Create apps/landing/src/lib/alt.ts with agentAlt(emp) helper (§3.0.7).
 - Create apps/landing/src/components/veqiro/json-ld.tsx — <JsonLd data={...}> wrapper (§3.0.3).
 - Create apps/landing/src/components/veqiro/breadcrumbs.tsx — renders UI + emits BreadcrumbList from the same prop (§3.0.4).

 Step 2 — Assets (one-time; non-code):

 - Create apps/landing/public/og-image.png (1200×630). Optional modular alternative: implement opengraph-image.tsx file-based generator under src/app/
 (§3.0.6) → one file, all OG images derive from data automatically.
 - Create per-agent OG images in apps/landing/public/og/{slug}.png × 6 (skip if using §3.0.6).
 - Create favicon suite + site.webmanifest in apps/landing/public/.
 - Create apps/landing/public/llms.txt.

 Step 3 — Wire helpers into pages (each item below is now a ≤10-line diff because helpers do the work):

 - Update layout.tsx: remove hardcoded canonical; add icons, manifest, expand keywords; inject <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />.
 - Convert each page to export const metadata = buildPageMetadata({...}) — /, /about, /pricing, /privacy, /terms. Privacy and Terms pass noindex: true.
 - Convert /agents/[slug]/page.tsx generateMetadata to a single buildPageMetadata({...}) call reading from AGENT_META[slug] + EMPLOYEES.
 - Add <JsonLd data={[softwareApplicationJsonLd(), faqPageJsonLd(siteConfig.faqItems)]} /> to /.
 - Add <JsonLd data={[productJsonLd(pricingTiers), faqPageJsonLd(pricingFaq)]} /> to /pricing.
 - Add <JsonLd data={[personAgentJsonLd(emp), breadcrumbJsonLd(crumbs)]} /> to each agent page — rendered once in the shared agent-page.tsx component, not
 per-slug.
 - Replace all per-page breadcrumb rendering with <Breadcrumbs items={...}>.

 Step 4 — Content + polish:

 - Swap alt={emp.name} → alt={agentAlt(emp)} in characters.tsx, agent-page.tsx, about-crew-grid.tsx.
 - Add keyword-loaded H1 subtitle on /agents/[slug] (single edit in agent-page.tsx reads from AGENT_META).
 - Fix footer links in site-config.ts (remove/replace mailto: placeholders).
 - Add agent-to-agent "rest of the crew" strip on the bottom of agent-page.tsx (reads from EMPLOYEES).
 - Swap remaining <img> → next/image in characters.tsx (confirm against Next 16 docs per AGENTS.md rule).

 Step 5 — Validate:

 - Validate every page in Google Rich Results Test; fix errors.
 - Submit updated sitemap in Google Search Console + Bing Webmaster.
 - Capture drift snapshot: python .claude/skills/seo/scripts/drift_baseline.py https://veqiro.com → becomes the "Phase 1 done" marker for regression
 tracking.

 Phase 2 — Capture comparison + use-case demand (Weeks 3–6)

 - Create 5 comparison pages under /compare/* (§6.1). Pull data from §2 Cluster 4; write from scratch, emit Product + FAQPage + BreadcrumbList schema on
 each.
 - Create 4 use-case pages under /use-cases/* (§6.2). Emit BreadcrumbList + FAQPage.
 - Create /security page with real security information.
 - Create /integrations hub page (detail children are Phase 3).
 - Create /changelog (starts minimal; updated per release).
 - Update sitemap.ts to include all new URLs with correct priorities (§4.7).
 - Add breadcrumb UI component used across non-home pages.

 Phase 3 — Content engine / Blog (Months 2–4)

 Launch /blog + initial 12 posts. Publishing cadence: 2/week for first month, 1/week after.

 Initial 12 posts (targeting Cluster 6 + long-tail per-agent how-tos):

 ┌─────┬──────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────┬──────────────────────┐
 │  #  │                                Post title                                │            Target keyword             │ Primary agent linked │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 1   │ "What is an AI Employee? A founder's guide to hiring your first one"     │ ai employees / what is an ai employee │ (all)                │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 2   │ "AI Employee vs Freelancer vs Full-time Hire: cost breakdown (2026)"     │ ai employee vs freelancer             │ (all)                │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 3   │ "How to automate your inbox with AI (without losing your voice)"         │ ai inbox automation                   │ Vega                 │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 4   │ "AI for competitor research: the 2-hour weekly workflow we use"          │ ai competitor research                │ Scout                │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 5   │ "Writing content that doesn't sound like AI: a brand-voice primer"       │ ai content brand voice                │ Maya                 │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 6   │ "The modern SEO workflow for founders (with an AI SEO agent)"            │ ai seo workflow                       │ Sage                 │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 7   │ "Contract red flags every founder should know (with AI-assisted review)" │ ai contract red flags                 │ Lex                  │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 8   │ "SaaS metrics every founder tracks: MRR, burn, CAC, LTV explained"       │ saas metrics for founders             │ Rex                  │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 9   │ "How to build an AI team for your startup (step-by-step)"                │ how to build ai team startup          │ (all)                │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 10  │ "Lindy vs Sintra vs Veqiro: which AI employee platform fits you?"        │ lindy vs sintra vs veqiro             │ (all)                │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 11  │ "The best AI tools for agencies in 2026"                                 │ ai tools for agencies                 │ (agencies use-case)  │
 ├─────┼──────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────┤
 │ 12  │ "How a 3-person startup ships like a 10-person team"                     │ lean team ai                          │ (founders use-case)  │
 └─────┴──────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────┴──────────────────────┘

 Each post: 1,500–3,000 words, Article JSON-LD (Article or BlogPosting), BreadcrumbList, internal links to 2–3 agent pages, one comparison page, one
 use-case page. Hero image with descriptive alt.

 Phase 4 — Authority (Months 4–12)

 - Link building: outreach from comparison posts to competitor-alternative communities (Reddit r/startups, r/saas, Hacker News, IndieHackers).
 - Integrations children pages (/integrations/gmail, /integrations/linkedin, etc.) targeting "{tool} ai integration" queries.
 - Guest posts / podcast appearances pointing back to use-case pages.
 - Case studies (/customers/{slug}) once enough customers + permission gathered — emit Review schema (real reviews only).
 - Expand blog to cover second-tier keywords per agent.
 - Consider /resources or /templates (e.g., downloadable "Founder's AI stack" template) with Content + lead-gen loop.

 ---
 8. Files to Modify / Create

 Modify

 ┌───────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                       Path                        │                                              Change                                              │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/layout.tsx                   │ Remove hardcoded canonical; add icons + manifest; expand keywords; inject Org + WebSite JSON-LD  │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/pricing/page.tsx             │ Add metadata export (title, description, canonical, OG)                                          │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/about/page.tsx               │ Add alternates.canonical and OG URL                                                              │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/privacy/page.tsx             │ Add per-page canonical; set robots: { index: false, follow: true }                               │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/terms/page.tsx               │ Same as privacy                                                                                  │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/agents/[slug]/page.tsx       │ Enhance generateMetadata: per-slug canonical, per-slug OG image, stronger description; inject    │
 │                                                   │ Person + BreadcrumbList JSON-LD                                                                  │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/sitemap.ts                   │ Add new URLs after Phase 2; bump agent/pricing to weekly                                         │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/robots.ts                    │ (No structural change; fine as is)                                                               │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/sections.tsx   │ Strengthen alt text; clean up footer mailto: placeholder links                                   │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/characters.tsx │ Swap <img> → next/image; stronger alt                                                            │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/agent-page.tsx │ Add H1 subtitle phrase w/ primary keyword; add "rest of the crew" strip; render JSON-LD          │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/lib/site-config.ts               │ Add footerColumns entries for new real pages (security, integrations, changelog, blog, compare,  │
 │                                                   │ use-cases); remove placeholder mailto: links                                                     │
 └───────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┘

 Create

 ┌─────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
 │                                Path                                 │                                    Purpose                                    │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │                                                                     │ [Shared helper] SITE_URL, SITE_KEYWORDS, AGENT_META map, and                  │
 │ apps/landing/src/lib/seo.ts                                         │ buildPageMetadata({...}) — single source for every page's Next Metadata       │
 │                                                                     │ object (§3.0.1)                                                               │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │                                                                     │ [Shared helper] Typed builders: organizationJsonLd, websiteJsonLd,            │
 │ apps/landing/src/lib/jsonld.ts                                      │ softwareApplicationJsonLd, productJsonLd, personAgentJsonLd, faqPageJsonLd,   │
 │                                                                     │ breadcrumbJsonLd, articleJsonLd (§3.0.2)                                      │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/lib/alt.ts                                         │ [Shared helper] agentAlt(emp) and other alt-text formulas — one rule, reused  │
 │                                                                     │ everywhere images of the crew appear (§3.0.7)                                 │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/json-ld.tsx                      │ [Shared component] Single <JsonLd data={...}> wrapper for <script             │
 │                                                                     │ type="application/ld+json"> — used on every page (§3.0.3)                     │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/breadcrumbs.tsx                  │ [Shared component] <Breadcrumbs items={...}> — renders UI and emits           │
 │                                                                     │ BreadcrumbList JSON-LD from the same prop (§3.0.4)                            │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/page-shell.tsx                   │ [Shared component, optional] Wraps non-home pages (nav + footer + breadcrumbs │
 │                                                                     │  + JSON-LD slot) so new pages are ~30 lines each (§3.0.5)                     │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │                                                                     │ [Shared generator, optional] One file generates all 6 per-agent OG images at  │
 │ apps/landing/src/app/agents/[slug]/opengraph-image.tsx              │ build time from EMPLOYEES data, replacing 6 static PNGs (§3.0.6 — confirm     │
 │                                                                     │ Next 16 API)                                                                  │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/public/og-image.png                                    │ 1200×630 home/default OG                                                      │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/public/og/{vega,scout,maya,sage,lex,rex}.png           │ Per-agent OG × 6                                                              │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/public/og/pricing.png, og/about.png                    │ Per-page OG                                                                   │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/public/favicon.ico + full favicon suite                │ Brand + search engine requirements                                            │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/public/site.webmanifest                                │ PWA manifest                                                                  │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/public/llms.txt                                        │ AI crawler directory                                                          │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/compare/lindy-alternative/page.tsx             │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/compare/sintra-alternative/page.tsx            │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/compare/relevance-ai-alternative/page.tsx      │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/compare/jasper-alternative/page.tsx            │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/compare/zapier-agents-alternative/page.tsx     │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/use-cases/founders/page.tsx                    │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/use-cases/marketing-teams/page.tsx             │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/use-cases/agencies/page.tsx                    │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/use-cases/solopreneurs/page.tsx                │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/security/page.tsx                              │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/integrations/page.tsx                          │ Phase 2 (children Phase 3)                                                    │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/changelog/page.tsx                             │ Phase 2                                                                       │
 ├─────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/app/blog/page.tsx +                                │ Phase 3                                                                       │
 │ apps/landing/src/app/blog/[slug]/page.tsx                           │                                                                               │
 └─────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────┘

 Reuse (don't duplicate)

 ┌────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                    Path                    │                                                Reuse for                                                │
 ├────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/lib/site-config.ts        │ Source of truth for Organization schema (contact, social); FAQ data (faqItems); footer columns. Don't   │
 │                                            │ hardcode any of these in JSON-LD.                                                                       │
 ├────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/data.ts │ Source of truth for Person schema per agent (knowsAbout ← skills, description, etc.). Also source for   │
 │                                            │ per-agent page meta descriptions.                                                                       │
 └────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────┘



 Appendix — SEO skill commands to use during implementation

 - /seo page <url> — deep audit on a single page after editing it (confirms title length, alt text, schema, H-structure).
 - /seo schema <url> — regenerate schema suggestions per page.
 - /seo cluster "ai employees" — generate deeper cluster for homepage (SERP-based).
 - /seo cluster "ai executive assistant" — do this per agent to find secondary keywords and feeder blog posts.
 - /seo sxo <url> — check page-type fit and persona coverage on comparison + use-case pages.
 - /seo drift baseline <url> + /seo drift compare <url> — before/after regression guard.
 - /seo google report — generate the PDF deliverable once Phase 1 ships.