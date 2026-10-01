# Workspace Polish — Responsive, Navigation, Chat Placement, Integrations, Theme, Crash Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No git steps.** The owner runs all git operations themselves. Never `git add` / `commit` / `push` from this plan.

**Goal:** Make everything reached from `/assistants` onward (employee directory, agent workspaces, chat dock, dialogs, team room) work on phones, tablets and desktops in light and dark; give it clear navigation in and out; let the customer put chat where they want it; show real coloured integration logos inside each agent; and fix the header button that crashes the page.

**Architecture:** Nothing here changes data models or server code. The work is confined to `apps/main`: (1) one-line root-cause fix plus error boundaries for the crash; (2) a small pure "chat layout" module + provider changes so chat can be docked, resized, expanded to a full page, or (on small screens) reached as a page — without ever clobbering the `[agent]` layout's state-preservation rules; (3) a restructured workspace header with a "console" exit menu and a single employee switcher; (4) global dialog/sheet fixes plus a per-surface responsive pass; (5) reuse of the Settings integration cards inside the workspace; (6) a token sweep of hardcoded colours.

**Tech Stack:** Next.js 16.2.1 (App Router — **not** the Next.js you know, see constraints), React 19.2, Tailwind v4, Base UI (`@base-ui/react`) wrapped by `components/ui/*`, next-themes, TanStack Query, `node:test` run through `tsx` for pure-logic tests.

**Spec:** None separate — the request (six numbered items) is restated in "Requirements" below and this plan is the design.

## Requirements (the six asks, verbatim intent)

1. Everything from "Assistants" in the sidebar onward — each page, section, dialog, popup — is responsive and smooth on mobile. Pages outside the new layout were already responsive and must not regress.
2. Standard, friendly navigation: choose an agent → its sidebar/modules → chat with its tools/dialogs; always a clear way back to Dashboard, other console pages, and organization switching.
3. Integrations inside each agent (e.g. `/workspace/lex/integrations`) show the same real coloured logos as `/settings/integrations`.
4. All pages adapt to Light / Dark / System with no mismatches.
5. The unlabeled icon beside the theme and chat toggles always shows "Something went sideways." — fix it and make its purpose obvious.
6. Chat currently only opens as a thin right column; the customer needs a proper way to open it in the main area, "like it used to be".

## Global Constraints

- **Next.js 16 has breaking changes.** `apps/main/AGENTS.md` says to read `node_modules/next/dist/docs/` before writing route files. Before Task 2 (error.tsx) read `01-app` docs for `error.tsx`; do not rely on memory.
- **`[agent]` layout state rule** (`app/(workspace)/workspace/[agent]/layout.tsx`, `WorkspaceChatProvider.tsx`): never add `loading.tsx` / `template.tsx` at or above the `[agent]` level, never a changing `key` above the providers, never move the providers into a page. An `error.tsx` at the `[agent]` level is allowed (it sits *inside* the layout).
- **No agent slug literals** in `lib/workspace/{registry,modules,types}.ts`, `ModuleHost.tsx`, `ModuleNav.tsx`, `WorkspaceShell.tsx` (enforced by `scripts/check-workspace-invariants.mjs`).
- **Design system** (`docs/design/veqiro-console-design-system.md`): tokens only (`--background`, `--card`, `--muted`, `--vq-line-2`, `--vq-r*`), no raw hex in new code, no nested cards, radii 8/12/16, **every change ships light and dark together**.
- **Tailwind v4 syntax** as used in the repo: `border-(--vq-line-2)`, `rounded-[var(--vq-r)]`. Base UI primitives use the `render={...}` prop, not Radix `asChild`, in `components/ui/dropdown-menu.tsx` / `sheet.tsx` / `dialog.tsx`.
- **Breakpoints in use:** `sm` 640, `md` 768 (module rail appears), `lg` 1024, `xl` 1280.
- **Verification commands** (run from `apps/main`): `npx tsc --noEmit`, `pnpm lint` (eslint + invariants), `npx tsx --test src/lib/workspace/<file>.test.ts`, `pnpm build` at the end of each phase.
- **Scope discipline:** bugs found outside the six asks are listed under "Found outside the ask" and are **not** in any task until the owner signs off.

## Review Focus

Failure modes the requests imply but a happy-path test would miss, most likely first:

1. **Draft loss** — typing in the composer, then expanding chat to a page / collapsing it / resizing it / switching module must keep the draft, scroll position and any in-flight stream (Task 4 tests + manual matrix).
2. **Dock closed preference silently overwritten** — visiting the Chat page must not flip the customer's saved "dock open" preference to closed (today `ChatModule` does exactly this).
3. **Chat history not loading on the Chat page** — direct landing on `/workspace/x/chat` (phone, refresh, shared link) must load history (today the initial fetch is aborted by the same effect).
4. **"Open chat" actions dead on small screens** — `sendPrompt`, `lex:ask-about`, and prompt-action submit call `setDockOpen(true)` on a viewport where the dock is not rendered; the customer sees nothing happen.
5. **localStorage unavailable / corrupt** (private mode, blocked site data, garbage width value) — dock width and open state must degrade to defaults, never throw.

---

## What I found (evidence, so you can check my reading)

