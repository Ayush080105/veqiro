"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { getAgent, AGENT_PHOTOS } from "@/lib/config/agents"
import { FONT } from "@/lib/fonts"
import { useTeam } from "@/lib/api/team"

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
      style={{
        display: "block",
        padding: "12px 14px",
        borderBottom: "1px solid #D4C9B0",
        background: active ? "#EFE7D6" : "#FFF9ED",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Overlapping avatars — the room, at a glance. */}
        <div style={{ display: "flex", flexShrink: 0 }}>
          {(agents.length ? agents : ["vega", "maya", "sage"]).slice(0, 4).map((slug, i) => {
            const agent = getAgent(slug.toLowerCase())
            return (
              <span
                key={slug}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid #FFF9ED",
                  marginLeft: i === 0 ? 0 : -9,
                  background: (agent?.color as string) ?? "#EFE7D6",
                  display: "block",
                  opacity: agents.length ? 1 : 0.35,
                }}
              >
                {AGENT_PHOTOS[slug.toLowerCase()] && (
                  <Image
                    src={AGENT_PHOTOS[slug.toLowerCase()]}
                    alt=""
                    width={52}
                    height={52}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </span>
            )
          })}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: FONT.head,
              fontWeight: 700,
              fontSize: 15,
              color: "#111",
              lineHeight: 1.2,
            }}
          >
            Team
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "#999",
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {enoughForATeam
              ? `${agents.length} agents · one shared task`
              : "hire 2+ agents to unlock"}
          </div>
        </div>
      </div>
    </Link>
  )
}
