# Chat Real-Time Update Fix — Comprehensive Implementation Plan

## Context

When a user sends a message to an agent and navigates away before it responds, returning to the chat shows no new output — no typing indicator, no agent response — until a hard refresh (F5). The same happens with Maya image/content regeneration. This has been tried before but partial fixes always left edge cases.

This plan covers **all identified root causes and edge cases**, with explicit "do not break" constraints for every change.

---

## Architecture Summary (What Was Actually Found in Code)

The chat page (`assistants/[id]/page.tsx`) manages messages in **local React state** (`msgWindow`) with a stale-while-revalidate localStorage pattern. It does NOT use `useQuery` from React Query for messages — it uses raw `getMessages()` in a `useEffect`. Real-time updates rely on:
1. `onSuccess` callback in `useSendMessage` (bound to the component instance)
2. An "orphaned mutation detection" effect that watches `useMutationState` for a `pending → success` transition
3. Browser HTTP cache is **not bypassed** — `apiFetch` uses native `fetch()` with no `cache` option

---

## All Bugs Found

### Bug 1 (CRITICAL): Browser may serve HTTP-cached response on mount re-fetch
**Where**: `apps/main/src/lib/api/assistants.ts`, `getMessages()` (line 31–34)
**What**: `apiFetch` calls `fetch()` with no `cache` option (browser default is `'default'`). For GET requests to the same URL, browsers can serve a cached response if no `Cache-Control` headers prevent it. When the component re-mounts after navigation, `getMessages()` fires but may return stale data.
**Invariant preserved**: Only `getMessages()` gets `cache: 'no-store'`. All POST calls (sendMessage, runAgentAction, etc.) are unaffected. Other GET calls (statuses, lastMessages, published posts) are unaffected.

### Bug 2 (CRITICAL): Orphaned detection misses "mutation already completed before mount"
**Where**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`, lines 503–523
**What**: The effect only fires when `latestMutationStatus` transitions from `"pending"` to `"success"` while the component is alive. On first render, `prevMutationStatusRef.current` is `undefined`. If mutation completed before this component mounted (user came back AFTER agent finished), `prev` is `undefined`, not `"pending"`, so the guard exits early and no re-fetch happens. The initial mount `getMessages()` call should cover this — but only works if Bug 1 is also fixed.
**Belt-and-suspenders fix**: After `initialLoaded` becomes true, if `latestMutationStatus === "success"` and `mutationStatuses.length > 0` (a mutation exists in QueryClient memory for this agent), do a one-time additional fetch. This catches the case where the mount fetch returned stale cached data despite Bug 1 fix.
**Invariant preserved**: This extra fetch is guarded by `didCatchUpRef` (a new ref) to fire at most once per component lifetime. It does NOT interfere with the existing orphaned detection effect or the `thisMutationRef` logic.

### Bug 3 (HIGH): No auto-refresh when user switches tabs
**Where**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`
**What**: If user has chat open in a browser tab, sends a message, switches to another tab while agent works, gets notified (sidebar updates), switches back — no refetch fires. React Query has `refetchOnWindowFocus: false` globally (query-client.ts line 9).
**Fix**: Add a `visibilitychange` listener in the page. When the document becomes visible AND there's a known mutation for this agent (pending or success), trigger a refetch. Uses a ref to read the latest status without causing the listener to re-register on every status change.
**Invariant preserved**: Listener is cleaned up on unmount. The ref pattern avoids stale closures. Listener only adds one `getMessages()` call — same as the mount fetch, no new state shape.