| # | Finding | Where |
|---|---------|-------|
| 5 | **Root cause of the crash.** The "extra icon" is the employee switcher (`ChevronsUpDown`) in the workspace header. Opening it renders `<DropdownMenuLabel>` (Base UI `Menu.GroupLabel`) **outside** a `<DropdownMenuGroup>`. Base UI throws `MenuGroupRootContext is missing. Menu group parts must be used within <Menu.Group>` (verified in `@base-ui/react@1.3.0` `menu/group/MenuGroupContext.js`). There is no error boundary under `(workspace)`, so the throw reaches `app/error.tsx` — "Something went sideways." replaces the whole page. It is the only `DropdownMenuLabel` call site. | `components/workspace/AgentSwitcher.tsx:55` |
| 5 | Its purpose (switch between employees, with a "needs you" count per employee, plus Team room) is real but the icon has no label, so it reads as a mystery control. | `AgentSwitcher.tsx` |
| 6 | Chat exists only as a 360/400px right dock, visible from `lg`. A full-width Chat module exists (`/workspace/[agent]/chat`) but is `hiddenInNav` and the only link to it is a header icon that is `lg:hidden`. **On desktop there is no way to open chat in the main area.** | `modules.ts`/`registry.ts` (`hiddenInNav: id==="chat"`), `WorkspaceShell.tsx:92` |
| 6 | `ChatModule` calls `setDockOpen(false)` on mount → (a) persists `"0"` to localStorage so the dock stays closed on every later visit; (b) flips `active` in `useAgentChat`, whose effect **aborts the initial history fetch** (`use-agent-chat.ts:105-159`), so landing directly on `/chat` can show an empty thread. | `ChatModule.tsx`, `WorkspaceChatProvider.tsx:67` |
| 6 | `ChatModule` sizes itself with `h-[calc(100%+2.5rem)]` inside an auto-height wrapper, so the percentage cannot resolve and the composer will not pin to the bottom. (Reasoned from the CSS — confirm in browser at step 3.1.) | `ChatModule.tsx:24`, `WorkspaceShell.tsx:108` |
| 6 | Below `lg` the dock is `hidden`, but `sendPrompt` / `lex:ask-about` / prompt-action submit call `setDockOpen(true)`. On phones/tablets these do nothing visible. | `WorkspaceChatProvider.tsx`, `WorkspaceDialogs.tsx:120` |
| 1 | At `lg` (1024–1279) the module rail (208px) **and** dock (360px) are both shown → module content gets ~456px. Tablet-landscape / small-laptop is cramped. | `WorkspaceShell.tsx:113-121`, `ModuleNav.tsx:21` |
| 1 | `DialogContent` has no max-height / scroll. 11 dialogs (publish, schedule, top-up, delegate, prompt-action, tools menu, video template, connect-integration, trial gate, create org, settings dialogs) can exceed a phone viewport and be uncloseable/unsubmittable. `ActionDialog` and 4 others already cap themselves. | `components/ui/dialog.tsx:49` |
| 1 | Header on a 360px phone carries ☰, back, avatar, name, Maya's credits pill + top-up, switcher, chat, theme = overflow for Maya. | `WorkspaceShell.tsx:34-99` |
| 1 | `ApprovalsModule` says "Review in chat" with no link; on phones chat is a separate page. | `SimpleModules.tsx:56` |
| 1 | Work-type tabs are a non-scrolling `flex` row. Shell uses `h-svh`; soft keyboards want `dvh`. `MemoryGraph` sets `touchAction: "none"` (traps vertical page scroll on touch). | `WorkModule.tsx:56`, `WorkspaceShell.tsx:33`, `MemoryGraph.tsx:155` |
| 2 | Only exit from a workspace is "← Employees". No route to Dashboard, Tasks, Brain, Settings, Community, or organization switching without going out first. The Team-room page has the same single exit. | `WorkspaceShell.tsx:40-50`, `assistants/team/page.tsx` |
| 3 | `IntegrationsModule` renders a generic `Plug` icon, ignores real logos, and only knows MCP connections — X/LinkedIn (native OAuth, `LEGACY_MCP_SLUGS`) show "Soon"/wrong state. "Connect" links away to `/settings/integrations`. | `SimpleModules.tsx:72-105` |
| 4 | Hardcoded light-only colours in surfaces rendered inside workspaces: `bg-white` card, `bg-green-50/red-50/blue-50/gray-50/yellow-50` status pills without `dark:`, `#000000` platform dot (invisible on dark), `hover:bg-black/[0.06]`. Worst files: `agents/maya/published-posts-tab.tsx` (18), `gallery-tab.tsx` (15), `rex/forms.tsx` (7), `maya/cards.tsx` (6), `rex/data-tab.tsx`, `rex/cards.tsx`, `lex/cards.tsx`. Also black brand logos (X, GitHub-style SVGs) vanish on dark backgrounds. | see Task 12 |
| — | `apps/server`: **no change required** for any of the six items (dock/theme/layout prefs are per-browser; integration state already comes from existing endpoints). | — |
| — | I could not load the app in a browser from this session (dev server on :3001 refused the browser connection), so responsiveness findings are from code. Task 8 turns this into a device-width matrix run before/after. | — |

## File Structure

**Create**
- `src/lib/workspace/chat-layout.ts` — pure: dock placement by viewport, width clamping, constants.
- `src/lib/workspace/chat-layout.test.ts` — `node:test` for the above.
- `src/lib/workspace/use-dock-placement.ts` — `useSyncExternalStore` hook returning `"none" | "overlay" | "inline"`.
- `src/components/workspace/chat/DockResizeHandle.tsx` — drag/keyboard resize separator.
- `src/components/workspace/ConsoleMenu.tsx` — exit menu: console pages + organization switcher.
- `src/lib/config/console-nav.ts` — the console nav items shared by `AppSidebar` and the workspace.
- `src/lib/hooks/use-org-switcher.ts` — extracted from `AppSidebar` (switch/create org state).
- `src/components/integrations/IntegrationLogo.tsx` — logo component moved out of the card file.
- `src/components/integrations/LegacyIntegrationCard.tsx` — X/LinkedIn native card moved out of the settings page.
- `src/app/(workspace)/error.tsx`, `src/app/(workspace)/workspace/[agent]/error.tsx` — workspace error boundaries.

**Modify**
- `components/workspace/AgentSwitcher.tsx`, `WorkspaceShell.tsx`, `WorkspaceMobileNav.tsx`, `WorkspaceChatProvider.tsx`, `WorkspaceDialogs.tsx`, `ModuleNav.tsx`, `chat/ChatDock.tsx`, `modules/ChatModule.tsx`, `modules/SimpleModules.tsx`, `modules/WorkModule.tsx`, `modules/MemoryGraph.tsx`
- `lib/workspace/dock-store.ts`, `lib/workspace/modules.ts`, `lib/workspace/registry.ts`
- `components/layout/AppSidebar.tsx`, `components/ui/dialog.tsx`
- `components/integrations/IntegrationCatalogCard.tsx`, `app/(dashboard)/settings/integrations/page.tsx`
- `app/(workspace)/assistants/team/page.tsx`
- Theme sweep files listed in Task 12.

---

# Phase A — Stop the crash (item 5)

### Task 1: Fix the switcher crash and label the control

**Files:**
- Modify: `apps/main/src/components/workspace/AgentSwitcher.tsx`

**Interfaces:**
- Produces: `AgentSwitcher({ subtitle }: { subtitle: string })`. Trigger becomes the employee identity block (avatar + name + chevron) so the "mystery icon" is now a labelled control. Task 7 relies on this: the identity block **is** the switcher on every screen size.

- [ ] **Step 1: Reproduce.** Run `pnpm dev`, open `/workspace/lex/overview`, click the `ChevronsUpDown` icon. Expected before fix: "Something went sideways."; console shows `Base UI: MenuGroupRootContext is missing`.
- [ ] **Step 2: Wrap the label in a group and merge the trigger with the identity block.** In `AgentSwitcher.tsx` add `DropdownMenuGroup` to the imports and change the content and trigger:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
```

Trigger (replaces the current icon `Button`; it now shows who you are working with):

```tsx
<DropdownMenuTrigger
  render={
    <button
      type="button"
      aria-label={`Switch employee — currently ${config.name}`}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--vq-r-sm)] px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  }
>
  <span
    className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border"
    style={{ background: config.color }}
  >
    {AGENT_PHOTOS[agent] ? (
      <Image src={AGENT_PHOTOS[agent]} alt="" fill sizes="32px" className="object-cover" />
    ) : (
      <span className="grid h-full w-full place-items-center font-head text-[11px] text-white">
        {config.initials}
      </span>
    )}
  </span>
  <span className="min-w-0 flex-1">
    <span className="block truncate font-head text-sm leading-tight">{config.name}</span>
    <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
  </span>
  <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
</DropdownMenuTrigger>
```

`AgentSwitcher` takes `subtitle: string` (Task 7 passes the role on ≥md and `role · module` on phones), and reads `config` from `useAgentWorkspace()` alongside `agent`.

Content — the label **inside** a group:

```tsx
<DropdownMenuContent align="start" className="w-72">
  <DropdownMenuGroup>
    <DropdownMenuLabel>Your employees</DropdownMenuLabel>
    {AGENTS.map((candidate) => { /* unchanged items */ })}
  </DropdownMenuGroup>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={() => router.push("/assistants/team")} className="gap-2.5">
    {/* unchanged Team room item */}
  </DropdownMenuItem>
