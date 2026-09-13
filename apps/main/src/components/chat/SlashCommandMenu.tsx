"use client"

import * as React from "react"
import * as Icons from "lucide-react"

import { FONT } from "@/lib/fonts"
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
      <div
        style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: 0,
          right: 0,
          background: "var(--card)",
          border: "1px solid var(--vq-line-2)",
          borderRadius: 14,
          boxShadow: "var(--vq-shadow-lg)",
          padding: "10px 14px",
          fontFamily: FONT.body,
          fontSize: 12.5,
          color: "var(--muted-foreground)",
        }}
      >
        No matching actions.
      </div>
    )
  }

  return (
    <div
      role="listbox"
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 0,
        right: 0,
        maxHeight: 280,
        overflowY: "auto",
        background: "var(--card)",
        border: "1px solid var(--vq-line-2)",
        borderRadius: 14,
        boxShadow: "var(--vq-shadow-lg)",
        padding: 6,
      }}
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
              "flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors",
              a.locked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            style={{ background: selected ? "var(--muted)" : "transparent" }}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
              {a.locked ? (
                <Icons.Lock className="size-3.5 text-muted-foreground" />
              ) : (
                <Icon className="size-3.5 text-foreground" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-foreground">
                {a.label}
                {a.locked && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                )}
              </span>
              <span className="truncate text-[10.5px] text-muted-foreground">{a.description}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