### Bug 4 (MODERATE): `hasPreviousPage` not updated after orphaned re-fetch
**Where**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`, line 517–521 (orphaned re-fetch)
**What**: When the orphaned detection fires and re-fetches messages, it calls `setMsgWindow(msgs)` but does NOT call `setHasPreviousPage(msgs.length === WINDOW)`. If the re-fetch returns 20 messages (exactly WINDOW), `hasPreviousPage` stays `false` from the initial mount, hiding the "load older messages" button.
**Fix**: Add `setHasPreviousPage(msgs.length === WINDOW)` in the orphaned re-fetch `.then()` block.
**Invariant preserved**: Same logic already used in the mount effect (line 377) and loadPreviousPage callback (line 407).

### Bug 5 (MODERATE): Maya/agent actions don't update sidebar last message
**Where**: `apps/main/src/lib/api/assistants.ts`, `useRunAgentAction.onSuccess` (line 261–265)
**What**: When a Maya action completes (draft-content, generate-variants, etc.), `useRunAgentAction.onSuccess` calls `queryClient.invalidateQueries({ queryKey: qk.chat(...) })`. But the chat page uses raw `getMessages()` in local state — NOT `useQuery` — so this invalidation is a complete no-op for the chat display. More importantly, `qk.lastMessages()` is never invalidated after actions, so the sidebar's "last message" preview stays stale.
**Fix**: Add `queryClient.invalidateQueries({ queryKey: qk.lastMessages() })` to `useRunAgentAction.onSuccess`.
**Invariant preserved**: This only adds a sidebar refetch. Existing `qk.chat` invalidation stays (harmless). The existing `useSendMessage.onSuccess` path via `setQueryData` for lastMessages is unaffected.

### Bug 6 (MODERATE): No scroll-to-bottom after action start or action complete
**Where**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`, `handleActionStart` and `handleActionComplete`
**What**: When user submits an action and the result is appended as a new message, `scrollIntentRef.current` is never set. The user doesn't see the new message without manually scrolling down. (By contrast, `sendMutation.onSuccess` does set `scrollIntentRef.current = "smooth"`.)
**Fix**: In `handleActionStart`, set `scrollIntentRef.current = "smooth"` before `setMsgWindow`. In `handleActionComplete`, set `scrollIntentRef.current = "smooth"` ONLY in branches that APPEND new messages (the `if (!patched)` fallback blocks, and the `maya:generate-variants` and default action branches). Do NOT set scroll intent in in-place patch branches (maya:regenerate-image patched=true, maya:regenerate-content patched=true) — those update mid-conversation cards and scrolling to bottom would be wrong.
**Invariant preserved**: The `useLayoutEffect` at line 529 already handles scroll based on `scrollIntentRef.current` — no changes to that logic. Only `handleActionStart` and the append branches of `handleActionComplete` are touched.

### Non-issue: Maya image regeneration on page reload
After a page reload, the `displayMessages` memo (lines 869–975) already re-applies `maya:regenerate-image` patches from server data. This is self-healing and requires no fix.

### Non-issue: `useSendMessage.onSuccess` updating `lastMessages`
The `queryClient.setQueryData` call at line 220–234 runs on the QueryClient level, not the component level. It fires correctly even when the original component unmounted. No fix needed.

### Non-issue: Fast A→B→A navigation race condition
Each component mount creates its own state. An old promise's `setMsgWindow` call on an unmounted component is silently ignored by React 18. No stale-data injection possible between component instances.

---

## Implementation Plan (in order)

### Step 1 — Add `cache` option to `apiFetch`
**File**: `apps/main/src/lib/api/client.ts`

Add `cache?: RequestCache` to the `RequestOpts` type, and pass it to the `fetch()` call.

```typescript
type RequestOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  agentSlugForNotFound?: string
  signal?: AbortSignal
  cache?: RequestCache  // ← ADD
}

// In apiFetch, destructure and pass to fetch:
const { method = "GET", body, agentSlugForNotFound, signal, cache } = opts
const res = await fetch(`${API_URL}${path}`, {
  method,
  credentials: "include",
  cache,                              // ← ADD (undefined = browser default, preserving existing behavior for all other callers)
  headers: body ? { "Content-Type": "application/json" } : undefined,
  body: body ? JSON.stringify(body) : undefined,
  signal,
})
```

**What's preserved**: All existing callers pass no `cache` option → `cache` is `undefined` → browser default behavior unchanged for all other API calls (POST mutations, status checks, lastMessages, etc.).

---

### Step 2 — Pass `cache: 'no-store'` in `getMessages()`
**File**: `apps/main/src/lib/api/assistants.ts`

Change the `apiFetch` call inside `getMessages()` to add `cache: 'no-store'`:

```typescript
return await apiFetch<Message[]>(
  `/agents/${agentSlug}/chat?${qs.toString()}`,
  { agentSlugForNotFound: agentSlug, cache: 'no-store' }  // ← ADD cache
)
```

**What's preserved**: `getLastMessages`, `getAssistantStatuses`, `sendMessage`, `runAgentAction`, `publishPost`, `publishCarousel`, `getPublishedPosts` — all unchanged. Only message list fetches bypass browser cache.

---

### Step 3 — Fix `useRunAgentAction` to invalidate `lastMessages`
**File**: `apps/main/src/lib/api/assistants.ts`

In `useRunAgentAction.onSuccess`, add a `lastMessages` query invalidation:

```typescript
onSuccess: ({ agentSlug }) => {
  queryClient.invalidateQueries({
    queryKey: qk.chat(agentSlug, organizationId),
  })
  queryClient.invalidateQueries({ queryKey: qk.lastMessages() })  // ← ADD
},
```

**What's preserved**: Existing `qk.chat` invalidation stays. `useSendMessage` path is unaffected. This simply adds a sidebar refetch after any agent action completes.

---

### Step 4 — Add `visibilitychange` listener in page.tsx
**File**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

