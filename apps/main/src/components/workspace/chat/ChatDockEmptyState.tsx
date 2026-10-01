"use client"

import Image from "next/image"

import { AGENT_PHOTOS } from "@/lib/config/agents"
import type { AgentConfig } from "@/lib/types"

/**
 * What the dock shows before there is a conversation.
 *
 * Deliberately not the old full-page empty state, which centred a 120px
 * portrait and a three-line description — at 360px that reads as a poster
 * wedged into a column. This gives the dock what it actually needs: who you
 * are talking to, and something to say.
 */
export function ChatDockEmptyState({
  agent,
  onPrompt,
}: {
  agent: AgentConfig
  onPrompt: (prompt: string) => void
}) {
  const photo = AGENT_PHOTOS[agent.id]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
      <span
        className="relative size-12 overflow-hidden rounded-full border border-border"
        style={{ background: agent.color }}
      >
        {photo ? (
          <Image src={photo} alt={agent.name} fill sizes="48px" className="object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center font-head text-sm text-white">
            {agent.initials}
          </span>
        )}
      </span>

      <div>
        <p className="font-head text-sm">Ask {agent.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{agent.role}</p>
      </div>

      {agent.quickPrompts.length > 0 && (
        <div className="mt-1 flex w-full flex-col gap-1.5">
          {agent.quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPrompt(prompt)}
              className="w-full cursor-pointer rounded-[var(--vq-r-sm)] border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
