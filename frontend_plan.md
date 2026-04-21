 Veqiro Frontend Integration Plan — Production Launch

 Context

 Veqiro is a startup launching with three apps in a monorepo:

 - apps/server — Express + Better Auth + Prisma + Postgres (port 5000)
 - apps/ai — Python FastAPI agent backend (port 8000)
 - apps/main — Next.js 16 dashboard (port 3001)
 - apps/landing — Next.js 16 marketing site (port 3000)

 Backend is owned by other engineers — do not touch apps/ai or apps/server. Backend already provides:

 - Better Auth with email/password, Google OAuth (with Gmail + Calendar scopes), email verification, password reset
 - 5 working agents wired through Express → FastAPI: Maya (social), Sage (SEO/blog), Lex (legal+RAG), Scout (research), Vega (email/calendar). Plus Rex
 (metrics — FastAPI only, no Express wrapper) and Mark (empty stub).
 - Social OAuth + posting for Twitter, LinkedIn, Instagram
 - Organization plugin (multi-tenant; activeOrganizationId lives on the session)
 - Message persistence in Message table keyed by agent + organizationId
 - Missing: /api/v1/brand-kit GET/PATCH/scrape routes — the AI service expects them but Express has no handler. Frontend already treats this as 404 →
 "backend unavailable" banner.

 The frontend (apps/main) is ~90% built: auth pages, 6-step onboarding wizard, all agent chat UIs, brain page (brand kit + knowledge tabs), settings,
 single apiFetch API client. The landing page is feature-complete but has hardcoded data, no smooth scroll, and a few broken CTAs.

 Goal: ship a production-ready startup. Connect frontend to backend wherever the backend exists, replace mocks, polish the marketing site, make signup →
 onboarding → daily use one smooth flow.

 Important caveat: apps/main/AGENTS.md warns this Next.js version has breaking API changes from training data — consult
 apps/main/node_modules/next/dist/docs/ before using any Next API I'm unsure about.

 ---
 Scope (clarified with user)

 In scope:
 1. Landing page polish: smooth scroll, fix CTAs, centralized data file
 2. Auth flows: complete forgot-password, reset-password, verify-email; add session guard on dashboard layout
 3. Onboarding: verify the 6-step wizard works end-to-end after signup
 4. Brain page: redesign as a single brand-kit editor (drop the localStorage-only knowledge tabs since onboarding/brain capture the same data)
 5. All 5 working assistants (Maya, Sage, Lex, Scout, Vega): chat + plus-menu actions wired and rendering nicely
 6. Settings → Integrations (Twitter/LinkedIn/Instagram) and Members (Better Auth org plugin)
 7. Production smoke test

 Out of scope (per user):
 - /dashboard page (kept as overview, mock data stays)
 - /workspace/* pages — briefing, content, leads (kept as overview, mock data stays)
 - Settings → Profile, Billing, Notifications (no backend endpoints; show "coming soon" but don't pretend they save)
 - Rex and Mark agent functionality (let the existing 404 fallback show)
 - Knowledge items feature on /brain (Documents/Webpages/Notes/Images — removed)
 - Any change to apps/server or apps/ai

 ---
 Plan

 Section 1 — Landing page cleanup (apps/landing)

 Goal: smooth scroll, working CTAs, single source of truth for marketing content.

 1. Add smooth scroll in src/app/globals.css:
 html { scroll-behavior: smooth; }
 2. Create src/lib/site-config.ts as the single source for marketing data. Move into it:
   - contact (email, phone, address — dummy values now, user will fill in real ones)
   - social (Twitter/X, LinkedIn, Instagram, GitHub URLs)
   - nav (navbar links: [{ href: '#crew', label: 'The Crew' }, ...])
   - pricingTiers (currently hardcoded in sections.tsx:51-58)
   - howItWorksSteps (currently in sections.tsx:9-13)
   - faqItems (currently in sections.tsx:124-130)
   - footer (column structure, currently in sections.tsx:216-231, plus copyright)
   - marqueeItems (currently in app/page.tsx:15-21)
   - crewReplies and crewFollows (currently in crew.tsx:70-90)
   - mainAppUrl, landingUrl (read from env, exported for convenience)
   - demoCtaHref = mailto:hello@veqiro.com (user picked mailto; configurable here)
 3. Refactor components to import from site-config:
   - src/components/veqiro/hero.tsx — pull navbar links from siteConfig.nav
   - src/components/veqiro/sections.tsx — pull pricing, steps, FAQ, footer
   - src/components/veqiro/crew.tsx — pull crew replies/follows
   - src/app/page.tsx — pull marquee items
   - src/components/veqiro/data.ts — keep EMPLOYEES here (it's already centralized); optionally re-export from site-config
 4. Fix broken CTAs:
   - sections.tsx:195 "Book a demo" → siteConfig.demoCtaHref (mailto link)
   - Footer links (sections.tsx:227) — replace href="#" with real targets where they exist (About → external if needed, Docs → external, Contact → mailto,
 Privacy/Terms → simple in-app routes or external). Where there's no destination yet, route to mailto:hello@veqiro.com so the link does something.
   - Verify all "Hire the Crew / Start free" buttons go to ${siteConfig.mainAppUrl}/signup
   - Verify "Login" in navbar goes to ${siteConfig.mainAppUrl}/login
 5. Navbar consolidation: there are two navbar implementations — inline in hero.tsx and an unused NavBar in shared.tsx. Pick the one in hero.tsx (it's the
 one in use), and delete the unused export from shared.tsx to avoid drift.

 ---
 Section 2 — Auth flows (apps/main)

 Goal: every auth page works end-to-end with Better Auth.

 1. src/app/(auth)/forgot-password/page.tsx — wire to authClient.forgetPassword({ email, redirectTo: '${origin}/reset-password' }). Show success state
 after submit.
 2. src/app/(auth)/reset-password/page.tsx — read token from URL search params (Better Auth includes it on redirect). Call authClient.resetPassword({
 newPassword, token }). Redirect to /login on success with toast.
 3. src/app/(auth)/verify/page.tsx — read token from URL. Call authClient.verifyEmail({ token, callbackURL: '/onboarding' }). Backend has
 autoSignInAfterVerification: true, so user lands signed in.
 4. Google OAuth button (login + signup pages) — call authClient.signIn.social({ provider: 'google', callbackURL: '/onboarding' }). The backend already
 configures Gmail + Calendar scopes for everyone, which Vega needs.
 5. Add session guard in src/app/(dashboard)/layout.tsx. Currently only /onboarding redirects unauthenticated users. Add a top-level guard so direct hits
 to /assistants, /brain, /settings also redirect to /login if no session. Use authClient.useSession() (client component) — Next 16 server-side session
 reads through Better Auth need to consult its docs first.
 6. Sign-out flow: confirm logout in AppSidebar calls authClient.signOut() and then router.push(LANDING_URL).

 ---
 Section 3 — Onboarding & Brain unification

 Goal: onboarding collects the brand kit once; /brain is where the user views and edits the same data later. Drop the knowledge-tabs concept.

 Decision rationale (user-confirmed): Onboarding and the Brain "Brand Kit" tab capture the same BrandKit shape. The other Brain tabs (Documents, Webpages,
 Notes, Images) are localStorage-only with no backend, so they're feature-debt rather than working features.

 1. Strip /brain (src/app/(dashboard)/brain/page.tsx) to a single section: the brand kit editor (the existing BrandKitSection.tsx). Remove tabs UI,
 knowledge grid, search.
 2. Field-set parity check: ensure the brain editor includes every field captured during onboarding plus platform_tones (twitter/linkedin/instagram tone
 overrides). The brain version may have more fields than onboarding — that's fine, since it's the "edit later" surface.
 3. Hydration: on mount call getBrandKit(organizationId). If null (404), show a small banner "Brand Kit storage isn't connected yet — your changes save
 locally and will sync when backend ships." Continue saving to localStorage as the existing code already does.
 4. Auto-save: keep the existing 800ms debounced saveBrandKit() call.
 5. Delete dead Knowledge code (or move to _archive/ if user wants to revisit later):
   - src/components/brain/KnowledgeGrid.tsx, KnowledgeCard.tsx, AddKnowledgeDialog.tsx, BrainSearch.tsx
   - src/hooks/useKnowledgeStore.ts
   - Knowledge types in src/lib/types/index.ts (only if unused elsewhere)
 6. Add a "Brain" entry to the AppSidebar (or rename it "Brand Kit") so users can find it. The page is the user's editable identity profile that all agents
  read.
 7. Keep onboarding wizard as-is — it already saves on completion and redirects to /dashboard. Just verify the field shape posted matches what /brain
 expects, since both call saveBrandKit().

 ---
 Section 4 — Assistants: chat + plus-menu actions

 Goal: every working agent (Maya, Sage, Lex, Scout, Vega) has a usable chat and at least one tool action that produces visible results.

 The chat-send + history-load + plus-menu plumbing is already wired correctly through src/lib/api/assistants.ts and src/lib/agents/actions.ts. The work is
 in the action result rendering and a few action-specific UI flows.

 For all five agents (in src/components/chat/ActionResultRenderer.tsx):
 - Switch on action ID and render shaped results instead of raw JSON.
 - Common pieces: copy-to-clipboard button on text blobs, error state, loading skeleton.

 Maya (social/content)

 - Chat: working ✓
 - Actions in actions.ts: generate-ideas, draft-content, generate-variants, revise, regenerate-image, regenerate-content
 - draft-content result: render the body as markdown, hashtags as chips, image preview if returned, plus a "Publish" button that opens a dialog: pick a
 connected SocialAccount → call publishPost(orgId, { socialAccountId, caption, hashtags, imageUrl }) → success toast with the post URL.
 - generate-ideas result: render each idea as a card with hook + predicted engagement + hashtags.
 - regenerate-image / regenerate-content: render new image / new caption with "use this" button.
 - Empty SocialAccount list → "Connect Twitter/LinkedIn/Instagram in Settings → Integrations" link.

 Sage (SEO)

 - Chat ✓; Actions: keyword-research, generate-blog, analyze-content, content-brief
 - keyword-research result: table of keywords with intent badge + difficulty bar + cluster grouping.
 - generate-blog result: render the markdown content with copy + download-as-.md buttons; show the meta title/description card; show SEO score gauge.
 - analyze-content result: score + issue list + improvement list as colored sections.
 - content-brief result: structured brief card with H2 outline + must-include topics.

 Lex (legal)

 - Chat ✓; Actions: ingest-document, analyze-contract, draft-document, explain, legal-research, compliance-check
 - ingest-document: file-input UI in RunActionDialog for the action with id === 'lex:ingest-document'. Convert selected PDF to base64 client-side, POST as
 pdfBase64. Show "ingesting..." progress.
 - analyze-contract result: risk-level badge, risks list with severity colors, key terms table, always render the disclaimer at the bottom.
 - draft-document result: render the document as monospace text with a download button; show review notes + disclaimer.
 - explain / legal-research / compliance-check: structured cards as backend response.

 Scout (research)

 - Chat ✓; Actions: research-topic, research-company, scan-competitors, trending-topics
 - research-company result: profile card with founded/team-size/funding/pricing tiles + SWOT lists.
 - scan-competitors result: table per competitor with change badge + significance.
 - trending-topics result: trend cards with momentum arrow + content angle.

 Vega (email/calendar)

 - Chat ✓; Actions: process-inbox, draft-reply, calendar-summary, create-event, executive-briefing, compose-email
 - Connect Google CTA: the existing UI shows a "Connect Google Calendar" banner. Clicking it should call authClient.signIn.social({ provider: 'google',
 callbackURL: '/assistants/vega' }). Backend OAuth scopes already include Gmail + Calendar, so this single sign-in covers both.
 - process-inbox result: list of triaged emails with priority badges + "open draft" link if a draft was created.
 - calendar-summary result: agenda timeline + free-block list.
 - create-event result: event card with conflict warning if any.
 - executive-briefing result: collapsible sections for email summary + calendar summary + recommendations.

 Rex & Mark

 - Per user decision: leave the existing 404 fallback (AgentNotAvailableError toast). No frontend change.
 - Optional: improve the empty-state copy to "This agent is launching soon" instead of "isn't connected yet".

 ---
 Section 5 — Settings

 Goal: integrations and members work; everything else honestly says "coming soon".

 1. /settings/integrations (src/app/(dashboard)/settings/integrations/page.tsx)
   - Twitter, LinkedIn, Instagram cards: wire Connect to authorizeUrl(platform) (already in lib/api/integrations.ts) — backend redirects to OAuth, callback
  returns to main app, list refreshes.
   - Wire Disconnect to DELETE /api/v1/integrations/:id.
   - On mount, call GET /api/v1/integrations to populate connection states.
   - Google, Slack, Notion, GitHub, Stripe: leave as "Coming soon" (disabled button + tooltip).
 2. /settings/members (src/app/(dashboard)/settings/members/page.tsx)
   - Replace MOCK_MEMBERS with authClient.organization.listMembers({ query: { organizationId } }).
   - Invite is already wired via authClient.organization.inviteMember() ✓
   - Wire Remove → authClient.organization.removeMember({ memberIdOrEmail, organizationId }).
   - Show pending invitations from authClient.organization.listInvitations().
 3. /settings, /settings/billing, /settings/notifications
   - These have no backend support. Don't fake-save. Each page: keep the UI but disable Save buttons with a "Coming soon" note. Avatar upload button stays
 disabled as it already is.

 ---
 Section 6 — Production polish & verification

 1. Build & typecheck:
 cd apps/landing && npm run build
 cd apps/main && npm run build
 1. Fix any TypeScript errors. Pay attention to Next 16 deprecation warnings — consult apps/main/node_modules/next/dist/docs/ if any API I'm using has
 changed.
 2. Lint:
 cd apps/landing && npm run lint
 cd apps/main && npm run lint
 3. Env check: confirm the following are set in both apps' .env.local:
   - apps/landing: NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3001, NEXT_PUBLIC_LANDING_URL=http://localhost:3000
   - apps/main: NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1, NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:5000, NEXT_PUBLIC_API_VERSION=v1,
 NEXT_PUBLIC_LANDING_URL=http://localhost:3000
 4. Manual end-to-end smoke test (golden path):
   a. Start backend: cd apps/server && npm run dev and cd apps/ai && uvicorn main:app --reload
   b. Start landing: cd apps/landing && npm run dev (3000)
   c. Start main: cd apps/main && npm run dev (3001)
   d. Visit landing → click "Hire the Crew" → lands on main /signup
   e. Sign up with email → email verify link → /onboarding
   f. Complete 6 onboarding steps → land on /dashboard
   g. Visit /brain → see the saved brand kit data → edit a field → reload → still there
   h. Visit /assistants/maya → send a chat message → verify response
   i. Open plus-menu → run "Generate post ideas" → verify rendered cards
   j. Visit /settings/integrations → connect Twitter (mock or real OAuth) → return to Maya → run "Draft a post" → click Publish → verify post URL
   k. Visit /assistants/vega → click "Connect Google" → grant Gmail+Calendar → run "Calendar summary"
   l. Sign out → land on landing /
 5. Network tab check: every action call hits a real /api/v1/... URL with credentials: include, returns 200 or expected 4xx with helpful UI feedback.

 ---
 Critical files

 apps/landing

 - src/app/globals.css — add smooth scroll
 - src/lib/site-config.ts — NEW, single source of marketing data
 - src/components/veqiro/hero.tsx — import navbar from site-config
 - src/components/veqiro/sections.tsx — import pricing/FAQ/steps/footer; fix Book-a-demo + footer hrefs
 - src/components/veqiro/crew.tsx — import quote replies from site-config
 - src/app/page.tsx — import marquee items from site-config
 - src/components/veqiro/shared.tsx — remove unused NavBar export

 apps/main — auth

 - src/app/(auth)/forgot-password/page.tsx, reset-password/page.tsx, verify/page.tsx — wire to authClient.*
 - src/app/(dashboard)/layout.tsx — session guard

 apps/main — brain (unify with onboarding)

 - src/app/(dashboard)/brain/page.tsx — strip to single brand-kit editor
 - src/components/brain/BrandKitSection.tsx — verify field-set parity with onboarding wizard
 - Delete: KnowledgeGrid.tsx, KnowledgeCard.tsx, AddKnowledgeDialog.tsx, BrainSearch.tsx, useKnowledgeStore.ts
 - src/components/layout/AppSidebar.tsx — keep "Brain" link (or rename to "Brand Kit")

 apps/main — assistants (already wired; improve action result rendering)

 - src/app/(dashboard)/assistants/[id]/page.tsx — verify chat + Vega Connect-Google CTA
 - src/components/chat/ActionResultRenderer.tsx — per-action result UI (the bulk of the visual work)
 - src/components/chat/RunActionDialog.tsx — PDF file-input + base64 conversion for lex:ingest-document
 - src/components/chat/MaaPublishDialog.tsx — NEW, Maya post-publish flow with social-account picker

 apps/main — settings

 - src/app/(dashboard)/settings/integrations/page.tsx — verify Twitter/LinkedIn/Instagram connect/disconnect end-to-end
 - src/app/(dashboard)/settings/members/page.tsx — wire to Better Auth org plugin (listMembers, removeMember, listInvitations)
 - src/app/(dashboard)/settings/{page,billing/page,notifications/page}.tsx — show "coming soon", disable Save

 Reused (no changes needed)

 - src/lib/api/client.ts — apiFetch wrapper with AgentNotAvailableError (already correct)
 - src/lib/api/assistants.ts — sendMessage, getMessages, runAgentAction, publishPost (already correct)
 - src/lib/api/brain.ts — getBrandKit, saveBrandKit, scrapeBrandKit (already correct)
 - src/lib/api/integrations.ts — authorizeUrl, list/disconnect (already correct)
 - src/lib/agents/actions.ts — full action catalog for all 6 agents (already correct)
 - src/lib/config/agents.ts — agent personalities + crew metadata (already correct)
 - src/lib/auth-client.ts — Better Auth client with org plugin (already correct)

 ---
 Verification

 End-to-end manual smoke test described in Section 6, step 4. Plus:

 - cd apps/landing && npm run build && npm run lint — clean
 - cd apps/main && npm run build && npm run lint — clean
 - All five working agents return either a real result or a clear failure UI (no blank screens, no raw JSON dumps to the user)
 - Brand kit edited in /brain round-trips through reload (via backend if available, via localStorage otherwise)
 - Twitter/LinkedIn/Instagram OAuth flows complete and the connected accounts appear in /settings/integrations
 - Vega's "Connect Google" CTA opens the OAuth dialog with Gmail+Calendar scopes