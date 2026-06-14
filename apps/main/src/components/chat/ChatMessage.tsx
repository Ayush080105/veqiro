"use client"

import * as React from "react"
import { Download, Copy, Check } from "lucide-react"
import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { ActionResultRenderer } from "@/components/chat/ActionResultRenderer"
import { ChatImage } from "@/components/chat/ChatImage"
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

function CopyBtn({ text }: { text: string }) {
  const [state, setState] = React.useState<"idle" | "copied">("idle")
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setState("copied")
      setTimeout(() => setState("idle"), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy message"
      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,0.10)",
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        color: "#444",
      }}
    >
      {state === "copied" ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
    </button>
  )
}

function AgentDisc({
  initials,
  color,
  photo,
}: {
  initials: string
  color: string
  photo?: string
}) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: "50%",
        background: color,
        border: "1.5px solid rgba(0,0,0,0.1)",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT.head,
        fontSize: 11,
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        {initials}
      </span>
      {photo && (
        <img
          src={photo}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
        />
      )}
    </div>
  )
}

function TypingIndicatorComponent({
  agentInitials,
  agentColor = "var(--vq-yellow)",
  agentPhoto,
}: {
  agentInitials: string
  agentColor?: string
  agentPhoto?: string
}) {
  return (
    <div className="flex items-end gap-2">
      <AgentDisc initials={agentInitials} color={agentColor} photo={agentPhoto} />
      <div
        style={{
          background: `color-mix(in srgb, ${agentColor} 40%, #FFF9ED)`,
          borderRadius: "18px 18px 18px 4px",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 5,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}
      >
        <style>{`
          @keyframes vq-typing-dot {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
          }
        `}</style>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              background: "#888",
              borderRadius: "50%",
              display: "inline-block",
              animation: `vq-typing-dot 1.2s ${i * 0.2}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export const TypingIndicator = React.memo(TypingIndicatorComponent)

export interface ChatMessageProps {
  message: Message
  agentName: string
  agentInitials: string
  agentColor: string
  agentPhoto?: string
  isLex: boolean
  showAvatar?: boolean
  marginTop?: number
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
  onRevertImage?: () => void
}

function ChatMessageComponent({
  message,
  agentName,
  agentInitials,
  agentColor,
  agentPhoto,
  isLex,
  showAvatar = true,
  marginTop,
  onFollowUpAction,
  onRevertImage,
}: ChatMessageProps) {
  const isUser = message.role === "user"
  const time = formatMessageTime(message.createdAt)
  const actionId = message.customInput?.actionId as AgentActionId | undefined

  const inlineTimestamp = (isUserMsg: boolean) => (
    <div
      style={{
        textAlign: "right",
        marginTop: 4,
        fontSize: 11,
        color: isUserMsg ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
        fontFamily: FONT.mono,
        letterSpacing: "0.3px",
      }}
    >
      {time}
    </div>
  )

  if (isUser) {
    return (
      <div className="group flex items-end justify-end gap-2" style={{ marginTop }}>
        <div className="self-end">
          <CopyBtn text={message.content} />
        </div>
        <div className="flex flex-col items-end" style={{ maxWidth: "min(78%, 560px)" }}>
          <div
            style={{
              background: "#1A1A1A",
              color: "#FFFFFF",
              borderRadius: "18px 18px 4px 18px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
              padding: "10px 14px 8px",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message.content}
            {inlineTimestamp(true)}
          </div>
          {message.imageUrl && (
            <div style={{ marginTop: 6 }}>
              <ChatImage src={message.imageUrl} alt="attachment" borderRadius={12} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-end gap-2" style={{ marginLeft: showAvatar ? 0 : 40, marginTop }}>
      {showAvatar ? (
        <AgentDisc initials={agentInitials} color={agentColor} photo={agentPhoto} />
      ) : (
        <div style={{ width: 32, flexShrink: 0 }} />
      )}
      <div className="flex flex-col min-w-0" style={{ maxWidth: actionId ? "520px" : "min(85%, 600px)" }}>
        {actionId && message.customInput?.result != null ? (
          <>
            <ActionResultRenderer
              actionId={actionId}
              result={message.customInput.result}
              agentColor={agentColor}
              onFollowUpAction={onFollowUpAction}
              onRevertImage={onRevertImage}
            />
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontFamily: FONT.mono, letterSpacing: "0.3px", marginTop: 2 }}>
              {time}
            </div>
          </>
        ) : (
          <div
            style={{
              background: `color-mix(in srgb, ${agentColor} 40%, #FFF9ED)`,
              borderLeft: `3px solid ${agentColor}`,
              color: "#111",
              borderRadius: "18px 18px 18px 4px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              padding: "10px 14px 8px",
              fontFamily: FONT.body,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <MarkdownMessage content={message.content} />
            {message.imageUrl && (
              <div style={{ marginTop: 8 }}>
                <ChatImage src={message.imageUrl} alt="generated" borderRadius={10} />
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
                    letterSpacing: "0.3px",
                    color: "#555",
                    textDecoration: "underline",
                  }}
                >
                  <Download className="size-3" /> Download
                </a>
              </div>
            )}
            {inlineTimestamp(false)}
          </div>
        )}
      </div>
      {!actionId && (
        <div className="self-end">
          <CopyBtn text={message.content} />
        </div>
      )}
    </div>
  )
}

export const ChatMessage = React.memo(
  ChatMessageComponent,
  (prev, next) =>
    prev.message === next.message &&
    prev.agentName === next.agentName &&
    prev.agentInitials === next.agentInitials &&
    prev.agentColor === next.agentColor &&
    prev.showAvatar === next.showAvatar &&
    prev.marginTop === next.marginTop &&
    prev.isLex === next.isLex,
)
