# Veqiro — New Feature Ideas Plan

## Context

Veqiro is an "AI employees" platform for founders, agencies, and SMBs. Today it ships **6 agents**:

| Agent | Role | Color | Model |
|---|---|---|---|
| **Maya** | Content & social (X/LinkedIn/IG) | red | gpt-4o-mini |
| **Rex** | Finance / MRR / runway / forecasts | green | gpt-4o-mini |
| **Scout** | Market research / competitor intel / leads | yellow | gemini-2.0-flash |
| **Sage** | SEO / keywords / blog generation | pink | gemini-2.0-flash |
| **Lex** | Legal / contracts / compliance | violet | gemini-2.0-flash |
| **Vega** | Inbox / calendar / executive assistant | blue | gpt-4o-mini |

Existing platform: multi-tenant orgs, Brain (BrandKit), Workspace (Briefing/Content/Leads), Dashboard with KPIs/charts, Cloudflare R2 file storage, integrations (Google, Twitter/X, LinkedIn, Instagram), 7-day trial → Pro $39/mo, cross-agent `ask_agent` tool, structured actions + free-form chat per agent.

**Why this plan:** the foundations are in. Now we need a thoughtful next-wave feature roadmap that (a) deepens each agent so users come back daily, (b) lights up cross-agent flows so Veqiro feels like a *team*, not 6 chatbots, (c) closes obvious platform gaps (no chat history, no approvals queue, no mobile, no voice, no global search, no scheduled jobs UI), and (d) explores new agents and new product surfaces aligned with Veqiro's "AI employees" thesis.

**Market signal informing this plan** (web research, April 2026):
- 82% of small businesses now use AI tools; founders spend $300–500/mo on AI agent stacks (SBE Council, mean.ceo)
- Highest-ROI automations: customer follow-up, document processing, internal reporting, support routing
- Marketing agencies sink **4–8 hrs/week per client** on manual reporting — $10K–50K/yr of dead labor
- Lindy ($49/mo, 4000+ apps, HITL approvals) and Manus AI (autonomous, sandboxed) are the two competitive shapes; Cognosys was acquired by Cohere
- AI SDR has matured into "human-in-the-loop > full autonomy" (Landbase, Artisan, 11x.ai, Qualified Piper)
- HR AI adoption doubled (26% → 43%) in one year
- 2026 chat UX trends: **transparent orchestration**, **action receipts** (what changed, rollback hook), **intent-based delegation**, voice + multimodal, taskboards over chat-first

**Files that anchor this plan** (for executor reference):
- Agent definitions: `apps/ai/agents/{agent}/agent.py`, `apps/ai/agents/registry.py`, `apps/ai/agents/base.py`
- Frontend agent config: `apps/main/src/lib/config/agents.ts`, `apps/main/src/lib/agents/actions.ts`
- Chat UI: `apps/main/src/components/chat/{ChatMessage,ChatInput,ActionResultRenderer,RunActionDialog,PlusMenu}.tsx`
- Routes: `apps/main/src/app/(dashboard)/{dashboard,assistants,brain,workspace,settings}/`
- Schema: `apps/server/prisma/schema.prisma`

---

## Section 1 — Per-Agent Features

For each agent: **(a) deepening features**, **(b) chat-UX additions** (tabs, panels, inline tools), **(c) follow-up actions** that turn one-shot output into ongoing workflows.

### 1.1 Maya — Content & Social

**Deepening features**
- **Content calendar** with drag-and-drop scheduling across X / LinkedIn / IG / Threads / TikTok / Reddit. Today posts exist but live in a flat list.
- **Repurpose engine** — one input becomes a tweet thread, LinkedIn post, IG carousel, Reels script, newsletter snippet, blog teaser, podcast hook. Single "Repurpose this" button on any draft.
- **Performance feedback loop** — pull post metrics back from connected platforms; Maya learns which hooks/lengths/topics work for *this* account and adapts.
- **A/B variant scheduler** — schedule 2–3 variants in series, auto-compare, declare a winner.
- **Comment & DM triage** — Maya reads inbound replies, drafts responses, flags ones that need a human (deals, complaints).
- **Trending hooks panel** — daily refresh of trending topics filtered to user's industry + brand voice (uses Scout under the hood).
- **Video script mode** — TikTok/Reels script with shot-by-shot directions, on-screen text, hook-A-roll-CTA structure.
- **Hashtag intelligence** — which tags moved the needle for *this* account vs. industry baseline.
- **Asset pack generator** — one prompt → all sizes (1080², 1200×628, 9:16, 16:9, 4:5) auto-cropped + brand-kit-applied.
- **Newsletter mode** — Substack/Beehiiv/Resend export with section blocks.
- **Carousel builder** — visual slide-by-slide editor with brand fonts/colors auto-applied.