Add a ref to track the latest mutation status without stale closures, and a `useEffect` for the visibility listener. Place this after the existing `prevMutationStatusRef` and `thisMutationRef` declarations (around line 440):

```typescript
// Ref to read latest mutation status from event listeners without stale closures
const latestMutationStatusRef = useRef(latestMutationStatus)
latestMutationStatusRef.current = latestMutationStatus // Keep updated on every render
```

Add a new `useEffect` after the existing orphaned mutation detection effect (after line 523):

```typescript
// Refetch when user returns to this tab — covers the "agent finished while on another tab" case
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState !== "visible") return
    const status = latestMutationStatusRef.current
    if (status !== "pending" && status !== "success") return
    getMessages(id, organizationId).then((msgs) => {
      setMsgWindow(msgs)
      setHasPreviousPage(msgs.length === WINDOW)
      try {
        localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
      } catch {}
    })
  }
  document.addEventListener("visibilitychange", handleVisibility)
  return () => document.removeEventListener("visibilitychange", handleVisibility)
}, [id, organizationId]) // Only re-register when agent changes, not on every status change
```

**What's preserved**: The listener only fires on `visibilitychange` (not on navigation between pages, which is covered by the mount effect). It reads `id` and `organizationId` directly (not stale) and calls `latestMutationStatusRef` (not stale). It reuses the same `getMessages` + `setMsgWindow` + `setHasPreviousPage` + localStorage pattern used everywhere else. Proper cleanup prevents memory leaks.

---

### Step 5 — Belt-and-suspenders: "already success when mounted" detection
**File**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

Add a new ref and effect. Place the ref near the other refs (after `thisMutationRef`):

```typescript
const didCatchUpRef = useRef(false) // Guards the "already-complete-on-mount" fetch
```

Add a new `useEffect` after the visibility listener effect:

```typescript
// If a mutation for this agent completed before this component mounted,
// the orphaned detection can't catch it (no pending→success transition seen).
// After initialLoaded settles, do one additional fetch as belt-and-suspenders.
useEffect(() => {
  if (!initialLoaded || didCatchUpRef.current) return
  if (latestMutationStatus !== "success" || mutationStatuses.length === 0) return
  didCatchUpRef.current = true
  getMessages(id, organizationId).then((msgs) => {
    setMsgWindow(msgs)
    setHasPreviousPage(msgs.length === WINDOW)
    try {
      localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
    } catch {}
  })
}, [initialLoaded, latestMutationStatus, mutationStatuses.length, id, organizationId])
```

**What's preserved**: `didCatchUpRef` ensures this fires at most ONCE per component lifetime. It reads `mutationStatuses.length` to gate on "a mutation exists" — if there are no mutations (clean user opening chat for first time), this never fires. The existing orphaned detection effect is completely unchanged. Deps include `mutationStatuses.length` which is already computed above.

---

### Step 6 — Fix `hasPreviousPage` in orphaned re-fetch
**File**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

In the existing orphaned mutation detection effect (around line 517), add `setHasPreviousPage`:

```typescript
// Orphaned mutation — re-fetch so the result and tool cards appear.
getMessages(id, organizationId).then((msgs) => {
  scrollIntentRef.current = "smooth"
  setMsgWindow(msgs)
  setHasPreviousPage(msgs.length === WINDOW)  // ← ADD
  try {
    localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
  } catch {}
})
```

**What's preserved**: All other logic in the orphaned effect is unchanged. `WINDOW` constant is already in scope.

---

### Step 7 — Add scroll intent to action start and action complete
**File**: `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`

**In `handleActionStart`** (around line 589), add before `setMsgWindow`:
```typescript
scrollIntentRef.current = "smooth"  // ← ADD
setMsgWindow((prev) => [...prev, userMsg].slice(-WINDOW))
```

**In `handleActionComplete`**, add `scrollIntentRef.current = "smooth"` ONLY in branches that append new messages to the bottom (NOT in-place patch branches):

- **`maya:regenerate-image`**: Only in the `if (!patched)` fallback block, before `return [...msgs, userMsg, assistantMsg]...`
- **`maya:regenerate-content`**: Only in the `if (!patched)` fallback block, before `return [...msgs, assistantMsg]...`
- **`maya:generate-variants`**: Before `setMsgWindow((prev) => [...prev, assistantMsg].slice(-WINDOW))`
- **Default action branch**: Before `setMsgWindow((prev) => [...prev, assistantMsg].slice(-WINDOW))`

Do NOT add scroll intent in the `if (patched)` branches of regenerate-image and regenerate-content — those patch cards mid-conversation and scrolling to bottom would be jarring.