</DropdownMenuContent>
```

Note `align="start"` and `w-72`: the trigger is now on the left of the header, so the menu must open rightwards, and `w-(--anchor-width)` in the base class must be overridden with an explicit width (it is, by `w-72`).
- [ ] **Step 3: Verify.** `npx tsc --noEmit`; in the browser open the switcher on Lex → items list, current employee disabled, counts show, Team room navigates. Console: no errors.

### Task 2: Error boundaries so one widget can never blank the whole page

**Files:**
- Create: `apps/main/src/app/(workspace)/error.tsx`
- Create: `apps/main/src/app/(workspace)/workspace/[agent]/error.tsx`

**Interfaces:**
- Consumes: Next 16 `error.tsx` contract (**read `node_modules/next/dist/docs/01-app` on error handling first** and match its signature).
- Produces: a recoverable error UI. The `[agent]` one renders **inside** the layout, so the header, module rail and chat dock stay mounted and only the module body shows the error.

- [ ] **Step 1: Read the Next 16 docs** for `error.tsx` props (`error`, `reset`, any new prop names).
- [ ] **Step 2: `[agent]/error.tsx`** — module-level, keeps the shell:

```tsx
"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export default function WorkspaceModuleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-start gap-3">
      <EmptyState
        tone="plain"
        title="This section hit a snag"
        description="The rest of the workspace is fine. Try again, or head back to the overview."
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => reset()}>Try again</Button>
        <Button asChild size="sm" variant="outline">
          <Link href="./overview">Overview</Link>
        </Button>
      </div>
    </div>
  )
}
```

(If `EmptyState` props differ, mirror how `WorkModule.tsx` calls it.)
- [ ] **Step 3: `(workspace)/error.tsx`** — same shape, full-screen (`min-h-svh grid place-items-center p-6`), with buttons "Try again" and a `Link` to `/assistants` labelled "Back to employees". Catches anything the shell itself throws.
- [ ] **Step 4: Prove it.** Temporarily `throw new Error("x")` at the top of `ActivityModule` → the activity body shows the module error while header/rail/dock remain; then temporarily throw in `WorkspaceShell` → the full-screen boundary appears. Remove both throws.
- [ ] **Step 5:** `pnpm lint` (invariants must still pass — an `error.tsx` is not `loading.tsx`/`template.tsx`).

---

# Phase B — Chat placement and chat correctness (item 6)

**Design.** Three ways to have chat, all sharing one thread (state lives in `WorkspaceChatProvider`, so switching between them never loses a draft):

| Mode | When | How you get there |
|------|------|-------------------|
| **Docked** (right column, resizable 320–720px) | `xl` ≥1280: beside the module. `lg` 1024–1279: as an **overlay** on top of the module (no squeezing). | Header "Chat" toggle (unchanged) |
| **Full page** (chat is the main area, module rail still on the left) | any screen | New: **Expand** button in the dock header; **Chat** entry in the module rail; the header chat icon on small screens |
| **Hidden** | any | Dock close button / header toggle |

Below `lg` there is no dock, so chat *is* the Chat page, and every "reveal chat" action navigates there.

### Task 3: Pure chat-layout logic (TDD)

**Files:**
- Create: `apps/main/src/lib/workspace/chat-layout.ts`
- Test: `apps/main/src/lib/workspace/chat-layout.test.ts`

**Interfaces:**
- Produces:
  - `type DockPlacement = "none" | "overlay" | "inline"`
  - `dockPlacement(viewportWidth: number): DockPlacement`
  - `clampDockWidth(width: number, viewportWidth: number): number`
  - `parseStoredWidth(raw: string | null): number | null`
  - constants `DOCK_MIN = 320`, `DOCK_MAX = 720`, `DOCK_DEFAULT = 380`, `RAIL_WIDTH = 208`, `MODULE_MIN = 520`, `OVERLAY_AT = 1024`, `INLINE_AT = 1280`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  DOCK_DEFAULT,
  clampDockWidth,
  dockPlacement,
  parseStoredWidth,
} from "./chat-layout"

test("no dock below lg — chat is a page there", () => {
  assert.equal(dockPlacement(375), "none")
  assert.equal(dockPlacement(1023), "none")
})

test("overlay between lg and xl so the module is not squeezed", () => {
  assert.equal(dockPlacement(1024), "overlay")
  assert.equal(dockPlacement(1279), "overlay")
})

test("inline from xl", () => {
  assert.equal(dockPlacement(1280), "inline")
  assert.equal(dockPlacement(2560), "inline")
})

test("clamp never lets the dock starve the module of 520px next to the 208px rail", () => {
  assert.equal(clampDockWidth(900, 1280), 552) // 1280 - 208 - 520
})

test("clamp enforces the floor and the ceiling", () => {
  assert.equal(clampDockWidth(100, 1920), 320)
  assert.equal(clampDockWidth(5000, 2560), 720)
  assert.equal(clampDockWidth(500, 1920), 500)
})

test("clamp on a viewport too small to honour the module minimum still returns the floor", () => {
  assert.equal(clampDockWidth(500, 1100), 320)
})

test("stored width: garbage, empty and out-of-range values are rejected, not thrown on", () => {
  assert.equal(parseStoredWidth(null), null)
  assert.equal(parseStoredWidth(""), null)
  assert.equal(parseStoredWidth("wide"), null)
  assert.equal(parseStoredWidth("NaN"), null)
  assert.equal(parseStoredWidth("-40"), null)
  assert.equal(parseStoredWidth("450"), 450)
  assert.equal(DOCK_DEFAULT, 380)
})
```

- [ ] **Step 2: Run, expect FAIL** — `cd apps/main && npx tsx --test src/lib/workspace/chat-layout.test.ts` → "Cannot find module ./chat-layout".
- [ ] **Step 3: Implement**

```ts
export type DockPlacement = "none" | "overlay" | "inline"

export const DOCK_MIN = 320
export const DOCK_MAX = 720
export const DOCK_DEFAULT = 380
export const RAIL_WIDTH = 208
export const MODULE_MIN = 520
export const OVERLAY_AT = 1024
export const INLINE_AT = 1280

/**
 * Where the chat dock can live at this viewport width. Below `lg` it cannot
 * (a docked column beside a module is not a phone layout) — chat is the Chat
 * page there. Between `lg` and `xl` it floats over the module instead of
 * squeezing it, because rail + dock would leave ~450px for the work itself.
 */
export function dockPlacement(viewportWidth: number): DockPlacement {
  if (viewportWidth < OVERLAY_AT) return "none"
  if (viewportWidth < INLINE_AT) return "overlay"
  return "inline"
}

export function clampDockWidth(width: number, viewportWidth: number): number {
  const ceiling = Math.min(DOCK_MAX, viewportWidth - RAIL_WIDTH - MODULE_MIN)
  return Math.round(Math.min(Math.max(width, DOCK_MIN), Math.max(ceiling, DOCK_MIN)))
}

export function parseStoredWidth(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
```

- [ ] **Step 4: Run, expect PASS** (same command).

### Task 4: Provider, store and hook changes — chat that survives every mode

**Files:**
- Modify: `apps/main/src/lib/workspace/dock-store.ts`
- Create: `apps/main/src/lib/workspace/use-dock-placement.ts`
- Modify: `apps/main/src/components/workspace/WorkspaceChatProvider.tsx`
- Modify: `apps/main/src/components/workspace/WorkspaceDialogs.tsx`
- Modify: `apps/main/src/components/workspace/modules/ChatModule.tsx`

**Interfaces:**
- Consumes: Task 3 exports.
- Produces (used by Tasks 5, 6):
  - `useDockWidth(): [number, (px: number) => void, (px: number) => void]` → `[width, setWidthLive, commitWidth]` (live = memory + emit; commit = also persist).
  - `useDockPlacement(): DockPlacement`
  - `WorkspaceChatValue` gains `dockVisible: boolean` (open **and** not on the Chat page **and** placement ≠ "none"), `revealChat(): void`, and `expandChat(): void` / `collapseChat(): void`. Existing `dockOpen`, `setDockOpen`, `toggleDock`, `sendPrompt`, `openAction` keep their signatures.