**Chat-UX additions**
- **Tab: Files in this chat** — every image / PDF / link Maya has touched in this thread, pinnable, reusable.
- **Tab: Drafts** — saved drafts not yet published, filterable by platform/status (idea → draft → scheduled → published → failed).
- **Tab: Inspiration vault** — saved screenshots / links / competitor posts that triggered an idea.
- **Tab: Voice samples** — pin 5–10 winning past posts; Maya treats them as ground truth for future generations.
- **Inline platform preview** — every draft shows live X/LinkedIn/IG mockup with character count, image preview, link unfurl.

**Follow-up actions**
- "Schedule across all connected platforms"
- "Send to Lex for legal review" (e.g., regulated industries)
- "Promote with Sage" (turn this into an SEO-optimized blog)
- "Tell Rex to track conversion" (UTM + revenue attribution)

### 1.2 Rex — Finance

**Deepening features**
- **Native pulls from Stripe / QuickBooks / Xero / Chargebee / Profitwell / Mercury / Brex / Ramp** — not just CSV upload. (Schema gates exist; integration adapters needed.)
- **Cohort retention** — D1/D7/D30 cohort heatmap, reverse cohort, GRR/NRR auto-tracked.
- **Pricing simulator** — "what if I raise prices 10% with X% churn impact" — shows revenue, runway, LTV deltas.
- **Cap table & SAFE tracker** — dilution scenarios per round.
- **Cash-flow forecast with hire scenarios** — "what if I hire 2 engineers in May?" → updated runway.
- **Magic numbers panel** — SaaS magic number, Rule of 40, CAC payback, NRR/GRR, burn multiple — one card.
- **Investor-grade update generator** — monthly update with metrics, narrative, asks, formatted for email or Notion.
- **Anomaly explanations** — when MRR jumps/drops, Rex doesn't just flag, it *explains* by querying upstream data (which customers? which cohort? which plan?).
- **Subscriptions audit** — find SaaS overlap and unused tools across the org's bank/card data.
- **Budget vs. actual tracker** — set quarterly targets, Rex reports drift weekly.

**Chat-UX additions**
- **Tab: Datasets** (already exists) — extend with re-pull / refresh-now button per source.
- **Tab: Pinned cards** (already exists via `RexPinnedCard`) — extend with grouping into custom dashboards.
- **Tab: Alerts log** — every triggered alert, what happened next.
- **Tab: Forecast scenarios** — saved what-ifs side-by-side comparable.
- **Inline data freshness chip** — "data from 2h ago — refresh now?" on every metric card.

**Follow-up actions**
- "Send this update to investors" (Vega drafts personalized variants)
- "Make a board deck from this" (already exists, surface contextually)
- "Alert me if MRR drops below $X" (creates an alert rule)
- "Ask Sage which content drove this revenue" (UTM cross-ref)

### 1.3 Scout — Market Research & Competitive Intel

**Deepening features**
- **Live competitor changelog** — `CompetitorWatch` model exists; render weekly diff: pricing changes, new features, blog posts, hiring signals, leadership changes, funding events.
- **Buying-signal radar** — Reddit / HN / G2 / Capterra / Twitter mentions of pain in your category + intent ("looking for", "alternative to", "anyone tried").
- **Lead enrichment from CSV** — paste a CSV of names/emails → enriched with role / company / funding / tech stack / intent score.
- **ICP scoring** — define ICP, Scout scores any lead 0–100 with reasons.
- **Hiring tracker** — what your competitors are hiring for tells you their priorities.
- **Investor research** — "tell me about Sequoia partner X" with thesis, recent investments, board seats.
- **Pricing benchmarks** — auto-tracked competitor pricing pages, alert on changes.
- **Market sizing on demand** — TAM/SAM/SOM with sources cited.
- **News monitoring** with custom queries — "alert me when anyone mentions our category + 'pricing'".
- **Patent/SEC/job-posting feeds** for deeper signal.

**Chat-UX additions**
- **Tab: Watchlist** (exists) — extend with diffing/changelog and Slack/email digest.
- **Tab: Saved searches** with re-run + alerting.
- **Tab: Lead lists** — saved enriched lead batches, exportable to CSV / HubSpot / Pipedrive.
- **Tab: Reports archive** — every research session, searchable.
- **Inline source confidence** — every claim shows source URL + confidence ("confirmed" vs "inferred").

