"use client"

import { Suspense, useMemo } from "react"
import { ChevronDown } from "lucide-react"

import { AGENT_PHOTOS } from "@/lib/config/agents"
import { useLexSources } from "@/lib/api/lex"
import type { AgentActionId } from "@/lib/types/agents"
import { cn } from "@/lib/utils"
import { ChatInput } from "@/components/chat/ChatInput"
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { useAgentWorkspace } from "../AgentWorkspaceContext"
import { useWorkspaceChat } from "../WorkspaceChatProvider"

/**
 * The chat thread, docked beside the module body.
 *
 * Its state does not live here — it lives in WorkspaceChatProvider, mounted by
 * the agent layout, which is what lets a half-typed message survive navigating
 * from Overview to Work and back. This component is only the view.
 */
export function ChatDock({ fullBleed }: { fullBleed?: boolean }) {
  const { agent, config, spec } = useAgentWorkspace()
  const { chat, dialogs, openAction } = useWorkspaceChat()
  const { setToolsOpen } = dialogs

  const {
    msgWindow,
    hasPreviousPage,
    isLoadingPrev,
    loadPreviousPage,
    content,
    setContent,
    handleSend,
    handleRestoreDraft,
    isLoading,
    isAtBottom,
    setIsAtBottom,
    chatScrollRef,
    highlightedMessageId,
    attachedSourceIds,
    setAttachedSourceIds,
  } = chat

  // Lex is the only agent with composer attachments today, but the spec flag
  // is what decides — not a slug check. The hook runs regardless because hooks
  // must, and returns nothing useful for agents that never ask for sources.
  const wantsSources = spec.composer?.attachments === "lex-sources"
  const { data: lexSources } = useLexSources()

  const messages = useMemo(
    () => (spec.transformMessages ? spec.transformMessages(msgWindow) : msgWindow),
    [spec, msgWindow],
  )

  const photo = AGENT_PHOTOS[agent]
  const isBusy = isLoading
  const hasStreamingMessage = messages.some((m) => m.deliveryStatus === "streaming")

  return (
    <div className={cn("flex min-h-0 w-full flex-col", fullBleed && "h-full")}>
      <div className="flex shrink-0 items-center gap-2 border-b border-(--vq-line-2) px-3 py-2">
        <span className="truncate font-head text-sm">{config.name}</span>
        <span className="flex-1" />
        {spec.chatHeaderExtras?.map((Extra, i) => (
          <Suspense key={i} fallback={null}>
            <Extra />
          </Suspense>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={chatScrollRef}
          className="flex h-full flex-col overflow-y-auto px-4 py-4"
          onScroll={(e) => {
            const el = e.currentTarget
            setIsAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 50)
            if (el.scrollTop < 80 && hasPreviousPage && !isLoadingPrev) {
              void loadPreviousPage()
            }
          }}
        >
          {hasPreviousPage && (
            <div className="flex justify-center pb-1">
              <button
                onClick={() => void loadPreviousPage()}
                disabled={isLoadingPrev}
                className={cn(
                  "rounded-full border border-(--vq-line-2) bg-card/85 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase shadow-(--vq-shadow-sm)",
                  isLoadingPrev ? "cursor-default opacity-60" : "cursor-pointer opacity-100",
                )}
              >
                {isLoadingPrev ? "loading…" : "↑ load older messages"}
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={msg.id ?? `msg-${i}`}
              data-message-id={msg.id}
              className={cn(
                "rounded-xl transition-colors duration-700",
                msg.id && msg.id === highlightedMessageId
                  ? "bg-(--vq-yellow)/25"
                  : "bg-transparent",
              )}
            >
              <ChatMessage
                message={msg}
                agentInitials={config.initials}
                agentColor={config.color}
                agentPhoto={photo}
                showAvatar={
                  msg.role !== "assistant" ||
                  i === 0 ||
                  messages[i - 1]?.role !== "assistant"
                }
                marginTop={i === 0 ? 0 : messages[i - 1]?.role === msg.role ? 4 : 12}
                onFollowUpAction={(actionId: AgentActionId, prefill?: Record<string, unknown>) =>
                  openAction(actionId, prefill)
                }
                onRestoreDraft={handleRestoreDraft}
              />
            </div>
          ))}

          {isBusy && !hasStreamingMessage && (
            <TypingIndicator
              agentInitials={config.initials}
              agentColor={config.color}
              agentPhoto={photo}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            chatScrollRef.current?.scrollTo({
              top: chatScrollRef.current.scrollHeight,
              behavior: "smooth",
            })
          }
          aria-label="Scroll to latest"
          className={cn(
            "absolute right-4 bottom-4 z-10 grid size-9 cursor-pointer place-items-center rounded-full border-none bg-primary text-primary-foreground shadow-(--vq-shadow-lg) transition-[opacity,transform] duration-200",
            isAtBottom
              ? "pointer-events-none translate-y-2 opacity-0"
              : "pointer-events-auto translate-y-0 opacity-100",
          )}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="shrink-0">
        <ChatInput
          value={content}
          onChange={setContent}
          onSend={handleSend}
          agentSlug={agent}
          onToolsClick={() => setToolsOpen(true)}
          onPickAction={(a) => openAction(a.id)}
          knowledgeSources={wantsSources ? lexSources : undefined}
          attachedSourceIds={wantsSources ? attachedSourceIds : undefined}
          onAttachSource={
            wantsSources
              ? (s) =>
                  setAttachedSourceIds((prev) =>
                    prev.includes(s.sourceId) ? prev : [...prev, s.sourceId],
                  )
              : undefined
          }
          onRemoveAttachedSource={
            wantsSources
              ? (sourceId) =>
                  setAttachedSourceIds((prev) => prev.filter((id) => id !== sourceId))
              : undefined
          }
          placeholder={`Message ${config.name.toLowerCase()}…`}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}
