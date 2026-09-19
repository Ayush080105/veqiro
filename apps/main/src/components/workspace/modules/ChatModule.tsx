"use client"

import { useEffect } from "react"

import { useWorkspaceChat } from "../WorkspaceChatProvider"
import { ChatDock } from "../chat/ChatDock"

/**
 * Chat as a full-width module.
 *
 * Two audiences need this: phones, where a 380px dock beside a module body is
 * not a layout, and anyone who wants the thread at full width. It renders the
 * same ChatDock reading the same provider state, so switching between docked
 * and full-bleed keeps the draft and scroll position.
 */
export function ChatModule() {
  const { setDockOpen } = useWorkspaceChat()

  // Showing the thread twice at once is just confusing, so the dock steps
  // aside while this module owns the screen.
  useEffect(() => {
    setDockOpen(false)
  }, [setDockOpen])

  return (
    <div className="-mx-4 -my-5 h-[calc(100%+2.5rem)] sm:-mx-6">
      <ChatDock fullBleed />
    </div>
  )
}
