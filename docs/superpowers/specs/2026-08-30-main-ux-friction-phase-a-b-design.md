# apps/main UX Friction Fixes — Phase A (implement now) & Phase B (plan only)

## Context

This spec follows on from the visual-alignment work in
`2026-08-30-main-ui-saas-alignment-design.md` (bringing apps/main's chrome to
apps/landing's restrained B2B look). That pass covers global tokens/components;
it does not touch the page-specific structural/UX bugs below. This spec covers
those, split into two phases the user wants kept separate:

- **Phase A** (implemented in this pass): responsiveness bugs, integrations
  page reorganization, the brain page's broken sticky footer, and a visual
  restyle of the community/feedback page.
- **Phase B** (plan only, not implemented yet): chat message reliability
  (messages vanishing until refresh), and broader frontend/backend performance
  work (dashboard over-fetching, auth session fetch duplication, chat history
  virtualization, memoization). Phase B gets its own detailed design + saved
  plan doc when the user says to start it — real SSE token streaming
  specifically needs its own dedicated brainstorming session given it touches
  6 agent services across Express and FastAPI.

Research for both phases was done via 5 parallel codebase surveys; findings
are folded into the sections below with exact file:line references.

---

## Phase A

### A1. Brain page responsiveness

**Files:** `apps/main/src/app/(dashboard)/brain/page.tsx`,
`apps/main/src/components/brain/BrandKitSection.tsx`,
`apps/main/src/components/ui/tabs.tsx`

**Problem:** The 8-tab `TabsList` (Identity, Audience, Voice & Tone, Visual,
Assets, Competitive, Site Context, Brand Images —
`BrandKitSection.tsx:184-218`) has no `overflow-x-auto` wrapper and no
responsive breakpoints. On narrow viewports it either overflows the page
horizontally or crushes labels. The rest of the page (banners, footer) is
built with raw inline `style={{}}` objects with hardcoded pixel padding —
zero breakpoint logic anywhere.

**Fix:**
- Wrap the `TabsList` in a horizontally-scrollable container: `overflow-x-auto
  flex-nowrap` with `-webkit-overflow-scrolling: touch`, no wrap-to-multiple-rows
  (avoids reflow jank), each `TabsTrigger` keeps `flex-shrink-0` so labels
  don't crush.
- Convert the banners (`backendUnavailable`, `seededHint`, `isEmpty` —
  `page.tsx:303-372`) from inline `style={{}}` to Tailwind classes with
  `sm:`/`md:` breakpoints for padding/font-size, matching the pattern already
  used in `apps/main/src/app/(onboarding)/onboarding/layout.tsx:73`
  (`sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 ...
  px-5 py-4 sm:px-8 sm:py-5`).

### A2. Brain page sticky footer removal

**Files:** `apps/main/src/app/(dashboard)/brain/page.tsx:389-436`

**Problem:** The "Save brain" / "Changes auto-saved" bar is `position: fixed;
bottom: 0; left: 0; right: 0; z-index: 40`, spanning the full viewport width
rather than being scoped to the content column. The `AppSidebar`'s desktop
container (with the org avatar / username / logout button in its
`SidebarFooter`, `AppSidebar.tsx:314-400`) is `fixed inset-y-0 z-10 left-0`.
Because the brain footer's z-index (40) beats the sidebar's (10) and it spans
`left:0`, it paints over the sidebar's bottom-left avatar/logout area on every
tab, on any ≥768px viewport.

**Fix:**
- Delete the fixed/full-width footer entirely.
- Add an inline save-status row rendered inside the page's normal flow, below
  the tab content (inside `BrandKitSection.tsx`'s tab body wrapper or directly
  under the `Tabs` component in `page.tsx`, whichever keeps it simplest) —
  ordinary `Card`/border styling, `flex items-center justify-between gap-3
  flex-wrap`, containing the "Save brain" button and the "Changes auto-saved"
  text/indicator. It scrolls with the page and never overlaps the sidebar
  because it's not `position: fixed`.
- Since it's rendered once at the page level (like the current footer), it
  naturally still appears under every tab ("each step") without duplicating
  it per-tab.

### A3. Maya top-up button hidden on narrow viewports

**File:** `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx:1209-1218,
1347-1397`

**Problem:** The Maya tab bar row (`Chat` / `Published Posts` / `Content
Plan` tabs + `MayaCreditsPill` + `MayaTopUpButton`, right-aligned via
`marginLeft: "auto"`) has no `flexWrap` and sits inside a parent with
`overflow: "hidden"` (line 1216). On narrow widths the rightmost element —
the top-up button — gets clipped instead of wrapping or scrolling.

**Fix:** Add `flexWrap: "wrap"` (or convert to Tailwind `flex flex-wrap
items-center gap-2`) to the row at `page.tsx:1348`, and let the trailing
`MayaCreditsPill` + `MayaTopUpButton` cluster (currently
`marginLeft: "auto"`) drop to its own line when the tab buttons don't leave
room, instead of being clipped by the ancestor's `overflow: hidden`. Same
pattern is reused for Lex/Sage/Rex tab bars (lines 1227, 1264, 1301) but only
Maya's row currently overflows because only it has the extra trailing
content — apply the same `flex-wrap` fix to all four for consistency while
touching this code.

### A4. Spot-check pass (targeted, not a full audit)

At mobile (~375px), tablet (~768px), and desktop widths, check: dashboard,
the chat/assistants shell (message list + input + tab bars for all agents),
integrations, settings, and billing pages. Fix any clipped/overflowing
elements found using the same techniques as above (wrap, scroll containers,
Tailwind breakpoints) — this is not a systematic line-by-line audit of the
whole app, just these six areas plus anything visibly broken while working
through A1-A3.

### A5. Integrations page reorganization

**File:** `apps/main/src/app/(dashboard)/settings/integrations/page.tsx`

**Current order:** PageHeader → SettingsNav → heading → `LEGACY_INTEGRATIONS`
grid (Twitter/LinkedIn) → `ApprovalPolicySection` (Tool Permission) →
"1000+ more, via Composio" heading + search/filter + full catalog grid. Legacy
and catalog tools are listed together, not grouped by connection state.

**Fixes:**
1. **Group by connection state.** The page already computes
   `connectedMcpSlugs` (a `Set<string>`, `page.tsx:200-203`) and
   `accountByPlatform` (`page.tsx:194-198`) from the existing
   `useMcpConnections()` / `useIntegrations()` hooks — no new data fetching
   needed. Partition the merged `LEGACY_INTEGRATIONS` + `filteredCatalog`
   list into two rendered sections using these existing lookups:
   - **"Connected"** section first — any legacy account present, or any
     catalog entry in `connectedMcpSlugs`.
   - **"Not connected"** section below it — everything else, keeping the
     existing search/category filter UI scoped to this section.
2. **Tool Permission "*" display.** Research found this is already handled
   correctly — `ApprovalPolicySection.tsx:117-119` and `:145` both render
   `"*"` as "Every tool", never the raw asterisk. During implementation,
   grep for any other raw `"*"` render in this section and fix if found; no
   change expected here beyond verification.
3. **Remove the Composio branding line.** Replace `page.tsx:262-265`:
   ```tsx
   <h2 className="text-sm font-semibold text-foreground">1000+ more, via Composio</h2>
   <p ...>Browse the full catalog and connect the tools each agent needs.</p>
   ```
   with neutral copy, e.g. `"More integrations"` / `"Browse and connect the
   tools your agents can use."` (exact wording can be adjusted during
   implementation to match nearby copy tone). No other customer-visible
   Composio text exists in `apps/main` — the only other occurrences are code
   comments and a vendor logo `<img src>` URL (`logos.composio.dev`), which
   is not rendered text and out of scope here.

### A6. Community/feedback page restyle (visual only, no structural change)

**File:** `apps/main/src/app/(dashboard)/feedback/page.tsx` (617 lines, all
sections defined inline: `AgentDetailDialog`, `UpcomingAgentsSection`,
`FeedbackCard`)

**Problem:** This page never received the soft-shadow/hairline design-system
migration that `settings/billing` and `dashboard` already have. It
reimplements a competing "hard shadow" look throughout — `border-[3px]
border-foreground` + `shadow-[Npx_Npx_0_var(--foreground)]` on ~15 elements
(cards, buttons, badges, search box, sort control) — plus three separate
independently-colored badge systems (`CATEGORY_COLORS`, `AGENT_COLORS`,
`STATUS_CONFIG`) using saturated agent brand hexes directly as pill
backgrounds, and three stacked filter rows before any content
(`page.tsx:450-559`).

**Fix (restyle only — same sections, same features, same data):**
1. Replace hard-shadow cards/containers with `Card variant="brand"`
   (`components/ui/card.tsx` — hairline border + `--vq-shadow`, already used
   by `settings/billing` and `dashboard`).
2. Replace ad-hoc bordered/shadowed buttons with the standard `Button`
   component and its existing variants (no page-local button styling).
3. Consolidate the three filter rows (category tabs / agent-slug pills /
   sort+search+submit) into a single, tighter control area — e.g. category
   tabs + a compact agent filter (`Select` or condensed pill row) on one
   line, sort/search/submit on a second line, instead of three full-width
   strips. Keep all existing filter functionality (category, agent, sort,
   search, submit) — just reduce the chrome.
4. Replace the three independent brand-hex badge systems on `FeedbackCard`
   with the shared `Badge` component using a restrained, consistent palette
   (muted backgrounds, not saturated brand fills) so category/agent/status
   read as one coherent row instead of three competing labels.
5. `UpcomingAgentsSection`'s voting card grid: apply the same `Card
   variant="brand"` treatment for consistency with the rest of the page.
6. No changes to data fetching, voting logic, submit flow, or the
   `SubmitFeedbackDrawer` — this is styling only.

---

## Phase B (plan only — not implemented in this pass)

Detailed design + its own saved plan doc happen when the user says to start
Phase B. Findings from research are captured here so that future design work
doesn't need to re-discover them.

### B1. Chat messages vanish until refresh — root cause (quick fix candidate)

Two distinct, compounding bugs in
`apps/main/src/app/(dashboard)/assistants/[id]/page.tsx` and
`apps/main/src/lib/api/assistants.ts`:

- **On AI/send error:** the server (`lex.service.ts:41-114` and the
  equivalent in sage/maya/scout/rex/vega) persists the user's message to
  Postgres *before* calling the AI, with no try/catch around the AI call —
  so an AI failure still leaves the message safely saved, but the whole HTTP
  request rejects with a generic 500. The client's `useSendMessage.onError`
  (`assistants.ts:369-371`) responds by **deleting** the optimistic message
  from `msgWindow` outright, even though it's already in the DB. A refresh
  re-fetches and it reappears — hence "vanishes until refresh."
- **Without any error:** several effects in `page.tsx` (initial mount
  refresh 443-457, orphaned-mutation catch-up 585-606, visibility-change
  handler 611-626, belt-and-suspenders catch-up 631-642) call `getMessages()`
  and then `setMsgWindow(msgs)` as an **unconditional flat overwrite**, with
  no request-guarding (no abort/ignore-flag). If one of these resolves after
  an optimistic append but with a stale server snapshot, it silently wipes
  the just-sent message from view.

**Proposed quick fix (no streaming required):** don't delete the optimistic
message on error — mark it "failed to send" and keep it visible with a retry
affordance; and change the overwrite effects to merge against current state
(or guard with an abort/ignore-flag keyed to the active agent id) instead of
flat-replacing. This alone should eliminate the reported symptom and can land
independently of the larger streaming work.

### B2. Real token streaming (SSE)

No SSE/WebSocket exists anywhere in the stack today (`apps/server`,
`apps/ai`, `apps/main` all confirmed clean of `EventSource`/`WebSocket`/
`text/event-stream`). All 6 agents (lex, sage, maya, scout, rex, vega) follow
the same synchronous request/response pattern end-to-end (Node → FastAPI →
single JSON response). Introducing real streaming means deciding: Express
relays a stream from FastAPI vs. FastAPI streams directly and Node passes it
through; a structured `error` event distinct from a normal stream end; and
touching all 6 agent services + their FastAPI counterparts consistently.
This needs its own dedicated brainstorming/spec session — flagged here only
so the scope is visible up front.

### B3. Dashboard over-fetching

`useDashboardSummary` (`apps/main/src/lib/api/dashboard.ts`,
`apps/server/src/modules/dashboard/dashboard.service.ts:26-60`) returns
`recentActivity` (2 DB queries, up to 20 entries) and `attention`, neither of
which `dashboard/page.tsx` consumes. Also sets `refetchOnMount: "always"`, so
it refetches every time the dashboard is navigated back to regardless of
staleness. `IntegrationHealth.tsx` fires two separate requests
(`useIntegrations` + `useMcpConnections`) for one widget.

### B4. Chat-agent-switch stale-data race

The message-list `useEffect` in `page.tsx` (421-458) has no cleanup/abort
guard. Switching agents quickly (maya → rex → maya) can let a slow-resolving
fetch from a previous agent land after the switch and overwrite the current
agent's messages with stale data — same unguarded-overwrite pattern as B1.

### B5. Chat history — no virtualization

Pagination and scroll-anchor-preservation on "load older messages" are
already correctly implemented (`page.tsx:468-481`, `648-669`). However there
is no virtualization (no react-window/react-virtual anywhere in the repo),
and the message window is never trimmed after prepending older pages —
long-lived conversations accumulate an ever-growing unvirtualized DOM list.
Worth virtualizing if this becomes a measured problem; not urgent.

### B6. Auth/session

No middleware; three separate files (`page.tsx`, `(dashboard)/layout.tsx`,
`(onboarding)/layout.tsx`) each call `fetchSession()`
(`server-session.ts:53-69`, `cache: "no-store"`) independently with no
shared request memoization (e.g. React `cache()`). Not excessive in
frequency (only on hard navigation, not on every route change), but
duplicated where a per-request memo would be free.

### B7. General frontend perf hygiene

`React.memo` used in only 3 files (chat message components are already
memoized, which is the important case). `useMemo`/`useCallback` used in
22/10 files respectively out of 256 — sparse, ad hoc. `next/dynamic`
code-splitting used in only 2 places. `next/image` used in 9/25 image-bearing
files. None of this is broken, just underused — worth targeted application
(not a blanket pass) once Phase B is scoped, focused on the heaviest
components (e.g. the 1606-line chat page and its modals).

---

## Implementation note

Per user direction, Phase A is implemented directly from this spec — no
separate implementation-plan document. Work proceeds in the order A1 → A6
above; each area is a self-contained file-level change and can be verified
independently (visual check in browser at multiple widths for A1-A4, A6;
functional check for A5).
