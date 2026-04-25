"use client"

import * as React from "react"
import { ShieldAlert, Download } from "lucide-react"
import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { ActionResultRenderer } from "@/components/chat/ActionResultRenderer"
import { FONT } from "@/lib/fonts"
import type { Message } from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"

function formatMessageTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMin = Math.floor((now - date) / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function AgentDisc({
  initials,
  color,
}: {
  initials: string
  color: string
}) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: "50%",
        background: color,
        border: "2.5px solid #111",
        boxShadow: "2px 2px 0 #111",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT.head,
        fontSize: 12,
        letterSpacing: 0.5,
        color: "#111",
      }}
    >
      {initials}
    </div>
  )
}

export function TypingIndicator({
  agentInitials,
  agentColor = "var(--vq-yellow)",
}: {
  agentInitials: string
  agentColor?: string
}) {
  return (
    <div className="flex items-end gap-2">
      <AgentDisc initials={agentInitials} color={agentColor} />
      <div
        style={{
          background: agentColor,
          border: "2.5px solid #111",
          borderRadius: "16px 16px 16px 4px",
          boxShadow: "3px 3px 0 #111",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              background: "#111",
              borderRadius: "50%",
              display: "inline-block",
              animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export interface ChatMessageProps {
  message: Message
  agentName: string
  agentInitials: string
  agentColor: string
  isLex: boolean
}

export function ChatMessage({
  message,
  agentName,
  agentInitials,
  agentColor,
  isLex,
}: ChatMessageProps) {
  const isUser = message.role === "user"
  const time = formatMessageTime(message.createdAt)
  const actionId = message.customInput?.actionId as AgentActionId | undefined

  const timestamp = (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: 2,
        textTransform: "uppercase",
        opacity: 0.6,
        color: "#111",
      }}
    >
      {time}
    </span>
  )

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[78%] flex-col items-end gap-1">
          <div
            style={{
              background: "#111",
              color: "#EFE7D6",
              border: "2.5px solid #111",
              borderRadius: "16px 16px 4px 16px",
              boxShadow: "3px 3px 0 #111",
              padding: "12px 16px",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              animation: "pop 240ms cubic-bezier(.2,.9,.3,1.4)",
            }}
          >
            {message.content}
          </div>
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="attachment"
              style={{
                maxWidth: "100%",
                border: "2.5px solid #111",
                borderRadius: 12,
                boxShadow: "3px 3px 0 #111",
                marginTop: 4,
              }}
            />
          )}
          {timestamp}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2">
      <AgentDisc initials={agentInitials} color={agentColor} />
      <div className="flex max-w-[85%] flex-col gap-1 min-w-0">
        {actionId && message.customInput?.result != null ? (
          <ActionResultRenderer
            actionId={actionId}
            result={message.customInput.result}
          />
        ) : (
          <div
            style={{
              background: agentColor,
              color: "#111",
              border: "2.5px solid #111",
              borderRadius: "16px 16px 16px 4px",
              boxShadow: "3px 3px 0 #111",
              padding: "12px 16px",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.5,
              animation: "pop 240ms cubic-bezier(.2,.9,.3,1.4)",
            }}
          >
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                opacity: 0.7,
                marginBottom: 6,
              }}
            >
              {agentName}
            </div>
            <MarkdownMessage content={message.content} />
            {message.imageUrl && (
              <div style={{ marginTop: 10 }}>
                <img
                  src={message.imageUrl}
                  alt="generated"
                  style={{
                    maxWidth: "100%",
                    border: "2.5px solid #111",
                    borderRadius: 10,
                    boxShadow: "3px 3px 0 #111",
                  }}
                />
                <a
                  href={message.imageUrl}
                  download
                  style={{
                    marginTop: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#111",
                    textDecoration: "underline",
                  }}
                >
                  <Download className="size-3" /> Download
                </a>
              </div>
            )}
            {isLex && (
              <div
                style={{
                  marginTop: 10,
                  background: "#FFF9ED",
                  border: "2px solid #111",
                  borderRadius: 8,
                  padding: "8px 10px",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <ShieldAlert
                  className="mt-0.5 size-3 shrink-0"
                  style={{ color: "#7A1717" }}
                />
                <p
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 0.5,
                    lineHeight: 1.5,
                    color: "#7A1717",
                    margin: 0,
                  }}
                >
                  Not legal advice. Consult a qualified attorney for legal matters.
                </p>
              </div>
            )}
          </div>
        )}
        {timestamp}
      </div>
    </div>
  )
}
