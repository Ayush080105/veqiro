# Fix: Chat result lost after navigating away during agent response

## Root Cause

When the AI agent is processing (fetch in flight) and the user navigates to dashboard/workspace and returns:

1. The page component **unmounts** — `msgWindow` local state is lost.
2. The HTTP request **continues in the background**.
3. On remount, `getMessages()` fetches server messages — but the AI hasn't responded yet, so nothing new is returned.
4. The mutation eventually completes → `onSuccess` fires on the **old, dead component's closure** → `setMsgWindow(...)` is a no-op.
5. The new component never gets updated. Typing indicator disappears. Result never shows.

A hard refresh works because by then `getMessages()` fetches an already-completed response.

The existing comment at line 459 acknowledges the intent (`useMutationState survives navigation`) but the result updating was never wired up.

---

## File to Change

**`apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`**

No new imports needed — `useMutationState`, `getMessages`, `useEffect`, and `useRef` are all already imported.

---

## Changes

### 1. Add two refs (near the other refs, ~line 436)

```typescript
const thisMutationRef = useRef(false)
const prevMutationStatusRef = useRef<string | undefined>(undefined)
```

- `thisMutationRef` — `true` while **this** component instance is waiting for its own send.
- `prevMutationStatusRef` — tracks previous mutation status to detect transitions.

---

### 2. Observe latest mutation status (after the existing `pendingCount` block, ~line 464)

```typescript
const mutationStatuses = useMutationState({
  filters: { mutationKey: ["sendMessage", id, organizationId] },
  select: (m) => m.state.status,
})
const latestMutationStatus = mutationStatuses[mutationStatuses.length - 1]
```

---

### 3. Mark ownership in `onOptimistic` (one line inside the existing `sendMutation` callbacks)

```typescript
const sendMutation = useSendMessage(id, organizationId, conversationIdRef.current, {
  onOptimistic: (optimistic) => {
    thisMutationRef.current = true   // ← ADD THIS LINE
    scrollIntentRef.current = "smooth"
    setMsgWindow((prev) => [...prev, optimistic].slice(-WINDOW))
    setHasPreviousPage(true)
  },
  onSuccess: (serverMsg) => {
    // ... unchanged ...
  },
  onError: () => {
    // ... unchanged ...
  },
})
```

---

### 4. Add orphan-detection effect (right after the `isBusy` line, before `historyLoaded`)

```typescript
useEffect(() => {
  const prev = prevMutationStatusRef.current
  prevMutationStatusRef.current = latestMutationStatus

  // Only act on a pending → success transition (not already-success on mount)
  if (prev !== "pending" || latestMutationStatus !== "success") return

  if (thisMutationRef.current) {
    // This component instance triggered the mutation; onSuccess already handled it.
    thisMutationRef.current = false
    return
  }

  // Orphaned mutation (started before this component mounted) just completed.
  // Re-fetch messages from the server so the AI response and tool results appear.
  getMessages(id, organizationId).then((msgs) => {
    scrollIntentRef.current = "smooth"
    setMsgWindow(msgs)
    try {
      localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
    } catch {}
  })
}, [latestMutationStatus, id, organizationId])
```

---

## Why Each Scenario is Safe

| Scenario | What happens |
|---|---|
| Normal send (user stays on page) | `thisMutationRef.current = true` → effect clears flag and returns; `onSuccess` handles update as before. No double-fetch. |
| Navigate away while pending, return while still pending | New mount has `thisMutationRef.current = false`. When mutation settles → `prev="pending"`, `curr="success"` → refetch fires. Result appears. ✓ |
| Navigate away, come back AFTER mutation completed | `latestMutationStatus` is already `"success"` on mount → `prev = undefined ≠ "pending"` → exits early. Existing `getMessages()` on mount already fetches the result. ✓ |
| Switch between different agents | `id`/`organizationId` dependency change resets `prev` tracking naturally. ✓ |
| Mutation errors while user is away | `latestMutationStatus = "error" ≠ "success"` → exits. No stale state changes. ✓ |

---

## How to Test

1. Open a chat, send a message to Maya (image generation — takes 10–20 seconds).
2. While the typing indicator is visible, navigate to `/dashboard` or `/workspace`.
3. Navigate back to the chat.
4. **Expected**: typing indicator shows while pending; when Maya finishes, the image result card appears — **no page refresh needed**.
5. **Regression check**: sending a normal message while staying on page — no duplicate messages, no extra network call.
