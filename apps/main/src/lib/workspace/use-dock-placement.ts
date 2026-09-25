"use client"

import { useSyncExternalStore } from "react"

import { dockPlacement, type DockPlacement } from "./chat-layout"

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

/**
 * Where the chat dock can live at the current viewport.
 *
 * Logic only. The layout itself stays in CSS classes so there is no hydration
 * flash; this is for behaviour that must know whether a dock is actually on
 * screen (fetch gating, "reveal the chat" navigation). The server snapshot is
 * "inline" because the desktop layout is what the dock's default assumes.
 */
export function useDockPlacement(): DockPlacement {
  return useSyncExternalStore(
    subscribe,
    () => dockPlacement(window.innerWidth),
    () => "inline",
  )
}
