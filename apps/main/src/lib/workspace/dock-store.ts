"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Whether the chat dock is open, per agent, remembered per browser.
 *
 * useSyncExternalStore rather than useState + a hydration effect, because
 * localStorage genuinely is external state: the effect version has to render
 * once with the default and then again with the stored value, which is both an
 * extra render on every workspace entry and the exact "setState in an effect"
 * cascade the React lint rules warn about. getServerSnapshot gives SSR a
 * stable answer, so there is no hydration mismatch either.
 *
 * Storage can be unreadable (private mode, blocked site data). Every access is
 * guarded and a failure degrades to "dock open", never to a broken workspace.
 */

const PREFIX = "vq.workspace.dock."

const listeners = new Set<() => void>()

/**
 * Fallback when localStorage is unavailable.
 *
 * Without this the dock would not merely forget between visits — it would stop
 * toggling entirely, because the read would keep returning the value the failed
 * write never changed. Private-mode users get a dock that works for the session
 * and forgets afterwards, which is the right trade.
 */
const memory = new Map<string, boolean>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab changing the same key should move this one too.
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function read(agent: string): boolean {
  if (memory.has(agent)) return memory.get(agent)!
  try {
    const stored = localStorage.getItem(`${PREFIX}${agent}`)
    // No preference yet means open: a customer who has never touched the dock
    // should meet the employee, not an empty column.
    return stored === null ? true : stored === "1"
  } catch {
    return true
  }
}

export function useDockOpen(agent: string): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    subscribe,
    () => read(agent),
    // The server has no localStorage and must not guess; the default is open,
    // matching a first-time visitor.
    () => true,
  )

  const setOpen = useCallback(
    (next: boolean) => {
      // Memory first so the snapshot is correct even if the write below fails.
      memory.set(agent, next)
      try {
        localStorage.setItem(`${PREFIX}${agent}`, next ? "1" : "0")
      } catch {
        // Session-only for this browser; the click still works.
      }
      emit()
    },
    [agent],
  )

  return [open, setOpen]
}