- [ ] **Step 1: Dock width in the store** — add to `dock-store.ts` (same guarded-storage pattern as `read`/`setOpen`; key `vq.workspace.dockWidth`, global not per-agent):

```ts
import { DOCK_DEFAULT, clampDockWidth, parseStoredWidth } from "./chat-layout"

const WIDTH_KEY = "vq.workspace.dockWidth"
let widthMemory: number | null = null

function readWidth(): number {
  if (widthMemory !== null) return widthMemory
  try {
    return parseStoredWidth(localStorage.getItem(WIDTH_KEY)) ?? DOCK_DEFAULT
  } catch {
    return DOCK_DEFAULT
  }
}

export function useDockWidth(): [number, (px: number) => void, (px: number) => void] {
  const width = useSyncExternalStore(subscribe, readWidth, () => DOCK_DEFAULT)
  const setLive = useCallback((px: number) => {
    widthMemory = clampDockWidth(px, window.innerWidth)
    emit()
  }, [])
  const commit = useCallback((px: number) => {
    widthMemory = clampDockWidth(px, window.innerWidth)
    try {
      localStorage.setItem(WIDTH_KEY, String(widthMemory))
    } catch {
      /* session-only */
    }
    emit()
  }, [])
  return [width, setLive, commit]
}
```

Also change `read(agent)`'s "no preference yet" default from `true` to `window.innerWidth >= INLINE_AT` (import `INLINE_AT`) so a first-time visitor on a small laptop is not greeted by an overlay covering their module; the SSR snapshot stays `true` (unchanged).
- [ ] **Step 2: `use-dock-placement.ts`**

```ts
"use client"

import { useSyncExternalStore } from "react"
import { dockPlacement, type DockPlacement } from "./chat-layout"

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb)
  return () => window.removeEventListener("resize", cb)
}

/** Logic only — layout itself stays in CSS classes so there is no hydration flash. */
export function useDockPlacement(): DockPlacement {
  return useSyncExternalStore(
    subscribe,
    () => dockPlacement(window.innerWidth),
    () => "inline",
  )
}
```

- [ ] **Step 3: Provider.** In `WorkspaceChatProvider.tsx`:
  1. Pull `activeModule`, `hrefFor` from `useAgentWorkspace()`; `const placement = useDockPlacement()`.
  2. Replace the `active` gate so it reflects "the thread can actually be seen":

```ts
const onChatPage = activeModule === "chat"
const dockVisible = dockOpen && !onChatPage && placement !== "none"
const chat = useAgentChat(agent, organizationId, config.name, {
  active: onChatPage || dockVisible,
})
```

  3. Add navigation helpers and make every "show the thread" path go through `revealChat`:

```ts
const revealChat = useCallback(() => {
  if (onChatPage) return
  if (placement === "none") router.push(hrefFor("chat"))
  else setDockOpen(true)
}, [onChatPage, placement, router, hrefFor, setDockOpen])

// Remember where "Dock it again" should return to.
const lastModuleRef = useRef<string>("overview")
useEffect(() => {
  if (activeModule !== "chat") lastModuleRef.current = activeModule
}, [activeModule])

const expandChat = useCallback(() => router.push(hrefFor("chat")), [router, hrefFor])
const collapseChat = useCallback(() => {
  setDockOpen(true)
  router.push(hrefFor(lastModuleRef.current as ModuleId))
}, [router, hrefFor, setDockOpen])
```

  4. `sendPrompt` → `setContent(prompt); revealChat()`. In `openAction`'s `lex:ask-about` branch replace `setDockOpen(true)` with `revealChat()`. (`ModuleId` from `@/lib/workspace/types`.)
  5. Add `dockVisible`, `revealChat`, `expandChat`, `collapseChat` to the context value/type and memo deps.
- [ ] **Step 4: `WorkspaceDialogs.tsx`** — take `revealChat` from `useWorkspaceChat()` instead of `setDockOpen`; in the prompt-action `onSubmit` call `revealChat()` before `chat.sendText(prompt)`. In `handleActionComplete`, when the dock is not visible make the success toast actionable so phone users can see the result card they just created:

```ts
toast.success(meta ? `${meta.label} complete.` : "Action complete.", {
  action: dockVisible || onChatPage ? undefined : { label: "View in chat", onClick: revealChat },
})
```

(add `dockVisible`, `activeModule === "chat"` and `revealChat` from the hooks and to the callback deps).
- [ ] **Step 5: `ChatModule.tsx`** — delete the `useEffect(() => setDockOpen(false))` entirely (the shell hides the dock by deriving `dockVisible`, so the saved preference is untouched). Replace the negative-margin/percentage-height wrapper with a plain `<ChatDock fullBleed />`; Task 6 makes the shell give this route a full-height, padding-free container.
- [ ] **Step 6: Verify the three Review-Focus regressions** by hand: (a) with the dock open, visit Chat, go back to Overview → dock is still open; (b) hard-refresh on `/workspace/lex/chat` → history loads; (c) at 375px trigger "Ask about this document" (Lex) → lands on the Chat page with the document attached and prompt pre-filled. `npx tsc --noEmit`, `pnpm lint`.

### Task 5: Dock UI — resize, expand, close, overlay

**Files:**
- Create: `apps/main/src/components/workspace/chat/DockResizeHandle.tsx`
- Modify: `apps/main/src/components/workspace/chat/ChatDock.tsx`
- Modify: `apps/main/src/components/workspace/WorkspaceShell.tsx` (aside only; header is Task 7)

**Interfaces:**
- Consumes: `useDockWidth`, `useWorkspaceChat().{dockVisible, expandChat, collapseChat, setDockOpen}`.
- Produces: `DockResizeHandle()` (no props); `ChatDock` header gains buttons.

- [ ] **Step 1: `DockResizeHandle.tsx`** — an accessible vertical separator on the dock's left edge:

```tsx
"use client"

import { useRef } from "react"
import { DOCK_DEFAULT } from "@/lib/workspace/chat-layout"
import { useDockWidth } from "@/lib/workspace/dock-store"

export function DockResizeHandle() {
  const [width, setLive, commit] = useDockWidth()
  const drag = useRef<{ startX: number; startW: number } | null>(null)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat"
      aria-valuenow={width}
      tabIndex={0}
      className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize touch-none xl:block hover:bg-ring/30 focus-visible:bg-ring/50 focus-visible:outline-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { startX: e.clientX, startW: width }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        // The dock is on the right: dragging left widens it.
        setLive(drag.current.startW + (drag.current.startX - e.clientX))
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        commit(drag.current.startW + (drag.current.startX - e.clientX))
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onDoubleClick={() => commit(DOCK_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); commit(width + 24) }
        if (e.key === "ArrowRight") { e.preventDefault(); commit(width - 24) }
        if (e.key === "Home") { e.preventDefault(); commit(DOCK_DEFAULT) }
      }}
    />
  )
}
```

  (Resize only at `xl`, where the dock is inline; the overlay uses a fixed comfortable width.)
- [ ] **Step 2: `ChatDock` header.** Replace the static "Chat" label row with title + actions, shown only when docked (`!fullBleed`); in `fullBleed` (page) mode show a "Dock" button instead of "Expand":

