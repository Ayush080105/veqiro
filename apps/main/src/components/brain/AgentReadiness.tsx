"use client"

import { useMemo } from "react"

import type { BrainFormValues } from "@/lib/types"
import { AGENTS } from "@/lib/config/agents"

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
    <div className="rounded-(--vq-r) border border-(--vq-line-2) bg-card p-3.5 shadow-(--vq-shadow-sm)">
      <p className="m-0 mb-3 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        agent readiness
      </p>
      <div className="flex flex-wrap gap-4">
        {readiness.map((agent) => (
          <div key={agent.id} className="flex flex-col items-center gap-1">
            <div className="relative">
              <div
                className="grid size-9 place-items-center rounded-full border border-(--vq-line-2) font-head text-[11px] text-foreground"
                style={{ background: agent.color }}
              >
                {agent.initials}
              </div>
              <span
                className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border border-card"
                style={{ background: agent.ready ? "var(--vq-green)" : "var(--vq-yellow)" }}
              />
            </div>
            <span className="font-mono text-[10px] tracking-wide text-foreground/80 uppercase">
              {agent.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
