# Agent Workspaces — Pre-Merge Audit & Fix Plan

**Branch:** `feat/agent-workspaces` → `main`
**Goal:** Find and fix everything that would embarrass us if a customer hit it right after this branch ships — broken buttons, dropped handoffs, business-logic bugs, responsiveness gaps, theme breaks, and any place the new module-based workspace disagrees with the old chat-based one it replaces.

**Scope of this audit:** the real diff against `main`, i.e. everything under `apps/main/src/app/(workspace)/`, `apps/main/src/components/workspace/`, `apps/main/src/lib/workspace/`, plus every changed file under `apps/server/src/modules/agents/*` and `apps/server/src/modules/workspace/`. Generated Prisma client files and SQL migrations were skimmed for model shape only, not reviewed line by line.

**Method:** static code review, not a running app. Per your instruction, nothing here was verified by starting the dev server or exercising real AI/chat calls — every finding below is traced through the actual source (component → hook → API client → route → service → schema) to the point where I'm confident it's a real defect, not a guess. Where I couldn't fully confirm something, it's marked **VERIFY** instead of listed as a bug.

**What's solid, up front, so this doesn't read as all-bad news:** the workspace framework itself (`WorkspaceShell`, `ModuleHost`, `AgentWorkspaceContext`, `WorkspaceChatProvider`, the six default modules) is well-built — consistent org-scoping on every backend read, no hardcoded colors, responsive grids throughout, no dead links (`ComingSoonModule` renders an honest placeholder instead of 404ing). Scout, Sage, and Rex's new work-type UIs are clean and their handoff buttons are wired correctly end-to-end. The MCP approval-policy and entitlement-gating changes are careful and correct. The bugs below are real but they're pockets, not a systemic problem.

---

## How to read this plan

Findings are grouped: cross-cutting issues first (things that affect every agent or the shell itself), then one section per agent in the agreed order (Maya, Scout, Sage, Rex, Lex, Vega). Each finding has a severity, exact file:line, why it's real, and the fix. Two items are flagged **DECISION NEEDED** — they're not mechanical fixes, they change scope or behavior, and I'm not making that call for you.

Implement in the phase order below; each phase ends with `tsc --noEmit` + ESLint (and a build where noted) before moving on, so a mistake in one phase doesn't get buried under the next.

---

## Phase 0 — Cross-cutting (shell, handoffs, auth)

### 0.1 [HIGH] Mobile users cannot navigate between workspace modules at all

**Files:** `apps/main/src/components/workspace/ModuleNav.tsx:27`, `apps/main/src/components/workspace/WorkspaceShell.tsx:96-117`

`ModuleNav` — the rail listing Overview / Work / Actions / Approvals / Automations / Activity / Memory / Integrations / Settings — is `hidden ... md:block` with **no mobile equivalent anywhere in the codebase** (confirmed: no `Sheet`, `Drawer`, hamburger, or bottom-nav component references `ModuleNav` or the module list on any narrower breakpoint). Below 768px, a customer can only reach the module they land on (Overview) plus whatever module the mobile-only chat button (`WorkspaceShell.tsx:87-91`) sends them to. There is no way to tap into Work, Approvals, or Settings from a phone.

This is the single biggest responsiveness gap in the branch — everything else (module content, cards, forms) is already responsive; the door to get to most of it is not.

- [x] Add a mobile nav affordance in `WorkspaceShell.tsx`'s header (a `Sheet`/drawer triggered by a menu icon, `md:hidden`) that lists the same `ready`/`soon` modules `ModuleNav` computes, reusing `useAgentWorkspace().modules` and `hrefFor`. Implemented as `WorkspaceMobileNav.tsx`.
- [x] Reuse `ModuleNav`'s `NavItem` rendering logic (or extract it) so active-state styling and the "Coming soon" grouping stay in sync between desktop and mobile. Extracted `ModuleNavList` (in `ModuleNav.tsx`) and shared it between the desktop rail and the new mobile sheet.
- [ ] Verify at ~375px and ~768px widths — **still needs a manual/browser pass**; `next build` confirms the route compiles and renders server-side, not that the sheet looks right on a real phone width.

### 0.2 [LOW] Stale path in dev-only diagnostic message

**File:** `apps/main/src/components/workspace/WorkspaceChatProvider.tsx:100`