```tsx
<div className="flex shrink-0 items-center gap-1 border-b border-(--vq-line-2) px-3 py-2">
  <span className="truncate text-xs font-medium text-muted-foreground">
    Chat with {config.name}
  </span>
  <span className="flex-1" />
  {spec.chatHeaderExtras?.map(/* unchanged */)}
  {fullBleed ? (
    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={collapseChat}>
      <PanelRight className="size-4" /><span className="hidden sm:inline">Dock chat</span>
    </Button>
  ) : (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Open chat full screen" title="Open chat full screen" onClick={expandChat}>
        <Maximize2 className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Close chat" title="Close chat" onClick={() => setDockOpen(false)}>
        <X className="size-4" />
      </Button>
    </>
  )}
</div>
```

  Imports: `Maximize2, PanelRight, X` from `lucide-react`, `Button`. On the page (`fullBleed`), constrain the thread and composer to a readable column: wrap the scroll content and the composer in `mx-auto w-full max-w-3xl` (the scroll *container* stays full width so the scrollbar is at the window edge).
- [ ] **Step 3: Shell aside.** Replace the `<aside>` in `WorkspaceShell.tsx`:

```tsx
const { dockVisible } = useWorkspaceChat()
const [dockWidth] = useDockWidth()
...
<div className="relative flex min-h-0 flex-1">
  <ModuleNav />
  <main ...>{children}</main>

  {dockVisible && (
    <aside
      aria-label="Chat"
      className={cn(
        "hidden min-h-0 border-l border-(--vq-line-2) bg-card lg:flex",
        // lg–xl: float over the module. xl+: sit beside it at the chosen width.
        "absolute inset-y-0 right-0 z-30 w-[400px] max-w-[92vw] shadow-[var(--vq-shadow-lg)]",
        "xl:relative xl:inset-auto xl:z-auto xl:max-w-none xl:shrink-0 xl:shadow-none",
      )}
      style={{ ["--dock-w" as string]: `${dockWidth}px` }}
    >
      <DockResizeHandle />
      <ChatDock />
    </aside>
  )}
</div>
```

  and give the `xl` width through a class that reads the variable: `xl:w-(--dock-w)`. Remove the old `dockOpen ? "w-[360px]…" : "w-0…"` / `aria-hidden` logic — the aside is simply not rendered when hidden (it was `w-0` before, which kept an invisible focusable subtree).
- [ ] **Step 4: Overlay dismissal.** In overlay mode (lg–xl) add Escape-to-close: a `useEffect` in the shell that, only when `placement === "overlay" && dockVisible`, listens for `keydown` Escape → `setDockOpen(false)`.
- [ ] **Step 5: Verify** at 1440, 1280, 1100 widths: docked/resized/persisted across reload; overlay does not squeeze the module at 1100; Expand → full page with the same draft; Dock chat → returns to the module you came from with the dock open. `pnpm lint`.

### Task 6: Chat page layout, and Chat in the module rail

**Files:**
- Modify: `apps/main/src/components/workspace/WorkspaceShell.tsx` (`<main>`)
- Modify: `apps/main/src/lib/workspace/modules.ts`, `apps/main/src/lib/workspace/registry.ts`

- [ ] **Step 1: `main` gets a chat variant.** In the shell derive `const onChatPage = activeModule === "chat"` (`useAgentWorkspace()`), and render:

```tsx
<main className={cn("min-w-0 flex-1", onChatPage ? "flex min-h-0 flex-col overflow-hidden" : "overflow-y-auto")}>
  {onChatPage ? (
    children
  ) : (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">{children}</div>
  )}
</main>
```

  and `ChatModule` returns `<div className="flex min-h-0 flex-1 flex-col"><ChatDock fullBleed /></div>` so `ChatDock`'s `h-full` chain resolves against a definite flex height (this is the real fix for the un-pinned composer).
- [ ] **Step 2: Chat in the rail.** In `registry.ts` change `hiddenInNav: override?.hiddenInNav ?? id === "chat"` to `override?.hiddenInNav ?? false`, and update its comment (the dock is one way in; the page is another). In `modules.ts` move `"chat"` to directly after `"overview"` in `MODULE_ORDER` and update the ordering comment ("outcome first, then chat as the always-available way to ask…"). Grep for tests or code depending on the old order: `grep -rn "MODULE_ORDER" src` and fix any.
- [ ] **Step 3: Verify** on Chat page: composer pinned at the bottom, thread scrolls, "scroll to latest" button visible, works at 375 with mobile keyboard (Task 7 switches the shell to `h-dvh`). Rail highlights "Chat".

---

# Phase C — Navigation (item 2)

**Design.** Header, left to right:

- **☰** (`<md`): module sheet. The sheet also holds Maya-style header extras and the console links (so nothing is lost on phones).
- **Console menu** (grid icon, labelled "Console" on ≥sm): Dashboard · Employees · Tasks · Brain · Community · Settings, then the organization block (current org, other orgs, Create workspace, See all workspaces). This is the answer to "how do I get back to the dashboard / other pages / organization".
- **← Employees** (≥sm): kept — the most common way back.
- **Identity block = employee switcher** (Task 1): avatar, name, role (`role · Module` on phones).
- Header extras (Maya credits) shown ≥md; inside the ☰ sheet below md.
- Right: **Chat** toggle (≥lg) or chat icon (<lg, → Chat page), then theme.

### Task 7: Console nav config, org-switch hook, ConsoleMenu, header rebuild

**Files:**
- Create: `apps/main/src/lib/config/console-nav.ts`
- Create: `apps/main/src/lib/hooks/use-org-switcher.ts`
- Create: `apps/main/src/components/workspace/ConsoleMenu.tsx`
- Modify: `apps/main/src/components/layout/AppSidebar.tsx`
- Modify: `apps/main/src/components/workspace/WorkspaceShell.tsx`, `WorkspaceMobileNav.tsx`
- Modify: `apps/main/src/app/(workspace)/assistants/team/page.tsx`

**Interfaces:**
- Produces: `CONSOLE_NAV: { primary: NavEntry[]; secondary: NavEntry[] }` where `NavEntry = { href: string; label: string; icon: LucideIcon }`; `useOrgSwitcher(onBefore?: () => void)` → `{ activeOrg, organizations, switchingId, switchOrg(id), createOrg() }`; `ConsoleMenu()` (no props); `WorkspaceMobileNav()` (no props, now includes console links + header extras).

- [ ] **Step 1: `console-nav.ts`** — move `navItems` / `bottomNavItems` out of `AppSidebar.tsx` verbatim (keep the "Employees, not Assistants" comment) and export them as `primary` / `secondary`. `AppSidebar` imports them; behaviour unchanged (sidebar tour selectors `data-tour="nav-…"` keep working).
- [ ] **Step 2: `use-org-switcher.ts`** — lift `switchingId`, `switchOrg`, `createOrg` and the `authClient.useActiveOrganization()/useListOrganizations()/useHydrated()` reads out of `AppSidebar` unchanged, taking `onBefore` (the sidebar passes `closeMobileSidebar`). Refactor `AppSidebar` to use it; confirm the sidebar org menu still behaves identically (switch, create, see all).
- [ ] **Step 3: `ConsoleMenu.tsx`** — a `DropdownMenu` whose trigger is `Button variant="ghost" size="sm"` with `LayoutGrid` icon and a `hidden sm:inline` "Console" label (`aria-label="Console menu"`). Content, **using `DropdownMenuGroup` around every `DropdownMenuLabel`** (the Task 1 lesson):

```tsx
<DropdownMenuContent align="start" className="w-64">
  <DropdownMenuGroup>
    <DropdownMenuLabel>Console</DropdownMenuLabel>
    {[...CONSOLE_NAV.primary, ...CONSOLE_NAV.secondary].map((item) => (
      <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)} className="gap-2.5">
        <item.icon className="size-4" />
        {item.label}
      </DropdownMenuItem>
    ))}
  </DropdownMenuGroup>
  <DropdownMenuSeparator />
  <DropdownMenuGroup>
    <DropdownMenuLabel>{activeOrg?.name ?? "Organization"}</DropdownMenuLabel>
    {organizations.map((o) => (
      <DropdownMenuItem key={o.id} disabled={o.id === activeOrg?.id || !!switchingId} onClick={() => void switchOrg(o.id)}>
        {/* name + check / spinner, same as AppSidebar */}
      </DropdownMenuItem>
    ))}
    <DropdownMenuItem onClick={() => void createOrg()}>Create workspace</DropdownMenuItem>
    <DropdownMenuItem onClick={() => router.push("/workspaces")}>See all workspaces</DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>
```

  Menu items are ≥40px tall on touch (`py-2.5` via `className`).
