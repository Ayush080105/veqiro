"use client"

import * as React from "react"
import * as Icons from "lucide-react"

import { cn } from "@/lib/utils"
import type { AgentActionMeta } from "@/lib/agents/actions"

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const lib = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return lib[name] ?? Icons.Sparkles
}

export interface SlashCommandMenuProps {
  items: AgentActionMeta[]
  selectedIndex: number
  onHover: (index: number) => void
  onSelect: (action: AgentActionMeta) => void
}

/**
 * Inline fast path onto the same AgentActionId registry ToolsMenu browses in
 * a full dialog — typing "/" narrows this list live instead of opening a
 * separate modal. Purely presentational/controlled: ChatInput owns the typed
 * query, filtering, and keyboard-selected index so ArrowUp/Down/Enter can be
 * intercepted on the same keydown handler that already governs Enter-to-send.
 */
export function SlashCommandMenu({ items, selectedIndex, onHover, onSelect }: SlashCommandMenuProps) {
  if (items.length === 0) {
    return (
      <div className="absolute inset-x-0 bottom-[calc(100%+8px)] rounded-[var(--vq-r)] border border-border/60 bg-card px-3.5 py-2.5 text-sm text-muted-foreground shadow-[var(--vq-shadow-lg)]">
        No matching actions.
      </div>
    )
  }

  return (
    <div
      role="listbox"
      className="absolute inset-x-0 bottom-[calc(100%+8px)] max-h-[280px] overflow-y-auto rounded-[var(--vq-r)] border border-border/60 bg-card p-1.5 shadow-[var(--vq-shadow-lg)]"
    >
      {items.map((a, i) => {
        const Icon = resolveIcon(a.icon)
        const selected = i === selectedIndex
        return (
          <button
            key={a.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={a.locked}
            onMouseEnter={() => onHover(i)}
            onClick={() => {
              if (a.locked) return
              onSelect(a)
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--vq-r-sm)] border border-transparent p-2 text-left transition-colors",
              selected && "border-border/60 bg-muted/50",
              a.locked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--vq-r-sm)] bg-background ring-1 ring-border/70">
              {a.locked ? (
                <Icons.Lock className="size-3.5 text-muted-foreground" />
              ) : (
                <Icon className="size-3.5 text-foreground" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                {a.label}
                {a.locked && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Soon
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">{a.description}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
