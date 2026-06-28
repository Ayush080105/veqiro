"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Lock } from "lucide-react"
import { useUpcomingAgents } from "@/lib/api/feedback"
import { Sticker } from "@/components/ui/sticker"
import { FONT } from "@/lib/fonts"

export default function UpcomingAgentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: agents, isLoading } = useUpcomingAgents()

  const agent = agents?.find((a) => a.id === id)

  useEffect(() => {
    if (!isLoading && agents && !agent) {
      router.replace("/assistants")
    }
  }, [isLoading, agents, agent, router])

  if (isLoading || !agent) {
    return (
      <div
        style={{
          flex: 1,
          background: "#EFE7D6",
          display: "flex",
          flexDirection: "column",
        }}
      />
    )
  }

  return (
    <div
      style={{
        flex: 1,
        background: "#EFE7D6",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #D4C9B0",
          background: "#FFF9ED",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: agent.color ?? "#aaa",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {agent.emoji ?? "🤖"}
        </div>
        <div>
          <div style={{ fontFamily: FONT.head, fontSize: 16, fontWeight: 700, color: "#111" }}>
            {agent.name}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: "#888", marginTop: 2 }}>
            coming soon
          </div>
        </div>
      </div>

      {/* Lock banner */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Lock style={{ width: 30, height: 30, color: "#555" }} />
        </div>

        <Sticker rotate={-3} tone="yellow">
          coming soon
        </Sticker>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              lineHeight: 1,
              color: "#111",
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            {agent.name}
          </h2>
          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.65,
              color: "#555",
              margin: 0,
            }}
          >
            {agent.description ?? agent.tagline}
          </p>
        </div>
      </div>

      {/* Disabled input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #D4C9B0",
          background: "#FFF9ED",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#EFE7D6",
            border: "1px solid #D4C9B0",
            borderRadius: 12,
            padding: "12px 16px",
            opacity: 0.5,
            cursor: "not-allowed",
          }}
        >
          <span
            style={{
              fontFamily: FONT.body,
              fontSize: 14,
              color: "#999",
              flex: 1,
            }}
          >
            {agent.name} is coming soon…
          </span>
          <Lock style={{ width: 14, height: 14, color: "#bbb", flexShrink: 0 }} />
        </div>
      </div>
    </div>
  )
}