- [ ] **Step 4: Rebuild the header in `WorkspaceShell.tsx`**:

```tsx
<header className="flex shrink-0 items-center gap-1.5 border-b border-(--vq-line-2) bg-card px-2 py-2 sm:gap-2 sm:px-4">
  <WorkspaceMobileNav />
  <ConsoleMenu />
  <Button asChild variant="ghost" size="sm" className="hidden shrink-0 gap-1.5 px-2 text-muted-foreground sm:inline-flex">
    <Link href="/assistants" aria-label="Back to your employees">
      <ArrowLeft className="size-4" /> Employees
    </Link>
  </Button>
  <span className="hidden h-5 w-px shrink-0 bg-(--vq-line-2) sm:block" />
  <AgentSwitcher subtitle={subtitle} />
  <div className="hidden shrink-0 md:block"><HeaderExtras /></div>
  <ChatToggle />   {/* ≥lg: dock toggle; <lg: link to the Chat page */}
  <ThemeToggle />
</header>
```

  where `subtitle = compact ? \`${config.role} · ${moduleLabel}\` : config.role` — on phones show the current module label (`MODULE_META[activeModule].label`) so the customer always knows where they are; `<h1>` semantics: keep an `sr-only <h1>` with the employee name since the visible name is now inside a button.
  `ChatToggle` (local component in the shell): on `lg+` the existing Show/Hide chat button (label "Chat", `aria-pressed={dockVisible}`); on `<lg` a `Button asChild` link to `hrefFor("chat")` with `MessageSquare`. Highlighted (`bg-muted`) when on the Chat page.
  Use `h-dvh` (not `h-svh`) on the shell root so the mobile keyboard/URL bar do not push the composer off-screen.
- [ ] **Step 5: `WorkspaceMobileNav`** — inside the sheet, after the module list add a footer section: header extras (`<HeaderExtras />` — export it from the shell or move it to its own file), then a "Console" list rendering `CONSOLE_NAV` links (closing the sheet on click) and "← Employees". Sheet width `w-72` stays; the list scrolls (`overflow-y-auto`).
- [ ] **Step 6: Team room parity** — in `assistants/team/page.tsx` add `<ConsoleMenu />` after the back button so the team room has the same exits as a workspace; keep everything else.
- [ ] **Step 7: Verify.** Manual: from `/workspace/lex/approvals` reach Dashboard, Tasks, Brain, Settings, switch organization, and return — using only the header (desktop) and only ☰/header (375px). `npx tsc --noEmit`, `pnpm lint`.

---

# Phase D — Responsive pass (item 1)

### Task 8: A repeatable device-width check, then baseline it

**Files:** none changed (this creates the checklist the later tasks are proven against).

- [ ] **Step 1: Widths to test:** 320, 375, 414, 768, 1024, 1280, 1536 (iPhone SE → desktop). Use Chrome DevTools device toolbar, or the `chrome-devtools` MCP (`resize_page` / `emulate`), logged in against a local dev server.
- [ ] **Step 2: Automatic horizontal-overflow probe.** On every route below, at each width, run in the console:

```js
(() => {
  const w = document.documentElement.clientWidth
  const bad = [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && (r.right > w + 1 || r.left < -1)
  }).slice(0, 8).map((el) => el.tagName + "." + String(el.className).slice(0, 60))
  return { scrollW: document.documentElement.scrollWidth, clientW: w, offenders: bad }
})()
```

  Pass = `scrollW <= clientW` and no offenders that are not inside an intentional scroller (`overflow-x-auto`).
- [ ] **Step 3: Route × surface checklist** (record ✅/❌ + width for each; the "fix" tasks below reference these):
  - `/assistants` directory; `/assistants/team` (thread, composer, run panel/graph)
  - For **each of the six employees** under `/workspace/<slug>/`: `overview` (agent widgets: LexHome, Maya content-plan/calendar, Rex data & cards, Sage SEO widgets, Scout projects, Vega pulse/outcomes), `work` (+ each work type list and detail: Maya campaigns/gallery/published-posts calendar, Sage pages, Scout research, Lex documents & review sheets, Rex data tab), `actions`, `approvals`, `automations`, `activity`, `memory` (list **and** graph), `integrations`, `settings`, `chat`
  - Chat surfaces: message result cards for each agent (Maya/Rex/Sage/Scout/Lex/Vega cards render in a ~340px dock and at full width on the Chat page), composer toolbar, slash-command menu, attach-source menu, tools menu, help sheet, media viewer, artifact HTML viewer
  - Dialogs/sheets: RunActionDialog for every action, PromptActionDialog, DelegateDialog, ConnectIntegrationModal, Maya publish / schedule / top-up / gallery, VideoTemplatePicker, Lex review/document sheets, Rex/Sage card sheets, SubmitFeedbackDrawer, TrialGateModal, CreateOrgDialog, OnboardMeModal
  - Global: toasts (sonner) placement over the composer on phones, ScheduledPostFailureAlert
- [ ] **Step 4: Baseline** — run the matrix on the current code and save results next to this plan as `2026-09-26-workspace-responsive-baseline.md` (a table, not screenshots). This tells the owner exactly what was broken before and lets the final run prove nothing regressed.

### Task 9: Global dialog and sheet fixes

**Files:**
- Modify: `apps/main/src/components/ui/dialog.tsx:49` (`DialogContent`)
- Check: `apps/main/src/components/ui/sheet.tsx`, `alert-dialog.tsx`

- [ ] **Step 1: Make every dialog phone-safe at the primitive.** Add to the `DialogContent` base class list: `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain`. `tailwind-merge` means existing overrides win: `ActionDialog` (`flex flex-col max-h-[90vh]`, inner scroller), `feedback/page.tsx` (`overflow-hidden p-0`), `gallery-tab`/`OnboardMeModal` keep their own. Keep the close button reachable when the body scrolls by making it `sticky`-safe: it is `absolute top-2 right-2` inside the scrolling popup — change it to stay pinned with `fixed`-like behaviour only if testing shows it scrolls away (test with `PromptActionDialog` at 320×568; if it scrolls away, wrap `children` in a scroll container and keep the close button outside it).
- [ ] **Step 2: Footers.** `DialogFooter` already stacks (`flex-col-reverse sm:flex-row`); confirm primary action is last in DOM order → appears at the bottom-most position on phones. Verify per dialog that no `DialogFooter` is overridden to `flex-row` without `flex-wrap`.
- [ ] **Step 3: Inputs on iOS.** Ensure form inputs inside dialogs are ≥16px on `<sm` to prevent iOS zoom-on-focus (`components/ui/input.tsx`, `textarea.tsx`, select trigger): if they are `text-xs`/`text-sm`, add `max-sm:text-base`.
- [ ] **Step 4: Verify** the Task 8 dialog list at 320×568 and 375×667: every dialog scrolls, submit is reachable, Esc/close works, no content clipped. Confirm `sheet.tsx` side panels use `w-full` on `<sm` (the per-file overrides `w-full … sm:max-w-*` already do; check `HelpSheet` `!max-w-md` and `SubmitFeedbackDrawer`).

