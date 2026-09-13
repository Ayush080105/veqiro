"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { FONT } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import type { LexSource } from "@/lib/types/agents"

export interface AttachSourceMenuProps {
  items: LexSource[]
  selectedIndex: number
  onHover: (index: number) => void
  onSelect: (source: LexSource) => void
}

/**
 * "#" sibling of SlashCommandMenu — same inline-popover pattern, over Lex's
 * ingested sources instead of the AgentActionId registry. Selecting a source
 * attaches its full text to the next send (see use-agent-chat's
 * attachedSourceIds) rather than inserting anything into the composer text.
 */
export function AttachSourceMenu({ items, selectedIndex, onHover, onSelect }: AttachSourceMenuProps) {
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
        No matching documents.
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
      {items.map((s, i) => {
        const selected = i === selectedIndex
        return (
          <button
            key={s.sourceId}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(s)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors"
            style={{ background: selected ? "var(--muted)" : "transparent" }}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
              <FileText className="size-3.5 text-foreground" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-medium text-foreground">{s.name}</span>
              <span className={cn("truncate text-[10.5px] text-muted-foreground")}>
                {s.typeDetected ?? s.type} · {s.pageCount} page{s.pageCount === 1 ? "" : "s"}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
