"use client"

import { ChatDock } from "../chat/ChatDock"

/**
 * Chat as the main area.
 *
 * Two audiences: phones, where a docked column beside a module is not a
 * layout, and anyone who wants the thread at full width. It renders the same
 * ChatDock reading the same provider state, so switching between docked and
 * full-page keeps the draft and scroll position.
 *
 * It does NOT touch the customer's saved dock preference. The shell hides the
 * dock while this module is showing (see `dockVisible` in WorkspaceChatProvider)
 * instead of writing "closed" — which used to persist, so visiting Chat once
 * meant the dock stayed shut on every later visit, and also aborted this very
 * page's history fetch.
 *
 * Height comes from the shell: on this module <main> is a definite-height flex
 * column, so the thread scrolls and the composer pins to the bottom.
 */
export function ChatModule() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatDock fullBleed />
    </div>
  )
}
