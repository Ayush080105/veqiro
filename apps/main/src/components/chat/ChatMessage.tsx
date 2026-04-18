"use client"

import * as React from "react"
import { ShieldAlert, Download } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { ActionResultRenderer } from "@/components/chat/ActionResultRenderer"
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

export function TypingIndicator({ agentInitials }: { agentInitials: string }) {
  return (
    <div className="flex items-end gap-2">
      <Avatar size="sm">
        <AvatarFallback>{agentInitials}</AvatarFallback>
      </Avatar>
      <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export interface ChatMessageProps {
  message: Message
  agentInitials: string
  isLex: boolean
}

export function ChatMessage({ message, agentInitials, isLex }: ChatMessageProps) {
  const isUser = message.role === "user"
  const time = formatMessageTime(message.createdAt)
  const actionId = message.customInput?.actionId as AgentActionId | undefined

  if (isUser) {
    return (
      <div className="flex justify-end animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        <div className="flex max-w-[70%] flex-col items-end gap-1">
          <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs whitespace-pre-wrap break-words">
            {message.content}
          </div>
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="attachment"
              className="max-w-full rounded-lg mt-1"
            />
          )}
          <span className="text-[10px] text-muted-foreground">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <Avatar size="sm">
        <AvatarFallback>{agentInitials}</AvatarFallback>
      </Avatar>
      <div className="flex max-w-[85%] flex-col gap-1 min-w-0">
        {actionId && message.customInput?.result != null ? (
          <ActionResultRenderer
            actionId={actionId}
            result={message.customInput.result}
          />
        ) : (
          <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-xs">
            <MarkdownMessage content={message.content} />
            {message.imageUrl && (
              <div className="mt-2">
                <img
                  src={message.imageUrl}
                  alt="generated"
                  className="max-w-full rounded-lg shadow-sm"
                />
                <a
                  href={message.imageUrl}
                  download
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="size-3" /> Download
                </a>
              </div>
            )}
            {isLex && (
              <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
                <ShieldAlert className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  This is not legal advice. Consult a qualified attorney for legal matters.
                </p>
              </div>
            )}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">{time}</span>
      </div>
    </div>
  )
}
