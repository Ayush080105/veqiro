"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Lock } from "lucide-react"
import { useUpcomingAgents } from "@/lib/api/feedback"
import { Sticker } from "@/components/ui/sticker"

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
    return <div className="flex flex-1 flex-col bg-background" />
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-(--vq-line-2) bg-card px-5 py-4">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-full text-lg"
          style={{ background: agent.color ?? "var(--muted-foreground)" }}
        >
          {agent.emoji ?? "🤖"}
        </div>
        <div>
          <div className="font-head text-base font-bold text-foreground">
            {agent.name}
          </div>
          <div className="mt-0.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            coming soon
          </div>
        </div>
      </div>

      {/* Lock banner */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-10 text-center">
        <div className="flex size-18 shrink-0 items-center justify-center rounded-full bg-black/8">
          <Lock className="size-7.5 text-muted-foreground" />
        </div>

        <Sticker rotate={-3} tone="yellow">
          coming soon
        </Sticker>

        <div className="flex max-w-110 flex-col gap-2">
          <h2 className="m-0 font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-none tracking-tight text-foreground">
            {agent.name}
          </h2>
          <p className="m-0 font-body text-sm leading-relaxed text-muted-foreground">
            {agent.description ?? agent.tagline}
          </p>
        </div>
      </div>

      {/* Disabled input */}
      <div className="border-t border-(--vq-line-2) bg-card px-4 py-3">
        <div className="flex cursor-not-allowed items-center gap-2.5 rounded-xl border border-(--vq-line-2) bg-background px-4 py-3 opacity-50">
          <span className="flex-1 font-body text-sm text-muted-foreground">
            {agent.name} is coming soon…
          </span>
          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