**Follow-up actions**
- "Hand to Vega for outreach" (Vega drafts personalized intro)
- "Hand to Sage for content angle" (SEO around competitor's weakness)
- "Hand to Maya for narrative" (positioning post)
- "Schedule this watchlist to refresh weekly"

### 1.4 Sage — SEO & Content Strategy

**Deepening features**
- **GEO (Generative Engine Optimization) suite** — the new SEO. Search is moving from Google to ChatGPT / Claude / Gemini / Perplexity answers, and brands are panicking about *how to get cited*. Sage's GEO suite:
  - **Citation tracker** — daily probes against ChatGPT / Claude / Perplexity / Gemini / Google AI Overviews / Copilot for your tracked queries; logs which engines cite you, which cite competitors, with screenshots and answer snippets.
  - **Citation-share dashboard** — your % share of voice across AI engines per topic, weekly trend.
  - **Why-not-cited diagnosis** — when a competitor is cited and you aren't, Sage explains why (their content is more structured, has better schema, has more inbound mentions, etc.) and proposes fixes.
  - **GEO content rewriter** — restructures existing pages to be more LLM-citeable: clear definitions up top, structured Q&A, statistics with sources, schema.org markup, llms.txt generation.
  - **Brand mention seeding** — Sage drafts comments / Reddit answers / Quora answers / forum posts that LLMs scrape, lifting your citation odds (with disclosure templates so users stay above-board).
  - **Wikipedia / authoritative-source watch** — flag opportunities to get mentioned in entries LLMs treat as ground truth.
  - **Prompt corpus** — curated list of 50–500 "prompts your customers actually ask AI"; tracked and re-probed weekly.
- **AI-search visibility tracking** — see GEO suite above (kept here as the umbrella line).
- **Programmatic SEO builder** — template × dataset → 100s of pages (location pages, comparison pages, alternative pages).
- **Topical authority map** — visualize your topic clusters and gaps vs. competitors.
- **SERP tracker** — daily ranking checks for tracked keywords with charts.
- **Content refresh recommendations** — old posts losing rank → "update this with X".
- **Internal linking suggestions** — find orphan pages, suggest links from high-authority posts.
- **People-Also-Ask FAQ harvester** — auto-generate FAQ blocks per article.
- **Schema markup generator** — JSON-LD per page type.
- **Backlink intelligence** — who links to competitors but not you.
- **Reddit / Quora seed strategy** — answer questions that drive traffic in stealth mode.
- **Multi-language SEO** — translate + localize keyword research.

**Chat-UX additions**
- **Tab: Keyword bank** (`SavedKeyword` exists) — extend with content pipeline status (Idea → Brief → Draft → Published → Refresh-due).
- **Tab: Published posts** — pulled rankings + impressions + CTR per post.
- **Tab: Content calendar** (shared with Maya — see Section 2).
- **Tab: Briefs library** — every brief Sage generated.
- **Inline competitor SERP card** — when researching a keyword, show top 10 with featured-snippet owner highlighted.

**Follow-up actions**
- "Hand to Maya to syndicate as social"
- "Send to Lex if claims need verification" (e.g., medical/legal/financial)
- "Schedule monthly refresh check"

### 1.5 Lex — Legal & Compliance

**Deepening features**
- **Contract repository** — `Source` model exists; layer on smart tags (NDA / MSA / Lease / Employment / DPA), expiry calendar, auto-renewal alerts.
- **Redline collaboration** — sentence-level proposed changes, exportable as Word redlines.
- **Term-sheet analyzer** — VC SAFE / convertible / priced rounds with founder-friendliness score.
- **Privacy policy / ToS auto-generator** — current with regs, regenerable when you change products.
- **DPA & vendor-risk reviewer** — submit a vendor DPA, get a risk profile.
- **Compliance task tracker** — SOC2 / GDPR / HIPAA readiness checklists with progress per control.
- **Risk register dashboard** — every flagged risk with severity, owner, status.
- **Trademark / IP monitoring** — alert when someone files near your mark.
- **eSignature integration** — Docusign / SignWell / Dropbox Sign send-from-Lex.
- **Multi-jurisdiction toggle** — same NDA but US-DE vs UK vs EU.

**Chat-UX additions**
- **Tab: Document library** — all uploaded docs with smart tags + expiry calendar view.
- **Tab: Templates** — your library of reusable NDAs, MSAs, offer letters per jurisdiction.
- **Tab: Risk register** — open risks across the org, status, owner.
- **Tab: Compliance progress** — visual progress bars per framework.
- **Inline "Explain like I'm a founder" toggle** — switch jargon ↔ plain English on any clause.

**Follow-up actions**
- "Send to counter-party via Vega for signature"
- "Notify me 30 days before expiry"
- "Ask Rex about financial exposure of this contract"

### 1.6 Vega — Executive Assistant

**Deepening features**
- **Lifecycle email engine** — Vega ships *full* nurture sequences, not just single replies. Pre-built and customizable flows that adapt to brand voice + product:
  - **Welcome sequence** (auto-generated from BrandKit): D0 thank-you, D1 product tour, D3 social proof, D7 first-CTA.
  - **Trial-to-paid conversion funnel** (7 / 14 / 30 day variants): triggered milestones (signup → first action → activation → conversion-window-closing) with personalized urgency and feature highlights based on what the user did/didn't do in the product.
  - **Onboarding drip** — role-aware (founder vs. ops lead vs. agency owner gets different paths), tied to checklist completion.
  - **Re-engagement / win-back** — silent-user detection (no opens 30 days, no logins 60 days) → tailored "what you've missed" with new features, social proof, comeback discount.
  - **Post-purchase / post-call follow-ups** — auto-schedule 24-hour, 7-day, 30-day touchpoints.
  - **Live A/B testing** — Vega rotates subject lines / hooks / CTAs and reports winners.
  - **Event-triggered branches** — "user upgraded → kill trial sequence; user churned → start win-back."
  - **Connector targets:** Resend / SendGrid / Mailchimp / Customer.io / Loops / HubSpot.
- **Auto meeting prep** — 30 min before any meeting, Vega drops a brief: who's coming (LinkedIn + last interactions), agenda guess, talking points, open threads.
- **Meeting notes** — upload Zoom / Meet transcript or have Vega dial in → action items, summary, follow-ups, attendee-by-attendee.
- **Time-blocking auto-pilot** — protect deep work, surface conflicts, suggest reschedules.
- **Slack / Discord / WhatsApp triage** — beyond Gmail, route across DM platforms.
- **Travel research helper** — flights, hotels, restaurant recs for trips.
- **Expense report drafting** — feed receipts → categorized expense draft.
- **Voicemail / call summary** — phone integration for transcribed summaries.
- **"What did I miss?"** — vacation mode catches you up in 5 minutes.
- **Smart unsubscribe** — kill noise senders with one click; weekly inbox-hygiene digest.
- **Person CRM** — every contact, last interaction, key facts, talking points; auto-builds from email + calendar history.
- **Birthday / anniversary / renewal reminders** — soft-touch relationship maintenance.
- **Out-of-office responder** — context-aware (writes different OOO based on who emails).

**Chat-UX additions**
- **Tab: People** — your personal CRM, searchable by name / company / last contact.
- **Tab: Tasks** — extracted automatically from inbox + calendar + meeting notes.
- **Tab: Briefings archive** — daily/weekly briefings searchable.
- **Tab: Drafts** — outbound emails Vega drafted but you haven't sent.
- **Inline "send via Vega" composer** — embedded in any agent's chat: "Vega, email this draft to investor X".

**Follow-up actions**
- "Schedule this meeting" (one-click from email thread)
- "Pull Rex metrics into the briefing"
- "Block 2hrs deep-work tomorrow morning"

---

## Section 2 — Multi-Agent Collaboration Features

These are the features that actually justify "AI *employees*" framing — agents handing work to each other.

### 2.1 Content production pipeline (Sage → Maya → Rex)
**Flow:** Sage finds a keyword → Sage drafts brief → Maya converts to 8 social posts + a blog → Maya schedules → Rex tracks revenue attribution via UTM.
**UX:** A single button on any Sage keyword card: "Run full pipeline". Progress tracker shows each agent's step.

### 2.2 Lead-to-meeting (Scout → Vega)
**Flow:** Scout finds a qualified lead → enriches → Vega researches them → Vega drafts personalized intro → user approves → Vega sends and books a meeting.
**UX:** "Hand to Vega for outreach" on every lead card. Approval queue before send.

### 2.3 Investor-update workflow (Rex → Vega)
**Flow:** Rex generates monthly investor update → Vega sends personalized variants per investor (different tone for lead vs. seed angels) with a "next ask" tailored to each.
**UX:** "Send to investors" on Rex's update card. Per-investor preview before send.

### 2.4 Contract lifecycle (Lex → Vega → Rex)
**Flow:** Lex flags MSA expiring in 30 days → Vega drafts renewal email → Rex calculates uplift opportunity → consolidated card shown.
**UX:** Renewal calendar dashboard with all three layers visible.

### 2.5 Competitor-inspired content (Scout → Sage → Maya)
**Flow:** Scout detects competitor's top blog → Sage finds the keyword + content gap → Maya writes a *better* version + social syndication.
**UX:** "Counter this" button on Scout's competitor changelog.

### 2.6 Inbox-driven content (Vega → Maya / Sage)
**Flow:** Vega notices the same customer question 5+ times → suggests "this is a content opportunity" → Maya drafts a LinkedIn post / Sage drafts a blog FAQ.
**UX:** Weekly "Content opportunities from inbox" card.

### 2.7 Performance attribution (Maya ↔ Rex)
**Flow:** Maya's posts get UTMs auto-applied → Rex correlates traffic + revenue → reports which content drives money.
**UX:** "Revenue per post" leaderboard in Maya's published-posts tab.

### 2.8 Vendor cost optimization (Lex + Rex)
**Flow:** Lex parses all vendor contracts → Rex flags duplicate / overlap / unused spend from bank data → joint card shows renegotiation candidates.
**UX:** "Subscriptions audit" dashboard.

### 2.9 Cross-agent @mentions in chat
In any agent's chat, type `@rex how's MRR?` → Maya pings Rex via the existing `ask_agent` tool, Rex's answer appears inline as a quoted card from Rex.
**UX:** Autocomplete on `@`, agent-color-coded reply card.

### 2.10 Multi-agent "huddle"
Pose a question to multiple agents at once: *"Should we drop our price 20%?"* → Rex (margin impact), Scout (competitor pricing), Maya (positioning narrative), Sage (SEO impact on "cheap" keywords) each respond in parallel, results aggregated.
**UX:** New "Huddle" tab on dashboard; pick agents + question → side-by-side answers.

### 2.11 Briefing 2.0 (Vega orchestrates all 5 others)
Vega's morning briefing pulls live: Rex (anomalies), Scout (competitor moves), Sage (ranking changes), Maya (post performance), Lex (expiring contracts). One executive snapshot, sent at user's chosen time/channel (email/Slack/push).

### 2.12 Project Mode — "Help me launch X"
User sets a goal ("Launch our SOC2 page next month"). An orchestrator routes:
- Lex: drafts the SOC2 trust page legal copy
- Sage: SEO plan for "soc2 + [our category]"
- Maya: launch campaign across social
- Scout: market sizing & competitor's trust pages
- Rex: pricing impact analysis
- Vega: launch timeline + investor announcement email

**UX:** A new top-level surface — `/projects` — with goal cards, agent assignments, status, blockers.

### 2.13 Approval chains
Some flows need sign-off before world-touching actions: e.g., Maya wants to publish → Lex auto-reviews for risky claims → user gets approval card with both views.

### 2.14 Lifecycle email factory (Maya → Vega → Rex)
**Flow:** User picks a flow type (welcome / trial-to-paid / onboarding / re-engagement) → Maya writes the copy in brand voice → Vega configures triggers + cadence + connector → Rex tracks open / click / conversion / revenue per step and reports winners weekly.
**UX:** A new `/sequences` surface; visual sequence builder (steps as cards) with each step showing who wrote it (Maya), who delivers it (Vega), and Rex-tracked performance numbers inline. One-click "Optimize this step" runs Rex's underperforming-step finder + Maya's rewrite.

### 2.15 PR & media outreach (Scout → Maya → Vega)
**Flow:** Scout finds relevant journalists per beat (tech / lifestyle / industry / local) and recent stories they wrote → Maya drafts a press release + 5–10 personalized pitches matched to each journalist's beat and recent angles → Vega schedules send, tracks opens/replies, manages follow-ups, logs coverage.
**UX:** "PR Campaign" launchpad: pick angle (launch / funding / milestone / hire) → review journalist list with fit score → approve drafts → Vega handles outbound queue with reply detection. Coverage tracker shows mentions and backlinks once published.

### 2.16 GEO content engine (Sage → Maya → Lex)
**Flow:** Sage detects a high-value AI-search query you're not cited on → drafts a GEO-optimized brief (LLM-citeable structure, sources, schema) → Maya writes the long-form content + repurposes into social citations → Lex verifies factual claims and source quality (LLMs cite trustworthy sources; trust signals matter) → publish.
**UX:** "Win this prompt" button on any prompt in Sage's citation tracker. End-to-end pipeline visible.

---

## Section 3 — Platform-Wide Features

Cross-cutting features for the whole product, not specific to any one agent.

### 3.1 Conversation persistence & history
- Multiple **named threads** per agent (today: one rolling thread per agent).
- **Folders / projects** to group threads.
- **Pin / archive / star** threads.
- **Restore from history** — any past thread becomes the new starting point.

### 3.2 Files panel per chat
- Tab in every agent: **"Files in this chat"** — uploaded PDFs, images, URLs.
- Pin / unpin / delete; reuse across threads with one click.
- File-aware context: agent treats pinned files as priority context.

### 3.3 Universal Inbox / Action Center
A single feed (`/inbox`) showing every action awaiting human input across all agents:
- "Maya scheduled 3 posts — approve?"
- "Lex flagged 2 contracts expiring"
- "Rex: MRR anomaly detected"
- "Vega: 5 emails need your input"
One-click approve / reject / edit / delegate.

### 3.4 Approval workflows (HITL)
Any agent action that touches the outside world (post, send email, charge, sign) goes through approval queue. Configurable: "auto-approve Maya posts under 200 chars; require approval for everything else."

### 3.5 Activity timeline & audit log
Per org, every agent action: who/what/when/where, with a **rollback hook** where reversible (un-publish, recall email if within 30s, etc.). Critical for "action receipts" UX trend.

### 3.6 Mobile (PWA + native)
PWA first (low cost). Approvals, voice messages, briefing reads, push notifications. Major gap today — desktop-only.

### 3.7 Voice mode
- Talk to any agent (push-to-talk) → text response or voice response.
- Voice notes → tasks parsed by Vega.
- Phone-in briefings: Vega calls you at 8am, reads the briefing.

### 3.8 Slack / Discord integration
Talk to any agent via @mention in Slack. Briefings, alerts, approval cards posted to user-chosen channels. Already a planned integration; flesh out fully.

### 3.9 Email aliases per agent
- `maya@yourorg.veqiro.com` — forward = Maya processes (campaign brief, image asset).
- `lex@yourorg.veqiro.com` — cc on a contract email = Lex auto-reviews.
- `vega@yourorg.veqiro.com` — forward = Vega adds to your inbox-triage.
This is the "email is the universal API" hack and it's huge for non-technical users.

### 3.10 Scheduled jobs / agent crons
User-defined recurring tasks with a visible UI:
- "Every Monday 8am: Rex weekly digest"
- "Every morning: Vega briefing"
- "Every Friday: Scout competitor changelog"
Today the crons exist but only as code; surface them as a user-editable UI.

### 3.11 Agent memory / "Vault"
Pin facts agents always remember:
- "Always sign emails as Naresh"
- "We don't accept clients < $5K MRR"
- "Tone: confident but never arrogant"
Per-org and per-user layers.

### 3.12 Templates marketplace + industry packs
Veqiro-curated and community-shared:
- "SaaS founder pack" — preconfigures all 6 agents
- "Marketing agency pack"
- "E-commerce pack"
- "B2B services pack"

### 3.13 Team collaboration
- Multiple humans + agents in one thread.
- Assign agent tasks to teammates.
- Team-level memory + permissions per role.

### 3.14 Shareable artifacts
Already exists for Rex pinned cards. Extend to all agent outputs: any deliverable → public read-only branded link. Agency use-case: send to clients.

### 3.15 API + webhooks
Trigger agents from external systems:
- Stripe webhook → Rex updates
- HubSpot new-lead → Scout enriches → Vega outreach
- Linear ticket assigned → Vega summarizes context
Bi-directional. Critical for serious users.

### 3.16 Knowledge base ingestion (beyond BrandKit)
Connect Notion / Google Drive / Dropbox / GitHub README / Confluence / company wiki. All agents read from it. Today only BrandKit + uploaded files.

### 3.17 Cmd+K command palette
Global shortcut: switch agents, run actions, search threads, jump to settings. Today no global navigation primitive.

### 3.18 Dark mode
Genuinely missing today. Veqiro's warm cream + ink palette is distinctive — add a dark counterpart that preserves agent colors.

### 3.19 Cost / hours-saved dashboard
Already shows "hours saved" estimate; flesh out with per-agent breakdown, task-type breakdown, $-equivalent, weekly trends. Strong stickiness driver — users see ROI.

### 3.20 Onboarding 2.0 with role-based defaults
Today: collect BrandKit. Better: ask role first ("Founder / Marketing Lead / Agency Owner / Ops Lead") → preconfigure relevant agents, hide irrelevant actions, surface role-tuned starter actions.

### 3.21 Multi-language responses
Already serves global users; let each user pick response language per-agent (e.g., Maya replies in EN but writes posts in PT).

### 3.22 Custom brand personalities
Slight per-org persona tuning: "Maya more formal" / "Vega British English" — not full prompt rewrites, just slider-tuned voice presets.

### 3.23 Power-user prompt library
Save and reuse prompts. Share with team. Hotkey to insert.

### 3.24 White-label mode (agency tier)
Agencies want to resell Veqiro to their clients with their own branding. Higher tier; meaningful expansion revenue.

### 3.25 Notifications & digests
Email + push + Slack notifications when agents finish work, flag anomalies, or need approval. Configurable cadence per channel.

---

## Section 4 — New Agents to Add

Pick a few aligned with Veqiro's "AI employees" thesis. Ranked by market signal + fit.

### 4.1 PIPER — AI SDR / Outbound Sales (high priority)
**Why:** Strongest market category; AI SDR has matured into HITL > full autonomy (Landbase, Artisan, 11x.ai, Qualified). Founders + agencies all need this.
**Capabilities:**
- Multi-channel sequences (email, LinkedIn DM, Twitter DM)
- Intent-signal monitoring (collab with Scout)
- Reply detection & smart follow-up
- ICP-fit scoring before outreach
- A/B-tested templates with performance tracking
- Connects to HubSpot / Pipedrive / Salesforce / Attio
- Color: orange. Initials: PI.

### 4.2 CASE — Customer Success / Support (high priority)
**Why:** Top-3 SMB AI use case. Connects existing customer pain to product wins (loops back to Maya/Sage as content fuel).
**Capabilities:**
- Ticket auto-response (Intercom / Zendesk / HelpScout / Front)
- Churn-risk scoring from usage signals
- NPS / CSAT analysis
- Customer health-scoring dashboard
- Auto-FAQ from frequent tickets (collab with Sage)
- Renewal reminders & expansion flagging (collab with Rex)
- Color: teal. Initials: CS.

### 4.3 HARPER — HR / People Ops & Recruiting (medium-high)
**Why:** HR AI adoption doubled in 2025–26.
**Capabilities:**
- Job description writing (collab with Maya for tone, Lex for compliance)
- Resume screening & ranking against role
- Interview scheduling (collab with Vega)
- Interview question library
- Onboarding checklists per role
- Offer letter generation (collab with Lex)
- Employee FAQ assistant
- Color: coral. Initials: HR.

### 4.4 ATLAS — Data Analyst (medium)
**Why:** Rex is finance-specific; users ask product/usage/marketing analytics constantly.
**Capabilities:**
- Connect Postgres / BigQuery / Mixpanel / Amplitude / GA4 / PostHog
- Natural-language SQL ("plot DAU by week, segmented by plan")
- Saved dashboards
- Anomaly detection across any metric
- Cohort analysis beyond finance
- Sharable charts (extend Rex's pinned-cards pattern)
- Color: purple. Initials: AT.

### 4.5 AXIS — Project Manager / Operations (medium)
**Why:** Natural orchestrator role; ties every other agent into "projects."
**Capabilities:**
- Linear / Jira / Asana / ClickUp / Notion sync
- Sprint planning, ticket grooming, status reports
- Blocker detection
- Retrospective generation
- Roadmap drafting
- Could host the "Project Mode" from Section 2.12
- Color: indigo. Initials: AX.

### 4.6 NOVA — Brand & Product Designer (lower priority but distinctive)
**Why:** Maya does content imagery; Nova does brand & product visuals — logos, mockups, brand kit refreshes, design system tweaks. A real gap because Maya's output is "post art," not "brand asset."
**Capabilities:**
- Logo iterations
- Wireframe / mockup generation
- Component-library audit
- Pitch-deck design (collab with Rex on numbers, Maya on narrative)
- Social graphics in brand kit
- Color: cyan. Initials: NV.

### 4.7 PULSE — Investor Relations (niche but founder-heart)
**Why:** Founders agonize over investor comms. Veqiro is founder-aligned; this is high-signal.
**Capabilities:**
- Investor pipeline CRM
- Personalized monthly updates (collab with Rex)
- Pitch-deck iteration (collab with Nova)
- Fundraise tracker
- Investor research (collab with Scout)
- Color: gold. Initials: PL.

**Recommended phasing:** Piper + Case first (immediate ROI for SMB users), Harper third, then Atlas/Axis as orchestration matures, Nova/Pulse as differentiation plays.

---

## Section 5 — Adjacent Feature Categories

Slightly broader than core, still on-brand for "AI employees / automation for companies."

### 5.1 Agent Studio — custom agent builder
Let users build their own agent in Veqiro: name, persona, system prompt, tools, integrations, knowledge sources. Mirrors Lindy's biggest moat. Existing `BaseAgent` framework already supports this — surface it as a UI.

### 5.2 Workflow / Automations builder (visual)
"When X → do Y" with Veqiro agents as nodes. n8n/Zapier-lite but agent-native:
- Trigger: Stripe new subscription
- Action: Rex updates dashboard
- Action: Vega sends welcome email (with Maya's onboarding sequence)
- Action: Case adds to onboarding pipeline
A natural extension of cross-agent flows.

### 5.3 Customer-facing AI receptionist
Embed Veqiro on the user's site as a branded chat agent that knows the BrandKit. Routes to Vega for booking, Case for support, Sage for blog, Maya for newsletter signup. Turn Veqiro into a customer-facing surface, not just internal.

### 5.4 AI phone receptionist
Inbound phone → AI receptionist (powered by Veqiro + Vega/Case). Books meetings, answers FAQ, routes urgent calls, escalates with summary.

### 5.5 Browser/Gmail extension
Right-click any email: "Summarize / Draft reply / Schedule meeting / Forward to Lex." Drastically lowers activation friction — users never need to leave their inbox.

### 5.6 Slack/Notion/Linear app installations
Veqiro agents available natively inside the user's existing tools. Lower-friction adoption than asking users to come to Veqiro daily.

### 5.7 White-label briefings as a service
For agencies: branded daily/weekly briefings auto-sent to their clients. "PoweredBy Yourname Agency" branding. Agency expansion path.

### 5.8 Outbound voice agents
For appointment confirmations, customer surveys, simple cold calls. Big category in 2026 (Bland, Synthflow, Retell). Veqiro's edge: it knows your brand kit and customer context.

### 5.9 Form-filling agent
Bulk fill across forms: directory submissions for SEO (citations / NAP), grant applications, partnership intake forms, vendor security questionnaires (collab with Lex).

### 5.10 Pre-publish brand-safety check
Any outbound artifact (post, email, blog, contract) → routed through Lex (legal risk) + Maya (brand voice) + Sage (SEO impact) before going live. Like CI/CD for content.

### 5.11 AI mock-interview / sales-call simulator
Agents role-play investor / customer / candidate. Founder practices pitch with Pulse-as-VC. Sales rep practices with a synthetic customer.

### 5.12 PR & media outreach engine
A full PR-agency-in-a-box. PR agencies charge $5K+/mo and the work is highly automatable; this is a $20B market with no convincing AI-native player yet.
- **Journalist database + matching** — scrape / index journalists by beat, publication, recent stories, response rate; match to user's angle.
- **Hunter.io / Apollo / Clearbit fallback** for contact discovery; verified email scoring.
- **Press release generator** — multi-format (boilerplate, headline-only, embargo, exclusive) from BrandKit + a single-paragraph pitch.
- **Personalized pitch drafter** — different drafts per journalist type (tech / lifestyle / VC / local / industry trade) with hook tailored to journalist's last 3 stories.
- **Outbound + reply handling** (via Vega) — tracked sends, follow-up cadence, reply detection, "interested" handoff to user.
- **Coverage tracker** — Google News + RSS + social mentions; ties published coverage back to the pitch that won it.
- **Embargo/exclusive workflow** — one journalist gets first access; auto-release to wider list on lift date.
- **Could ship as Scout sub-skill OR as a dedicated micro-agent ("BYLINE")** — recommend Scout sub-skill first, promote to agent if usage justifies.

### 5.17 GEO + creative studio hybrid (positioning play)
A bigger-picture surface: position Veqiro's content stack (Maya + Sage + Nova + Lex review) as **"AI creative studio + GEO agency"** — produce ad creative (copy, video scripts, visuals) AND get it cited in ChatGPT / Claude / Gemini answers. This is a marketing/positioning angle more than a feature: bundle Sage's GEO suite (Section 1.4) + Maya's content (Section 1.1) + Nova's brand assets (Section 4.6) into a single "Creative + Visibility" package, possibly as a higher pricing tier or agency offering. Generative Engine Optimization is rapidly becoming a paid service category — Veqiro can occupy it before standalone GEO startups dominate.

### 5.18 Lifecycle email & nurture as a product surface
Beyond Vega's lifecycle engine (Section 1.6) and the Maya→Vega→Rex factory (Section 2.14), expose this as a top-level `/sequences` workspace with:
- Pre-built sequence templates (SaaS welcome, ecommerce post-purchase, B2B lead nurture, course-launch ramp).
- Visual sequence builder.
- Step-level performance dashboard (Rex-driven).
- Library of high-performing copy patterns user can pull into any step.
- Per-segment branching (free user vs. paid, EU vs US, mobile vs desktop signup).
This is one of the highest-ROI "AI employee" use cases for SMBs and a clean expansion path: most users buy Veqiro for one agent and stay because the lifecycle engine quietly becomes irreplaceable.

### 5.13 Goal tracker / OKR co-pilot
Set quarterly goals → agents check in on progress weekly, flag risks, propose tasks. Ties everything together.

### 5.14 Cross-agent insights layer
Meta-analytics: "you spent 40 hrs on content this month, 20% above average. Maya could pick up 60% of this." Suggestions to delegate.

### 5.15 Marketplace of skills/connectors
Third-party developers ship Veqiro skills (e.g., "Shopify connector for Rex," "Calendly connector for Vega"). Long-term ecosystem play.

### 5.16 Veqiro for Teams (multi-user agents)
Shared agents that work across whole team — see who asked what, team-level memory, per-role permissions. Real "department" feel.

---

## Verification

This plan is a feature-ideation document, not an implementation plan. To validate ideas before building:

1. **Score each idea on a 2×2** (impact × build cost). Ship Section 1 quick-wins first (file panels, history, repurpose engine) — many leverage existing data models with thin UI work.
2. **User interview pass** — before scoping any Section 2 multi-agent flow, talk to 5 active Veqiro users about which agent-to-agent handoff they'd actually use.
3. **Competitive walkthrough** — sign up for Lindy, Manus, Sintra, Qualified Piper for a week each; document where they're better and where Veqiro can win.
4. **Schema audit** — for every feature involving persistence, check if the Prisma model already exists (`Source`, `RexPinnedCard`, `CompetitorWatch`, `SavedKeyword` already cover ~half of what's proposed).
5. **One-month build picks** — recommend starting with: (a) per-chat Files tab + thread history (Section 3.1, 3.2), (b) Universal Action Center (Section 3.3), (c) one cross-agent flow (Section 2.1 Sage→Maya pipeline), (d) Piper as the next agent (Section 4.1). These four ship a *visible* leap without rewriting foundations.

**End of plan.**