The dev-mode double-mount warning tells the developer to check for `loading.tsx` or `template.tsx` under `app/(dashboard)/workspace/[agent]/` — that route group was renamed to `app/(workspace)/workspace/[agent]/` as part of this branch (see `WorkspaceShell.tsx`'s own header comment: "Deliberately outside the (dashboard) group"). The message now points a future debugger at a path that doesn't exist.

- [x] Update the string to `app/(workspace)/workspace/[agent]/`.

### 0.3 [LOW] Stale comment says handoffs are dormant — they're not

**File:** `apps/server/src/modules/workspace/handoffs.service.ts:12-19`

The module doc-comment says the `Handoff` table/queries are "shipped dormant in Phase 0 ... nothing creates one until the workforce phase." That's no longer true on this branch: `apps/main/src/components/workspace/panels/DelegateDialog.tsx` → `useCreateHandoff` (`apps/main/src/lib/api/workspace.ts:435-446`) → `POST /workspace/handoffs` → `createHandoff()` is a fully live path, reachable from the "Hand to another employee" button on every insight in every agent's Overview (`InsightList.tsx:110-118`). A maintainer reading the comment would wrongly assume this write path is unused.

- [x] Update or remove the "shipped dormant" paragraph to reflect that `DelegateDialog` actively creates handoffs.

### 0.4 [MEDIUM] — DECISION NEEDED: `vega:compose-email` doesn't exist, and the handoffs meant to target it were never built

`AGENTS.md` documents three handoff buttons that all target `vega:compose-email`:

- Rex investor-update → "Send via Vega"
- Rex runway → "Email board"
- Lex contract analysis → "Email team about risks"

None of this exists in code, confirmed from both ends:

- **The action doesn't exist.** Vega's *entire* action surface, everywhere (`lib/types/agents.ts`, `lib/agents/actions.ts`'s `AGENT_ACTIONS.vega`, `RunActionDialog.tsx`'s `SPECS`, `ActionResultRenderer.tsx`'s dispatch), is exactly one entry: `vega:daily-briefing`. There is no `compose-email`, and also none of `process-inbox`, `draft-reply` (Vega's own), `calendar-summary`, `create-event`, or `executive-briefing` — all six of which `AGENTS.md` lists as Vega's "key outputs." Backend confirms the same story: `vega.routes.ts` only exposes `/chat`, `/chat/stream`, `/briefing`.
- **The source buttons don't exist either.** Grepped `apps/main/src/components/agents/rex/cards.tsx` and `apps/main/src/components/agents/lex/cards.tsx` for `vega:compose-email` — zero matches in either file.

This isn't a regression introduced by this branch (Vega's own git-log entry says the daily-briefing Actions module "is no longer empty," implying it was empty before and briefing is the first thing built) — it's `AGENTS.md` describing a target state that Vega hasn't reached yet, while the doc reads as if it's already shipped.

