"use client"

import * as React from "react"
import { HelpCircle, Paperclip, Plus, Send } from "lucide-react"

import { FONT } from "@/lib/fonts"
import { CHAT_MESSAGE_MAX } from "@/lib/schemas/chat"

export interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onPlusClick: () => void
  onHelpClick: () => void
  onAttachClick?: () => void
  /** Optional icon rendered inside the attach button (defaults to Paperclip). */
  attachIcon?: React.ReactNode
  /** Tooltip text for the attach button (defaults to "Attach PDF"). */
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
        background: "#FFF9ED",
        border: "2.5px solid #111",
        borderRadius: "50%",
        boxShadow: "2px 2px 0 #111",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        color: "#111",
        transition: "transform 120ms ease",
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translate(2px,2px)"
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "translate(0,0)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translate(0,0)"
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
  onHelpClick,
  onAttachClick,
  attachIcon,
  attachTitle = "Attach PDF",
  placeholder = "Message the agent…",
  disabled = false,
  max = CHAT_MESSAGE_MAX,
}: ChatInputProps) {
  const charCount = value.length
  const canSend = value.trim().length > 0 && charCount <= max && !disabled

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
        background: "#EFE7D6",
        borderTop: "3px solid #111",
        padding: "14px 16px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <IconButton
          onClick={onPlusClick}
          ariaLabel="Open actions menu"
          title="Actions (Ctrl/Cmd+K)"
        >
          <Plus className="size-4" />
        </IconButton>

        {onAttachClick && (
          <IconButton
            onClick={onAttachClick}
            ariaLabel={attachTitle}
            title={attachTitle}
          >
            {attachIcon ?? <Paperclip className="size-4" />}
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
              minHeight: 44,
              maxHeight: 160,
              padding: "11px 18px",
              background: "#fff",
              border: "2.5px solid #111",
              borderRadius: 999,
              boxShadow: "2px 2px 0 #111",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.4,
              color: "#111",
              outline: "none",
            }}
          />
        </div>

        <IconButton
          onClick={onHelpClick}
          ariaLabel="What can this agent do?"
          title="Capabilities"
        >
          <HelpCircle className="size-4" />
        </IconButton>

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          style={{
            height: 40,
            padding: "0 18px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#111",
            color: "#EFE7D6",
            border: "2.5px solid #111",
            borderRadius: 999,
            boxShadow: canSend ? "3px 3px 0 var(--vq-red)" : "3px 3px 0 #555",
            fontFamily: FONT.head,
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.6,
            transition: "transform 120ms ease",
          }}
          onMouseDown={(e) => {
            if (canSend) e.currentTarget.style.transform = "translate(2px,2px)"
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translate(0,0)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translate(0,0)"
          }}
        >
          Send <Send className="size-4" />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 6,
          paddingRight: 8,
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: charCount > max ? "#7A1717" : "#555",
          }}
        >
          {charCount}/{max}
        </span>
      </div>
    </form>
  )
}
