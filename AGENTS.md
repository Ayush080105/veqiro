# Agent Reference

Six AI agents, each with a focused domain. They share a common handoff mechanism: result cards expose buttons that open another agent's form pre-filled with the relevant data — no copy-pasting required.

---

## Maya — Social Media Content

Drafts, schedules, and publishes social content across LinkedIn, Twitter, and Instagram. Generates post ideas, full drafts, carousel slides, image variants, and product campaign photos. Publishes directly to connected accounts.

**Key outputs**
- `generate-ideas` — array of content ideas with hooks, hashtags, visual descriptions
- `draft-content` — full platform-native post (body, hashtags, CTA, optional image)
- `draft-carousel` — single caption + N swipeable slide images
- `generate-variants` — same content adapted for multiple platforms
- `campaign` — N product campaign photos with composition roles
- `publish` / `publish-carousel` — live post to connected social account(s)

**Hands off to →**

| Button | Target | Pre-filled with |
|--------|--------|-----------------|
| Draft → Variants | `maya:generate-variants` | original content + platform |
| Draft → Revise | `maya:revise` | original content + platform |
| Ideas → Draft | `maya:draft-content` | topic, platform |

---

## Scout — Market & Competitor Intelligence

Researches markets, profiles competitors, and surfaces trending topics. Monitors competitor websites for changes. All research is grounded in live web scraping.

**Key outputs**
- `research-topic` — market overview, key players, opportunities, risks, keywords found
- `research-company` — company profile (description, pricing, strengths, weaknesses, news)
- `trending-topics` — list of trends with momentum, relevance, content hook per trend
- `discover-competitors` — competitor list with differentiation narrative

**Hands off to →**

| Button | Target | Pre-filled with | User benefit |
|--------|--------|-----------------|--------------|
| "Draft post" (per trend) | `maya:draft-content` | trend topic, platform=linkedin | Turn a signal into a post instantly |
| "Generate ideas" (per trend) | `maya:generate-ideas` | trend as topic hint | Brainstorm content angles around the trend |
| "Find keywords" (research report) | `sage:keyword-research` | market overview as seed | Discover SEO potential of the researched market |
| "Draft positioning post" (company) | `maya:draft-content` | differentiation topic | Counter-position against a competitor in one click |

---

## Sage — SEO & Content Strategy

Keyword research, content briefs, blog generation, and SEO audits. Produces structured content plans and fully written blog posts optimised for search.

**Key outputs**
- `keyword-research` — keywords clustered by intent with difficulty, volume, content type
- `content-brief` — H2 structure, must-cover topics, competitor gaps, CTA, title options
- `generate-blog` — full blog post (markdown/HTML, meta fields, schema markup)
- `generate-blog-ideas` — list of SEO-backed blog ideas with content angles
- `analyze-content` — SEO audit score, issues, improvements, missing keywords

**Hands off to →**

| Button | Target | Pre-filled with | User benefit |
|--------|--------|-----------------|--------------|
| "Generate ideas" (per keyword) | `maya:generate-ideas` | keyword as topic hint | Instantly generate social posts around a researched keyword |
| "Write blog" (per idea) | `sage:generate-blog` | title, target keyword | One-click from idea to full blog |
| "Post about this" (per idea) | `maya:draft-content` | blog idea title, platform=linkedin | Share the blog idea as a social post |
| "Draft social post" (brief) | `maya:draft-content` | first title option, platform=linkedin | Promote the content you're about to write |

---

## Rex — Business Analytics & Finance

Analyses business metrics, forecasts trends, models scenarios, and generates investor communications. Connects to uploaded datasets (CSV/spreadsheet) and generates board-ready reports.

