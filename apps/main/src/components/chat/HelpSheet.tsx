"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AGENT_ACTIONS } from "@/lib/agents/actions"
import type { AgentConfig } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const lib = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return lib[name] ?? Icons.Sparkles
}

export function HelpSheet({
  open,
  onOpenChange,
  agent,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agent: AgentConfig
}) {
  const actions = AGENT_ACTIONS[agent.id] ?? []
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!max-w-md">
        <SheetHeader>
          <SheetTitle>{agent.name} · What I can do</SheetTitle>
          <SheetDescription>{agent.description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto p-4 pt-0">
          <div className="flex flex-wrap gap-1">
            {agent.specialties.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Chat
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Type anything in the input and {agent.name} will reply in natural
              language, autonomously calling the right tools behind the scenes.
            </p>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Structured actions
            </p>
            <p className="mb-2 text-xs text-muted-foreground leading-relaxed">
              Click the <strong>+</strong> button in the chat input to launch a
              structured flow with a form. Results render as rich cards you can
              export or act on.
            </p>
            <div className="flex flex-col gap-1.5">
              {actions.map((a) => {
                const Icon = resolveIcon(a.icon)
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 border border-border bg-muted/20 p-2.5"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center bg-background ring-1 ring-border">
                      <Icon className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-xs font-medium">{a.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {a.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
