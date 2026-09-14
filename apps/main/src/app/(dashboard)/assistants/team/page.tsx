"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Send, Loader2, Users } from "lucide-react"
import { toast } from "sonner"

import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { AGENT_PHOTOS, getAgent } from "@/lib/config/agents"
import { useTeam, useTeamMessages, useSendTeamMessage } from "@/lib/api/team"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import type { Message } from "@/lib/types"

/**
 * The shared team room.
 *
 * One thread where every agent the org is entitled to can be assigned work by
 * the planner. Deliberately reuses ChatMessage, so a planned run renders the
 * same task graph here as it does in an individual chat.
 */
export default function TeamPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id

  const { data: team, isLoading: teamLoading } = useTeam()
  const { data: history, isLoading: historyLoading } = useTeamMessages(organizationId)
  const send = useSendTeamMessage(organizationId)

  const [content, setContent] = useState("")
  const [pending, setPending] = useState<Message[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Server returns newest-first for pagination; the thread reads oldest-first.
  const messages = useMemo(
    () => [...(history ?? [])].reverse().concat(pending),
    [history, pending],
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, send.isPending])

  const agents = team?.agents ?? []
  const enoughForATeam = agents.length >= 2

  const submit = async () => {
    const text = content.trim()
    if (!text || send.isPending) return
    setContent("")
    // Optimistic echo so the room does not look frozen during planning, which
    // takes a few seconds longer than an ordinary turn.
    setPending([
      {
        role: "user",
        content: text,
        imageUrl: null,
        createdAt: new Date().toISOString(),
      } as Message,
    ])
    try {
      await send.mutateAsync(text)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the team")
      setContent(text)
    } finally {
      setPending([])
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-(--vq-line-2) bg-card px-5 py-3.5">
        <div className="flex shrink-0">
          {agents.slice(0, 6).map((slug, i) => (
            <span
              key={slug}
              title={getAgent(slug.toLowerCase())?.name ?? slug}
              className={cn(
                "block size-8 overflow-hidden rounded-full border-2 border-card",
                i !== 0 && "-ml-2.75"
              )}
              style={{ background: (getAgent(slug.toLowerCase())?.color as string) ?? "var(--background)" }}
            >
              {AGENT_PHOTOS[slug.toLowerCase()] && (
                <Image
                  src={AGENT_PHOTOS[slug.toLowerCase()]}
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              )}
            </span>
          ))}
        </div>
        <div className="min-w-0">
          <div className="font-head text-[17px] font-bold text-foreground">
            Team
          </div>
          <div className="mt-px text-xs text-muted-foreground">
            {teamLoading
              ? "…"
              : enoughForATeam
                ? `${agents.map((a) => getAgent(a.toLowerCase())?.name ?? a).join(", ")}`
                : "Not enough agents yet"}
          </div>
        </div>
      </div>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 sm:px-5"
      >
        {!enoughForATeam && !teamLoading ? (
          <EmptyTeam count={agents.length} />
        ) : historyLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading the room…
          </div>
        ) : messages.length === 0 ? (
          <EmptyThread />
        ) : (
          messages.map((m, i) => {
            // Unlike a per-agent chat, the speaker changes per message here.
            const cfg = getAgent((m.agent ?? team?.lead ?? "vega").toLowerCase())
            return (
              <ChatMessage
                key={m.id ?? `pending-${i}`}
                message={m}
                agentInitials={cfg?.initials ?? "T"}
                agentColor={(cfg?.color as string) ?? "var(--vq-yellow)"}
                agentPhoto={AGENT_PHOTOS[(m.agent ?? "").toLowerCase()]}
              />
            )
          })
        )}
        {send.isPending && (
          <TypingIndicator
            agentInitials={getAgent((team?.lead ?? "vega").toLowerCase())?.initials ?? "T"}
            agentColor={(getAgent((team?.lead ?? "vega").toLowerCase())?.color as string) ?? undefined}
            agentPhoto={AGENT_PHOTOS[(team?.lead ?? "vega").toLowerCase()]}
          />
        )}
      </div>

      {/* Composer */}
      <div className="bg-background px-5 pt-3 pb-4">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-[var(--vq-r)] border border-border bg-card py-2 pr-2 pl-4",
            !enoughForATeam && "opacity-50"
          )}
        >
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            disabled={!enoughForATeam || send.isPending}
            placeholder={
              enoughForATeam
                ? "Give the team something that spans a few of them…"
                : "Hire another agent to use the team room"
            }
            className="flex-1 border-none bg-transparent text-sm text-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!enoughForATeam || send.isPending || !content.trim()}
            aria-label="Send"
            className={cn(
              "grid size-9 place-items-center rounded-[var(--vq-r-sm)] border-none bg-primary text-primary-foreground",
              content.trim() && enoughForATeam ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-40"
            )}
          >
            {send.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyTeam({ count }: { count: number }) {
  return (
    <div className="mx-auto my-12 max-w-115 text-center">
      <Users size={28} className="mx-auto mb-3 text-muted-foreground" />
      <div className="font-head text-lg font-bold text-foreground">
        The team room needs at least two agents
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        {count === 1
          ? "You have one agent. Hire another and they can work a single task together, each using their own connected tools."
          : "Hire a couple of agents and they can work a single task together, each using their own connected tools."}
      </p>
      <Link
        href="/settings/billing"
        className="mt-3.5 inline-block rounded-lg bg-primary px-4.5 py-2.25 text-[13.5px] font-medium text-primary-foreground no-underline"
      >
        See agents
      </Link>
    </div>
  )
}

function EmptyThread() {
  return (
    <div className="mx-auto my-10 box-border w-full max-w-120 px-1 text-center">
      <div className="font-head text-[17px] font-bold text-foreground">
        Give the whole team one job
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Ask for something that needs more than one of them. They&apos;ll plan it
        out as a set of steps for you to approve before anything runs.
      </p>
      <div className="mt-3.5 grid gap-2 text-left">
        {[
          "Research what competitors shipped this month and draft a post about how we differ",
          "Pull last quarter's numbers, check the contract terms, and summarise the risks",
        ].map((p) => (
          <div
            key={p}
            className="rounded-[var(--vq-r-sm)] border border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground"
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  )
}
