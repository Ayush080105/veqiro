"use client"

import * as React from "react"
import { Paperclip, Send, Wrench } from "lucide-react"

import { FONT } from "@/lib/fonts"
import { CHAT_MESSAGE_MAX } from "@/lib/schemas/chat"

export interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onToolsClick: () => void
  onAttachClick?: () => void
  attachIcon?: React.ReactNode
  attachTitle?: string
  placeholder?: string
  disabled?: boolean
  max?: number
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
        color: "#666",
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
  onAttachClick,
  attachIcon,
  attachTitle = "Attach PDF",
  placeholder = "Message the agent…",
  disabled = false,
  max = CHAT_MESSAGE_MAX,
}: ChatInputProps) {
  const charCount = value.length
  const canSend = value.trim().length > 0 && charCount <= max && !disabled
  const nearLimit = charCount > max - 200

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      if (!disabled) onToolsClick()
    }
  }

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
            color: "#fff",
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
              color: charCount > max ? "#CC3333" : "#999",
            }}
          >
            {charCount}/{max}
          </span>
        </div>
      )}
    </form>
  )
}
