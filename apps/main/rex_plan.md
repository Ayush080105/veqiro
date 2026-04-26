 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 REX — Feature Roadmap & Completion Plan

 Context

 REX is ~90% complete. Four items from the original plan remain unbuilt. Beyond those, the AI output quality has significant trust gaps, and there are
 high-leverage product features that would make REX sticky for daily startup use (founders check tools like Runway.app every morning). This plan covers the
  completion of v1 AND a prioritised roadmap of everything that would push REX from "useful" to "indispensable."

 ---
 Part A — Remaining Original Plan Items (v1 Completion)

 These must ship before calling REX "done" per the original spec.

 A1. AgentInfoPanel — Weekly Digest Settings Toggle

 Files to edit:
 - apps/main/src/components/assistants/AgentInfoPanel.tsx
 - apps/main/src/lib/api/rex.ts (already has getSettings, patchSettings)

 What to build:
 - When agent.id === "rex", render a collapsible settings section at the bottom of the panel
 - Fetch GET /agents/rex/settings on mount
 - Toggle: "Email me Monday digest" (weeklyDigestEnabled) with a timezone dropdown (UTC / user timezone)
 - PATCH on change with debounce
 - Difficulty: Easy | Third-party: No

 ---
 A2. KPI Drill-Down Chart Modal

 Files to edit:
 - apps/main/src/components/agents/rex/KpiStrip.tsx

 What to build:
 - KpiTileBtn onClick is already wired — pass a handler that opens a modal
 - Modal renders a sparkline (can reuse the SVG Sparkline from cards.tsx) of the last 90 days from the org's RexDataset for that metric key
 - Fetch datasets from existing GET /agents/rex/datasets query (already cached)
 - If no data exists, show "Upload data to see trend"
 - Difficulty: Easy | Third-party: No

 ---
 A3. "Use Saved Dataset" Picker in Forms

 Files to edit:
 - apps/main/src/components/agents/rex/forms.tsx (4 forms: analyze-metrics, forecast, financial-analysis, unit-economics)
 - New shared sub-component DatasetPicker (inside forms.tsx or a new dataset-picker.tsx)

 What to build:
 - Small <select> dropdown above each DataPointTable field that calls GET /agents/rex/datasets (React Query, 30s stale)
 - On pick, populate the field.onChange() with the dataset's points array
 - Show name • metricKey • N pts in the dropdown label
 - Only show datasets that match the expected metricKey (e.g. forecast form shows only MRR/revenue datasets)
 - Difficulty: Easy | Third-party: No

 ---
 A4. Quick-Action Buttons After Dataset Save

 Files to edit:
 - apps/main/src/components/agents/rex/data-tab.tsx

 What to build:
 - After handleSave() succeeds, render a post-save panel (instead of just clearing state)
 - Content: "Got it! I saved [N] datasets. Want me to…" + 2-3 action buttons:
   - "Forecast [metric]" → opens RunActionDialog with rex:forecast prefilled
   - "Analyze metrics" → opens RunActionDialog with rex:analyze-metrics prefilled
   - "Financial analysis" → opens RunActionDialog with rex:financial-analysis prefilled
 - Pass openAction callback down via a prop from the page (or use a query param / event emitter pattern)
 - Difficulty: Easy | Third-party: No

 ---
 Part B — AI Quality & Trust Improvements (High-Impact, No Third Party)

 These make REX's output trustworthy enough for a real startup board meeting.

 B1. Temperature Tuning by Endpoint

 File: apps/ai/agents/rex/routes.py

 Change the complete() call on each endpoint to pass explicit temperature:
 - Financial narratives → temperature=0.3
 - Runway/Unit Economics recommendations → temperature=0.3
 - Investor Update email body → temperature=0.5
 - Weekly Digest → temperature=0.6
 - Chat → temperature=0.7 (conversational)

 Why: Fixed 0.7 temperature on financial analysis causes output to vary run-to-run on the same data — founders lose trust when Rex says something different
  tomorrow.

 Difficulty: Easy | Third-party: No

 ---
 B2. Structured Output via OpenAI response_format (JSON Schema)

 File: apps/ai/core/llm.py, apps/ai/agents/rex/routes.py

 Replace prompt-based JSON parsing with OpenAI's response_format: { type: "json_object" } parameter, and use stricter JSON Schema for each endpoint
 response. This eliminates the current fragile strip_json_fences + fallback truncation pattern.

 Also: Add a post-parse validator that checks required fields are present before returning to Express.

 Difficulty: Medium | Third-party: No

 ---
 B3. Confidence Scores + Data Source Labels on Every Insight

 Files: apps/ai/agents/rex/routes.py, apps/server/src/modules/agents/rex/rex.types.ts, apps/main/src/components/agents/rex/cards.tsx

 Return additional fields from each AI endpoint:
 {
   "data_coverage": "12 months (Jan 2025 – Dec 2025)",
   "data_source": "mrr dataset — uploaded 2026-04-25",
   "confidence": "high | medium | low",
   "confidence_reason": "based on 12 data points; Prophet model used"
 }

 Render this as a subtle footer on each card in cards.tsx.

 Why: "Where did Rex get this?" kills trust when unanswered.

 Difficulty: Medium | Third-party: No

 ---
 B4. Improved LLM Prompts with Benchmark Context

 File: apps/ai/agents/rex/routes.py

 Current prompts are minimal ("Analyze these metrics"). Rewrite with:
 - SaaS benchmark thresholds baked in (LTV:CAC > 3x = healthy; churn < 2%/mo = excellent)
 - Explicit format instructions with field-by-field guidance
 - 1-2 few-shot examples embedded in the system prompt for weekly digest and investor update
 - Instruction to cite WHY a metric is green/amber/red (e.g. "runway < 6mo = amber")

 Difficulty: Medium | Third-party: No

 ---
 B5. Anomaly Root-Cause Correlation

 File: apps/ai/agents/rex/analytics.py, apps/ai/agents/rex/routes.py

 When an anomaly is detected (Z-score > 2σ), cross-check other metrics at the same date window:
 - If MRR drops + churn spikes at same time → flag "churn-driven revenue drop"
 - If burn spikes + no new hires → flag "one-time expense or invoice spike"

 Add root_cause_hypothesis to anomaly objects. LLM then narrates with this context.

 Difficulty: Hard | Third-party: No

 ---
 Part C — New Engagement Features (No Third Party)

 Features that make REX the first thing founders open every morning.

 C1. Magic Numbers Summary Card (Home KPI Dashboard)

 Files: New apps/main/src/components/agents/rex/magic-numbers.tsx, edit page.tsx

 A condensed card showing 5 critical metrics for the company's stage:
 - Runway (months) + trend arrow
 - Net Revenue Retention (%)
 - CAC Payback (months)
 - MoM Churn (%)
 - MoM Revenue Growth (%)

 Rendered below KpiStrip only when data exists. Each tile → opens drill-down chart.

 Why: Founders check Runway.app every morning for this view. One glance = company health.

 Difficulty: Easy | Third-party: No

 ---
 C2. Threshold-Based Email Alerts

 Files: New apps/server/src/modules/agents/rex/rex.alerts.ts, rex.cron.ts, rex.repository.ts, apps/main/src/components/agents/rex/alert-settings.tsx in
 AgentInfoPanel

 Configurable alert rules per org stored in RexSettings:
 - Runway drops below X months → email alert
 - Churn jumps by > Y% week-over-week → email alert
 - MRR declines → email alert

 Daily cron (not just Monday) checks thresholds against latest datasets. Uses existing Resend integration.

 Difficulty: Medium | Third-party: No (uses existing Resend)

 ---
 C3. Webhook Ingest Endpoint

 Files: apps/server/src/modules/agents/rex/rex.routes.ts, rex.controller.ts, rex.service.ts

 New endpoint: POST /agents/rex/ingest

 {
   "api_key": "org-scoped key",
   "metric": "mrr",
   "date": "2026-04-26",
   "value": 62000,
   "period": "monthly"
 }

 - Generates a per-org API key stored in RexSettings
 - Appends the data point to the matching RexDataset (or creates one)
 - Real-time data without UI — billing service, CRM, internal script can POST
 - Key shown in AgentInfoPanel settings

 Why: Stripe sends a webhook after every invoice. Rex should catch it.

 Difficulty: Medium | Third-party: No

 ---
 C4. Scenario Builder Templates

 Files: apps/main/src/components/agents/rex/forms.tsx (RexScenarioForm), apps/main/src/lib/schemas/agents/rex.ts

 Pre-built scenario templates:
 - "Hire 2 engineers" → { burn_delta: +25000 }
 - "Double marketing" → { burn_delta: +10000, mrr_delta: +5000 }
 - "Price increase 20%" → { mrr_delta: +MRR_pct }
 - "Extend runway by cutting X" → slider-based burn reduction

 Appears as a row of template chips above the scenario entries in RexScenarioForm. Click to pre-fill.

 Difficulty: Easy | Third-party: No

 ---
 C5. Board Deck Auto-Generation

 Files: New apps/ai/agents/rex/routes.py endpoint /ai/rex/board-deck, apps/server/src/modules/agents/rex/, new frontend card

 New action rex:board-deck — generates a structured investor-ready summary:
 - 5 sections: Company Overview, Financial Health (MRR/Burn/Runway), Metrics Analysis (growth, churn), Risks & Mitigations, Key Ask
 - Output as HTML with print-friendly styling
 - Copy-to-HTML button in card + "Open in new tab" for full preview

 Why: Founders spend 1hr/month on board packs. This kills the spreadsheet.

 Difficulty: Medium | Third-party: No

 ---
 C6. Multi-Sheet Excel Support

 File: apps/server/src/modules/agents/rex/rex.csv.ts

 Extend parseUploaded() to process ALL sheets in an XLSX, not just sheet 0. Return an array of ParseResult per sheet. Frontend shows a tab picker to
 confirm which sheet maps to which metric.

 Difficulty: Easy | Third-party: No

 ---
 C7. Column Mapping Templates (Org Memory)

 Files: apps/server/src/modules/agents/rex/rex.repository.ts, rex.csv.ts, apps/server/prisma/schema.prisma

 Store last successful column mapping in RexSettings.columnMappingTemplates (JSON field). On next upload, auto-apply the saved mapping as the default
 instead of re-inferring. Show "Apply saved mapping" button in parse review UI.

 Difficulty: Easy | Third-party: No

 ---
 C8. REX → Vega Cross-Agent Digest Integration

 Files: apps/ai/agents/vega/routes.py (executive-briefing endpoint), apps/ai/agents/rex/agent.py

 In Vega's executive-briefing prompt, add a call to ask_agent("rex", "give me today's financial snapshot in 2 sentences"). Append Rex's response as a
 "Financial status" section in the briefing.

 Difficulty: Easy | Third-party: No

 ---
 C9. Variance Analysis (Actual vs Budget)

 Files: apps/server/prisma/schema.prisma (add purpose field to RexDataset: "actual" | "budget"), apps/ai/agents/rex/routes.py (new endpoint
 /ai/rex/variance), frontend card + form

 Founder uploads a budget dataset (tagged as "budget"). Rex computes: actual vs budget delta by month, highlights over/under by >10%, LLM narrates
 "Marketing came in 12% over budget due to Q2 campaign."

 Difficulty: Medium | Third-party: No

 ---
 C10. Shareable Pinned Cards

 Files: apps/server/src/modules/agents/rex/rex.repository.ts, rex.routes.ts, rex.controller.ts, new page
 apps/main/src/app/(dashboard)/rex-share/[id]/page.tsx

 Add isPublic: Boolean + shareToken: String? to RexPinnedCard. New endpoint GET /agents/rex/pins/public/:token returns the card payload without auth. New
 public page renders the card via ActionResultRenderer.

 Pin button grows a "Share" action after pinning.

 Difficulty: Medium | Third-party: No

 ---
 Part D — Third-Party Integrations (Phase 2+)

 D1. Stripe API Sync (Real-Time MRR)

 Auto-sync MRR, churn, ARR, new customers, expansion revenue from Stripe subscription data. Daily sync via cron — no CSV upload needed.

 Difficulty: Hard | Third-party: Yes (Stripe API + OAuth flow)
 Why: This is the single highest-leverage integration. Eliminates manual data entry for most SaaS founders.

 ---
 D2. Plaid Bank Integration (Cash Balance)

 Real-time cash position from bank account. Enables accurate runway without asking the founder.

 Difficulty: Hard | Third-party: Yes (Plaid API)

 ---
 D3. Slack Alerts

 Post anomaly alerts, weekly digest summary, and runway warnings to a founder's Slack channel.

 Difficulty: Medium | Third-party: Yes (Slack API / Slack App)
 Why: Founders are in Slack all day. Email gets missed; Slack doesn't.

 ---
 D4. ChartMogul / Baremetrics Sync

 Pull cohort data, MRR movements, churn analysis from existing billing analytics tools founders already use.

 Difficulty: Hard | Third-party: Yes (ChartMogul API, Baremetrics API)

 ---
 D5. Zapier / Make.com Webhook Connector

 Let founders send data from Notion, Airtable, HubSpot, Gong → Rex via Zapier.

 Difficulty: Medium | Third-party: Yes (Zapier Partner API)

 ---
 D6. Industry Benchmarking Dataset

 Compare founder metrics to anonymised SaaS cohort benchmarks (from Carta, OpenVC, or our own aggregated user data eventually).

 Difficulty: Hard | Third-party: Yes (Carta, Pitchbook, or internal data at scale)

 ---
 Prioritised Implementation Order

 Immediate (v1 completion) — 1-3 days

 ┌─────┬────────────────────────────────┬────────────┬───────────┐
 │  #  │            Feature             │ Difficulty │ 3rd Party │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ A1  │ AgentInfoPanel digest toggle   │ Easy       │ No        │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ A2  │ KPI drill-down chart modal     │ Easy       │ No        │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ A3  │ Saved dataset picker in forms  │ Easy       │ No        │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ A4  │ Quick-action buttons post-save │ Easy       │ No        │
 └─────┴────────────────────────────────┴────────────┴───────────┘

 Phase 1 — High ROI, no integrations — 1-2 weeks

 ┌─────┬───────────────────────────────────┬────────────┬───────────┐
 │  #  │              Feature              │ Difficulty │ 3rd Party │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ B1  │ Temperature tuning by endpoint    │ Easy       │ No        │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ B4  │ Improved LLM prompts + benchmarks │ Medium     │ No        │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ C1  │ Magic Numbers summary card        │ Easy       │ No        │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ C4  │ Scenario builder templates        │ Easy       │ No        │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ C6  │ Multi-sheet Excel support         │ Easy       │ No        │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ C7  │ Column mapping memory             │ Easy       │ No        │
 ├─────┼───────────────────────────────────┼────────────┼───────────┤
 │ C8  │ REX → Vega cross-agent digest     │ Easy       │ No        │
 └─────┴───────────────────────────────────┴────────────┴───────────┘

 Phase 1 (continued) — Engagement hooks — 2-3 weeks

 ┌─────┬─────────────────────────────────┬────────────┬───────────┐
 │  #  │             Feature             │ Difficulty │ 3rd Party │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ B2  │ Structured output (JSON schema) │ Medium     │ No        │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ B3  │ Confidence scores + data source │ Medium     │ No        │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ C2  │ Threshold-based email alerts    │ Medium     │ No        │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ C3  │ Webhook ingest endpoint         │ Medium     │ No        │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ C5  │ Board deck auto-generation      │ Medium     │ No        │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ C9  │ Variance analysis               │ Medium     │ No        │
 ├─────┼─────────────────────────────────┼────────────┼───────────┤
 │ C10 │ Shareable pinned cards          │ Medium     │ No        │
 └─────┴─────────────────────────────────┴────────────┴───────────┘

 Phase 2 — Deep product moat — 4-6 weeks

 ┌─────┬────────────────────────────────┬────────────┬───────────┐
 │  #  │            Feature             │ Difficulty │ 3rd Party │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ B5  │ Anomaly root-cause correlation │ Hard       │ No        │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ D3  │ Slack alerts                   │ Medium     │ Yes       │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ D1  │ Stripe API sync                │ Hard       │ Yes       │
 ├─────┼────────────────────────────────┼────────────┼───────────┤
 │ D5  │ Zapier connector               │ Medium     │ Yes       │
 └─────┴────────────────────────────────┴────────────┴───────────┘

 Phase 3 — Enterprise & ecosystem — 2-3 months

 ┌─────┬─────────────────────────────┬────────────┬───────────┐
 │  #  │           Feature           │ Difficulty │ 3rd Party │
 ├─────┼─────────────────────────────┼────────────┼───────────┤
 │ D2  │ Plaid bank integration      │ Hard       │ Yes       │
 ├─────┼─────────────────────────────┼────────────┼───────────┤
 │ D4  │ ChartMogul/Baremetrics sync │ Hard       │ Yes       │
 ├─────┼─────────────────────────────┼────────────┼───────────┤
 │ D6  │ Industry benchmarking       │ Hard       │ Yes       │
 └─────┴─────────────────────────────┴────────────┴───────────┘

 ---
 Critical Files Reference

 ┌────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
 │                          File                          │                          Purpose                          │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/ai/agents/rex/routes.py                           │ All AI endpoints — prompts, response shapes, temperature  │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/ai/agents/rex/analytics.py                        │ Pre-LLM math — anomalies, health, derived metrics, runway │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/ai/agents/rex/agent.py                            │ Chat tools, system prompt, tool dispatch                  │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/ai/core/llm.py                                    │ LLM client — temperature, max_tokens, MOCK_MODE           │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/server/src/modules/agents/rex/rex.cron.ts         │ Weekly digest scheduler                                   │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/server/src/modules/agents/rex/rex.repository.ts   │ Prisma queries for all REX models                         │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/server/prisma/schema.prisma                       │ RexDataset, RexPinnedCard, RexSettings                    │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/main/src/components/agents/rex/forms.tsx          │ All 9 action forms                                        │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/main/src/components/agents/rex/cards.tsx          │ All 9 result cards                                        │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/main/src/components/agents/rex/data-tab.tsx       │ CSV upload + dataset management                           │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/main/src/components/agents/rex/KpiStrip.tsx       │ Live KPI strip                                            │
 ├────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ apps/main/src/components/assistants/AgentInfoPanel.tsx │ Where digest toggle goes                                  │
 └────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────┘

 ---
 Verification

 After Phase A implementation:
 1. Navigate /assistants/rex → click Info icon → see digest toggle → toggle off → no email on Monday
 2. Click MRR tile in KPI strip → chart modal opens with 90-day trend
 3. Open Plus → Forecast action → click "Use saved dataset" dropdown → select MRR → table auto-fills
 4. Upload a CSV → save → see "Want me to forecast?" panel with action buttons

 After Phase B/C:
 5. Run financial analysis on same data twice → get near-identical narrative (temperature=0.3)
 6. Run weekly digest → card footer shows data source + confidence label
 7. POST to /agents/rex/ingest with API key → new data point appears in datasets
 8. Vega executive briefing → includes Rex financial snapshot section