**Key outputs**
- `analyze-metrics` — trend, anomalies, insights, health indicator, charts data
- `forecast` — time-series prediction with confidence intervals and methodology
- `financial-analysis` — MRR, ARR, burn, runway, growth rate, health status
- `runway` — months remaining, cash position, scenarios, recommendation
- `unit-economics` — CAC, LTV, LTV:CAC ratio, payback period, benchmarks
- `scenario` — what-if modelling with interactive sliders
- `weekly-digest` — WoW changes, alerts, green flags, focus items
- `investor-update` — subject line, exec summary, full email body
- `variance` — budget vs actual with direction and narrative
- `board-deck` — full HTML board presentation

**Hands off to →**

| Button | Target | Pre-filled with | User benefit |
|--------|--------|-----------------|--------------|
| "Share on LinkedIn" (digest) | `maya:draft-content` | digest headline, platform=linkedin | Celebrate a milestone publicly without switching apps |
| "Share growth update" (financial) | `maya:draft-content` | milestone topic | Turn a green financial signal into a post |
| "Share forecast" (forecast) | `maya:draft-content` | forecast summary | Share growth trajectory with your audience |
| "Generate investor update" (various) | `rex:investor-update` | current metrics, period | One-click from analysis to investor email draft |
| "Send via Vega" (investor update) | `vega:compose-email` | subject line + full email body | Send the drafted update without leaving the platform |
| "Email board" (runway) | `vega:compose-email` | runway status + recommendation | Alert the board about cash position instantly |
| "Calculate runway" (financial) | `rex:runway` | burn and revenue figures | Drill from financial health into runway detail |
| "Model a scenario" (forecast/runway) | `rex:scenario` | base metrics | Explore what-if without re-entering data |

---

## Lex — Legal & Compliance

Analyses contracts for risk, checks regulatory compliance, drafts legal documents, and answers questions about uploaded legal documents using RAG.

**Key outputs**
- `analyze-contract` — risk level, clause breakdown, negotiation points, obligations, recommended action
- `compliance-check` — framework results (GDPR, HIPAA, SOC2 …), critical gaps, remediation steps
- `draft-document` — full legal document in markdown
- `query-document` — RAG-based Q&A against uploaded documents
- `legal-research` — applicable laws, requirements, practical guidance
- `explain` — plain-English explanation with key terms glossary

**Hands off to →**

| Button | Target | Pre-filled with | User benefit |
|--------|--------|-----------------|--------------|
| "Email team about risks" (contract) | `vega:compose-email` | subject with risk level + high-risk clause summary | Alert stakeholders about contract risks in one click |
| "Draft awareness post" (compliance) | `maya:draft-content` | compliance framework as topic | Communicate your compliance posture publicly |

---

## Vega — Email & Calendar Intelligence

Connects to Gmail and Google Calendar. Triages inboxes, drafts replies, composes emails, summarises calendars, creates events, and produces executive morning briefings.

**Key outputs**
- `process-inbox` — prioritised email list (urgent/high/medium/low) with summaries and suggested actions
- `draft-reply` — ready-to-send reply draft, optionally saved to Gmail
- `compose-email` — full email drafted from instructions (tone, CTA, recipient)
- `calendar-summary` — events, conflicts, free slots, daily summary
- `create-event` — calendar event with Google Meet link
- `executive-briefing` — morning summary: schedule, urgent actions, email digest, focus recommendation

**Hands off to →**

| Button | Target | Pre-filled with | User benefit |
|--------|--------|-----------------|--------------|
| "Draft post" (urgent/high emails) | `maya:draft-content` | email subject as topic | Turn customer escalations or product feedback into public content |

---

## Adding a New Handoff

1. In the source card component, add `onFollowUpAction?: FollowUp` to the props interface
2. Add a `Button` that calls `onFollowUpAction("target:action", { field: value })`
3. Use the exact field names from `RunActionDialog.tsx` SPECS `defaultValue` for the target action
4. In `ActionResultRenderer.tsx`, pass `onFollowUpAction={onFollowUpAction}` to the card

The prefill object is shallow-merged over the action's `defaultValue` — any unknown fields are ignored, so it's safe to pass extra context.
