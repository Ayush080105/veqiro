────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Veqiro — Onboarding, Brain, Brand Kit & R2 Uploads: End-to-End Fix Plan

 Context

 Veqiro is a Turborepo monorepo with three relevant apps:
 - apps/main (Next.js 16) — dashboard UI (onboarding flow + Brain editor)
 - apps/server (Express + Prisma + Postgres) — REST API; persists BrandKit keyed by organizationId
 - apps/ai (FastAPI/Python) — agent backend; loads brand kit per request to inject into LLM system prompts

 Six AI agents (Maya, Rex, Scout, Sage, Lex, Vega) read the brand kit on every request to calibrate voice, audience, and competitive positioning. The
 quality of every generated output therefore depends on having a strong, populated brand kit.

 The user reports five symptoms:
 1. Onboarding flow is shallow — short text inputs, no minimums; agents end up with weak grounding.
 2. Logo & mascot are URL-paste inputs; should be file uploads to R2.
 3. Onboarding → DB persistence appears flaky.
 4. Brain page misses fields onboarding collects (logo/mascot); brain ↔ onboarding ↔ brand kit are not coherently wired.
 5. apps/ai "many times" cannot load the brand kit and falls back to generic defaults.

 During exploration I uncovered two critical hidden bugs that explain symptoms 3, 4, and 5 in one shot:

 🔴 Bug A — camelizeBody middleware silently zeroes out brand-kit saves

 apps/server/src/app.ts:52 runs camelizeBody on every JSON request body. It converts company_name → companyName, logo_url → logoUrl, etc. But
 apps/server/src/modules/brand-kit/brand-kit.schema.ts validates against the snake_case keys. Result:
 - Zod parse succeeds because every field is .optional()
 - All scalar fields land as undefined
 - Prisma upsert.update with all-undefined treats them as "don't change" → on a fresh row they default to empty strings, on an existing row nothing updates
 - The endpoint returns 200, the client thinks it saved, but the DB row is mostly blank
 - Organization.onboarded = true is the only thing that actually persists

 This is why onboarding "feels saved" but the Brain page is empty and apps/ai reads defaults even when the call succeeds.

 🔴 Bug B — apps/ai queries brand kit by user ID, not organization ID

 apps/server/src/modules/agents/maya/maya.service.ts:75-76 correctly forwards both user_id: userId AND organization_id: organizationId to apps/ai. But
 every request model in apps/ai (ChatRequest, IdeationRequest, DraftRequest, etc.) only declares user_id. The handlers then call:

 # apps/ai/core/brand_kit.py:68
 url = f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/brand-kit/{user_id}"

 …but the server endpoint is GET /api/v1/internal/brand-kit/:organizationId and prisma.brandKit.findUnique({ where: { organizationId } }) returns null when
  the path param is a user ID. The fetch 404s, the try/except swallows it, and a hard-coded BrandKit() default is used. The LLM gets "My Company" /
 "Professional and friendly" instead of the real brand voice.

 Compounding this: apps/ai/.env ships with BRAND_KIT_SERVICE_URL=http://your-express-host:port (a placeholder), so even before the ID mismatch bites, the
 URL itself is invalid. And apps/server/src/modules/agents/maya/maya.service.ts lines 130, 166, 204, 242, 272, 309 only forward user_id (not
 organization_id) — those endpoints could never recover even after the apps/ai fix.

 Goal

 Ship a working onboarding → brand kit → brain → agents pipeline:
 1. Multi-step onboarding with enforced depth (min-character validation on description, audience, differentiators) plus live character counters and
 required-field gating.
 2. File upload to R2 for logo and mascot (replacing URL inputs) on both onboarding and Brain.
 3. Fix the camelize bug so saves persist.
 4. Fix the apps/ai org-id bug so agents see the real brand kit on every request.
 5. Make Brain a complete editor of the same brand kit that onboarding seeds — including logo/mascot, with auto-save and error-surfacing.

 ---
 Critical files to modify

 apps/server (backend)

 - apps/server/src/app.ts — fix or scope the camelizeBody middleware
 - apps/server/src/modules/brand-kit/brand-kit.schema.ts — tighten validation, add minimums
 - apps/server/src/modules/brand-kit/brand-kit.controller.ts — add asset-upload handler
 - apps/server/src/modules/brand-kit/brand-kit.service.ts — add upload service + key tracking
 - apps/server/src/modules/brand-kit/brand-kit.routes.ts — add POST /upload-asset route
 - apps/server/src/modules/brand-kit/brand-kit.repository.ts — extend writes for new fields
 - apps/server/src/modules/agents/maya/maya.service.ts — add organization_id to every AI call
 - apps/server/src/modules/agents/lex/lex.service.ts — add organization_id to AI calls
 - apps/server/src/modules/agents/vega/vega.service.ts — add organization_id to AI calls
 - apps/server/src/common/utils/r2.ts — add uploadFromBuffer helper (and optional deleteObject)
 - apps/server/prisma/schema.prisma — add logo_key and mascot_key columns for R2 lifecycle (lets us delete old objects on re-upload)
 - apps/server/.env — populate real R2_* credentials

 apps/ai (Python)

 - apps/ai/core/brand_kit.py — rename user_id → organization_id; better error logging
 - apps/ai/core/models.py — add organization_id to ChatRequest
 - apps/ai/agents/base.py — accept and pass organization_id through prompt building & tool execution
 - apps/ai/agents/maya/routes.py — add organization_id: str to IdeationRequest, DraftRequest, ReviseRequest, RegenerateImageRequest,
 RegenerateContentRequest, PublishRequest, GenerateVariantsRequest
 - apps/ai/agents/maya/agent.py — use organization_id everywhere brand kit is loaded (lines 43, 153, 180, 305, 341)
 - apps/ai/agents/sage/agent.py — same (lines 28, 234)
 - apps/ai/agents/scout/agent.py — same (line 47)
 - apps/ai/agents/lex/routes.py & agent.py, apps/ai/agents/vega/routes.py & agent.py, apps/ai/agents/rex/routes.py & agent.py — same
 - apps/ai/core/image_gen.py — same (line 135)
 - apps/ai/.env — replace BRAND_KIT_SERVICE_URL=http://your-express-host:port with real value (e.g. http://localhost:5000)

 apps/main (Next.js)

 - apps/main/src/app/(onboarding)/onboarding/page.tsx — convert step-by-step to react-hook-form + zod, add min-length rules, character counters, file
 uploads for logo/mascot
 - apps/main/src/components/brain/BrandKitSection.tsx — add a new "Assets" tab with logo/mascot file uploaders
 - apps/main/src/lib/api/brain.ts — switch save body to camelCase (matches new schema), add uploadAsset helper, surface real error messages
 - apps/main/src/lib/types/index.ts — extend BrandKit (add optional logo_key, mascot_key if exposed)
 - apps/main/src/components/brain/BrainCompletionBar.tsx — re-weight scoring now that all fields land
 - New: apps/main/src/components/forms/AssetUpload.tsx — reusable file picker with preview, upload progress, drag-drop, image-only validation
 - New: apps/main/src/components/forms/CharCount.tsx — live char counter with min/max indicator
 - New: apps/main/src/lib/validation/brandKit.ts — single zod schema shared between onboarding and brain (the source of truth for min lengths)

 ---
 Existing utilities to reuse

 Avoid rewriting what exists:
 - R2 upload — apps/server/src/common/utils/r2.ts: uploadImageBase64, isR2Configured. Already wired with AWS SDK v3 + S3Client. Extend with
 uploadBufferToR2(buffer, contentType, key) rather than building a new client.
 - base64 file conversion (frontend) — apps/main/src/components/chat/ActionForm/fields.tsx:277 (fileToBase64). Reuse for upload payload (Lex already does
 this for PDFs).
 - Auth context — apps/server/src/middlewares/auth.middleware.ts. Already populates req.userId and req.organizationId from session. Use it for the upload
 route.
 - Brand kit save flow — brandKitService.saveBrandKit() already does the upsert + onboarded flag in a transaction. Don't duplicate.
 - better-auth org context — authClient.useActiveOrganization() (used in onboarding line 694 and brain page line 106). Don't re-implement org lookup.
 - Veqiro shared form primitives — apps/main/src/components/veqiro/shared.tsx (VqInput, VqTextarea, FieldLabel, Button, Sticker). Keep visual language
 consistent.

 ---
 Implementation steps (ordered by dependency)

 Phase 1 — Fix the persistence layer (CRITICAL — unblocks everything else)

 1.1 Stop camelize from breaking brand-kit saves. The cleanest fix: keep camelize globally (other routes depend on it for nothing today, but it's a known
 convention) but rewrite the brand-kit zod schema to camelCase, since that's what hits validation. Map camelCase → snake_case once in the service layer
 when writing to Prisma. This puts the boundary at the storage edge, not the HTTP edge.

 - Rewrite brand-kit.schema.ts with camelCase keys: companyName, companyDescription, industry, targetAudience, brandVoice, logoUrl, mascotUrl, brandColors,
  platformTones, competitors, keyDifferentiators, websiteUrl. Add minimums (see 1.2).
 - In brand-kit.service.ts, accept the camelCase input, build the snake_case Prisma.BrandKitUncheckedUpdateInput explicitly (don't ...spread).
 - Update the GET response shape: keep the DB-native snake_case in the response (so apps/ai keeps working with current keys) OR also return camelCase. I
 recommend camelCase end-to-end on the client API and snake_case only in DB + apps/ai contract, with the server translating both ways. Reasoning:
 Next.js/React idioms prefer camelCase, the apps/ai contract is established.
 - Update apps/main/src/lib/api/brain.ts to send camelCase and parse camelCase, and update apps/main/src/lib/types/index.ts BrandKit type to camelCase.
 - Touch every consumer in apps/main (BrandKitSection, BrainCompletionBar, AgentReadiness, onboarding page) to use the new camelCase shape.

 1.2 Add real validation minimums to the brand-kit schema (single source of truth, server-side enforced):
 - companyName: min 2, max 200
 - companyDescription: min 120 chars, max 2000 (≈ 20–25 words; enough for the agents to ground in what + for whom)
 - industry: min 2, max 200
 - targetAudience: min 100 chars, max 1000
 - brandVoice: min 1, max 200
 - keyDifferentiators: min 80 chars, max 2000
 - competitors: optional but if present, each item min 2 chars; max 50 items
 - websiteUrl: optional, but if present must be valid URL (z.string().url())
 - logoUrl/mascotUrl: optional URL or null
 - Color hex validation: z.string().regex(/^#[0-9A-Fa-f]{6}$/) for primary/secondary/accent (when provided)

   Rationale on minimums: not arbitrary character counts — these match what produces non-generic LLM output. A 30-char company description gives Maya
 nothing to work with; ~120 chars forces 1–2 substantive sentences. Same logic for audience and differentiators. We allow these to be soft on intermediate
 Brain saves (auto-save) but hard at the moment we set Organization.onboarded = true (the onboarding "Finish" action).

 1.3 Two-tier validation to make auto-save not punish in-progress edits:
 - Add a second schema finalizeBrandKitSchema (the strict one with mins) and a permissive partialBrandKitSchema (everything optional, no mins).
 - PATCH /brand-kit uses the permissive schema (auto-save can write half-done fields).
 - New POST /brand-kit/finalize uses the strict schema, only succeeds if minimums pass, and is what flips Organization.onboarded = true. Move that
 side-effect out of upsertBrandKitAndMarkOnboarded and into finalize.

 1.4 Database: add logo_key and mascot_key String? columns to BrandKit (Prisma migration). These are the R2 object keys, used for deletion on re-upload.
 The public URL stays in logo_url/mascot_url. Add a migration: prisma/migrations/<ts>_add_brandkit_asset_keys/migration.sql.

 Phase 2 — Fix apps/ai → server brand-kit fetch

 2.1 In apps/ai/core/models.py, add organization_id: str to ChatRequest (required, min 1).

 2.2 In apps/ai/core/brand_kit.py:
 - Rename signature to async def load_brand_kit(organization_id: str).
 - Cache by organization_id.
 - Improve logs: when fetch fails, log full URL and status code (already done) — also distinguish 404 ("kit doesn't exist yet, expected for new orgs") vs
 401 ("internal key wrong, alert") vs 5xx ("server problem"). Don't downgrade 401 to a warning.
 - On 404, still return defaults (legitimate when org just signed up before finishing onboarding) but mark the returned BrandKit with a _loaded: bool field
  so callers can detect missing kits if they want.

 2.3 In every apps/ai request model in agents/maya/routes.py, agents/sage/routes.py, agents/scout/routes.py, agents/lex/routes.py, agents/rex/routes.py,
 agents/vega/routes.py: add organization_id: str = Field(..., min_length=1, max_length=128) next to the existing user_id.

 2.4 In apps/ai/agents/base.py: thread organization_id through build_system_prompt, chat_stream, chat_sync, _execute_cross_agent_call, execute_tool,
 ingest_to_rag. Pass organization_id to load_brand_kit. Note: user_id is still needed for RAG isolation per-user; do not drop it.

 2.5 Update every load_brand_kit(...) call site (see grep results above) to pass organization_id instead of user_id. Same for image_gen.

 2.6 In apps/server/src/modules/agents/maya/maya.service.ts (and lex.service.ts, vega.service.ts), add organization_id: organizationId next to every
 existing user_id: userId in calls to aiService.post. (Sage and Scout already do this; verify and don't double-add.)

 2.7 Replace the placeholder in apps/ai/.env: BRAND_KIT_SERVICE_URL=http://localhost:5000 (matches apps/server/.env PORT).

 Phase 3 — File uploads to R2 for logo/mascot

 3.1 Backend upload endpoint. Add POST /api/v1/brand-kit/upload-asset (brand-kit.routes.ts, behind authMiddleware). Body: multipart-form OR base64 JSON
 (pick one — base64 matches Lex's existing pattern and avoids adding multer; downside is 33% size overhead, fine for logos which are <1MB). I recommend
 base64 JSON for consistency.
 - Schema: { kind: 'logo' | 'mascot', filename: string, contentType: string, base64: string }.
 - Validate contentType in allowlist: image/png, image/jpeg, image/webp, image/svg+xml. Reject GIFs to avoid huge animated assets.
 - Validate decoded buffer size ≤ 5 MB.
 - Use uploadImageBase64({ organizationId, base64, contentType, prefix: 'brand/logo' | 'brand/mascot' }) — extend the prefix support if needed (already
 accepts arbitrary prefix).
 - On success: write the new logoUrl+logoKey (or mascot equivalents) to the BrandKit row in a service call. If a previous key exists, delete the old R2
 object (add deleteObject(key) to r2.ts).
 - Return { url, key }.

 3.2 Frontend reusable component apps/main/src/components/forms/AssetUpload.tsx:
 - Drag-drop area + click-to-pick fallback
 - Image preview (with current value if already saved)
 - Type/size validation client-side (mirror server allowlist) with clear error messages
 - Calls uploadAsset(orgId, kind, file) from lib/api/brain.ts
 - Shows progress / "uploading…" state
 - "Remove" button that PATCHes logoUrl: null / mascotUrl: null and triggers the server-side R2 delete

 3.3 Wire into onboarding (Step 4): replace the two VqInput URL inputs with two AssetUpload components. Onboarding can't do this until the org exists, so
 the upload only enables after Step 0 (workspace creation) — disable + tooltip if organizationId is empty.

 3.4 Wire into Brain: add a new "Assets" tab in BrandKitSection.tsx (sixth tab, between "Visual" and "Competitive") with the same two AssetUpload
 components.

 Phase 4 — Make onboarding actually deep

 4.1 Migrate the onboarding page from ad-hoc state to react-hook-form + zod (matches Brain page's pattern). Use the new lib/validation/brandKit.ts strict
 schema.

 4.2 Step-by-step changes:
 - Step 1 (Company Basics):
   - Description textarea: add live character counter (e.g. 47 / 120 minimum); below-min state shows "A bit more — agents need ~1–2 sentences to get this
 right." Disable Continue until min met.
   - Website URL: add format validation (allow empty, but if filled must be valid URL).
 - Step 2 (Industry & Audience):
   - Make industry chip required (already is via canAdvance).
   - Target audience textarea: char counter + 100-char min. Help text: "Be specific — job titles, company size, motivations."
 - Step 3 (Voice): required (already is).
 - Step 4 (Visual): replace logo & mascot URL inputs with AssetUpload components (per 3.3). Colours stay as-is.
 - Step 5 (Competitive):
   - Competitors: keep comma-separated input but show parsed-chip preview + count; encourage 3+ but don't require.
   - Key differentiators: char counter + 80-char min. Help text: "Why you, not them. Bullet-style works."
 - Step 6 (Summary): render the actual values that will be saved (currently it does, just verify it reads from the new form state). Add a "Looks good" /
 "Edit" affordance per row that jumps back to that step.

 4.3 "Finish" button:
 - Calls the new POST /brand-kit/finalize (strict schema). If the server rejects (e.g. user bypassed via dev tools), surface the per-field error and bounce
  them to the offending step.
 - On success, router.push('/dashboard').
 - Stop using localStorage drafts as the safety net. Drafts can stay (they're nice if the user closes the tab) but the success path must hit the server.
 Remove the "backend offline → save locally only" fallback for the finalize call — fail loud.

 4.4 Skip-the-onboarding edge case: existing logic (line 730–741) bounces returning users to /dashboard. Verify that still works after the schema change.

 Phase 5 — Brain page completeness & coherence

 5.1 Add the Assets tab (per 3.4).

 5.2 Brain page already auto-saves via PATCH (permissive schema in 1.3). Auto-save should not require minimums, but the page should display per-field
 validation hints (yellow border + "Agents will be more effective with X+ chars") for fields below their finalize-time minimum. This guides the user
 without blocking.

 5.3 Reset the "// Brand Kit storage isn't connected yet" yellow banner condition. After Phase 1, that banner only appears on real errors (5xx, network).
 Remove the "isEmpty + localStorage fallback" code path on the rationale that the bug is fixed and that path was hiding the persistence failure. Keep the
 in-page error toast for genuine failures.

 5.4 BrainCompletionBar re-weight: now that logo/mascot are first-class, count them. Suggested weights:
 - companyName: 10, companyDescription (≥120 chars): 15, targetAudience (≥100 chars): 15, brandVoice: 10, keyDifferentiators (≥80 chars): 15, competitors
 ≥1: 5, competitors ≥3: +5, brandColors all set: 10, platformTones any non-empty: 5, logoUrl: 5, mascotUrl: 5. Total = 100.

 5.5 AgentReadiness cross-check: Maya should "ready up" only when logoUrl exists (image generation uses it). Update its rules.

 Phase 6 — Verify & ship

 6.1 Manual end-to-end test plan (do this in browser, not just unit tests):
 1. New user signs up → lands on onboarding.
 2. Step 0: create workspace; verify org row in DB with onboarded=false.
 3. Step 1: try Continue with 30-char description — must be blocked, counter visible, hint shown. Fill ≥120 chars — passes.
 4. Step 2: blank target_audience — blocked. Fill ≥100 chars — passes.
 5. Step 4: upload a PNG logo (≤5MB) → preview appears, R2 dashboard shows the object under {orgId}/brand/logo/.... Upload an oversized file → blocked
 client-side. Upload a GIF → blocked.
 6. Step 5: add 3 competitors, 80+ char differentiators.
 7. Step 6: hit "Meet the crew" → DB shows BrandKit row with all fields, Organization.onboarded=true. Network tab: PATCH/finalize returned 200 with the
 populated row.
 8. Brain page: data loads identically to what was saved. Edit description, blur — auto-save fires, GET re-fetches the new value (verifies camelCase
 round-trip).
 9. Open Maya chat → send "What's our brand voice?" → Maya answers in the configured voice with company name. This is the regression test for Bug B. Tail
 apps/ai logs: should see brand_kit loaded | org=... company=... (not "fetch failed").
 10. Trigger Maya draft-content → generated post mentions the actual website_url and uses the actual platform tone for LinkedIn.
 11. Re-upload logo → R2 shows new object, old object is gone (delete worked).

 6.2 Server-side curl checks:
 # GET as internal (apps/ai contract)
 curl -H "x-internal-key: abcd" http://localhost:5000/api/v1/internal/brand-kit/<ORG_ID>
 # → 200 with full populated kit (snake_case)

 # PATCH as user (browser contract)
 curl -X PATCH -H "Content-Type: application/json" --cookie "<better-auth-cookie>" \
   -d '{"companyDescription":"…120+ chars…"}' \
   http://localhost:5000/api/v1/brand-kit
 # → 200 with the full row, companyDescription persisted

 6.3 Regression checks:
 - Maya/Sage/Scout chat endpoints still work (they pass both IDs now).
 - Lex PDF upload still works (uses fileToBase64, untouched).
 - Better-auth session flows untouched.

 6.4 Re-run linters/type-checks in each app:
 - pnpm -F @repo/main typecheck (or whatever the script is per apps/main/package.json)
 - pnpm -F @repo/server typecheck
 - cd apps/ai && python -m mypy . (if mypy is set up — otherwise just run the app and watch for runtime errors)

 ---
 Out of scope (deliberately deferred)

 - Adding shared @repo/types package between Python & TS (good idea long-term, not blocking).
 - Presigned-URL upload pattern (not needed at expected logo sizes).
 - Multi-tenant / org-switching UX changes.
 - Deleting old/orphaned R2 objects via a cron sweep (the per-upload delete is enough for now).
 - Refactoring the snake_case ↔ camelCase boundary across non-brand-kit endpoints (do that case-by-case as we touch them).

 ---
 Risks & call-outs

 - Migration safety: the camelCase schema rewrite is a breaking API change for the brain page and onboarding. We must ship 1.x of apps/server and the
 matching apps/main together. There is no third-party consumer of these endpoints, so no external coordination needed.
 - AI agent prompts: the apps/ai change is also a breaking contract — apps/server must ship the organization_id payload at the same time as apps/ai adds
 the field. Coordinate the deploy.
 - R2 credentials are blank in apps/server/.env. Uploads will fail until those are populated. Add a clear runtime error message when R2 is unconfigured
 (already exists in r2.ts:11–14); surface it as a toast on the upload component instead of a silent failure.
 - apps/ai/.env placeholder URL is a smoking gun — even after the org-id fix, brand kit fetch will fail until BRAND_KIT_SERVICE_URL is real.
╌╌╌