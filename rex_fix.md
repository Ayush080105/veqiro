╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Plan: Align REX Backend to camelCase Convention (Option 2)

 Context

 All 5 non-REX agents (Sage, Maya, Scout, Lex, Vega) follow this field-name contract:
 - Frontend sends snake_case fields (e.g. topic_hint, max_emails)
 - Global camelizeBody middleware converts them to camelCase on the way in
 - Backend Zod schemas validate camelCase fields (e.g. topicHint, maxEmails)

 REX was built with a different convention — its backend schemas use snake_case — so
 camelizeBody was breaking it. A previous fix removed camelizeBody globally, which
 restored REX but broke the other 5 agents.

 Goal: Make REX consistent with every other agent. update the REX backend (schemas + service field accesses) to use camelCase, so all 6
 agents follow the same path.

 No frontend changes are needed. No FastAPI changes are needed. Input types are auto-inferred
 via z.infer so no manual type-file edits are needed.


 Change 1 — Rename snake_case fields in rex.schema.ts

 File: apps/server/src/modules/agents/rex/rex.schema.ts

 Rename only the action schema fields that have underscores. All other schemas in this file
 (settings, datasets, pins, alertRules) are already camelCase — leave them untouched.

 ┌──────────────────────────────────┬──────────────────────────────┬────────────────────────────┐
 │          Old field name          │        New field name        │           Schema           │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ metric_name                      │ metricName                   │ forecastSchema             │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ historical_data                  │ historicalData               │ forecastSchema             │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ horizon_days                     │ horizonDays                  │ forecastSchema             │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ revenue_data                     │ revenueData                  │ financialAnalysisSchema    │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ expenses_data                    │ expensesData                 │ financialAnalysisSchema    │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ subscribers_data                 │ subscribersData              │ financialAnalysisSchema    │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ all_metrics                      │ allMetrics                   │ compileBriefingSchema      │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ agent_summaries                  │ agentSummaries               │ compileBriefingSchema      │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ cash_on_hand                     │ cashOnHand                   │ runwaySchema               │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ monthly_burn                     │ monthlyBurn                  │ runwaySchema               │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ monthly_revenue                  │ monthlyRevenue               │ runwaySchema               │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ growth_rate_pct                  │ growthRatePct                │ runwaySchema               │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ marketing_spend                  │ marketingSpend               │ unitEconomicsSchema        │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ new_customers                    │ newCustomers                 │ unitEconomicsSchema        │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ avg_monthly_revenue_per_customer │ avgMonthlyRevenuePerCustomer │ unitEconomicsSchema        │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ avg_customer_lifetime_months     │ avgCustomerLifetimeMonths    │ unitEconomicsSchema        │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ base_metrics (nested obj)        │ baseMetrics                  │ scenarioSchema             │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ growth_rate (inside baseMetrics) │ growthRate                   │ scenarioSchema             │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ burn_delta                       │ burnDelta                    │ scenario change sub-schema │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ mrr_delta                        │ mrrDelta                     │ scenario change sub-schema │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ growth_rate_override             │ growthRateOverride           │ scenario change sub-schema │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ prev_week                        │ prevWeek                     │ weeklyDigestSchema         │
 ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
 │ api_key                          │ apiKey                       │ ingestSchema               │
 └──────────────────────────────────┴──────────────────────────────┴────────────────────────────┘

 analyzeMetricsSchema, investorUpdateSchema, varianceSchema, boardDeckSchema have no
 underscored fields — leave them alone.

 ---
 Change 2 — Update field access in rex.service.ts

 File: apps/server/src/modules/agents/rex/rex.service.ts

 Critical rule: The FastAPI call keys (e.g. metric_name:, historical_data:) must stay
 snake_case because FastAPI expects them. Only the right-hand side input.xxx access changes
 to camelCase.

 Pattern: metric_name: input.metric_name → metric_name: input.metricName

 Apply this to every service function that reads a renamed field. Specifically:

 forecast()
 // string interpolation
 content: `Forecast: ${input.metricName}`
 // FastAPI call
 metric_name: input.metricName,
 historical_data: input.historicalData,
 horizon_days: input.horizonDays,

 financialAnalysis()
 revenue_data: input.revenueData,
 expenses_data: input.expensesData,
 subscribers_data: input.subscribersData,

 compileBriefing()
 all_metrics: input.allMetrics,
 agent_summaries: input.agentSummaries,

 runway()
 // string interpolation
 content: `Runway analysis — $${input.cashOnHand.toLocaleString()} cash, $${input.monthlyBurn.toLocaleString()}/mo burn`
 // FastAPI call
 cash_on_hand: input.cashOnHand,
 monthly_burn: input.monthlyBurn,
 monthly_revenue: input.monthlyRevenue,
 growth_rate_pct: input.growthRatePct,

 unitEconomics()
 marketing_spend: input.marketingSpend,
 new_customers: input.newCustomers,
 avg_monthly_revenue_per_customer: input.avgMonthlyRevenuePerCustomer,
 avg_customer_lifetime_months: input.avgCustomerLifetimeMonths,

 scenario()
 // string interpolation stays the same (scenarios array, no renamed field)
 base_metrics: input.baseMetrics,
 scenarios: input.scenarios,  // nested burnDelta/mrrDelta/growthRateOverride are inside objects that TypeScript will now type correctly

 weeklyDigest()
 prev_week: input.prevWeek,

 ingestPoint() (the webhook ingest function)
 // wherever api_key is read from input, change to input.apiKey

 No changes needed to: analyzeMetrics, investorUpdate, variance, boardDeck,
 getSnapshot, listPins, createPin, getSettings, patchSettings, listDatasets,
 saveDatasets — their input fields have no underscores.

 ---
 Change 3 — Check rex.cron.ts

 File: apps/server/src/modules/agents/rex/rex.cron.ts

 This file calls service functions and builds input objects. If it passes prev_week: ... to
 weeklyDigest(), rename it to prevWeek: .... If any other renamed field is constructed
 here, update it. The string "new_customers" used as a metric key lookup string is not a
 schema field — leave it unchanged.

 ---
 The End-to-End Flow (Same for All 6 Agents After This Plan)

 Frontend form  →  snake_case body  →  camelizeBody middleware  →  camelCase body
 →  Zod schema validates camelCase  →  service reads input.camelCase
 →  service sends snake_case keys to FastAPI  →  FastAPI receives snake_case

 Example (Sage, already working — REX will match this after changes):
 Frontend: { seed_topic: "AI" }
 After middleware: { seedTopic: "AI" }
 Schema: seedTopic: z.string()   ✓
 Service: seed_topic: input.seedTopic  → FastAPI gets { seed_topic: "AI" }

 Example (REX forecast, after this plan):
 Frontend: { metric_name: "mrr", historical_data: [...] }
 After middleware: { metricName: "mrr", historicalData: [...] }
 Schema: metricName: z.string()   ✓  (updated by this plan)
 Service: metric_name: input.metricName  → FastAPI gets { metric_name: "mrr" }  (unchanged)

 Frontend: no changes.  FastAPI: no changes.  Other 5 agents: no changes.

 ---
 What Does NOT Change

 - rex.controller.ts — only calls schema.parse(req.body) and passes input to services; no direct field access
 - rex.repository.ts — generic DB operations, no action schema field access
 - rex.routes.ts — routing only
 - rex.types.ts — Input types are auto-inferred via z.infer<typeof schema>, so they update automatically when the schema changes. Response interfaces (e.g.
 RexRunwayResponse.cash_on_hand) are FastAPI response proxies — leave them in snake_case
 - FastAPI call keys (the left side of key: input.field) — stay snake_case
 - All non-REX agent code — untouched
 - Frontend code — untouched (all agents continue to send snake_case)

 ---
 Verification

 After implementing:

 1. TypeScript build passes — run pnpm build (or tsc --noEmit) in apps/server. If any
 input.snake_case accesses are missed, TypeScript will error because the inferred type now
 only has camelCase keys.
 2. Test the forecast endpoint — open the REX chat, click the plus icon, pick "Forecast a
 metric", fill in data, click Run. Should no longer return 400.
 3. Test all other REX plus-icon actions — runway, financial analysis, unit economics,
 scenario, weekly digest, compile briefing. Each should succeed.
 4. Test a non-REX agent — open Sage, run "Keyword research". Should still work (confirms
 camelizeBody is back and the Sage schemas still validate correctly).
 5. Test the REX webhook ingest — POST /api/v1/agents/rex/ingest with body
 {"api_key":"...","metric":"mrr","date":"2026-01-01","value":50000}. Should succeed (the
 middleware converts api_key → apiKey, which now matches the updated schema).