Optionally gate on `isAtBottom`: `if (isAtBottom) scrollIntentRef.current = "smooth"` — this way, if user scrolled up to read history, we don't forcefully snap them to the bottom. Use judgment: for `handleActionStart` (user actively submitted something), always scroll. For `handleActionComplete`, only scroll if `isAtBottom`.

**What's preserved**: `scrollIntentRef` is already used by `useLayoutEffect` (line 529). No changes to that logic. The in-place patch branches (the `if (patched) return msgs` paths) are untouched.

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/main/src/lib/api/client.ts` | Add `cache?: RequestCache` to `RequestOpts`; pass to `fetch()` (Step 1) |
| `apps/main/src/lib/api/assistants.ts` | Add `cache: 'no-store'` in `getMessages()` (Step 2); add `lastMessages` invalidation in `useRunAgentAction.onSuccess` (Step 3) |
| `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx` | Add `latestMutationStatusRef` (Step 4); add `visibilitychange` effect (Step 4); add `didCatchUpRef` (Step 5); add catch-up effect (Step 5); add `setHasPreviousPage` in orphaned refetch (Step 6); add scroll intent in action callbacks (Step 7) |

---

## What Must NOT Change (Explicit Preservation List)

| Thing | Why it must stay |
|-------|-----------------|
| The `stale-while-revalidate` localStorage paint | Instant UX. The server fetch overwrites it. Don't remove the cache read. |
| `useSendMessage.onMutate` optimistic update | Shows user message immediately. The `onSuccess` then replaces it with the server message containing an ID. Touch nothing here. |
| `thisMutationRef` pattern | Correctly distinguishes "this component sent the mutation" from "orphaned mutation". Do not change its set/read/reset logic. |
| The `pending → success` check in orphaned effect | Only add `setHasPreviousPage`. All other lines stay identical. |
| `displayMessages` memo (lines 869–975) | Self-heals Maya image regen on page reload. Do not modify. |
| Pagination (`hasPreviousPage`, `loadPreviousPage`, `scrollAnchorRef`) | Only add `setHasPreviousPage` in orphaned refetch. No other changes. |
| `useSendMessage.onSuccess` `setQueryData` for `lastMessages` | Already correct. Works on unmounted components via QueryClient. |
| `mutationKey: ["sendMessage", agentSlug, organizationId]` | ChatList sidebar typing indicator depends on this exact key shape. Do not rename. |
| All toast notifications (Sonner) | Do not add, remove, or change existing `toast.success` / `toast.error` calls. |
| `conversationIdRef` | Stays as single `genConversationId()` per component lifetime. |
| All Maya action handling in `handleActionComplete` | Add scroll intent only. All the patching logic, card types, `patched` flag, fallback appends — untouched. |
| `WINDOW = 20` constant | Used in multiple places. Do not change. |
| `chatCacheKey` format `vq.chat.${orgId}.${agentId}` | All users have localStorage under this key. Do not rename or change format. |
| `queryClient.ts` global `refetchOnWindowFocus: false` | Do NOT change this. The `visibilitychange` listener in the chat page is targeted and intentional. Turning on global `refetchOnWindowFocus` would cause all queries to refetch on tab switch, which is too broad. |

---

## Verification Steps

1. **Bug 1 fix** (cache): Open DevTools Network tab → send a message → navigate away → come back → the `GET /agents/rex/chat?...` request should appear in Network with status 200 (not `(disk cache)` or `(memory cache)`).

2. **Bug 2 fix** (catch-up fetch): Send a message to Rex → wait for it to start → navigate to Maya → wait 10+ seconds for Rex to finish → navigate back to Rex → agent response should appear **without refreshing**.

3. **Bug 3 fix** (visibility): Send a message → open a different tab or app window → wait for agent to finish → switch back to the chat tab → message should appear automatically.

4. **Bug 4 fix** (hasPreviousPage): In a fresh conversation, send enough messages that `hasPreviousPage` would be affected. After orphaned refetch, verify the "load older messages" button shows/hides correctly.

5. **Bug 5 fix** (lastMessages after actions): Open Maya, generate content/image → check the sidebar "last message" preview for Maya updates after the action completes (without navigating away and back).

6. **Bug 6 fix** (scroll): Submit a Maya action while scrolled to the bottom → verify the result card scrolls into view. Submit while scrolled up → verify page does NOT force-scroll to bottom.

7. **Regression test**: Send a message while staying on the page → verify the existing optimistic-update → server-replace flow still works identically (no double-fetch visible, correct message ordering, typing indicator appears/disappears correctly).

8. **Regression test**: Load more (older) messages by scrolling to top → verify scroll position is preserved correctly after load, and `hasPreviousPage` toggles correctly.

9. **Regression test**: Maya image regeneration in-place → revert image → verify these still work as expected.
