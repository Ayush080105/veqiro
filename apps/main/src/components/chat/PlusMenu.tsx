"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { AGENT_ACTIONS, type AgentActionMeta } from "@/lib/agents/actions"
import type { AgentSlug } from "@/lib/types"
import { cn } from "@/lib/utils"

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const lib = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return lib[name] ?? Icons.Sparkles
}

export function PlusMenu({
  open,
  onOpenChange,
  agentSlug,
  agentName,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agentSlug: AgentSlug
  agentName: string
  onPick: (action: AgentActionMeta) => void
}) {
  const actions = AGENT_ACTIONS[agentSlug] ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What can {agentName} do?</DialogTitle>
          <DialogDescription>
            Pick a structured action. {agentName} will handle it end-to-end and
            return a rich result.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {actions.map((a) => {
            const Icon = resolveIcon(a.icon)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onPick(a)
                  onOpenChange(false)
                }}
                className={cn(
                  "group flex items-start gap-2.5 border border-transparent bg-muted/30 p-2.5 text-left transition-colors",
                  "hover:border-border hover:bg-muted"
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center bg-background ring-1 ring-border">
                  <Icon className="size-4 text-foreground" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <p className="text-xs font-medium text-foreground">{a.label}</p>
                  <p className="line-clamp-2 text-[10px] text-muted-foreground leading-relaxed">
                    {a.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