**Decided: Option B — defer, fix the docs.** Building `vega:compose-email` end to end (backend route, AI draft, `AGENT_ACTIONS` entry, `RunActionDialog` form, `ActionResultRenderer` card, plus the three handoff buttons in Rex/Lex's cards) is real feature scope for a later pass, not part of this cleanup.

- [x] Marked the three `vega:compose-email` handoff rows (Rex ×2, Lex ×1) and Vega's five undelivered key-outputs (`process-inbox`, `draft-reply`, `compose-email`, `calendar-summary`, `create-event`) with a 🚧 "designed, not yet built" note in `AGENTS.md`, so the doc matches what's actually shipped instead of reading as already-live. Nothing removed — the intended shape is still there for whoever picks up Option A later.
- [ ] Option A (building the real action) is intentionally **not** part of this pass — tracked here as future work, not scheduled.

### 0.5 [LOW] — VERIFY: mutation routes for insights/memory/handoffs skip entitlement gating

**File:** `apps/server/src/modules/workspace/workspace.routes.ts:54-59`

`PATCH /workspace/insights/:id`, `PATCH /workspace/memory-items/:id`, `POST /workspace/handoffs`, and `POST /workspace/handoffs/:id/accept|decline` are registered with `authMiddleware` only. Every other workspace route (`/pulse`, `/outcomes`, and everything under `/:agent/*`) also requires `entitlementMiddleware`/`entitlementForAgentParam`. Ownership is still checked at the row level (`patchMemoryItem` verifies `organizationId`, `setHandoffStatus` verifies `organizationId` before any transition), so this isn't a cross-tenant data leak — but an organization with a lapsed trial/subscription can still dismiss insights, retire memory, and create/accept/decline handoffs, which is inconsistent with how every other write in this router behaves.

- [x] Decided: gate them like everything else in this router. Added `entitlementMiddleware` alongside `authMiddleware` on all four route registrations (`PATCH /insights/:id`, `PATCH /memory-items/:id`, `POST /handoffs`, `POST /handoffs/:id/accept|decline`) — no schema or service change needed. `workspace.routes.test.ts` still passes (8/8).

---

## Phase 1 — Maya

### 1.1 [LOW-MEDIUM] Phantom quick action — "Content plan" button silently never renders

**File:** `apps/main/src/lib/workspace/agents/maya.workspace.ts:65`

`overview.quickActions` lists `"maya:content-plan" as AgentActionId` as the 4th quick action, alongside `generate-ideas`, `draft-content`, and `campaign`. `"maya:content-plan"` is not a real action — it's absent from `AgentActionId` (`lib/types/agents.ts`), from `AGENT_ACTIONS` (`lib/agents/actions.ts`), and from `RunActionDialog`'s `SPECS`. The `as AgentActionId` cast pushes an invalid string past the type checker. At runtime, `QuickAction` (`OverviewModule.tsx:203-212`) calls `findAction(id)`, gets `undefined`, and renders `null` — so Maya's Overview silently shows three quick actions instead of the intended four, with no error or visual sign anything's missing.

- [x] Remove the phantom `"maya:content-plan"` entry from `quickActions` — Content Plan is reachable via the `plan` Work-tab (`MayaPlansWork`), which is the right home for it; it was never meant to be an action-dialog.
- [x] Grepped for other `as AgentActionId` casts pointing at strings absent from `AgentActionId`'s union — every other agent's `quickActions`/`createActions` array resolves to a real, registered action; this was the only phantom entry.

### 1.2 [LOW] — VERIFY: campaign "Approved" label doesn't distinguish approved-with-no-date from scheduled-for-a-date

**Files:** `apps/server/src/modules/agents/maya/maya.campaigns.ts:83-107` (`approveCampaign`) vs `:109-130` (`scheduleCampaign`); `apps/main/src/components/workspace/agents/maya/MayaCampaignsWork.tsx:28-35`

Both `approveCampaign` and `scheduleCampaign` set `CampaignStatus.SCHEDULED`, and the frontend's `LABEL` map shows `"Approved"` for that status regardless of which path set it. `MayaCampaignsWork.tsx`'s row UI only exposes Approve/Archive — there's no call to `scheduleCampaign` anywhere in the new workspace, so a campaign actually scheduled for a future date (if that ever happens through some other surface) would still just read "Approved" here, with no visible date.

- [ ] Still open — deferred per your "rest is fine" go-ahead read as approving the plan's priorities, not as a decision on this specific low-severity item. No code changed here; flagging again so it isn't later mistaken for a regression introduced by this pass.

---

## Phase 2 — Scout

No confirmed defects. Reviewed `scout.workspace.ts` (frontend + backend), `ScoutProjectsWork.tsx`, `ScoutProjectDetail.tsx`, `scout.service.ts`, `scout.projects.ts`, and the three handoff buttons in `components/agents/scout/cards.tsx` ("Draft post," "Find keywords," "Generate ideas," "Draft positioning post," "Research" on a discovered competitor). All handoffs target real actions with prefill field names that match `RunActionDialog`'s `SPECS` exactly. `captureResearch` correctly turns research-topic/research-company results into durable `ResearchProject`/`ResearchSource`/`ResearchFinding` rows (trending-topics and discover-competitors intentionally don't, since they don't produce a single research subject). Responsive classes and theme tokens throughout — no hardcoded colors, no fixed-width overflow risk.

- [x] No action items for this phase beyond the cross-cutting fixes above.

## Phase 3 — Sage

No confirmed defects. Reviewed `sage.workspace.ts`, `SagePagesWork.tsx`, `sage.pages.ts`/`sage.pages.controller.ts`, and the handoff buttons in `components/agents/sage/cards.tsx`. The audit→monitoring migration (`SeoPage`/`SeoIssue`, with score-delta tracking and auto-resolving issues that stop being reported) is well-designed and internally consistent — no leftover references to a pre-monitoring shape. All four quick actions and both work-type create actions resolve to real, correctly-specced actions.

- [x] No action items for this phase beyond the cross-cutting fixes above.

## Phase 4 — Rex

*(Audited by a sub-agent using the same method as the rest of this plan; findings verified against the same source files before inclusion here.)*

### 4.1 [LOW] "Calculate runway" handoff always opens a blocked form

**File:** `apps/main/src/components/agents/rex/cards.tsx:406-410` (pre-existing, unchanged by this branch, but still live in the new workspace)

The Financial Health card's "Calculate runway" button hands off to `rex:runway` without prefilling `cash_on_hand`. `RunActionDialog`'s validator for that action (`RunActionDialog.tsx:518-523`) requires `cash_on_hand` to be a positive number before the form can submit, so every click drops the customer into a form that can't be submitted until they type a number in themselves — the "one-click drill into runway" the handoff promises doesn't hold.

- [x] `RexFinancialAnalysisResult.metrics` turns out to have no cash-balance field at all (confirmed against `lib/types/agents.ts`) — `rex:financial-analysis` never asks about or returns one. Prefilled `cash_on_hand` as a derived estimate instead: `runway_months × monthly_burn` (the inverse of how runway itself is calculated), left at `0` — same blocked state as before — only when `runway_months` is unknown.

### 4.2 Everything else checked out

Rex's dataset sharing (`sharePin`/public share page) uses unique, unguessable tokens and returns only the one pinned payload for a valid token — no cross-org leakage. The weekly-digest and daily-alert cron jobs isolate failures per-org with `Promise.allSettled`. All `rex:*` actions referenced in `rex.workspace.ts` have matching `ActionResultRenderer` cases and `RunActionDialog` SPECS entries.

- [x] No further action items for this phase.

## Phase 5 — Lex

### 5.1 [HIGH] "Ask about this document" is silently broken in the new workspace

**Files:** `apps/main/src/components/workspace/chat/ChatDock.tsx:126-128`, `apps/main/src/components/workspace/WorkspaceChatProvider.tsx` (owns `openAction`), `apps/main/src/components/chat/RunActionDialog.tsx:217,776`; compare against the working old behavior at `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx:804-820`

Three places hand off to `lex:ask-about` with a `{ sourceId, prompt }` payload: `ContractAnalysisCard`'s `ASK_PROMPTS` buttons, `FindingItem.onAsk` in `documents-tab.tsx:328`, and the "Ask about this" button in `review.tsx:804`. `lex:ask-about` is deliberately **not** a real dialog action — `RunActionDialog.tsx` explicitly excludes it from `SpecId`/`SPECS` (line 217) and returns `null` for it (line 776). In the **old** chat page, this was handled: `handleAgentFollowUp` (`assistants/[id]/page.tsx:807-820`) intercepts `"lex:ask-about"` before it ever reaches `RunActionDialog` — it attaches the source to the composer and pre-fills the question instead of opening a form.

The new workspace's equivalent wiring — `ChatDock.tsx`'s `onFollowUpAction` — has no such interception; it calls `openAction(actionId, prefill)` unconditionally, which sets `activeActionId = "lex:ask-about"`, `WorkspaceDialogs` renders `RunActionDialog`, and `RunActionDialog` returns `null`. **Nothing happens.** No dialog, no composer change, no error — the button just doesn't do anything. This is a real, user-facing regression on a capability `AGENTS.md` documents as one of Lex's core outputs (`query-document`).

- [x] Ported `handleAgentFollowUp`'s special case into `WorkspaceChatProvider.tsx`: the context's `openAction` now wraps the raw `dialogs.openAction`, intercepting `actionId === "lex:ask-about"` to call `chat.setAttachedSourceIds` + `chat.setContent` + `setDockOpen(true)` instead of opening a dialog, and falling through to the real `openAction` for everything else.
- [x] Confirmed all three call sites (`cards.tsx`, `documents-tab.tsx`, `review.tsx`) go through `onFollowUpAction` → the context's `openAction` → this wrapper — one fix covers all three. `tsc --noEmit` and `next build` both pass with the change in place.

### 5.2 Everything else checked out

`LexHome`'s `embedded` prop split (header/prompts hidden when embedded in the workspace Overview, shown when standalone) is clean and correct. `lex.memory.ts`'s Legal Watch, obligation tracking, and version-comparison logic are all scoped by `userId`+`organizationId` consistently — no cross-tenant leakage found. The new `syncLexInsights`/`projectLexSource`/`unprojectLexSource` wiring in `lex.controller.ts`/`lex.service.ts` fires at the right points (after finalize, before delete) and fails safely.

- [x] The "Email team about risks" handoff (contract analysis → `vega:compose-email`) is covered under the cross-cutting Decision 0.4 above (deferred to Option A / later) — no separate action needed here.

## Phase 6 — Vega

No code-level defects beyond what's already covered in 0.4. `VegaCompanyPulse` and `VegaOutcomes` are clean, responsive, theme-token-only, and correctly exclude Vega from its own roster. `vega.briefing.ts`'s prompt is grounded entirely in real workspace data (explicitly instructed not to invent anything) rather than free-form chat history — a good design. `workTypes: []` is intentional per the file's own comment ("Its own work objects ... are still to come"), consistent with Vega being the last-migrated, most partial workspace right now.

- [x] No action items beyond Decision 0.4 (resolved — Option B, docs updated).

---

## What was explicitly *not* verified this pass

- No dev server was started and no AI/chat calls were exercised, per your instruction — findings above are traced through source, not observed at runtime. A manual click-through pass (especially of Phase 0.1's mobile nav fix, and Phase 5.1's Lex fix) is still worth doing before this ships.
- Agent-specific form components (`components/agents/*/forms.tsx`) and every card variant were not exhaustively checked pixel-by-pixel at every breakpoint — the framework-level responsiveness (grids, `ModuleNav`, `ChatDock`, all six default modules) was, and it's solid apart from 0.1.
- `apps/ai` (the Python service) was not reviewed — the diff didn't touch it, and the audit was scoped to `apps/main`/`apps/server` per your instructions.

## Execution order

1. Phase 0 (cross-cutting) — do 0.1–0.3 and 0.5 first; get your answer on 0.4 before writing any Vega/Rex/Lex handoff code.
2. Phase 1 (Maya) → Phase 5 (Lex) in the agreed order — Scout and Sage need no code changes, so those phases are just the verification checklist below.
3. Phase 6 (Vega) only has action items once 0.4 is decided.

After each phase's checkboxes are done:
- [x] `tsc --noEmit` in `apps/main` and `apps/server`
- [x] ESLint on every changed file
- [x] `next build` for `apps/main` once all frontend phases were done (confirms the new mobile nav and the Lex composer fix don't break the production build)

## Verification record

- `npx tsc --noEmit` in `apps/main` — clean, no errors.
- `npx tsc --noEmit` in `apps/server` — clean, no errors.
- `npx eslint` on all six changed `apps/main` files (`ModuleNav.tsx`, `WorkspaceMobileNav.tsx`, `WorkspaceShell.tsx`, `WorkspaceChatProvider.tsx`, `maya.workspace.ts`, `rex/cards.tsx`) — 0 new errors/warnings. `rex/cards.tsx` has 2 pre-existing errors + 1 pre-existing warning at (now-shifted) lines 1203/820, confirmed via `git stash` to exist identically on the base branch before this pass touched the file — left alone, out of scope.
- `apps/server` has no ESLint config/script; `tsc --noEmit` is its static check and it's clean.
- `npx next build` in `apps/main` — succeeded, all 31 routes generated including every `/workspace/[agent]/*` module route, no type or build errors.
- `npx vitest run src/modules/workspace/workspace.routes.test.ts` in `apps/server` — 8/8 passing after adding `entitlementMiddleware` to the four previously-ungated routes.
- **Not done this pass:** starting the dev server / clicking through the app, per your instruction to review code rather than run it. The mobile nav (0.1) and the Lex ask-about fix (5.1) are the two changes most worth a real click-through before this ships, since both are UI interaction fixes that a build can confirm compiles but not confirm *feels* right.

## Files changed

- `AGENTS.md` — 0.4 (Vega/handoff doc corrections)
- `apps/main/src/components/workspace/ModuleNav.tsx` — 0.1 (extracted `ModuleNavList`)
- `apps/main/src/components/workspace/WorkspaceMobileNav.tsx` (new) — 0.1 (mobile sheet nav)
- `apps/main/src/components/workspace/WorkspaceShell.tsx` — 0.1 (wired the mobile nav trigger into the header)
- `apps/main/src/components/workspace/WorkspaceChatProvider.tsx` — 0.2 (stale path string), 5.1 (lex:ask-about interception)
- `apps/main/src/lib/workspace/agents/maya.workspace.ts` — 1.1 (removed phantom quick action)
- `apps/main/src/components/agents/rex/cards.tsx` — 4.1 (runway handoff prefill)
- `apps/server/src/modules/workspace/handoffs.service.ts` — 0.3 (stale comment)
- `apps/server/src/modules/workspace/workspace.routes.ts` — 0.5 (entitlement gating on 4 routes)

Nothing was committed — that's left to you.
