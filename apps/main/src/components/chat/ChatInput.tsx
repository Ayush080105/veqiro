"use client"

import * as React from "react"
import { Paperclip, Send, Wrench } from "lucide-react"

import { FONT } from "@/lib/fonts"
import { CHAT_MESSAGE_MAX } from "@/lib/schemas/chat"
import { AGENT_ACTIONS, type AgentActionMeta } from "@/lib/agents/actions"
import type { AgentSlug } from "@/lib/types"
import type { LexSource } from "@/lib/types/agents"
import { SlashCommandMenu } from "@/components/chat/SlashCommandMenu"
import { AttachSourceMenu } from "@/components/chat/AttachSourceMenu"

export interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onToolsClick: () => void
  /** Backs the inline "/" command palette — same registry ToolsMenu browses. */
  agentSlug: AgentSlug
  onPickAction: (action: AgentActionMeta) => void
  onAttachClick?: () => void
  attachIcon?: React.ReactNode
  attachTitle?: string
  /** Backs the inline "#" knowledge-attach picker. Lex-only — omit/empty
   *  elsewhere and typing "#" stays a literal character. */
  knowledgeSources?: LexSource[]
  attachedSourceIds?: string[]
  onAttachSource?: (source: LexSource) => void
  onRemoveAttachedSource?: (sourceId: string) => void
  placeholder?: string
  disabled?: boolean
  max?: number
}

function matchesQuery(action: AgentActionMeta, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return action.label.toLowerCase().includes(q) || action.description.toLowerCase().includes(q)
}

function matchesSourceQuery(source: LexSource, query: string): boolean {
  if (!query) return true
  return source.name.toLowerCase().includes(query.toLowerCase())
}

