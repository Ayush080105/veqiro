# apps/main UX Friction Fixes — Phase B Implementation Plan

**Goal:** Make chat state reliable across failed sends, background refreshes, and rapid agent switches, then remove the concrete dashboard/session over-fetching identified by the source design and apply a small, evidence-based bundle pass to the heaviest chat route.

**Source spec:** `docs/superpowers/specs/2026-08-30-main-ux-friction-phase-a-b-design.md`

**Scope:** B1, B3, B4, B6, and the targeted portion of B7. B2 and B5 remain explicit follow-on decisions for the reasons below.

**Phase boundary decisions:**

- B2 (real token streaming) is not safe to hide inside this reliability pass. The current response is more than text: it can contain images, action results, pending MCP approvals, tool traces, planned runs, usage, and model metadata. A real SSE migration needs one versioned event contract, cancellation/backpressure semantics, a structured terminal error, persistence timing, and a coordinated rollout across the Node relay and all six FastAPI agents. This plan leaves the synchronous contract intact and first fixes the message-loss symptom independently, as the source spec recommends.
- B5 (virtualization) remains measurement-gated. The initial DOM is bounded to 20 messages, older pages load intentionally, and scroll-anchor preservation already works. Adding a virtualization dependency or hand-rolled variable-height virtualizer without production evidence would put rich cards, images, and run graphs at risk. The targeted bundle changes in Task 4 reduce the chat route's cost without altering history behavior.

## Task 1 — Make chat reconciliation deterministic and recoverable

**Files:**

- Add: `apps/main/src/lib/chat/message-window.ts`
- Modify: `apps/main/src/lib/types/index.ts`
- Modify: `apps/main/src/lib/api/assistants.ts`
- Modify: `apps/main/src/components/chat/ChatMessage.tsx`
- Modify: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

- [x] Add client-only delivery state for optimistic messages and pure helpers that merge server snapshots by identity while reconciling their optimistic user-message equivalent.
- [x] Mark a failed optimistic message in place instead of deleting it, and show an accessible retry action on the user bubble.
- [x] Reconcile a successful mutation by optimistic id, preserving the user prompt while appending the assistant response exactly once.
- [x] Replace flat snapshot overwrites in initial refresh, orphaned-mutation catch-up, visibility catch-up, and the post-mount catch-up with functional merges.
- [x] Guard every asynchronous chat refresh and older-page fetch against the active organization/agent key; abort effect-owned requests during cleanup where possible.
- [x] Preserve the existing 20-message initial window, localStorage cache, pagination, scroll anchor, result-card patching, and mutation-state behavior.

## Task 2 — Remove dashboard requests and payload that are not rendered

**Files:**

- Modify: `apps/main/src/lib/api/dashboard.ts`
- Modify: `apps/main/src/lib/query-keys.ts`
- Modify: `apps/main/src/components/dashboard/IntegrationHealth.tsx`
- Modify: `apps/main/src/components/dashboard/RecentActivity.tsx`
- Modify: `apps/server/src/modules/dashboard/dashboard.repository.ts`
- Modify: `apps/server/src/modules/dashboard/dashboard.service.ts`
- Modify: `apps/server/src/modules/dashboard/dashboard.controller.ts`
- Modify: `apps/server/src/modules/dashboard/dashboard.routes.ts`

- [x] Remove `recentActivity` and `attention` from the dashboard summary contract and stop their four supporting database queries.
- [x] Let the dashboard summary respect its existing `staleTime` instead of forcing a request on every mount.
- [x] Add one authenticated dashboard integration-health endpoint that aggregates native and MCP connection summaries server-side.
- [x] Replace `IntegrationHealth`'s two browser requests with one cached query while preserving its current row and expiry logic.

## Task 3 — Deduplicate server-session reads per render pass

**Files:**

- Modify: `apps/main/src/lib/server-session.ts`
- Modify: `apps/main/src/lib/server-session.js`

- [x] Wrap the existing no-store session fetch with React `cache()` so page/layout callers share one request during a render pass.
- [x] Keep the forwarded cookie/user-agent headers, redirects, error fallback, and cross-request freshness unchanged.

## Task 4 — Apply targeted chat-route performance hygiene

**Files:**

- Modify: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`
- Modify: `apps/main/src/app/(dashboard)/assistants/team/page.tsx`
- Modify: `apps/main/src/components/chat/ChatMessage.tsx`
- Modify: `apps/main/src/components/dashboard/RecentActivity.tsx`

- [x] Dynamically import modal/sheet and agent-only panels that are absent from the initial chat view.
- [x] Replace local agent-photo `<img>` elements with configured `next/image` rendering and correct fixed-size hints.
- [x] Do not blanket-wrap callbacks/components in memoization; retain the existing memoized message list and expensive display-message computation.

## Task 5 — Verify Phase B behavior and contracts

- [x] Add focused tests for message merging, optimistic reconciliation, failed-message retention, and stale-request guards where they can be expressed as pure logic.
- [x] Run `apps/main` TypeScript, targeted ESLint, and a production Next.js build.
- [x] Run `apps/server` TypeScript build and relevant unit tests after the dashboard contract change.
- [x] Re-run the chat flow in a browser with mocked slow/failing responses when the local environment permits, including a rapid agent switch and failed-message retry.
- [x] Record the completed checks and any pre-existing lint/test failures here before handoff.

## Verification record

- The message-window suite passed 5/5 cases covering stale-snapshot preservation, persisted/optimistic reconciliation, identity-based de-duplication, failed-state retention, and bounded-window ordering.
- Targeted ESLint passed with zero errors or warnings after the React best-practices review.
- `pnpm build` passed for `apps/main`, including TypeScript and generation of all 33 application routes.
- `pnpm build` passed for `apps/server`.
- The full server suite passed 279/281 tests. Its two failures are pre-existing and unrelated to Phase B: the `rex-csv` XLSX fixture did not discover `mrr`, and the Scout service fixture expects an object without the existing `pendingActions: undefined` member.
- Browser verification loaded the rebuilt dashboard and Maya chat shells against a temporary authenticated-session mock and confirmed the lazy `next/image` agent assets rendered. The Better Auth client did not hydrate an active organization from that lightweight mock, so the composer remained disabled; the live failed-send/retry and slow agent-switch interaction could not be driven in-browser. Those state transitions are instead covered by the focused merge tests and explicit mutation/fetch request-key guards.
- Per the phase-boundary decision, SSE (B2) and variable-height history virtualization (B5) remain separate, explicitly scoped follow-ons rather than partial implementations in this pass.
