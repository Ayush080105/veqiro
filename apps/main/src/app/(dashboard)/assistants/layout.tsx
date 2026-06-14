"use client"

import { usePathname } from "next/navigation"
import ChatList from "@/components/assistants/ChatList"

export default function AssistantsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const chatOpen = pathname !== "/assistants"

  return (
    <div
      className="-m-4 flex overflow-hidden"
      style={{ height: "calc(100vh - 3rem)", background: "#EFE7D6" }}
    >
      {/* Agent list — full-width on mobile when no chat open, 340px sidebar on desktop */}
      <div
        className={[
          "flex flex-col flex-shrink-0 border-r-[3px] border-[#111] overflow-hidden",
          chatOpen
            ? "hidden md:flex md:w-[340px]"
            : "flex w-full md:w-[340px]",
        ].join(" ")}
      >
        <ChatList />
      </div>

      {/* Chat content — hidden on mobile until an agent is selected */}
      <div
        className={[
          "flex flex-col flex-1 min-w-0",
          chatOpen ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  )
}
