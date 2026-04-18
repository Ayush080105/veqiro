"use client"

import { useMemo } from "react"

import type { BrainFormValues } from "@/lib/types"
import { AGENTS } from "@/lib/config/agents"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface AgentReadinessProps {
  values: BrainFormValues
}

// ─── Readiness Rules ──────────────────────────────────────────────────────────

function isAgentReady(agentId: string, values: BrainFormValues): boolean {
  const voiceSet = values.brand_voice !== "Professional"
  const hasTone =
    values.platform_tones.twitter.trim() !== "" ||
    values.platform_tones.linkedin.trim() !== "" ||
    values.platform_tones.instagram.trim() !== ""

  switch (agentId) {
    case "maya":
      return voiceSet && hasTone && values.brand_colors.primary !== "#000000"
    case "rex":
      return (
        values.company_name.trim() !== "" && values.industry.trim() !== ""
      )
    case "scout":
      return values.competitors.length >= 1 && values.industry.trim() !== ""
    case "sage":
      return values.target_audience.trim() !== "" && voiceSet
    case "lex":
      return values.company_name.trim() !== ""
    case "vega":
      return values.company_name.trim() !== ""
    default:
      return false
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

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
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-foreground">
        Agent Readiness
      </p>
      <div className="flex items-start gap-3">
        {readiness.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col items-center gap-1"
          >
            <div className="relative">
              <Avatar className="size-7">
                <AvatarFallback
                  className="text-[10px]"
                  style={{
                    backgroundColor: `hsl(var(--${agent.color}))`,
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  {agent.initials}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background ${
                  agent.ready ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
            </div>
            <span className="text-[10px] leading-none text-muted-foreground">
              {agent.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
