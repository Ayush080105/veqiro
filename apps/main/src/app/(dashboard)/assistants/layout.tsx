"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import ChatList from "@/components/assistants/ChatList"
import { AssistantsTour } from "@/components/tour/AssistantsTour"
import { cn } from "@/lib/utils"

const COLLAPSE_STORAGE_KEY = "vq.assistantsPanelCollapsed"
// Below this width the 340px list crowds the chat pane (tablet/small-laptop
// range) — default to the collapsed rail there unless the user already chose.
const AUTO_COLLAPSE_BREAKPOINT = 1180

export default function AssistantsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const chatOpen = pathname !== "/assistants"
  const [collapsed, setCollapsedState] = useState(false)

  useEffect(() => {
    let initial = window.innerWidth < AUTO_COLLAPSE_BREAKPOINT
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
      if (stored !== null) initial = stored === "1"
    } catch {
      // localStorage can be unavailable in privacy-restricted contexts.
    }
    // Corrects for the client-only value (localStorage/viewport width) right
    // after mount — same hydration-safe pattern as useIsMobile. The lint rule
    // wants subscription-driven effects only; a one-time post-mount read has
    // no such external event to hang the update off of.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedState(initial)
  }, [])

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value)
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? "1" : "0")
    } catch {
      // localStorage can be unavailable in privacy-restricted contexts.
    }
  }

  return (
    <div
      className="-m-4 flex overflow-hidden bg-background"
      style={{ height: "calc(100vh - 3rem)" }}
    >
      <AssistantsTour />
      {/* Agent list — full-width on mobile when no chat open; a 340px sidebar
          on desktop, collapsible down to a 76px avatar rail. */}
      <div
        className={cn(
          "flex flex-col flex-shrink-0 border-r border-[var(--vq-line-2)] overflow-hidden transition-[width] duration-200 ease-out",
          chatOpen ? "hidden md:flex" : "flex w-full",
          collapsed ? "md:w-[76px]" : "md:w-[340px]",
        )}
      >
        <ChatList collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
      </div>

      {/* Chat content — hidden on mobile until an agent is selected */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0",
          chatOpen ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </div>
    </div>
  )
}
