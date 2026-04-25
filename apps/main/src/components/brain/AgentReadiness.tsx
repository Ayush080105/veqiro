"use client"

import { useMemo } from "react"

import type { BrainFormValues } from "@/lib/types"
import { AGENTS } from "@/lib/config/agents"
import { FONT } from "@/lib/fonts"

interface AgentReadinessProps {
  values: BrainFormValues
}

function isAgentReady(agentId: string, values: BrainFormValues): boolean {
  const voiceSet = !!values.brandVoice && values.brandVoice !== "Professional"
  const hasTone =
    values.platformTones.twitter.trim() !== "" ||
    values.platformTones.linkedin.trim() !== "" ||
    values.platformTones.instagram.trim() !== ""
  const hasLogo = !!values.logoUrl

  switch (agentId) {
    case "maya":
      // Maya generates images — needs a logo, voice, and at least one platform tone.
      return voiceSet && hasTone && hasLogo
    case "rex":
      return values.companyName.trim() !== "" && values.industry.trim() !== ""
    case "scout":
      return values.competitors.length >= 1 && values.industry.trim() !== ""
    case "sage":
      return values.targetAudience.trim() !== "" && voiceSet
    case "lex":
      return values.companyName.trim() !== ""
    case "vega":
      return values.companyName.trim() !== ""
    default:
      return false
  }
}

export function AgentReadiness({ values }: AgentReadinessProps) {
  const readiness = useMemo(
    () =>
      AGENTS.map((agent) => ({
        ...agent,
        ready: isAgentReady(agent.id, values),
      })),
    [values]
  )

  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "2.5px solid #111",
        borderRadius: 12,
        boxShadow: "4px 4px 0 #111",
        padding: "14px 16px",
      }}
    >
      <p
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          margin: "0 0 12px",
        }}
      >
        agent readiness
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {readiness.map((agent) => (
          <div
            key={agent.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: agent.color,
                  border: "2px solid #111",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: FONT.head,
                  fontSize: 11,
                  color: "#111",
                }}
              >
                {agent.initials}
              </div>
              <span
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: agent.ready ? "#1DBC87" : "#F5C518",
                  border: "2px solid #111",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#333",
              }}
            >
              {agent.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
