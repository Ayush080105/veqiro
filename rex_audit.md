 
     Vega + Rex + Workspace — End-to-End Test & Bug-Fix Pass (Pre-Production)

     Context

     Vega (smart inbox/calendar/briefing), Rex (financial CSV analytics), and Vega-related
     workspace features are built and about to ship. Before pushing to production, we need to
     verify each feature works end-to-end (frontend → backend → AI → DB), find every glitch /
     mismatch / bug, log them, and fix them. The user specifically reports that Rex CSV uploads
     sometimes don't perform the intended action. We also confirm VEGA_PLAN.md is fully done.

     Findings from audit (already done in planning):
     - VEGA_PLAN.md Tasks A–F are all wired up in code (parallelized AI, inbox cache, dynamic
     labels CRUD, draft-reply, label field + filter pills, background email job + 30-min cron).
     Only Task G (manual E2E testing) remains. So this is a verify-it-works + fix-runtime-bugs
     effort, not a build-missing-features effort.
     - Rex CSV path is the highest-risk area — ~20 candidate bug sources in rex.csv.ts /
     rex.service.ts (silent parse failures shown as success, encoding/delimiter assumptions,
     fragile column/date type detection, reused column-mapping applied to wrong columns, no token
     budget for large CSVs). Zero automated tests for Rex.
     - DB migration gap: VegaLabel + VegaInboxCache exist only as a loose, untracked
     prisma/migrations/add_vega_label_inbox_cache.sql ("run in Supabase SQL editor"). Tables
     probably exist in the shared dev DB but a fresh migrate deploy won't create them.

     Approach (confirmed with user): Hybrid. I run all 4 services locally, test backend/AI/DB
     via direct API calls + automated tests + log inspection, reproduce/fix bugs, and hand off a
     precise browser click-through checklist for the UI-only parts. A test user with Google
     (Gmail + Calendar) connected exists, so Vega live flows are testable via API.

     Scope (confirmed): Vega Inbox+Labels, Vega Calendar+Briefing, Rex — tested deeply.
     Maya/Scout/Sage/Lex — lighter smoke/contract test. Rex fixes = "wrong/missing-action" bugs
     only (leave debatable behaviors like dedup-by-sum policy as-is).

     ---
     Environment (verified during planning)

     - Stack: Next.js apps/main (:3001), Express TS apps/server (:5000), FastAPI apps/ai (:8000),
     Prisma → Supabase Postgres. Monorepo = pnpm + turbo.
     - .env files populated: OpenAI + Gemini keys, R2 storage, Google OAuth, INTERNAL_API_KEY=abcd,
     AI_SERVICE_URL=http://localhost:8000, Langfuse tracing.
     - Start: AI = uvicorn main:app (port 8000) from apps/ai (venv present); server = pnpm dev
     (tsx watch src/server.ts); main = pnpm dev (next on 3001). AI internal routes require
     header X-Internal-Key: abcd (apps/ai/main.py, core.auth.verify_internal_key).
     - Tests today: only apps/server/src/tests/unit/billing.test.ts (run via pnpm --filter server test).
     pytest available in AI venv but no project tests.

     ---
     Plan

     Phase 0 — Bring-up & static gates

     1. pnpm install if needed, then pnpm check-types and pnpm lint across the monorepo; capture
     every TS/lint error (existing tsc-out.txt suggests prior type issues — re-baseline).
     2. Verify DB schema: confirm vega_label + vega_inbox_cache tables actually exist in the dev DB
     (prisma migrate status / introspect). Fix the gap: create a proper timestamped migration
     from the loose add_vega_label_inbox_cache.sql so a clean deploy provisions them. Remove the
     loose file once folded in.
     3. Start AI (:8000), server (:5000), main (:3001). Hit /health + /ready on AI; confirm server
     boots and cron registers (look for the [vega-cron] schedule log). Record any startup errors.

     Phase 1 — Rex deep test + fixes (priority — the reported pain)

     Rex files: backend apps/server/src/modules/agents/rex/{rex.csv.ts, rex.service.ts, rex.controller.ts, rex.repository.ts, rex.schema.ts, rex.routes.ts};
      AI apps/ai/agents/rex/{agent.py, routes.py, analytics.py, forecasting.py}; frontend apps/main/src/components/agents/rex/* +
     lib/api/rex.ts + lib/api/uploads.ts.

     1. Build a CSV corpus (real-world variety): clean wide-format (Date,MRR,Churn…), long-format
     (metric,period,value), monthly labels ("Jan 2025","Q1 2025"), Excel serial dates, currency/%/K-M-B
     numbers, EU vs US decimals, ambiguous 05/06/2025 dates, mixed N/A/blank cells, tab-delimited
     file named .csv, non-UTF-8 (ISO-8859-1) file, multi-sheet .xlsx, empty file, malformed CSV,
     large file (~20k rows). Store under a scratch dir (gitignored).
     2. Reproduce by driving the real path: upload to R2 via presign (lib/api/uploads.ts flow) →
     POST /agents/rex/datasets/parse → inspect candidate_mapping/datasets/warnings → save →
     POST /agents/rex/analyze-metrics (and forecast). Log where output ≠ intended for each file.
     Where R2 upload is awkward to script, also exercise parseDataset/parseRows directly via a
     tiny harness so parsing is testable without R2.
     3. Fix the confirmed "wrong/missing-action" set in rex.csv.ts / rex.service.ts:
       - Parse errors / empty results that currently return as warnings + green success → surface as
     a real failure the UI can show (don't silently "succeed").
       - Delimiter detection by content (comma vs tab vs semicolon), not just file extension.
       - Encoding: detect/handle non-UTF-8 (at least latin-1 fallback) so headers aren't garbled.
       - Column/date type detection: scan the full column (not first 30 rows) and handle mixed
     N/A/blank cells so a valid date/number column isn't misclassified.
       - Date month/day ambiguity: make the default explicit/configurable instead of silent US assumption.
       - Saved column-mapping reuse (rex.service.ts): match by column identity/content, not just
     header name, so re-ordered columns don't get the wrong metricKey.
       - Token budget: sample/cap rows before sending metrics JSON to the LLM (chat +
     analyze-metrics in apps/ai/agents/rex/routes.py) so large CSVs don't overflow context.
       - Harden LLM-output JSON parsing in analyze-metrics (no mid-sentence truncation fallback).
     4. Add unit tests (apps/server/src/tests/unit/rex-csv.test.ts, run via existing node --test):
     cover parseDateCell, parseNumeric, parseRows (wide/long, delimiter, encoding, mixed cells,
     mapping reuse). These lock the fixes and give lasting coverage.

     Phase 2 — Vega live API testing (Google connected)

     Files: backend apps/server/src/modules/agents/vega/*; AI apps/ai/agents/vega/*; frontend
     apps/main/src/components/vega/*, lib/api/vega-*.ts, settings/workspace pages.

     Test each via API against the real connected account; log failures:
     - Inbox: load latency, cache hit on 2nd load (<10min), ?force=true bypass, four-category
     grouping, per-email label badge present, VIP star, filter pills filter correctly.
     - Labels: GET/POST/PATCH/DELETE /agents/vega/labels (default seeding, create, autoReply toggle,
     delete); confirm labels flow into AI custom_labels.
     - Draft Reply: POST /agents/vega/draft-reply returns a full draft; EmailActionPanel loading path.
     - Send Reply / Follow-up / Schedule Meeting / Bulk ignore+snooze: verify Gmail side effects and
     DB rows (VegaFollowUp), follow-up appears in tab, snooze applies Vega/Snoozed label.
     - Calendar: list events, create event, meeting prep, post-meeting follow-up, reschedule draft.
     - Briefing: morning/evening/weekly generation + VegaBriefingCache.
     - Background email job: invoke runEmailPipeline once directly (don't wait for 30-min cron);
     confirm Gmail labels applied + auto-draft created for autoReply labels + inbox cache updated.

     Phase 3 — Other agents smoke test (lighter)

     Maya / Scout / Sage / Lex: confirm AI routers mount (apps/ai/main.py), server routes respond, and
     one happy-path call each succeeds (content gen / leads / etc.). Log contract mismatches only; no deep
     fixing unless a clear break is found.

     Phase 4 — Cross-layer contract sweep

     Grep for frontend→backend→AI field/endpoint mismatches across in-scope modules (endpoint paths,
     request/response field names, Zod schema vs TS type vs Pydantic model). Fix mismatches found.

     Phase 5 — Consolidate, fix, re-verify

     - Maintain a running bug log (id, area, severity, repro, root cause, fix, status) in the
     conversation (write a BUG_LOG.md only if the user wants a file).
     - Fix all confirmed bugs (Rex focused-set + any Vega/contract breaks). Re-run the relevant
     API tests + unit tests after each fix.
     - Re-run pnpm check-types + pnpm lint + pnpm --filter server test clean at the end.

     ---
     Deliverables

     - Code fixes (Rex CSV focused-set + any Vega/contract bugs found) on branch vega-optimize.
     - New unit tests for Rex CSV parsing; existing tests still green.
     - Proper Prisma migration for VegaLabel + VegaInboxCache.
     - A browser click-through checklist (the UI-only verification the user runs), derived from
     VEGA_PLAN.md §10 plus Rex upload UX.
     - A summary of bugs found/fixed and anything that remains browser-only.

     Verification

     - pnpm check-types, pnpm lint, pnpm --filter server test all pass.
     - Rex: each CSV in the corpus parses to the intended mapping or fails loudly (no false success);
     analyze-metrics/forecast return coherent output for large files.
     - Vega: every API flow in Phase 2 returns expected data + correct Gmail/DB side effects.
     - AI /health + /ready OK; server boots with cron registered.
     - User completes the browser checklist with no blocking issues.

     Out of scope

     - Deep Maya/Scout/Sage/Lex bug-fixing (smoke only).
     - Debatable Rex behavior changes (dedup-by-sum, strict-validation toggles, multi-sheet merge UX,
     new DB uniqueness constraints) — explicitly deferred per user.
     - I cannot drive the browser or mint Google tokens; those steps are the user's checklist.