function IconButton({
  onClick,
  ariaLabel,
  title,
  children,
  disabled,
}: {
  onClick: () => void
  ariaLabel: string
  title?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      suppressHydrationWarning
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: "transparent",
        border: "none",
        borderRadius: "50%",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        color: "var(--muted-foreground)",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "rgba(0,0,0,0.06)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent"
      }}
    >
      {children}
    </button>
  )
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onToolsClick,
  agentSlug,
  onPickAction,
  onAttachClick,
  attachIcon,
  attachTitle = "Attach PDF",
  knowledgeSources,
  attachedSourceIds,
  onAttachSource,
  onRemoveAttachedSource,
  placeholder = "Message the agent…",
  disabled = false,
  max = CHAT_MESSAGE_MAX,
}: ChatInputProps) {
  const charCount = value.length
  const canSend = value.trim().length > 0 && charCount <= max && !disabled
  const nearLimit = charCount > max - 200

  const allActions = AGENT_ACTIONS[agentSlug] ?? []
  const menuableActions = React.useMemo(
    () => allActions.filter((a) => !a.hideFromMenu),
    // allActions is a fresh array from the module-level AGENT_ACTIONS record each
    // render, but its contents never change at runtime — agentSlug is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentSlug],
  )
  // "/" only means something when this agent actually has actions to offer —
  // Vega has none today, and typing "/" there should just be a literal character.
  const slashEnabled = menuableActions.length > 0

  const slashQuery = slashEnabled && value.startsWith("/") ? value.slice(1) : null
  const slashItems = React.useMemo(
    () => (slashQuery === null ? [] : menuableActions.filter((a) => matchesQuery(a, slashQuery))),
    [menuableActions, slashQuery],
  )

  const knowledgeEnabled = (knowledgeSources?.length ?? 0) > 0
  const attachQuery = knowledgeEnabled && slashQuery === null && value.startsWith("#") ? value.slice(1) : null
  const attachItems = React.useMemo(
    () => (attachQuery === null ? [] : (knowledgeSources ?? []).filter((s) => matchesSourceQuery(s, attachQuery))),
    [knowledgeSources, attachQuery],
  )

  const [selectedIndex, setSelectedIndex] = React.useState(0)
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [slashQuery, attachQuery])

  const pickAction = (action: AgentActionMeta) => {
    if (action.locked) return
    onPickAction(action)
    onChange("")
  }

  const pickSource = (source: LexSource) => {
    onAttachSource?.(source)
    onChange("")
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const activeCount = slashQuery !== null ? slashItems.length : attachQuery !== null ? attachItems.length : 0
    if (activeCount > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % activeCount)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + activeCount) % activeCount)
        return
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        const idx = Math.min(selectedIndex, activeCount - 1)
        if (slashQuery !== null) pickAction(slashItems[idx])
        else pickSource(attachItems[idx])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        onChange("")
        return
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      if (!disabled) onToolsClick()
    }
  }

  const attachedSources = React.useMemo(
    () =>
      (attachedSourceIds ?? [])
        .map((id) => (knowledgeSources ?? []).find((s) => s.sourceId === id))
        .filter((s): s is LexSource => Boolean(s)),
    [attachedSourceIds, knowledgeSources],
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
      style={{
        background: "var(--card)",
        borderTop: "1px solid var(--vq-line)",
        padding: "10px 12px 14px",
      }}
    >
      {attachedSources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {attachedSources.map((s) => (
            <span
              key={s.sourceId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 8px",
                background: "var(--muted)",
                border: "1px solid var(--vq-line-2)",
                borderRadius: 999,
                fontFamily: FONT.body,
                fontSize: 11.5,
                color: "var(--foreground)",
                maxWidth: 220,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachedSource?.(s.sourceId)}
                aria-label={`Remove ${s.name}`}
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Labelled rather than a bare "+": the menu opens this agent's structured
            actions, which a plus sign reads as "attach" or "new chat" instead. */}
        <button
          suppressHydrationWarning
          type="button"
          onClick={onToolsClick}
          aria-label="Open tools menu"
          title="Tools (Ctrl/Cmd+K)"
          disabled={disabled}
          style={{
            height: 40,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0 14px",
            background: "var(--background)",
            border: "1px solid var(--vq-line-2)",
            borderRadius: 999,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            color: "var(--muted-foreground)",
            fontFamily: FONT.body,
            fontSize: 13,
            fontWeight: 500,
            transition: "background 120ms ease, border-color 150ms",
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.borderColor = "var(--ring)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--vq-line-2)"
          }}
        >
          <Wrench className="size-4" />
          {/* Icon-only on the narrowest screens so the composer keeps its width. */}
          <span className="hidden sm:inline">Tools</span>
        </button>

        {onAttachClick && (
          <IconButton
            onClick={onAttachClick}
            ariaLabel={attachTitle}
            title={attachTitle}
          >
            {attachIcon ?? <Paperclip className="size-5" />}
          </IconButton>
        )}

        <div style={{ flex: 1, position: "relative" }}>
          {slashQuery !== null && (
            <SlashCommandMenu
              items={slashItems}
              selectedIndex={selectedIndex}
              onHover={setSelectedIndex}
              onSelect={pickAction}
            />
          )}
          {attachQuery !== null && (
            <AttachSourceMenu
              items={attachItems}
              selectedIndex={selectedIndex}
              onHover={setSelectedIndex}
              onSelect={pickSource}
            />
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            style={{
              width: "100%",
              resize: "none",
              minHeight: 42,
              maxHeight: 160,
              padding: "10px 16px",
              background: "var(--background)",
              border: "1px solid var(--vq-line-2)",
              borderRadius: 999,
              boxShadow: "var(--vq-shadow-sm)",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.4,
              color: "var(--foreground)",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ring)" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--vq-line-2)" }}
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: canSend ? "var(--primary)" : "var(--muted-foreground)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            boxShadow: canSend ? "var(--vq-shadow)" : "none",
            cursor: canSend ? "pointer" : "not-allowed",
            transition: "background 150ms, box-shadow 150ms",
          }}
        >
          <Send className="size-4" />
        </button>
      </div>

      {nearLimit && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 4,
            paddingRight: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: charCount > max ? "color-mix(in srgb, var(--vq-red) 55%, black)" : "var(--muted-foreground)",
            }}
          >
            {charCount}/{max}
          </span>
        </div>
      )}
    </form>
  )
}
