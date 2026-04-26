
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 REX (Data + Finance Analyst) — End-to-End Implementation Plan

 Context

 REX is the 6th and final AI "employee" in Verqio. The other 5 (Maya, Sage, Lex, Scout, Vega) are shipped end-to-end. REX is already 70% scaffolded:

 - apps/ai — agents/rex/ is fully built (chat + 8 specialized endpoints with MOCK_MODE fallbacks, Prophet forecasting, anomaly detection, RAG ingestion,
 cross-agent calls). Router is registered in main.py:25.
 - apps/main — agent registry entry, action registry (4 actions), Zod schemas, form components (forms.tsx), result cards (cards.tsx), result types — all in
  place.
 - apps/server — Prisma Agent enum already includes REX (migration 20260423072040_fix_agent_enum_rex applied).

 The gap: there is no apps/server/src/modules/agents/rex/. The frontend's useSendMessage("rex", …) and RunActionDialog calls /api/v1/agents/rex/* and gets
 404 — that's why the chat throws AgentNotAvailableError today.

 Beyond the missing server module, the goal is to make REX feel like a real high-pro CFO/data analyst on call: data feeding in continuously, instant
 insight, anomalies surfaced before being asked, what-ifs answered live, and an artifact you can pin/share.

 Decisions Locked In

 - Data source for v1: CSV/Excel upload + manual DataPointTable entry. Stripe OAuth connector explicitly deferred to v1.1. Reason: ships fast, no
 OAuth/sync infra to build, covers any data shape (Stripe export, bank export, ad-platform CSV).
 - Polish features in v1 (all four): live KPI strip in header, pinnable cards / Today panel, weekly digest email cron, interactive what-if sliders in
 ScenarioCard.
 - LLM: keep gpt-4o-mini (parity with other agents; the heavy lifting is in Python — the LLM only narrates).

 Goals

 1. Wire REX end-to-end — server module mirroring Sage's pattern, REX route in router.ts, frontend API client. Result: every action in the Plus menu and
 the chat work for REX, just like Sage/Maya today.
 2. Make REX useful with real data fast — CSV/XLSX upload → auto column-mapping → saved RexDataset rows that any action can pick from.
 3. Make REX feel alive — live KPI strip, pinnable result cards on a "Today" panel, scheduled weekly digest email, live what-if sliders.
 4. Don't break the others — reuse existing patterns (R2 uploads, messages repo, aiService, RunActionDialog).

 Out of Scope (explicit)

 - Stripe OAuth connector — deferred to v1.1. CSV upload covers the use case.
 - Plaid bank integration — deferred to v2.
 - Ad-platform connectors (Meta/Google Ads) — covered via CSV in v1.
 - Streaming token-by-token responses — apps/ai/agents/base.py has chat_stream but no agent uses it; defer for cross-agent rollout.

 ---
 Architecture

 Request flow mirrors Sage exactly:

 [apps/main]
   /assistants/rex
     ├─ ChatHeader  ──► KpiStrip (live MRR/Cash/Runway/Health) ──► GET /api/v1/agents/rex/snapshot
     ├─ Today panel (collapsible) ──► GET /api/v1/agents/rex/pins (+ pin icon on every card)
     ├─ Tabs: Chat | Data ──► Data tab uses GET /agents/rex/datasets, POST /agents/rex/datasets/parse
     ├─ ChatInput   ──► useSendMessage("rex", …) ──► POST /api/v1/agents/rex/chat
     └─ PlusMenu    ──► RunActionDialog ──► POST /api/v1/agents/rex/{action}

          │
          ▼
 [apps/server]  (Express, NEW module: src/modules/agents/rex/)
   rex.routes.ts        — chat (POST/GET); 9 action endpoints; datasets CRUD; pins CRUD; snapshot; settings (digest opt-in)
   rex.controller.ts    — req/res adapters (auth → zod parse → service → json)
   rex.service.ts       — DB writes (Message + customInput) + aiService.post(...) to apps/ai
   rex.repository.ts    — Prisma queries (messages, RexDataset, RexPinnedCard, RexSettings)
   rex.schema.ts        — Zod input validation (mirrors frontend schemas + new ones for runway/unit-econ/scenario/digest/investor-update)
   rex.types.ts         — TS types inferred from Zod
   rex.csv.ts           — CSV/XLSX parser + column-mapping inference (Papa Parse + SheetJS)
   rex.cron.ts          — node-cron weekly digest job

          │  (X-Internal-Api-Key, axios)
          ▼
 [apps/ai]  (FastAPI — ALREADY EXISTS in agents/rex/)
   /ai/rex/chat                — RexAgent.chat_sync (tool-using LLM loop)
   /ai/rex/analyze-metrics     — anomaly detection + insight narrative
   /ai/rex/forecast            — Prophet/linear forecast with bands
   /ai/rex/financial-analysis  — derived metrics + health + recs
   /ai/rex/compile-briefing    — cross-agent (auto-fetches maya/scout)
   /ai/rex/investor-update     — structured email
   /ai/rex/runway              — base/optimistic/pessimistic
   /ai/rex/unit-economics      — CAC, LTV, payback, benchmarks
   /ai/rex/scenario            — N what-if scenarios vs base
   /ai/rex/weekly-digest       — Monday CFO digest

 History contract (matches Sage): server passes history: [{role, content}] from the last REX_HISTORY_LIMIT messages of Message table where agent="REX" and
 organizationId=....

 ---
 Phase Plan

 Phases are ordered so each ships a working slice. Phase 1 makes everything in the Plus menu work; Phase 2 adds CSV ingestion; Phase 3 adds the addictive
 layer. All three phases ship in v1.

 Phase 1 — Make REX talk (server module + 5 new actions + cards)

 Goal: Plus-menu actions and chat both succeed. No new UI surfaces yet.

 1.1 New files in apps/server/src/modules/agents/rex/

 Create by mirroring apps/server/src/modules/agents/sage/:

 ┌───────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────┐
 │       File        │                                                What it does                                                 │    Mirror from     │
 ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
 │ rex.routes.ts     │ Express router — see route table below                                                                      │ sage.routes.ts     │
 ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
 │ rex.controller.ts │ Each handler: requireAuthContext() → parse(...Schema) → service.fn(...) → res.json(...)                     │ sage.controller.ts │
 ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
 │ rex.service.ts    │ For each action: createUserMessage (with customInput.actionId) → aiService.post("/ai/rex/<endpoint>",       │ sage.service.ts    │
 │                   │ payload) → createAssistantMessage (with customInput.result) → return data                                   │                    │
 ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
 │ rex.repository.ts │ createUserMessage, createAssistantMessage, findRecentMessages(orgId, REX_HISTORY_LIMIT),                    │ sage.repository.ts │
 │                   │ findAllRexMessages(orgId) — all filtered by agent: "REX"                                                    │                    │
 ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
 │ rex.schema.ts     │ Zod schemas matching the frontend's lib/schemas/agents/rex.ts + new schemas for runway, unit-economics,     │ sage.schema.ts     │
 │                   │ scenario, weekly-digest, investor-update                                                                    │                    │
 ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
 │ rex.types.ts      │ TS types inferred from Zod                                                                                  │ sage.types.ts      │
 └───────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────┘

 Server routes to expose (prefix /agents/rex, all behind authMiddleware):

 ┌────────┬────────────────────────┬────────────────────────────┬──────────────────────────┐
 │ Method │          Path          │  Maps to apps/ai endpoint  │     Frontend caller      │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /chat                  │ /ai/rex/chat               │ useSendMessage("rex", …) │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ GET    │ /chat?organizationId=… │ — (DB only)                │ useMessages("rex", …)    │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /analyze-metrics       │ /ai/rex/analyze-metrics    │ rex:analyze-metrics      │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /forecast              │ /ai/rex/forecast           │ rex:forecast             │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /financial-analysis    │ /ai/rex/financial-analysis │ rex:financial-analysis   │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /compile-briefing      │ /ai/rex/compile-briefing   │ rex:compile-briefing     │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /runway                │ /ai/rex/runway             │ new action               │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /unit-economics        │ /ai/rex/unit-economics     │ new action               │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /scenario              │ /ai/rex/scenario           │ new action               │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /weekly-digest         │ /ai/rex/weekly-digest      │ new action               │
 ├────────┼────────────────────────┼────────────────────────────┼──────────────────────────┤
 │ POST   │ /investor-update       │ /ai/rex/investor-update    │ new action               │
 └────────┴────────────────────────┴────────────────────────────┴──────────────────────────┘

 1.2 Wire route in apps/server/src/router.ts

 Add 2 lines, mirroring how Sage is wired (router.ts:5,26):

 import rexRouter from "./modules/agents/rex/rex.routes.js";
 // ...
 router.use("/agents/rex", authMiddleware, rexRouter);

 1.3 Constants

 Add REX_HISTORY_LIMIT = 10 to apps/server/src/config/constants.js (matches Sage's pattern).

 1.4 Frontend API client

 Create apps/main/src/lib/api/rex.ts mirroring apps/main/src/lib/api/sage.ts:

 - Typed wrappers for each endpoint: analyzeMetrics, forecast, financialAnalysis, compileBriefing, runway, unitEconomics, scenario, weeklyDigest,
 investorUpdate.
 - Each calls apiFetch("/agents/rex/<endpoint>", { method: "POST", body: ... }).

 The existing useSendMessage / useMessages in lib/api/assistants.ts are agent-agnostic (agentSlug param drives the URL) — they start working for REX the
 moment the server route exists.

 1.5 Add 5 new actions to apps/main/src/lib/agents/actions.ts

 REX currently has 4. Add the new endpoints exposed by apps/ai so users can trigger them from the Plus menu:

 { id: "rex:runway",          agent: "rex", endpoint: "runway",          label: "Runway scenarios",  icon: "Hourglass" },
 { id: "rex:unit-economics",  agent: "rex", endpoint: "unit-economics",  label: "Unit economics",    icon: "Coins" },
 { id: "rex:scenario",        agent: "rex", endpoint: "scenario",        label: "What-if scenarios", icon: "GitBranch" },
 { id: "rex:weekly-digest",   agent: "rex", endpoint: "weekly-digest",   label: "Weekly CFO digest", icon: "CalendarRange" },
 { id: "rex:investor-update", agent: "rex", endpoint: "investor-update", label: "Investor update",   icon: "Mail" },

 1.6 Add Zod schemas + Form components for the new actions

 - Extend apps/main/src/lib/schemas/agents/rex.ts with rexRunwaySchema, rexUnitEconomicsSchema, rexScenarioSchema, rexWeeklyDigestSchema,
 rexInvestorUpdateSchema.
 - Extend apps/main/src/components/agents/rex/forms.tsx with the matching RexRunwayForm, etc. — reuse DataPointTable for time-series inputs and
 Input/Textarea for scalar/string inputs. Each form gets a "Use saved dataset" picker that lists RexDataset rows for the org (drives the same field via the
  saved data).
 - Confirm apps/main/src/components/chat/RunActionDialog.tsx registers the new ids; if it uses a switch/map, append the new entries.

 1.7 Add result cards for the new actions

 Extend apps/main/src/components/agents/rex/cards.tsx:

 - RunwayCard — KPI tiles (months remaining, date of zero, verdict pill) + scenarios table (base / optimistic / pessimistic).
 - UnitEconomicsCard — CAC, LTV, payback months KPIs + benchmark context + recommendations list.
 - ScenarioCard — base case row + table of scenarios with runway_delta and arr_delta columns + recommendation. Phase 3 adds the live sliders on top of this
  card.
 - WeeklyDigestCard — headline + WoW changes table + alerts list (severity-colored) + green flags + 3 focus actions.
 - InvestorUpdateCard — copy-to-clipboard button for full_email_body, expandable sections.

 Wire these into apps/main/src/components/chat/ChatMessage.tsx (or wherever customInput.result is rendered) by extending the agent-aware switch.

 Verification for Phase 1

 - pnpm dev from repo root → all three apps boot.
 - Open /assistants/rex; send "What's my runway with $750K cash, $48K burn, $62K MRR, 8% growth?" — expect a chat reply that calls calculate_runway and
 shows numbers.
 - Click Plus → "Runway scenarios" → fill the form → submit → see RunwayCard rendered in the message stream.
 - Repeat for each of the 9 actions.
 - Refresh page → chat history persists (via GET /agents/rex/chat).
 - Open /assistants/sage, /assistants/maya, /assistants/lex, /assistants/scout, /assistants/vega and send one message each — no regressions.

 Phase 2 — Stop forcing users to type CSVs into a table

 Goal: REX accepts a real CSV/XLSX, infers the schema, persists a dataset, and any action's form can pick from those datasets.

 2.1 New Prisma model RexDataset

 Add to apps/server/prisma/schema.prisma:

 model RexDataset {
   id              String   @id @default(cuid())
   organizationId  String
   userId          String
   sourceId        String?  // FK to Source (R2 file) when uploaded; null for manual entry
   name            String   // user-editable, e.g. "Stripe MRR Apr 2026"
   metricKey       String   // "mrr" | "revenue" | "expenses" | "subscribers" | "marketing_spend" | "new_customers" | "churn_rate" | etc.
   unit            String?  // "USD", "count", "%"
   period          String   // "daily" | "weekly" | "monthly"
   points          Json     // [{ date: "YYYY-MM-DD", value: number }]
   meta            Json?    // { columnMapping, sourceFile, originalHeaders, ... }
   createdAt       DateTime @default(now())
   updatedAt       DateTime @updatedAt
   @@index([organizationId, metricKey])
 }

 Migration: pnpm --filter server prisma migrate dev --name add_rex_dataset.

 2.2 CSV/XLSX upload pipeline

 - Frontend reuses the existing presign flow (apps/main/src/lib/api/uploads.ts → R2). The R2 key is then passed to a new server endpoint POST
 /agents/rex/datasets/parse.
 - New apps/server/src/modules/agents/rex/rex.csv.ts:
   - Adds papaparse and xlsx (SheetJS) deps to apps/server/package.json.
   - parseUploaded({ r2Key, organizationId, userId }) → fetches from R2 → detects type by extension → parses to Array<Record<string, string>> → runs
 inferColumnMapping(rows).
   - inferColumnMapping heuristics: a column whose values parse as ISO/locale dates → date; column with numeric values whose header matches
 mrr|revenue|sales|amount|spend|cost|count|customers|churn → value with the matching metricKey.
   - Returns { candidate_mapping, sample_rows, headers } so the user can correct and confirm.
 - New POST /agents/rex/datasets (commit final mapping): persists one or more RexDataset rows (one per metric column).
 - After save, the service posts an assistant message: "I see 14 months of MRR data. Want me to forecast the next 90 days?" with quick-action buttons.

 2.3 New "Data" tab in the REX chat page

 In apps/main/src/app/(dashboard)/assistants/[id]/page.tsx add a chatTab state for agent.id === "rex" mirroring the existing Lex/Scout/Sage tab strips
 (already present in lines 487–587). New tabs: Chat | Data. The Data tab is a new component apps/main/src/components/agents/rex/data-tab.tsx:

 - "Drop a CSV or Excel file" zone (uses react-dropzone if not present, else native drag/drop).
 - After upload → modal shows the inferred column mapping → user confirms or adjusts → save.
 - List of saved datasets with name, metric key, point count, last updated, "Use in chat" button (which opens the relevant action prefilled).

 2.4 Wire saved datasets into the action forms

 Each form in forms.tsx that accepts a DataPoint[] field gets a small dropdown above the DataPointTable: "Use a saved dataset → ..." When picked, it
 populates the field; the user can still tweak.

 Verification for Phase 2

 - Upload a sample CSV with date,mrr,subscribers columns → see inferred mapping → confirm → see two RexDataset rows.
 - Open the Forecast action → "Use a saved dataset" → pick MRR → submit → ForecastCard renders with 30-day forecast.
 - Re-upload an XLSX with multiple sheets → only the first sheet is read in v1 (note this in the upload modal); rows persist correctly.

 Phase 3 — Make REX feel alive (KPI strip + Today panel + weekly digest email + live sliders)

 3.1 Live KPI strip in the chat header

 - New component apps/main/src/components/agents/rex/KpiStrip.tsx: shows MRR (with WoW arrow), Cash, Runway months, Health pill.
 - Renders right under ChatHeader only when agent.id === "rex" (parallel to the Lex tab strip).
 - Data source: a new lightweight GET /agents/rex/snapshot endpoint. Algorithm:
   a. Look at the latest weekly_digest result in Message.customInput (most recent Message where customInput.actionId === "rex:weekly-digest").
   b. If none, derive from latest RexDataset rows: pull last value of mrr, last value of cash, compute runway from latest mrr/burn if both present.
   c. If still nothing, return { ready: false } and the strip renders a "Connect data to see live numbers" CTA that opens the Data tab.
 - Click any KPI → opens a drill-down dialog (chart of that metric over the last 90 days from the corresponding RexDataset.points).

 3.2 Pinnable result cards + "Today" panel

 - New Prisma model:

 model RexPinnedCard {
   id              String   @id @default(cuid())
   organizationId  String
   userId          String
   kind            String   // "runway" | "weekly-digest" | "financial-analysis" | "forecast" | "unit-economics" | "scenario"
   payload         Json     // the result blob (snapshotted at pin time)
   position        Int      @default(0)
   createdAt       DateTime @default(now())
   @@index([organizationId, position])
 }

 Migration: add_rex_pinned_card.

 - Every action card in the chat gets a small pin icon (top-right of the card). Clicking persists the result.
 - New routes: GET /agents/rex/pins, POST /agents/rex/pins, DELETE /agents/rex/pins/:id.
 - New collapsible Today strip at the top of /assistants/rex (above the chat scroll area, below the KPI strip). Renders pinned cards using the same
 components from cards.tsx. Defaults to collapsed if nothing is pinned; auto-expanded on first pin.

 3.3 Weekly digest cron + email

 - Add node-cron to apps/server/package.json.
 - New file apps/server/src/modules/agents/rex/rex.cron.ts:
   - Schedule: every Monday 09:00 UTC (use node-cron cron expression 0 9 * * 1).
   - For each org with RexSettings.weeklyDigestEnabled = true:
       - Pull latest RexDataset rows for mrr, arr, burn, cash, churn_rate, growth_rate, new_customers, cac, ltv. Build the metrics payload.
     - Pull last week's snapshot for prev_week.
     - aiService.post("/ai/rex/weekly-digest", ...) → persist as a Message (with customInput.result).
     - Email the founder via mailer.ts (Resend) using a new React Email template packages/transactional/emails/RexWeeklyDigest.tsx.
 - Boot the cron from apps/server/src/server.ts (only if process.env.NODE_ENV === "production" to avoid duplicate runs in dev).
 - New Prisma model:

 model RexSettings {
   organizationId         String   @id
   weeklyDigestEnabled    Boolean  @default(true)
   weeklyDigestTimezone   String   @default("UTC")
   weeklyDigestRecipients String[]
   updatedAt              DateTime @updatedAt
 }

 Migration: add_rex_settings.

 - Settings UI: toggle in AgentInfoPanel (when agent is REX) — "Email me Monday digests at 9am [timezone]".
 - Manual trigger for testing: POST /agents/rex/weekly-digest already exists from Phase 1; the email send is also exposed as POST
 /internal/cron/rex-weekly-digest (internal-key gated) for safe local testing.

 3.4 Interactive what-if sliders in ScenarioCard

 - Replace the static scenarios table with three sliders (burn_delta, mrr_delta, growth_rate_override) plus a fourth "Add scenario" button.
 - Debounce slider input (350ms) → call POST /agents/rex/scenario with the modified scenarios payload → live update the table cells (runway months, ARR at
 12mo, breakeven month, verdict pill, deltas vs base).
 - "Save snapshot" button persists the current configuration as a pinned card (calls POST /agents/rex/pins with kind: "scenario").
 - Implementation note: the existing ScenarioCard already renders the result shape — only the input controls change. Use useDebouncedCallback from
 usehooks-ts (light dep; or hand-roll with a setTimeout ref).

 Verification for Phase 3

 - KPI strip shows real numbers after at least one weekly digest has run (or after a CSV upload of MRR + burn data). Clicking MRR opens the chart
 drill-down.
 - Pin a forecast card → reload → "Today" strip shows the pinned card. Unpin → it disappears.
 - Toggle weekly digest off in settings → cron skips that org. Toggle on → next Monday it fires (verify via the /internal/cron/... manual trigger and check
  the inbox).
 - Move the sliders in ScenarioCard → table updates within ~400ms with new runway/ARR values; the verdict pill changes color when crossing thresholds.

 ---
 Critical Files

 Files to CREATE

 apps/server/src/modules/agents/rex/
   ├── rex.routes.ts
   ├── rex.controller.ts
   ├── rex.service.ts
   ├── rex.repository.ts
   ├── rex.schema.ts
   ├── rex.types.ts
   ├── rex.csv.ts                                          (Phase 2)
   └── rex.cron.ts                                         (Phase 3)

 apps/main/src/lib/api/rex.ts
 apps/main/src/components/agents/rex/data-tab.tsx          (Phase 2)
 apps/main/src/components/agents/rex/KpiStrip.tsx          (Phase 3)
 apps/main/src/components/agents/rex/today-panel.tsx       (Phase 3)
 apps/main/src/components/agents/rex/scenario-sliders.tsx  (Phase 3 — drives ScenarioCard)
 packages/transactional/emails/RexWeeklyDigest.tsx          (Phase 3)

 Files to EDIT

 apps/server/src/router.ts                                 — register rexRouter
 apps/server/src/config/constants.ts                       — add REX_HISTORY_LIMIT
 apps/server/src/server.ts                                 — boot rex cron in production (Phase 3)
 apps/server/prisma/schema.prisma                          — add RexDataset (Phase 2), RexPinnedCard, RexSettings (Phase 3)
 apps/server/package.json                                  — add papaparse, xlsx (Phase 2), node-cron (Phase 3)

 apps/main/src/lib/agents/actions.ts                       — add 5 new REX actions
 apps/main/src/lib/schemas/agents/rex.ts                   — add 5 new schemas
 apps/main/src/components/agents/rex/forms.tsx             — add 5 new forms; add "Use saved dataset" picker (Phase 2)
 apps/main/src/components/agents/rex/cards.tsx             — add 5 new result cards; add pin icon to all cards (Phase 3); switch ScenarioCard to slider
 mode (Phase 3)
 apps/main/src/components/chat/RunActionDialog.tsx         — register new actions if it uses a switch
 apps/main/src/components/chat/ChatMessage.tsx             — render new REX cards by actionId
 apps/main/src/components/assistants/AgentInfoPanel.tsx    — add weekly-digest toggle for REX (Phase 3)
 apps/main/src/app/(dashboard)/assistants/[id]/page.tsx    — add Rex Chat|Data tab strip (Phase 2); render KpiStrip + Today panel (Phase 3)
 apps/main/package.json                                    — add usehooks-ts (Phase 3) if not already present

 Files to REUSE (do not modify)

 apps/ai/agents/rex/agent.py, routes.py, analytics.py, forecasting.py    — fully built
 apps/ai/agents/base.py, registry.py                                      — base infra
 apps/server/src/common/utils/aiService.ts                                — axios client (auto-injects X-Internal-Api-Key)
 apps/server/src/common/utils/r2.ts                                       — R2 file ops
 apps/server/src/common/utils/mailer.ts                                   — Resend wrapper
 apps/server/src/middlewares/auth.middleware.ts                           — session/org extraction
 apps/server/src/middlewares/internal.middleware.ts                       — internal key check
 apps/server/src/modules/uploads/                                         — presigned URL pipeline
 apps/main/src/lib/api/assistants.ts                                      — generic useMessages/useSendMessage (already supports any agentSlug)
 apps/main/src/lib/api/uploads.ts                                         — presign helpers
 apps/main/src/components/chat/PlusMenu.tsx, ChatInput.tsx, ChatMessage.tsx
 apps/main/src/components/chat/ActionForm/fields.tsx                      — DataPointTable, etc.

 ---
 Risks & Mitigations

 - Apps/main is "not the Next.js you know" (per apps/main/AGENTS.md) — read apps/main/node_modules/next/dist/docs/ before adding routes or layouts.
 - MOCK_MODE masking real failures — apps/ai REX returns canned responses when MOCK_MODE=true. Make sure local dev sets MOCK_MODE=false once Phase 1
 smoke-tests pass.
 - Prisma migration in shared dev DB — coordinate with anyone else on the team before applying the three new migrations (add_rex_dataset,
 add_rex_pinned_card, add_rex_settings).
 - Cron in dev — gate node-cron behind NODE_ENV === "production" to avoid duplicate runs when multiple devs run the server. Provide an
 /internal/cron/rex-weekly-digest endpoint for safe manual triggers.
 - CSV parsing edge cases — international date formats, currency symbols in numeric columns, empty rows. Mitigation: the user always reviews the inferred
 mapping before save; ship with a small set of golden CSV fixtures + a unit test in rex.csv.test.ts.

 ---
 Verification

 End-to-end smoke test after each phase (cumulative).

 After Phase 1:

 1. pnpm dev from repo root.
 2. Sign in, switch to a real org, navigate to /assistants/rex.
 3. Chat tool calls — send each of these and verify the right tool fires and a sane reply appears:
   - "What's my runway with $750K cash, $48K burn, $62K MRR, 8% growth?" → calculate_runway.
   - "What's our CAC if we spent $48K and got 141 customers?" → unit_economics.
   - "What if I hire 2 engineers?" → scenario_model.
   - "Give me this week's numbers." → weekly_digest.
 4. Plus-menu actions — open Plus → run each of the 9 actions with the example payload from the apps/ai pydantic models. Verify the corresponding card
 renders in the chat stream.
 5. History persistence — refresh; messages re-load via GET /agents/rex/chat.
 6. No regressions — open /assistants/sage, /assistants/maya, /assistants/lex, /assistants/scout, /assistants/vega and send one message each.
 7. Server logs — confirm aiService.post calls hit http://localhost:8000/ai/rex/* with X-Internal-Api-Key header.

 After Phase 2:

 - Upload a sample CSV with date,mrr,subscribers → see inferred mapping → confirm → see two RexDataset rows.
 - Open Forecast action → "Use saved dataset" → pick MRR → submit → ForecastCard renders.
 - Try an XLSX with messy headers (Date Sold, MRR (USD), # Subs) → inference still produces sensible mapping; user can correct in the modal.

 After Phase 3:

 - KPI strip shows MRR/Cash/Runway/Health at the top of /assistants/rex after at least one weekly digest or one CSV upload of MRR + burn data.
 - Click MRR in the strip → drill-down chart opens.
 - Pin a forecast card → reload → "Today" strip shows it. Unpin → disappears.
 - In AgentInfoPanel, toggle weekly digest → setting persists. Trigger POST /internal/cron/rex-weekly-digest → email arrives in the founder inbox using the
  RexWeeklyDigest template.
 - Move sliders in ScenarioCard → table updates within ~400ms; verdict pill recolors when thresholds cross. Click "Save snapshot" → new pinned card appears
  in Today.