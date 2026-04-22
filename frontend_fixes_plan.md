 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Launch-readiness plan — frontend handoff to testing team

 Context

 Veqiro is a multi-agent AI workspace. Three apps are relevant:

 - apps/landing — Next.js 16 marketing site (no backend).
 - apps/main — Next.js 16 / React 19 user app (auth, onboarding, chat, brain, settings, integrations).
 - apps/server — Express + Prisma + better-auth (auth, orgs, message store, integrations OAuth, Maya publishing).
 - apps/ai — FastAPI Python service that actually runs the 6 agents (maya, rex, scout, sage, lex, vega).

 Scope constraint (user direction): only apps/main and apps/landing may be edited. apps/server and apps/ai stay as-is. The frontend must match the current
 backend contract and degrade gracefully when an endpoint isn't live yet.

 Why this work matters: the testing team is about to sign off for launch. Today several journeys are broken or blocked by missing UI, even though the
 backend exists:

 1. Every protected API request requires session.activeOrganizationId (apps/server/src/middlewares/auth.middleware.ts:52-54). A freshly signed-up user has
 NO org, so every call returns 400 — the app is effectively unusable. Frontend has no org-creation UI.
 2. There is no onboarding-completion guard. A user can reach /dashboard with an empty brand kit and chats run without brand context.
 3. Landing "The Crew" cards update a panel below, but the page never scrolls — users don't see the panel change.
 4. /brain already wires 404 fallbacks, but the empty state after a skipped backend is confusing and there is no "seeded from onboarding" indicator.
 5. 30 agent actions exist in code (apps/main/src/lib/agents/actions.ts); each needs a card renderer (ActionResultRenderer.tsx), and any gap produces raw
 JSON — not acceptable for launch.
 6. Maya can publish, but the UI picker for connected social accounts + reconnect-on-expiry flow is not verified.
 7. Vega's Google Calendar banner is always shown (never checks whether Google is connected).

 Out of scope (user): /dashboard home, workspace pages (Briefing/Content/Leads), the MARK/REX enum drift between DB (MARK) and frontend/AI (REX). These
 come later.

 Implementation caveat: apps/main/AGENTS.md and apps/landing/AGENTS.md both warn "This is NOT the Next.js you know." The repo runs Next 16.2.1 with React
 19.2.4. Before coding, read the relevant guide in apps/main/node_modules/next/dist/docs/ — routing, metadata, useRouter, streaming APIs may differ from
 older versions.

 ---
 The 9 work items

 1. Organization creation as Step 0 of onboarding  — BLOCKER

 Problem: apps/server/src/middlewares/auth.middleware.ts:52-54 throws BadRequestError("No active organization selected") whenever
 session.session.activeOrganizationId is missing. Today's onboarding (apps/main/src/app/(onboarding)/onboarding/page.tsx:618-619) reads
 useActiveOrganization() but never creates one, so finish() at line 674-701 hits No workspace found. Create one first. and the user is stuck.

 Fix in apps/main/src/app/(onboarding)/onboarding/page.tsx:

 - Prepend a Step0 — Name your workspace: fields name (required, min 2), slug (auto-derived from name, editable, kebab-case).
 - On "Continue" from Step 0, call authClient.organization.create({ name, slug }) then authClient.organization.setActive({ organizationId: result.id }).
 Both are exposed by the organizationClient() plugin configured in apps/main/src/lib/auth-client.ts:7.
 - Update TOTAL = 7 (was 6), shift existing step indices by +1 in canAdvance, the step array, and the "AI employees ready" summary line at 603.
 - If on mount activeOrg?.id is already set, auto-skip Step 0 (setStep(1)).
 - If the create call fails with "slug taken", surface inline error and let the user edit the slug.

 No new backend route needed — better-auth's organization plugin (apps/server/src/lib/auth.ts:54) already serves the create/setActive endpoints under
 /api/v1/auth/organization/*.

 Add a thin wrapper so the rest of the app doesn't import authClient.organization.* directly:

 - New file apps/main/src/lib/api/organizations.ts exporting createOrganization(input) and setActiveOrganization(id) that call
 authClient.organization.create / setActive and normalize errors.

 2. Onboarding-completion guard

 Problem: apps/main/src/components/layout/SessionGuard.tsx only checks auth. An authenticated user with no org and no brand kit can navigate straight to
 /assistants/maya and hit 400 errors.

 Fix:

 - New component apps/main/src/components/layout/OnboardingGuard.tsx. Runs inside SessionGuard (nested). Logic:
   - const { data: activeOrg } = authClient.useActiveOrganization()
   - If no activeOrg → router.replace('/onboarding')
   - If activeOrg, call getBrandKit(activeOrg.id):
       - If returns null (404) → check localStorage veqiro.brandKitLocal.{orgId}; if missing or company_name empty → redirect to /onboarding
     - If returns kit with empty company_name → redirect to /onboarding
     - Else render children
   - Show the same loader as SessionGuard during check.
 - Wrap dashboard children in apps/main/src/app/(dashboard)/layout.tsx:12:
 <SessionGuard><OnboardingGuard>…</OnboardingGuard></SessionGuard>
 - Loosen only for /onboarding itself (which isn't under the dashboard layout, so this is automatic).

 3. Login / signup redirect targets

 - apps/main/src/components/forms/auth/loginForm.tsx:33 — change callbackURL: '/dashboard' to callbackURL: '/onboarding'. Onboarding self-skips for
 already-onboarded users once #2 is in place (via the same guard logic, used as a redirect-away-if-complete check at the top of the onboarding page).
 - apps/main/src/components/forms/auth/registerForm.tsx:28 already points to /onboarding — leave it.
 - apps/main/src/app/(auth)/verify/page.tsx:74 already points to /onboarding — leave it.
 - In apps/main/src/app/(onboarding)/onboarding/page.tsx, add a "redirect-away-if-already-onboarded" effect: if activeOrg exists AND
 getBrandKit(orgId).company_name non-empty → router.replace('/dashboard').

 4. Landing "The Crew" smooth scroll

 Problem: apps/landing/src/app/page.tsx:16-17 already renders <DeskPanel active={active} /> permanently. When a user clicks a CrewCard, the panel updates
 but the viewport doesn't move — users see nothing happen.

 Fix in apps/landing/src/components/veqiro/crew.tsx:

 - Add const sectionRef = useRef<HTMLElement>(null) in DeskPanel.
 - Attach to the <section> root at line 97.
 - In the existing useEffect at line 85 (runs when active changes), add: on every run after the first, call sectionRef.current?.scrollIntoView({ behavior:
 'smooth', block: 'start' }). Gate with a firstRunRef = useRef(true) so the initial mount doesn't scroll (page would jump mid-load).
 - Respect prefers-reduced-motion: if window.matchMedia('(prefers-reduced-motion: reduce)').matches, use block: 'start' with behavior: 'auto'.

 No ref or ID change needed elsewhere — scrolling the <section> itself is what the user wants.

 5. /brain page — pre-fill, edit, empty-state polish

 Current state: apps/main/src/app/(dashboard)/brain/page.tsx already calls getBrandKit(), falls back to localStorage[veqiro.brandKitLocal.{orgId}],
 debounces auto-save at 800ms, and shows a yellow "backend offline" notice. This is mostly fine. Polish only:

 - In onboarding's finish() (onboarding/page.tsx:689-694), also write the saved kit to localStorage[veqiro.brandKitLocal.{orgId}] on success, not just the
 draft key. That way /brain has data even when the backend eventually serves 404.
 - Add a small "Seeded from onboarding" hint above the form the first time it renders populated data (read via a one-time localStorage flag
 veqiro.brain.seeded.{orgId}; clear after first edit).
 - Add "Last saved: HH:MM" next to the auto-save pill (already shows "changes auto-saved" but no timestamp).
 - Rename the "Auto-fill from URL" affordance's error toast from generic to specific: distinguish 404 (scraper not deployed) from non-200 (failure).
 - Empty-state: if both backend and localStorage are empty, show a CTA "Back to onboarding" that navigates to /onboarding.

 6. Chat + Plus icon — 30 action audit

 Problem: ActionResultRenderer.tsx:67-140 dispatches 30 action IDs to card components. The fallback at lines 135-139 renders raw JSON in a <pre> —
 unacceptable for launch.

 Fix:

 - Enumerate the 30 actions from apps/main/src/lib/agents/actions.ts. For each, verify the matching XxxCard component exists and imports cleanly.
 - Build a small dev-mode checker: import every action ID, confirm getCardComponent(id) resolves. Add to apps/main/src/scripts/verify-action-cards.ts as a
 one-off script.
 - For any missing cards, implement them as minimal but presentable components (title, description, structured preview — no raw JSON). Launch-grade, not
 perfection.
 - Wire the "agent not connected yet" path: assistants.ts already throws AgentNotAvailableError on 404. Catch in the chat page's handleSend and surface
 toast.error("Rex isn't connected yet — try another agent") instead of silently failing.
 - customInput round-trip: /agents/{agent}/chat (GET) returns messages with customInput. Verify the chat page rehydrates action-result messages on refresh
 (currently messages are fetched at line 566-574 in the chat page; confirm the ActionResultRenderer receives customInput correctly).

 7. Maya publishing UI

 Backend that already exists: POST /api/v1/agents/maya/publish (apps/server/src/modules/agents/maya/maya.controller.ts:83-88) with body { socialAccountId,
 caption, hashtags?, imageUrl?, imageBase64? }. GET /api/v1/integrations/ lists connected accounts (social_account table filtered by org).

 Fix in apps/main:

 - In the Maya chat page, after a draft-content / generate-variants result card renders, show a "Publish" button.
 - Click → dialog with:
   - Platform picker (Twitter / LinkedIn / Instagram) — filtered to platforms the user has connected
   - Account picker (accountName) per platform
   - Caption (pre-filled, editable, char counter per platform: Twitter 280, LinkedIn 3000, Instagram 2200)
   - Image preview (already generated)
 - On submit → publishPost(...) in apps/main/src/lib/api/assistants.ts:POST /agents/maya/publish. Show pending / success / failure state; on success show
 "View on Twitter" link if platformPostId is returned.
 - If no accounts connected for a platform, CTA: "Connect {platform}" → link to /settings/integrations.
 - Handle 401/403 from a stale token: toast "Reconnect your {platform} account" with a deep link.

 8. Settings → Integrations — OAuth roundtrip polish

 Backend that already exists: GET /integrations/, GET /integrations/:platform/authorize, DELETE /integrations/:id, and public callback GET
 /integrations/:platform/callback redirecting to {CLIENT_URL}/settings/integrations?connected={platform} or ?error={msg}.

 Fix in apps/main/src/app/(dashboard)/settings/integrations/page.tsx (verify and polish — file was not read in exploration):

 - List connected accounts (via GET /integrations/) grouped by platform; show account name and connected date.
 - "Connect" button per platform → window.location.href = ${API_URL}/integrations/{platform}/authorize. Not an AJAX call — the browser must follow the 302
 to the provider.
 - Read URL query params connected / error on mount; show success or error toast, then router.replace('/settings/integrations') to clean URL.
 - "Disconnect" button → DELETE /integrations/{id} with confirm dialog.
 - Reconnect flow for expired tokens: same as Connect; after OAuth the record updates.

 9. Vega Google Calendar banner — conditional render

 Problem: apps/main/src/app/(dashboard)/assistants/[id]/page.tsx:708-743 shows the Google Calendar connection banner unconditionally on Vega's chat page.

 Fix:

 - Query the user's account entries (via a thin /api/v1/auth/accounts call or, if none exists, use authClient.listAccounts() if available in better-auth
 v1.5.6 — consult apps/main/node_modules/better-auth/ before picking).
 - Check for a Google account with scopes including gmail.modify and calendar.
 - Show the banner only when not connected. Add a "Reconnect" CTA if scopes are insufficient (token has openid/email/profile but not Gmail/Calendar).
 - Use authClient.signIn.social({ provider: 'google', callbackURL: '/assistants/vega' }) to initiate; the server-side config at
 apps/server/src/lib/auth.ts:38-52 already requests the right scopes with prompt: 'consent'.

 10. API-client error normalization (small, enabling)

 Fix in apps/main/src/lib/api/client.ts:

 - When status 401 → dispatch a custom event or call authClient.signOut() + router.replace('/login').
 - When status 403 on org-bound routes → toast "No access to this workspace." and return null.
 - When status 404 on agent routes → throw AgentNotAvailableError (already done).
 - When status 404 on brand-kit routes → return null/unavailable (already done).
 - When >=500 → toast generic "Something went wrong. Try again.".

 This avoids one-off try/catches throughout the app.

 ---
 Critical files to modify

 ┌──────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┐
 │                             File                             │                                        Change                                         │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/app/(onboarding)/onboarding/page.tsx           │ Add Step 0 (org creation), shift indices, redirect-away-if-complete                   │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/lib/api/organizations.ts                       │ New — thin wrapper over authClient.organization.*                                     │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/components/layout/OnboardingGuard.tsx          │ New — org + brand-kit completion check                                                │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/app/(dashboard)/layout.tsx                     │ Wrap children in OnboardingGuard                                                      │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/components/forms/auth/loginForm.tsx            │ callbackURL → /onboarding                                                             │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/app/(dashboard)/brain/page.tsx                 │ Seeded-from-onboarding hint, last-saved timestamp, empty-state CTA                    │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/app/(dashboard)/assistants/[id]/page.tsx       │ Vega banner conditional; Maya publish button; AgentNotAvailableError toast            │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/components/chat/ActionResultRenderer.tsx       │ Audit 30 mappings; fill missing cards                                                 │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/app/(dashboard)/settings/integrations/page.tsx │ Connect/Disconnect polish; callback query handling                                    │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/lib/api/client.ts                              │ Error normalization (401/403/5xx)                                                     │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/lib/api/assistants.ts                          │ Confirm publishPost call shape matches backend {socialAccountId, caption, hashtags?,  │
 │                                                              │ imageUrl?}                                                                            │
 ├──────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/landing/src/components/veqiro/crew.tsx                  │ DeskPanel: ref + scrollIntoView after first render                                    │
 └──────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┘

 Utilities that already exist and should be reused

 - authClient.organization.create / setActive / useActiveOrganization — apps/main/src/lib/auth-client.ts
 - apiFetch wrapper with AgentNotAvailableError / ApiError — apps/main/src/lib/api/client.ts:24
 - getBrandKit / saveBrandKit / scrapeBrandKit — apps/main/src/lib/api/brain.ts
 - runAgentAction / publishPost / sendMessage / getMessages — apps/main/src/lib/api/assistants.ts
 - SessionGuard — nested inside new OnboardingGuard
 - Brand kit context strip — apps/main/src/app/(dashboard)/assistants/[id]/page.tsx:142-228

 ---
 Verification plan (end-to-end)

 The testing team should be able to execute these from cold state. Run apps/server (needs Postgres + env), apps/ai (optional — mock mode works), and
 apps/main locally.

 Golden path (must pass before launch)

 1. Brand new signup
   - Open landing → "Get started" → /signup
   - Email + password → toast success → /verify → click verify link in mail → /onboarding
   - Step 0 (new): enter workspace name → org created; activeOrganizationId now in session (verify via devtools cookie)
   - Steps 1–6: fill brand kit → finish → /dashboard (or graceful "saved locally" toast if backend 404s)
   - Sidebar shows user + workspace. Navigate to /assistants/maya → chat loads; brand context strip shows company name, voice, colors
   - Send "Write a LinkedIn post about our launch" → user message appears → typing → assistant response
   - Click + → Maya's 6 actions visible → pick "Draft Content" → form → submit → result card renders (NOT raw JSON)
   - Reload /assistants/maya → the action-result message persists with correct card
 2. Returning user
   - Log in with already-onboarded account → lands on /dashboard (not /onboarding)
   - /brain → fields populated → edit → auto-save indicator → reload → persisted
 3. Un-onboarded bypass
   - Log in with account that has no brand kit → navigate to /assistants/maya → redirected to /onboarding
   - Onboarding self-skips Step 0 if org exists; otherwise starts at Step 0

 Plus-icon coverage (30 actions)

 For each of the 30 AgentActionMeta entries in apps/main/src/lib/agents/actions.ts:

 - Open the matching agent chat → + → select the action
 - Form renders all expected fields
 - Submit → result card renders (not fallback JSON)
 - Message persists after reload

 Maya publishing

 - /settings/integrations → connect Twitter (browser redirect → OAuth consent → callback → account appears)
 - Maya chat → Draft Content → "Publish to Twitter" → account picker → submit → success toast with "View on Twitter" link
 - Disconnect Twitter → account disappears
 - Repeat for LinkedIn and Instagram

 Vega Google Calendar

 - New account with no Google connection → /assistants/vega → banner shown
 - Click connect → Google OAuth (scopes include gmail.modify + calendar) → redirect back → banner gone
 - Try "Executive Briefing" action → succeeds

 Landing scroll

 - / → scroll to top → click any crew card → page smooth-scrolls to "currently working with" panel
 - Click a different card while panel is already in view → scrolls again (to keep panel top-aligned)
 - prefers-reduced-motion: reduce → scroll is instant (no animation)

 Backend-unavailable degrade

 - With apps/server off: signup/login blocked (expected). Turn on but block only /brand-kit/* → onboarding shows "saved locally" toast on finish; /brain
 shows yellow notice.
 - Block /agents/rex/* (REX missing on server today) → chat shows "rex isn't connected yet" toast on send, not a crash.

 Commands

 # server
 cd apps/server && pnpm dev
 # ai (optional)
 cd apps/ai && uvicorn app:app --reload --port 8000
 # main
 cd apps/main && pnpm dev   # http://localhost:3001
 # landing
 cd apps/landing && pnpm dev

 Run through the golden path, then the 30-action matrix, then social publishing, then scroll + vega banner. A Playwright smoke covering signup → onboarding
  → chat golden path would be ideal before launch but is not in the user's scope.

 ---
 Implementation notes

 - Next 16 + React 19: before writing code, skim apps/main/node_modules/next/dist/docs/ for router / metadata / use changes. apps/main/AGENTS.md explicitly
  flags this.
 - Keep commits small: ship Step 0 (org creation) first — it's the unblocker. Ship OnboardingGuard next. Polish items 4–10 can land independently.
 - Don't touch apps/server, apps/ai, or the Prisma schema (per user constraint).
 - No MARK/REX normalization — left for a future PR.