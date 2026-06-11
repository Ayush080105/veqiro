 Veqiro Agent Landing Pages — Feature Sync Plan                                                                                                      │
     │                                                                                                                                                     │
     │ ▎ For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement    │
     │ ▎ this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.                                                                           │
     │                                                                                                                                                     │
     │ Goal: Sync all six agent detail pages in apps/landing to accurately reflect every feature that exists in apps/main, adding missing capabilities,    │
     │ correcting wrong data, and updating content without touching layout or structure.                                                                   │
     │                                                                                                                                                     │
     │ Architecture: All content changes go into a single file — apps/landing/src/components/veqiro/data.ts — in the EMPLOYEES array. Each agent has       │
     │ capabilities[], skills[], actions[], howItHelps, workflow[], and outcomes[]. No layout files need editing.                                          │
     │                                                                                                                                                     │
     │ Tech Stack: TypeScript data file edit only. No component changes, no routing changes, no new files.                                                 │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Part 1 — Agent Feature Inventory (What Actually Exists in apps/main)                                                                                │
     │                                                                                                                                                     │
     │ This is the ground-truth reference for implementation. Refer back here when writing content.                                                        │
     │                                                                                                                                                     │
     │ MAYA — Content & Marketing Agent                                                                                                                    │
     │                                                                                                                                                     │
     │ Plus Menu actions:                                                                                                                                  │
     │ 1. Generate post ideas — platform-native ideas with hook, engagement prediction, hashtags                                                           │
     │ 2. Draft a post — full ready-to-publish post with optional AI image                                                                                 │
     │ 3. Create Product Campaign — generate a cohesive batch of campaign photos from a single product image; outputs a 2×grid of photos each with role    │
     │ (hero, square, story, ad), regenerate/download buttons, and a matching caption                                                                      │
     │ 4. Adapt to other platforms — rewrite a post for LinkedIn/Twitter/Instagram while preserving voice                                                  │
     │                                                                                                                                                     │
     │ Contextual actions (surfaced from result cards):                                                                                                    │
     │ - Draft a carousel — multi-slide carousel post with connected images; each slide has its own visual + copy                                          │
     │ - Regenerate image — redraw existing post image with a new prompt                                                                                   │
     │ - Rewrite caption — rework caption copy with a new prompt                                                                                           │
     │ - Revise a post — refine existing post based on plain-English feedback                                                                              │
     │                                                                                                                                                     │
     │ Special UI features:                                                                                                                                │
     │ - Attachment button in chat input: rocket icon labeled "Create Product Campaign" that launches the campaign dialog                                  │
     │ - Published Posts Tab: view/manage all previously published posts                                                                                   │
     │ - Image preview cards with character counters per platform (LinkedIn 3000, Twitter 280, Instagram 2200)                                             │
     │ - Platform icons + copy/download/publish buttons on each card                                                                                       │
     │                                                                                                                                                     │
     │ Supported platforms: LinkedIn, Twitter/X, Instagram                                                                                                 │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ REX — Data Analyst & Finance Agent                                                                                                                  │
     │                                                                                                                                                     │
     │ Plus Menu actions:                                                                                                                                  │
     │ 1. Ask about a dataset — NL question on uploaded CSV/Excel                                                                                          │
     │ 2. Analyze dataset — full AI analysis: insights, patterns, business recommendations                                                                 │
     │ 3. Generate dataset report — comprehensive DOCX report with charts, narratives, strategic takeaways                                                 │
     │ 4. Analyze metrics — trend, anomaly, health across KPIs                                                                                             │
     │ 5. Forecast a metric — project any metric forward with confidence bands                                                                             │
     │                                                                                                                                                     │
     │ Hidden/contextual actions:                                                                                                                          │
     │ 1. Financial analysis — MRR, ARR, churn, burn, runway                                                                                               │
     │ 2. Executive briefing — stitch metrics + agent summaries into one exec briefing                                                                     │
     │ 3. Runway scenarios — cash runway in base/optimistic/pessimistic scenarios                                                                          │
     │ 4. Unit economics — CAC, LTV, LTV:CAC, payback period with benchmarks                                                                               │
     │ 5. What-if scenarios — model burn/MRR/growth changes, compare runway outcomes                                                                       │
     │ 6. Weekly CFO digest — Monday morning digest: WoW changes, alerts, 3 focus actions                                                                  │
     │ 7. Investor update — structured investor update email with metrics and asks                                                                         │
     │ 8. Variance analysis — compare actual dataset vs budget dataset month by month                                                                      │
     │ 9. Board deck — auto-generate investor-ready board update: narrative sections, charts, print-ready HTML                                             │
     │                                                                                                                                                     │
     │ Special UI features:                                                                                                                                │
     │ - Data Tab — manage multiple uploaded CSV/Excel datasets; counter badge on tab; query/analyze/report each one                                       │
     │ - KPI Strip (always visible) — MRR, burn rate, cash runway each with RED/AMBER/GREEN color indicator + trend sparkline; drill-down per metric to    │
     │ see history                                                                                                                                         │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ SCOUT — Research & Strategist Agent                                                                                                                 │
     │                                                                                                                                                     │
     │ Plus Menu actions:                                                                                                                                  │
     │ 1. Research a topic — deep research with web scraping + synthesis                                                                                   │
     │ 2. Research a company — profile: features, pricing, SWOT, tech stack, key contacts, recent news                                                     │
     │ 3. Trending topics — rising topics in an industry with content angles                                                                               │
     │ 4. Discover competitors — find competitors using live web research; auto-saves to watchlist                                                         │
     │                                                                                                                                                     │
     │ Special UI:                                                                                                                                         │
     │ - Watchlist Tab — saved competitor list; each entry shows name, URL, why competitive, pricing model; trigger deep-dive from list; "Discover" button │
     │ to add new; discovered competitors are automatically added to the watchlist                                                                         │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ SAGE — SEO Specialist Agent                                                                                                                         │
     │                                                                                                                                                     │
     │ Plus Menu actions:                                                                                                                                  │
     │ 1. Keyword research — intent-classified keywords with difficulty, volume, competitor URLs                                                           │
     │ 2. Generate blog post — full SEO-optimized article with H2/H3, meta tags, FAQ schema, internal links                                                │
     │ 3. Audit content — score existing content, surface SEO improvements                                                                                 │
     │ 4. Content brief — SERP analysis, competitor gap, questions to answer, target word count, secondary keywords                                        │
     │ 5. Blog post ideas — trending topics tailored to company from brand kit                                                                             │
     │ 6. Page SEO Audit — deep-dive single URL: technical SEO, speed signals, image SEO, on-page, E-E-A-T, competitive analysis; returns prioritized      │
     │ 30/60/90-day action plan                                                                                                                            │
     │ 7. Site Audit — full-site health check: crawls sitemap, checks HTTP status, detects orphan pages, finds keyword cannibalization; returns domain     │
     │ overview + issue priorities                                                                                                                         │
     │                                                                                                                                                     │
     │ Special UI:                                                                                                                                         │
     │ - Favourites Tab — saved keywords; can trigger blog generation from any saved keyword                                                               │
     │                                                                                                                                                     │
     │ Advanced signals covered: E-E-A-T scoring, featured snippet opportunities, People Also Ask (PAA) answers, SERP feature detection, schema markup     │
     │ validation, readability scoring, topical authority recommendations                                                                                  │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ LEX — Legal Assistant Agent                                                                                                                         │
     │                                                                                                                                                     │
     │ Plus Menu actions:                                                                                                                                  │
     │ 1. Upload a document — PDF stored and indexed for analysis                                                                                          │
     │ 2. Analyze a contract — risk analysis, unusual clauses, missing protections, risk score                                                             │
     │ 3. Ask a document — Q&A with exact clause references                                                                                                │
     │ 4. Draft a document — NDA, SaaS MSA, offer letter, independent contractor agreement, other templates                                                │
     │ 5. Explain legal text — plain-English explanation with key terms glossary, related concepts, practical implications                                 │
     │ 6. Research a legal question — applicable laws, cases, practical guidance for a jurisdiction                                                        │
     │ 7. Compliance check — evaluate against GDPR, CCPA, SOC2, HIPAA (note: NOT PCI-DSS — this is wrong on the landing page)                              │
     │                                                                                                                                                     │
     │ Special UI:                                                                                                                                         │
     │ - Attachment button in chat to upload documents                                                                                                     │
     │ - Documents Tab — manage all uploaded PDFs with metadata: document name, type, size, page count, key topics extracted, upload summary;              │
     │ analyze/query any document from this list                                                                                                           │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ VEGA — Executive Assistant Agent                                                                                                                    │
     │                                                                                                                                                     │
     │ Plus Menu actions:                                                                                                                                  │
     │ 1. Triage inbox — prioritize, auto-label, optionally draft replies                                                                                  │
     │ 2. Draft a reply — reply in your voice to a specific email thread                                                                                   │
     │ 3. Calendar summary — agenda, conflicts, free slots for a date range                                                                                │
     │ 4. Schedule an event — parse plain-English event and create on Google Calendar                                                                      │
     │ 5. Compose an email — draft new outbound Gmail, saves as draft                                                                                      │
     │ 6. Executive briefing — daily exec briefing: urgent actions, schedule, focus recommendation                                                         │
     │                                                                                                                                                     │
     │ Special UI / Settings (agent-specific settings panel):                                                                                              │
     │ - VIP Contacts section — add contacts (email + optional name); VIP emails always surfaced at top of inbox regardless of AI triage priority; delete  │
     │ button per contact                                                                                                                                  │
     │ - Email Labels section — create custom labels with custom names and color picker; auto-draft toggle per label (Vega automatically creates a Gmail   │
     │ draft reply when a new email matching that label arrives); delete button per label                                                                  │
     │                                                                                                                                                     │
     │ Integrations: Gmail + Google Calendar OAuth                                                                                                         │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Part 2 — Gap Analysis (What's Missing from Landing Pages)                                                                                           │
     │                                                                                                                                                     │
     │ ┌───────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┐                                                                                                                                               │
     │ │ Agent │                                                          Missing / Wrong on Landing                                                       │
     │    │                                                                                                                                                │
     │ ├───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┤                                                                                                                                               │
     │ │ Maya  │ Product Campaign feature entirely absent; Carousel creation not mentioned; Published Posts Tab not mentioned                              │
     │    │                                                                                                                                                │
     │ ├───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┤                                                                                                                                               │
     │ │ Rex   │ Board deck generation absent; Variance analysis absent; DOCX report generation absent; KPI Strip (always-on dashboard) not highlighted;   │
     │    │                                                                                                                                                │
     │ │       │ Weekly CFO digest not specifically called out                                                                                             │
     │    │                                                                                                                                                │
     │ ├───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┤                                                                                                                                               │
     │ │ Scout │ Watchlist auto-populate on discovery not mentioned; minor detail gaps only                                                                │
     │    │                                                                                                                                                │
     │ ├───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┤                                                                                                                                               │
     │ │ Sage  │ Page SEO Audit entirely absent; Site Audit entirely absent; E-E-A-T, featured snippets, SERP features not mentioned                       │
     │    │                                                                                                                                                │
     │ ├───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┤                                                                                                                                               │
     │ │ Lex   │ Explain legal text not a separate capability; PCI-DSS is wrong — should be SOC2; Documents Tab management not highlighted                 │
     │    │                                                                                                                                                │
     │ ├───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┤                                                                                                                                               │
     │ │ Vega  │ VIP Contacts feature entirely absent; Smart Email Labels + Auto-Draft entirely absent                                                     │
     │    │                                                                                                                                                │
     │ └───────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ────┘                                                                                                                                               │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Part 3 — Exact Content Changes Per Agent                                                                                                            │
     │                                                                                                                                                     │
     │ All edits are in apps/landing/src/components/veqiro/data.ts, EMPLOYEES array.                                                                       │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ MAYA — Proposed Changes                                                                                                                             │
     │                                                                                                                                                     │
     │ File: data.ts → key: 'maya'                                                                                                                         │
     │                                                                                                                                                     │
     │ skills[] — update:                                                                                                                                  │
     │ Current: ['Blog posts', 'Ad copy', 'Brand voice', 'Campaign plans']                                                                                 │
     │ New:     ['Blog posts', 'Ad copy', 'Brand voice', 'Product campaigns', 'Carousels']                                                                 │
     │                                                                                                                                                     │
     │ capabilities[] — change from 5 to 6 cards:                                                                                                          │
     │                                                                                                                                                     │
     │ Keep existing 4 cards with small updates, add 2 new ones:                                                                                           │
     │                                                                                                                                                     │
     │ Card 1 (keep, minor wording update):                                                                                                                │
     │ { title: "Content Ideation", description: "Generate 3–10 content ideas for LinkedIn, Twitter/X, or Instagram — each with a hook, engagement angle,  │
     │ image prompt, and hashtag suggestions." }                                                                                                           │
     │                                                                                                                                                     │
     │ Card 2 (keep):                                                                                                                                      │
     │ { title: "Full Content Drafting", description: "Complete post for any platform with tone control, word count target, and brand kit integration.     │
     │ Maya auto-generates a matching image — and can also create multi-slide carousel posts for LinkedIn or Instagram." }                                 │
     │ (Added: carousel mention)                                                                                                                           │
     │                                                                                                                                                     │
     │ Card 3 (keep):                                                                                                                                      │
     │ { title: "Cross-Platform Variants", description: "Write once, rewrite for every platform natively — LinkedIn hooks, Twitter/X pacing, Instagram     │
     │ captions — while preserving your brand voice throughout." }                                                                                         │
     │                                                                                                                                                     │
     │ Card 4 (keep):                                                                                                                                      │
     │ { title: "Direct Publishing", description: "Post directly to connected social accounts the moment you approve. No copy-paste, no scheduling tool in │
     │ the middle." }                                                                                                                                      │
     │                                                                                                                                                     │
     │ Card 5 (update slightly):                                                                                                                           │
     │ { title: "Revision & Image Regeneration", description: "Revise any draft based on plain-English feedback. Rewrite just the caption with a new       │
     │ prompt, or redraw the image with a new brief — brand colors and logo stay locked in." }                                                             │
     │                                                                                                                                                     │
     │ NEW Card 6 — Product Campaign Creator:                                                                                                              │
     │ { title: "Product Campaign Creator", description: "Upload a single product photo and Maya generates a complete campaign set — multiple              │
     │ brand-consistent images each composed for a different placement (hero, square, story, ad) — plus a ready caption. One shot, full campaign." }       │
     │                                                                                                                                                     │
     │ actions[] — add 2 new prompts:                                                                                                                      │
     │ Current ends with: "Regenerate the image — I want something darker with our logo centered"                                                          │
     │ Add:                                                                                                                                                │
     │ - "Create a product campaign for our [product] — here's the product photo"                                                                          │
     │ - "Draft a 5-slide carousel post for LinkedIn about [topic]"                                                                                        │
     │                                                                                                                                                     │
     │ howItHelps — update to mention campaigns and carousels:                                                                                             │
     │ Add mention of product campaign and carousel features in the paragraph. Append to end:                                                              │
     │ "...She's an AI social media post generator for the teams who've been burned by tools that ship robotic drafts and call it a week — and now she     │
     │ also generates full product campaign photo sets and multi-slide carousels so your launch looks as good as the product."                             │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ REX — Proposed Changes                                                                                                                              │
     │                                                                                                                                                     │
     │ File: data.ts → key: 'rex'                                                                                                                          │
     │                                                                                                                                                     │
     │ capabilities[] — change from 6 to 6 cards (no new cards, but update 3 existing):                                                                    │
     │                                                                                                                                                     │
     │ Card 1 — update to mention KPI Strip:                                                                                                               │
     │ { title: "Financial Analysis & Live KPI Dashboard", description: "Full P&L breakdown from your revenue, expense, and subscriber data — MRR, ARR,    │
     │ growth rate, gross margin, burn rate — each flagged RED/AMBER/GREEN. Rex keeps a live KPI strip always visible at the top of the screen so your key │
     │ numbers are never more than a glance away." }                                                                                                       │
     │                                                                                                                                                     │
     │ Card 5 — update to include board deck, variance analysis, and weekly CFO digest:                                                                    │
     │ { title: "Investor Updates, Board Decks & Weekly Digest", description: "Auto-generate monthly investor updates with real metrics and narrative.     │
     │ Produce a full investor-ready board deck with charts, section headers, and print-friendly HTML. Run a variance analysis between your actual results │
     │ and budget, month by month. Or get a Monday morning CFO digest: what moved week-over-week, what looks weird, 3 focus actions." }                    │
     │                                                                                                                                                     │
     │ Card 6 — update to mention DOCX reports and dataset querying:                                                                                       │
     │ { title: "Data Hub: Upload, Query & Report", description: "Upload any CSV or Excel file (Stripe export, ad spend, bank statement) and Rex stores it │
     │ in your Data Hub. Ask questions in plain English, run a full AI analysis, or generate a comprehensive DOCX report with charts, narrative, and       │
     │ strategic takeaways — ready to share." }                                                                                                            │
     │                                                                                                                                                     │
     │ actions[] — add 3 new prompts:                                                                                                                      │
     │ Add:                                                                                                                                                │
     │ - "Generate my board deck for [month] — pull from my latest dataset"                                                                                │
     │ - "Run a variance analysis: actual results vs budget for last quarter"                                                                              │
     │ - "Give me my Monday CFO digest — what moved and what looks weird"                                                                                  │
     │                                                                                                                                                     │
     │ skills[] — add 'Board decks':                                                                                                                       │
     │ Current: ['Financial models', 'Dashboards', 'Forecasts', 'Anomaly detection']                                                                       │
     │ New:     ['Financial models', 'Dashboards', 'Forecasts', 'Anomaly detection', 'Board decks']                                                        │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ SCOUT — Proposed Changes                                                                                                                            │
     │                                                                                                                                                     │
     │ File: data.ts → key: 'scout'                                                                                                                        │
     │                                                                                                                                                     │
     │ Minor updates only.                                                                                                                                 │
     │                                                                                                                                                     │
     │ capabilities[] — update Card 4 (Competitor Watchlist):                                                                                              │
     │ { title: "Competitor Watchlist", description: "Live watchlist of tracked competitors — automatically populated whenever Scout discovers new ones.   │
     │ Each entry shows name, URL, why they're competitive, and pricing model. Trigger a fresh deep-dive teardown on any competitor anytime." }            │
     │ (Added: auto-populate behavior on discovery)                                                                                                        │
     │                                                                                                                                                     │
     │ capabilities[] — update Card 2 (Company Research) — add tech stack + key contacts mention:                                                          │
     │ { title: "Company Research", description: "Build a full profile on any company: founding date, team size, funding rounds, tech stack, key contacts, │
     │ product features, pricing, target market, strengths, weaknesses, and recent news — pulled from live web sources." }                                 │
     │                                                                                                                                                     │
     │ No other changes needed for Scout.                                                                                                                  │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ SAGE — Proposed Changes                                                                                                                             │
     │                                                                                                                                                     │
     │ File: data.ts → key: 'sage'                                                                                                                         │
     │                                                                                                                                                     │
     │ capabilities[] — change from 5 to 7 cards (add 2 new):                                                                                              │
     │                                                                                                                                                     │
     │ Keep existing 5 cards with small updates:                                                                                                           │
     │                                                                                                                                                     │
     │ Card 3 — update to mention E-E-A-T and SERP signals:                                                                                                │
     │ { title: "Content Analysis & Page Scoring", description: "Score any existing page against a target keyword — readability grade, keyword density,    │
     │ heading structure, word count, missing topics, and E-E-A-T signals. Returns a specific prioritized fix list, not vague suggestions." }              │
     │                                                                                                                                                     │
     │ NEW Card 6 — Page SEO Audit:                                                                                                                        │
     │ { title: "Page SEO Audit", description: "Deep-dive audit of any single URL: technical SEO issues, page speed signals, image optimization, on-page   │
     │ factors, E-E-A-T score, featured snippet opportunities, and a head-to-head against the top-ranking competitor. Returns a prioritized 30/60/90-day   │
     │ action plan." }                                                                                                                                     │
     │                                                                                                                                                     │
     │ NEW Card 7 — Site-Wide Audit:                                                                                                                       │
     │ { title: "Site-Wide Audit", description: "Crawl your full sitemap: check HTTP status codes, find orphan pages, detect keyword cannibalization       │
     │ across your domain, and surface your biggest technical SEO drag. Returns a domain health overview with total pages audited and issue priorities —   │
     │ not a tool bill." }                                                                                                                                 │
     │                                                                                                                                                     │
     │ skills[] — add 'Technical SEO' and 'Site audits':                                                                                                   │
     │ Current: ['Keyword research', 'On-page SEO', 'Backlink ops', 'SERP tracking']                                                                       │
     │ New:     ['Keyword research', 'On-page SEO', 'Technical SEO', 'Site audits', 'SERP tracking']                                                       │
     │                                                                                                                                                     │
     │ actions[] — add 2 new prompts:                                                                                                                      │
     │ Add:                                                                                                                                                │
     │ - "Run a full page audit on [URL] — I want technical, speed, E-E-A-T, and competitor scores"                                                        │
     │ - "Audit my entire site — sitemap is at [url]"                                                                                                      │
     │                                                                                                                                                     │
     │ howItHelps — update to mention site audit and E-E-A-T:                                                                                              │
     │ Update the paragraph to include:                                                                                                                    │
     │ "...She also does deep single-page audits and full-site crawls — surfacing orphan pages, cannibalization conflicts, and E-E-A-T gaps that are       │
     │ quietly costing you rankings. Think of her as an AI SEO specialist, AI keyword research tool, and technical SEO auditor combined..."                │
     │                                                                                                                                                     │
     │ SEO metadata in /agents/sage/page.tsx:                                                                                                              │
     │ - Add keywords: ai seo audit tool, ai technical seo, ai site audit, ai page audit                                                                   │
     │ - Update meta description to mention audits: "Sage does keyword research, writes SEO-optimized blog posts, audits single pages and full sites for   │
     │ technical issues. An AI SEO tool that actually ranks."                                                                                              │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ LEX — Proposed Changes                                                                                                                              │
     │                                                                                                                                                     │
     │ File: data.ts → key: 'lex'                                                                                                                          │
     │                                                                                                                                                     │
     │ capabilities[] — fix Card 5, update Card 3, expand Card 1:                                                                                          │
     │                                                                                                                                                     │
     │ Card 1 — update to highlight document library:                                                                                                      │
     │ { title: "Document Library & PDF Ingestion", description: "Upload any PDF contract (NDA, MSA, vendor agreement, offer letter). Lex stores it in     │
     │ your document library with metadata — type, page count, key topics extracted. Every uploaded document stays accessible for analysis, Q&A, or        │
     │ comparison anytime." }                                                                                                                              │
     │                                                                                                                                                     │
     │ Card 3 — update to include Explain Legal Text:                                                                                                      │
     │ { title: "Document Q&A & Plain-English Explanations", description: "Ask any question about an uploaded contract and get answers with exact clause   │
     │ references and relevance scores. Or paste any block of legal text and Lex translates it into plain English — with a key terms glossary, related     │
     │ concepts, and practical implications you can actually act on." }                                                                                    │
     │                                                                                                                                                     │
     │ Card 5 — FIX wrong compliance framework (PCI-DSS → SOC2):                                                                                           │
     │ { title: "Legal Research & Compliance Check", description: "Research any legal question by jurisdiction (US, UK, EU): applicable laws, relevant     │
     │ cases, and practical guidance. Run a compliance check against GDPR, CCPA, SOC2, or HIPAA — returns framework-by-framework results, critical gaps,   │
     │ and a prioritized remediation list." }                                                                                                              │
     │ (Corrected: removed PCI-DSS, added SOC2)                                                                                                            │
     │                                                                                                                                                     │
     │ outcomes[] — fix any mention of PCI-DSS to SOC2:                                                                                                    │
     │ Find in current outcomes Card 4: "GDPR, CCPA, HIPAA, PCI-DSS evaluation" → change to "GDPR, CCPA, SOC2, HIPAA evaluation"                           │
     │                                                                                                                                                     │
     │ skills[] — add 'Document library':                                                                                                                  │
     │ Current: ['NDA review', 'Contract drafting', 'Clause flagging', 'Policy audits']                                                                    │
     │ New:     ['NDA review', 'Contract drafting', 'Clause flagging', 'Policy audits', 'Document library']                                                │
     │                                                                                                                                                     │
     │ actions[] — add 1 new prompt:                                                                                                                       │
     │ Add: "Explain what this clause means in plain English: [paste clause]"                                                                              │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ VEGA — Proposed Changes                                                                                                                             │
     │                                                                                                                                                     │
     │ File: data.ts → key: 'vega'                                                                                                                         │
     │                                                                                                                                                     │
     │ capabilities[] — change from 5 to 7 cards (add 2 new):                                                                                              │
     │                                                                                                                                                     │
     │ Keep existing 5 cards unchanged.                                                                                                                    │
     │                                                                                                                                                     │
     │ NEW Card 6 — VIP Contacts:                                                                                                                          │
     │ { title: "VIP Contacts & Priority Triage", description: "Add key people — investors, clients, board members, partners — as VIP contacts. Vega       │
     │ always surfaces their emails at the top of your inbox triage, ahead of everything else. Never miss a message from the people that actually matter,  │
     │ regardless of how busy the inbox gets." }                                                                                                           │
     │                                                                                                                                                     │
     │ NEW Card 7 — Smart Email Labels with Auto-Draft:                                                                                                    │
     │ { title: "Smart Labels with Auto-Draft", description: "Create custom email labels with your own names and colors. Toggle auto-draft on any label —  │
     │ the moment a new email matching that label arrives, Vega writes a reply draft automatically. You open your inbox and the draft is already waiting.  │
     │ Review, tweak, send." }                                                                                                                             │
     │                                                                                                                                                     │
     │ skills[] — add 'VIP routing' and 'Smart labels':                                                                                                    │
     │ Current: ['Inbox triage', 'Calendar tetris', 'Meeting prep', 'Follow-ups']                                                                          │
     │ New:     ['Inbox triage', 'Calendar tetris', 'Smart labels', 'VIP routing', 'Follow-ups']                                                           │
     │                                                                                                                                                     │
     │ workflow[] — update Step 2 to mention VIP contacts and labels:                                                                                      │
     │ {                                                                                                                                                   │
     │   title: "2. Set your rules",                                                                                                                       │
     │   body: "Tell her who gets a same-day reply, who waits, and what your non-negotiable focus blocks look like. Add VIP contacts so their emails       │
     │ always surface first. Create smart labels with auto-draft enabled — she'll have a reply waiting before you open the thread. She respects these      │
     │ rules forever, no retraining required.",                                                                                                            │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ actions[] — add 2 new prompts:                                                                                                                      │
     │ Add:                                                                                                                                                │
     │ - "Add [name] at [email] to my VIP contacts"                                                                                                        │
     │ - "Create a label 'Client Escalations' with auto-draft turned on"                                                                                   │
     │                                                                                                                                                     │
     │ howItHelps — update to mention customization:                                                                                                       │
     │ Append: "...Set her up once: add VIPs so investor emails always reach the top, create smart labels with auto-draft so replies are waiting the       │
     │ moment an email arrives. She's the inbox system you always meant to build — already running."                                                       │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Part 4 — SEO Updates                                                                                                                                │
     │                                                                                                                                                     │
     │ Primary file to check: apps/landing/src/app/agents/[slug]/page.tsx                                                                                  │
     │ Check whether keywords and meta descriptions are hardcoded in the page file or pulled from data.ts. If hardcoded, update directly in the page file. │
     │ If in a metadata export, update there.                                                                                                              │
     │                                                                                                                                                     │
     │ Sage page SEO (/agents/sage):                                                                                                                       │
     │ - Meta description: add "audits pages and full sites"                                                                                               │
     │ - Add keywords: ai seo audit, ai technical seo, ai page audit tool, ai site audit                                                                   │
     │                                                                                                                                                     │
     │ Lex page SEO (/agents/lex):                                                                                                                         │
     │ - Keywords: replace pci-dss with soc2 if present                                                                                                    │
     │ - Keywords: add ai legal document library                                                                                                           │
     │                                                                                                                                                     │
     │ Vega page SEO (/agents/vega):                                                                                                                       │
     │ - Keywords: add ai email labels, ai vip inbox                                                                                                       │
     │                                                                                                                                                     │
     │ Maya page SEO (/agents/maya):                                                                                                                       │
     │ - Keywords: add ai product campaign generator, ai carousel post generator                                                                           │
     │                                                                                                                                                     │
     │ Rex page SEO (/agents/rex):                                                                                                                         │
     │ - Keywords: add ai board deck generator, ai cfo digest, ai variance analysis                                                                        │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Part 5 — Files to Edit                                                                                                                              │
     │                                                                                                                                                     │
     │ ┌────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┐                                                                                                                                                  │
     │ │                    File                    │                                             What changes                                             │
     │ │                                                                                                                                                   │
     │ ├────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┤                                                                                                                                                  │
     │ │ apps/landing/src/components/veqiro/data.ts │ All content changes — capabilities, skills, actions, workflow, howItHelps, outcomes for all 6 agents │
     │ │                                                                                                                                                   │
     │ ├────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┤                                                                                                                                                  │
     │ │ apps/landing/src/app/agents/sage/page.tsx  │ SEO metadata — description, keywords (verify if hardcoded here)                                      │
     │ │                                                                                                                                                   │
     │ ├────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┤                                                                                                                                                  │
     │ │ apps/landing/src/app/agents/lex/page.tsx   │ SEO metadata — fix PCI-DSS → SOC2 in keywords                                                        │
     │ │                                                                                                                                                   │
     │ ├────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┤                                                                                                                                                  │
     │ │ apps/landing/src/app/agents/vega/page.tsx  │ SEO metadata — add new keywords                                                                      │
     │ │                                                                                                                                                   │
     │ ├────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┤                                                                                                                                                  │
     │ │ apps/landing/src/app/agents/maya/page.tsx  │ SEO metadata — add new keywords                                                                      │
     │ │                                                                                                                                                   │
     │ ├────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┤                                                                                                                                                  │
     │ │ apps/landing/src/app/agents/rex/page.tsx   │ SEO metadata — add new keywords                                                                      │
     │ │                                                                                                                                                   │
     │ └────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────── │
     │ ─┘                                                                                                                                                  │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Part 6 — Verification                                                                                                                               │
     │                                                                                                                                                     │
     │ After implementation:                                                                                                                               │
     │                                                                                                                                                     │
     │ 1. Run cd apps/landing && pnpm dev (or npm run dev) and open each agent page:                                                                       │
     │   - /agents/vega — verify VIP Contacts + Smart Labels cards appear                                                                                  │
     │   - /agents/maya — verify Product Campaign Creator card appears + carousel mention in Full Content Drafting                                         │
     │   - /agents/rex — verify Board Deck/Variance/CFO Digest mentions; KPI strip mentioned in Financial Analysis card                                    │
     │   - /agents/sage — verify Page SEO Audit + Site-Wide Audit cards appear (should now show 7 cards)                                                   │
     │   - /agents/lex — verify Document Library card wording; verify SOC2 appears and PCI-DSS is gone from compliance text                                │
     │   - /agents/scout — verify Watchlist card mentions auto-populate                                                                                    │
     │ 2. Search page source for PCI-DSS — should return zero results across all landing pages.                                                            │
     │ 3. Run pnpm build (or npm run build) to confirm no TypeScript errors in data.ts after changes.                                                      │
     │ 4. Check page <title> and <meta name="description"> for Sage includes "audit" language.                                                             │
     ╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ⎿  Interrupted · What should Claude do instead?