### Task 10: Module-level responsive fixes found in the audit

**Files:**
- Modify: `components/workspace/modules/WorkModule.tsx`, `SimpleModules.tsx` (`ApprovalsModule`), `MemoryGraph.tsx`, `ModuleNav.tsx`, plus any component the Task 8 baseline marks ❌.

- [ ] **Step 1: Work-type tabs scroll instead of wrapping off-screen.** In `WorkModule.tsx` change the `<nav>` to `className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]"` and make each `Link` `whitespace-nowrap shrink-0`; put the create-action buttons on their own row below `sm` (`w-full sm:w-auto`, `flex-wrap`).
- [ ] **Step 2: Approvals get a real link to chat.** Replace the passive "Review in chat" text with `<Button size="sm" variant="outline" onClick={revealChat}>Review in chat</Button>` (`useWorkspaceChat().revealChat`) so on phones it navigates to the Chat page and on desktop it opens the dock. Stack the row on `<sm` (`flex-col items-start`).
- [ ] **Step 3: Memory graph on touch.** Change `touchAction: "none"` to `"pan-y"` on the graph container when the pointer is coarse (`window.matchMedia("(pointer: coarse)").matches`) so the page can scroll past it; keep pinch/drag-to-pan behind an explicit "Explore" toggle on touch devices, or leave the list as the default view on `<md` (choose the smaller change after testing at 375). The graph already sizes to its container via `ResizeObserver`.
- [ ] **Step 4: Rail at `md`–`lg`.** At 768–1023 the rail (208px) + module is fine; confirm. If Task 8 shows cramped content at 768, switch the rail below `lg` to icon-only (`w-14`, labels `sr-only`, `title` tooltips) via classes on `ModuleNav`/`NavItem` (no slug literals).
- [ ] **Step 5: Everything the baseline marked ❌** — one checklist line per failing surface with the concrete fix (typical: `grid-cols-N` without a `sm:` step, fixed-width children, `whitespace-nowrap` labels, tables without an `overflow-x-auto` wrapper, `min-w-0` missing on flex children). Do not batch-restyle passing surfaces.
- [ ] **Step 6: Re-run the Task 8 matrix**; every ✅ that was ✅ before stays ✅ (regression rule from the request: pages that were already responsive must not change).

---

# Phase E — Real logos in every agent's integrations (item 3)

### Task 11: Reuse the Settings cards inside the workspace

**Files:**
- Create: `apps/main/src/components/integrations/IntegrationLogo.tsx`
- Create: `apps/main/src/components/integrations/LegacyIntegrationCard.tsx`
- Modify: `apps/main/src/components/integrations/IntegrationCatalogCard.tsx`
- Modify: `apps/main/src/app/(dashboard)/settings/integrations/page.tsx`
- Modify: `apps/main/src/components/workspace/modules/SimpleModules.tsx` (`IntegrationsModule`)

**Interfaces:**
- Produces: `IntegrationLogo({ name, logoUrl })` (same props as today); `LegacyIntegrationCard({ integration, account? })` and the `LegacyIntegrationDef` type + `LEGACY_INTEGRATIONS` constant exported from it.

- [ ] **Step 1: Move, don't rewrite.** Extract `IntegrationLogo` into its own file and re-export it from `IntegrationCatalogCard.tsx` (`export { IntegrationLogo } from "./IntegrationLogo"`) so existing imports keep working. Make it dark-safe: black brand marks (X, Zoom-style SVGs) vanish on a dark card, so put every logo on a light tile in dark mode:

```tsx
className="size-8 shrink-0 rounded-md object-contain dark:bg-white/95 dark:p-1"
```

  (The initials fallback already uses `bg-muted`.)
- [ ] **Step 2: Extract `LegacyIntegrationCard`** (and `LEGACY_INTEGRATIONS`, `LegacyIntegrationDef`) verbatim from `settings/integrations/page.tsx` into its own file; the settings page imports it. Pure move — no behaviour change; confirm `/settings/integrations` looks and behaves identically.
- [ ] **Step 3: Rewrite `IntegrationsModule`** to render exactly what Settings renders, filtered to this agent. Real data sources: `getIntegrationsByAgent(agent)`, `useMcpConnections()`, `useIntegrations()` (native accounts) with `platformSlugToEnum`:

```tsx
export function IntegrationsModule({ agent }: ModuleProps) {
  const { data: mcp = [] } = useMcpConnections()
  const { data: accounts = [] } = useIntegrations()
  const entries = getIntegrationsByAgent(agent as Parameters<typeof getIntegrationsByAgent>[0])

  const connectedMcp = new Set(mcp.filter((c) => c.status === "CONNECTED").map((c) => c.slug))
  const accountByPlatform = new Map(accounts.map((a) => [a.platform, a]))

  const mcpEntries = entries.filter((e) => !LEGACY_MCP_SLUGS.has(e.slug))
  const legacy = LEGACY_INTEGRATIONS.filter((l) =>
    entries.some((e) => e.slug === l.id),
  )

  const connected = [
    ...legacy.filter((l) => l.platformSlug && accountByPlatform.has(platformSlugToEnum[l.platformSlug])),
    ...mcpEntries.filter((e) => connectedMcp.has(e.slug)),
  ]
  // …render "Connected" and "Available" sections; each item is either
  // <LegacyIntegrationCard …/> or <IntegrationCatalogCard entry connected/>
}
```

  Layout: `grid gap-4 sm:grid-cols-2`, two sections ("Connected", "Available") with the same headings/wording as Settings; an `EmptyState` when the agent has none; a small "Manage all integrations" `Link` to `/settings/integrations` (the console menu from Task 7 now makes leaving safe). Connect/disconnect happen **in place** (`ConnectIntegrationModal` is already inside `IntegrationCatalogCard`); X/LinkedIn keep their existing native OAuth flow.
