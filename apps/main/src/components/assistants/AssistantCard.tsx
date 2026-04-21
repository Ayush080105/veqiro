"use client"

import Link from "next/link"
import { useState } from "react"
import { FONT } from "@/components/veqiro/shared"
import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"
import type { AgentConfig, AgentStatus } from "@/lib/types"

interface AssistantCardProps {
  agent: AgentConfig
  status?: AgentStatus
  lastActivity?: string
  index?: number
}

const ROTATIONS = [-2, 1.5, -1, 2, -2, 1]

function statusLabel(status?: AgentStatus, lastActivity?: string): {
  label: string
  dot: string
} {
  if (status === "working") return { label: "currently working…", dot: "#1DBC87" }
  if (status === "needs-attention")
    return { label: "needs attention", dot: "#F06464" }
  return { label: lastActivity ?? "ready", dot: "#F5C518" }
}

export function AssistantCard({
  agent,
  status,
  lastActivity,
  index = 0,
}: AssistantCardProps) {
  const [hover, setHover] = useState(false)
  const Portrait = CHARACTER_COMPONENTS[agent.id]
  const rot = ROTATIONS[index % ROTATIONS.length]
  const { label, dot } = statusLabel(status, lastActivity)

  return (
    <Link
      href={`/assistants/${agent.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        background: "#111",
        border: "3px solid #111",
        borderRadius: 10,
        overflow: "hidden",
        textDecoration: "none",
        transform: `rotate(${hover ? 0 : rot}deg) translateY(${hover ? -6 : 0}px)`,
        transition: "transform 220ms cubic-bezier(.2,.9,.3,1.2), box-shadow 220ms",
        boxShadow: hover ? `10px 10px 0 ${agent.color}` : "6px 6px 0 #111",
      }}
    >
      <div style={{ background: agent.color }}>
        {Portrait ? <Portrait size="100%" /> : null}
      </div>
      <div
        style={{
          padding: "18px 20px 22px",
          background: "#111",
          color: "#EFE7D6",
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {agent.role}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 52,
            lineHeight: 1,
            color: agent.color as string,
            marginTop: 4,
            letterSpacing: -1,
          }}
        >
          {agent.name.toLowerCase()}
        </div>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 13,
            lineHeight: 1.4,
            margin: "12px 0 0",
            color: "#CFC6B2",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {agent.description}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#CFC6B2",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dot,
              boxShadow: "0 0 0 2px #111",
              display: "inline-block",
            }}
          />
          {label}
        </div>
      </div>
    </Link>
  )
}
