"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { getAgent, AGENT_PHOTOS } from "@/lib/config/agents"
import { useTeam } from "@/lib/api/team"
import { cn } from "@/lib/utils"

/**
 * Entry point to the shared team room, pinned above the six individual chats.
 *
 * Shows the agents actually in the room — the ones the org is entitled to —
 * so the value of buying another agent is visible from the sidebar rather
 * than hidden behind a paywall screen.
 */
export function TeamRow() {
  const pathname = usePathname()
  const active = pathname === "/assistants/team"
  const { data } = useTeam()

  const agents = data?.agents ?? []
  const enoughForATeam = agents.length >= 2

  return (
    <Link
      href="/assistants/team"
      className={cn(
        "block border-b border-(--vq-line-2) px-3.5 py-3 text-inherit no-underline",
        active ? "bg-background" : "bg-card"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Overlapping avatars — the room, at a glance. */}
        <div className="flex shrink-0">
          {(agents.length ? agents : ["vega", "maya", "sage"]).slice(0, 4).map((slug, i) => {
            const agent = getAgent(slug.toLowerCase())
            return (
              <span
                key={slug}
                className={cn("block size-6.5 overflow-hidden rounded-full border-2 border-card", i !== 0 && "-ml-2.25")}
                style={{
                  background: (agent?.color as string) ?? "var(--background)",
                  opacity: agents.length ? 1 : 0.35,
                }}
              >
                {AGENT_PHOTOS[slug.toLowerCase()] && (
                  <Image
                    src={AGENT_PHOTOS[slug.toLowerCase()]}
                    alt=""
                    width={52}
                    height={52}
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
            )
          })}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-head text-[15px] font-bold text-foreground leading-tight">
            Team
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {enoughForATeam
              ? `${agents.length} agents, one shared task`
              : "hire 2+ agents to unlock"}
          </div>
        </div>
      </div>
    </Link>
  )
}