- [ ] **Step 4: Sweep for other generic-icon integration lists.** `grep -rn "Plug" src/components/workspace src/components/agents` and replace any per-integration `Plug` tile with `IntegrationLogo`. (Dashboard `IntegrationHealth` is a console page and out of this item unless it also uses a generic icon — check and report, don't silently change.)
- [ ] **Step 5: Verify** `/workspace/{lex,maya,rex,sage,scout,vega}/integrations`: real coloured logos (broken remote logos fall back to initials), connected state correct for MCP **and** X/LinkedIn, connect modal opens in place and is phone-safe, dark mode shows logos on light tiles. `npx tsc --noEmit`, `pnpm lint`.

---

# Phase F — Theme correctness (item 4)

### Task 12: Replace hardcoded colours with tokens; prove it in both themes

**Files (from the audit; counts are hardcoded-colour lines):**
`agents/maya/published-posts-tab.tsx` (18), `agents/maya/gallery-tab.tsx` (15), `agents/rex/forms.tsx` (7), `agents/maya/cards.tsx` (6), `agents/rex/data-tab.tsx` (4), `agents/rex/cards.tsx` (4), `assistants/ChatList.tsx` (3), `agents/lex/cards.tsx` (3), `agents/maya/content-plan-tab.tsx` (2), `agents/sage/cards.tsx`, `agents/maya/forms.tsx`, `agents/maya/BrandImagesSelector.tsx`, `assistants/AgentInfoPanel.tsx`, `assistants/EmployeeDirectory.tsx`, `workspace/chat/dock-extras/ScoutSearchSource.tsx`. All under `apps/main/src/components/`.

- [ ] **Step 1: Confirm the available tokens** in `app/globals.css` (`:root` and `.dark`): `--chart-1…5`, `--vq-red`, `--vq-yellow`, `--destructive`, `--muted`, `--card`. Use only these.
- [ ] **Step 2: Apply this mapping** (light and dark handled by the token, no `dark:` needed):

| Found | Replace with |
|-------|--------------|
| `bg-white` (e.g. `published-posts-tab.tsx:84`) | `bg-card` |
| `border-green-600 text-green-700 bg-green-50` / `red` / `blue` / `gray` / `yellow` status trios (`gallery-tab.tsx:40-60`, `published-posts-tab.tsx:137-144`) | the existing `StatusPill` (`level="ok" \| "danger" \| "info" \| "warn"` — success→`ok`, failed→`danger`, scheduled→`info`, pending/other→`warn`, cancelled→`info`) — it already themes both modes |
| `text-red-600` inline errors | `text-destructive` |
| `text-green-600` / `text-blue-500/600` / `text-purple-500` type accents in Rex (`forms.tsx:1310-1312, 1525-1527, 1638`, `data-tab.tsx:309-311, 474`) | date→`chart-1` (blue), numeric→`chart-2` (green), categorical→`chart-4` (purple): `text-chart-N` for icons and `border-chart-N/30 bg-chart-N/10 text-chart-N` for the three type chips |
| `#000000` Twitter/X dot & colour (`published-posts-tab.tsx:28`, `gallery-tab.tsx:23`, `maya/cards.tsx:133`) | `var(--foreground)` (`bg-foreground`) — black on light, white on dark |
| `#0077B5` / `#E1306C` / `#0A66C2` platform brand colours | keep (brand identity reads on both themes) but make the *text* uses (`text-[#0077B5]`) use `text-chart-1` or `text-primary` where they are body text |
| `hover:bg-black/[0.06]` (`maya/cards.tsx:338`) | `hover:bg-muted` |
| `bg-black/70 text-white` media badges (`gallery-tab.tsx:121,127,189`) | keep — they sit on images, correct in both themes |
| `text-white` on `bg-primary` (calendar today marker `published-posts-tab.tsx:291`) | `text-primary-foreground` (primary is *warm white* in dark mode — white-on-white today) |

- [ ] **Step 3: Chat-surface check.** The chat background utility `.vq-chat-bg` has a `.dark` variant; confirm dock and Chat page use it consistently and that message bubbles/cards use `bg-card`/`bg-muted`. Confirm `ArtifactHtmlViewer` and board-deck/blog HTML previews are framed on a deliberate light "paper" surface with a visible border in dark mode (agent-generated HTML brings its own light styles; the frame must not make it look like a bug).
- [ ] **Step 4: Automated "white slab in dark mode" probe.** In dark mode on every route from Task 8, run:

```js
(() => {
  const dark = document.documentElement.classList.contains("dark")
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? []; return m.length < 3 ? 0 : (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255 }
  return [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect(); if (r.width * r.height < 4000) return false
    const bg = getComputedStyle(el).backgroundColor
    return dark && !bg.includes("rgba(0, 0, 0, 0)") && lum(bg) > 0.85 && !el.closest("iframe,img,video")
  }).slice(0, 10).map((el) => el.tagName + "." + String(el.className).slice(0, 70))
})()
```

  Expect `[]` (intentional light surfaces such as the HTML paper frame are documented exceptions). Mirror for light mode with `lum < 0.15` to catch dark slabs.
- [ ] **Step 6: Theme matrix.** For every route in the Task 8 list: Light, Dark, System (flip the OS/emulated `prefers-color-scheme` while on System and confirm it follows live), plus **reload while in dark** (no white flash — `ThemeProvider` uses `disableTransitionOnChange` and the class strategy, so verify rather than assume). Check focus rings, disabled states, skeletons, selection highlight (`bg-(--vq-yellow)/25` in chat search highlight), toasts, dropdown/popover surfaces, and the media viewer overlay.
- [ ] **Step 7:** `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.

---

# Phase G — Close out

### Task 13: Full regression pass

- [ ] `pnpm lint` (eslint + invariants), `npx tsc --noEmit`, `pnpm build`, `npx tsx --test src/lib/workspace/chat-layout.test.ts src/lib/workspace/memory-graph.test.ts`.
- [ ] Re-run the Task 8 matrix and the Task 12 theme matrix; diff against the baseline file. Report any ✅→❌.
- [ ] Walk the six asks as a customer would, once on a 375px phone and once at 1440px: (1) every screen smooth; (2) directory → employee → module → chat → console page → organization switch → back; (3) logos in all six `/integrations`; (4) Light/Dark/System; (5) open the employee switcher — no crash, clear purpose; (6) dock, resize, expand to page, dock again, close — draft intact through all of it; preference remembered after reload.
- [ ] Update `docs/superpowers/plans/2026-09-23-agent-workspaces-premerge-audit.md` item 0.1's open box ("Verify at ~375px and ~768px widths") with the result.

---

# Phase H — Owner-approved extras (found while auditing)

Approved by the owner after the plan review ("yes include the 4 new things … take care any feature or flow should not break"). Executed after Phases A–G.

### Task 14: Make the workspace invariants check real
- `scripts/check-workspace-invariants.mjs` scanned `src/app/(dashboard)/workspace/[agent]`, a path that stopped existing when routes moved to `(workspace)`; a swallowed error made `pnpm lint` print "workspace invariants hold" while checking nothing.
- **Done:** RED — a forbidden `[agent]/loading.tsx` passed (exit 0). Paths now point at `(workspace)/workspace`; a missing directory is a failure, not a pass. GREEN — exit 1 with the file present, 0 when clean.

### Task 15: Fix the stale redirect test
- `redirect.test.ts` asserted a "not migrated" agent using `maya`, but all six agents are migrated, so 1 of 8 tests failed.
- **Done:** `workspaceRedirectTarget` takes an optional `migrated` set (default = the real `WORKSPACE_MIGRATED`), so the rollback branch (a known agent taken out of the set) is still tested. 9/9 pass.

### Task 16: Replace the hardcoded "Free" org badge
- The sidebar org switcher showed "Free" for every organization. Plans are per-agent entitlements now; no org-level tier exists.
- **Done:** `lib/billing/org-plan.ts` `orgPlanLabel(entitlements)` → `Trial` / `Paid` / `Past due` / none (4 tests, RED→GREEN). The badge is hidden when the org holds no entitlements rather than asserting something untrue.

### Task 17: The old two-pane chat page
- `assistants/[id]/page.tsx` (1,391 lines) is only the `WORKSPACE_UI` rollback path now.
- **Decision (owner: "don't break any flow"):** kept, not retired. Shared code I changed (`DialogContent`, integrations cards) was checked not to alter it. Retiring it is a separate, owner-led call.

## Self-review notes

- **Coverage:** ask 1 → Tasks 8, 9, 10 (+ Task 7 header, Task 5 overlay); ask 2 → Tasks 6 (Chat in rail), 7; ask 3 → Task 11; ask 4 → Task 12 (+ Task 11 logo tiles), Task 13; ask 5 → Tasks 1, 2; ask 6 → Tasks 3–6. Review-Focus 1 → Task 4 step 6 + Task 13; 2 → Task 4 step 5; 3 → Task 4 step 6(b); 4 → Task 4 steps 3–4, 6(c); 5 → Task 3 tests + Task 4 step 1.
- **Order:** tasks are numbered in execution order (Phase A → G). Suggested first review checkpoint: after Phase A+B, since Phase A alone removes the crash.
- **Honest limits:** responsiveness findings other than the ones cited with file/line are hypotheses until Task 8's baseline runs; that is deliberate — the baseline decides which surfaces get touched, so passing surfaces are not restyled.
