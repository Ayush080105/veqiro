"use client"

import { useCallback, useSyncExternalStore } from "react"

import { DOCK_DEFAULT, INLINE_AT, clampDockWidth, resolveStoredWidth } from "./chat-layout"

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
    // No preference yet: open where the dock sits beside the module (xl+), shut
    // where it would float over it (lg–xl) — a first-time visitor on a small
    // laptop should meet their module, not a panel covering it.
    return stored === null ? window.innerWidth >= INLINE_AT : stored === "1"
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


/**
 * The dock's width, remembered per browser (one width, not one per agent — it
 * is a preference about how the customer likes their screen laid out).
 *
 * `setLive` is for drag: it updates memory and notifies, but does not write to
 * storage on every pointer move. `commit` is the final value and is persisted.
 */
const WIDTH_KEY = "vq.workspace.dockWidth"
let widthMemory: number | null = null

function readWidth(): number {
  if (widthMemory !== null) return widthMemory
  try {
    // Never trust storage as-is: it can be corrupt, or saved on a wider screen.
    return resolveStoredWidth(localStorage.getItem(WIDTH_KEY), window.innerWidth)
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
      // Session-only for this browser; the drag still worked.
    }
    emit()
  }, [])

  return [width, setLive, commit]
}
