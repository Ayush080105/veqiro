"use client"

import * as React from "react"
import { Paperclip, Plus, Send } from "lucide-react"

import { FONT } from "@/lib/fonts"
import { CHAT_MESSAGE_MAX } from "@/lib/schemas/chat"

export interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onPlusClick: () => void
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
  onPlusClick,
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
      onPlusClick()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
      style={{
        background: "#FFF9ED",
        borderTop: "1px solid #E5E5E5",
        padding: "10px 12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <IconButton
          onClick={onPlusClick}
          ariaLabel="Open actions menu"
          title="Actions (Ctrl/Cmd+K)"
        >
          <Plus className="size-5" />
        </IconButton>

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
              background: "#EFE7D6",
              border: "1.5px solid #D4C9B0",
              borderRadius: 999,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.4,
              color: "#111",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#9A8F7A" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#D4C9B0" }}
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
            background: canSend ? "#111" : "#D0D0D0",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            boxShadow: canSend ? "0 2px 6px rgba(0,0,0,0.25)" : "none",
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
