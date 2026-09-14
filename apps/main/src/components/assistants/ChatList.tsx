"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Search, Lock, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react"
import { useMutationState } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"
import { AGENTS, AGENT_PHOTOS } from "@/lib/config/agents"
import { useAgentStatuses, useLastMessages } from "@/lib/api/assistants"
import { useUpcomingAgents, type UpcomingAgent } from "@/lib/api/feedback"
import { useSearchMessages } from "@/lib/api/messages"
import { useIsMobile } from "@/hooks/use-mobile"
import { stripMarkdown, cn } from "@/lib/utils"
import { TeamRow } from "./TeamRow"
import type {
  AgentStatusData,
  AgentConfig,
  AgentSlug,
  LastMessage,
} from "@/lib/types"

/** Debounce a fast-changing value so search-as-you-type doesn't fire a
 * request per keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes vq-blink {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
        .vq-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--foreground); margin: 0 1.5px; animation: vq-blink 1.2s infinite ease-in-out; }
        .vq-dot:nth-child(2) { animation-delay: 0.2s; }
        .vq-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <span className="inline-flex items-center gap-px">
        <span className="vq-dot" />
        <span className="vq-dot" />
        <span className="vq-dot" />
      </span>
    </>
  )
}

const STATUS_DOT: Record<AgentStatusData["status"], string> = {
  working: "var(--vq-yellow)",
  idle: "var(--vq-green)",
  "needs-attention": "var(--vq-red)",
}

const EMPTY_UNREAD_SET = new Set<string>()

function formatRelative(iso: string | undefined | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function previewLine(
  last: LastMessage | null,
  fallback: string | undefined,
): string {
  if (last) {
    const prefix = last.role === "user" ? "You: " : ""
    return `${prefix}${stripMarkdown(last.content)}`.replace(/\s+/g, " ").trim()
  }
  return fallback ?? "No messages yet"
}

function useUnreadTracker(
  lastMap: Record<string, LastMessage | null> | undefined,
  pathname: string,
  organizationId: string,
): Set<string> {
  const [unreadState, setUnreadState] = useState<{
    organizationId: string
    unread: Set<string>
  }>({ organizationId: "", unread: EMPTY_UNREAD_SET })

  useEffect(() => {
    if (!lastMap || !organizationId) return

    const activeAgent = pathname.match(/^\/assistants\/(\w+)$/)?.[1]
    const keyPrefix = `vq.lastRead:v2:${organizationId}:`

    const recompute = () => {
      const unread = new Set<string>()

      for (const [id, msg] of Object.entries(lastMap)) {
        if (!msg || msg.role !== "assistant") continue
        const messageTime = new Date(msg.createdAt).getTime()
        if (!Number.isFinite(messageTime)) continue

        try {
          const key = `${keyPrefix}${id}`
          const stored = localStorage.getItem(key)
          const lastRead = stored === null ? null : Number(stored)

          // Seeing a response while its chat is already open counts as read.
          // Previously only the initial route change was recorded, so a reply
          // arriving seconds later became "unread" as soon as the user left.
          if (id === activeAgent) {
            if (lastRead === null || !Number.isFinite(lastRead) || messageTime > lastRead) {
              localStorage.setItem(key, String(messageTime))
            }
            continue
          }

          // This client-only tracker has no reliable history for a newly used
          // browser. Baseline existing messages as seen instead of claiming a
          // ten-day-old response is newly unread on that device.
          if (lastRead === null || !Number.isFinite(lastRead)) {
            localStorage.setItem(key, String(messageTime))
            continue
          }

          if (messageTime > lastRead) unread.add(id)
        } catch {
          // localStorage can be unavailable in privacy-restricted contexts.
        }
      }

      setUnreadState({ organizationId, unread })
    }

    recompute()

    // Keep multiple tabs in the same browser aligned. Cross-device syncing
    // still requires a real server-side read-receipt model.
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith(keyPrefix)) recompute()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [lastMap, pathname, organizationId])

  return unreadState.organizationId === organizationId
    ? unreadState.unread
    : EMPTY_UNREAD_SET
}

function AgentRow({
  agent,
  active,
  status,
  last,
  isTyping,
  unread,
}: {
  agent: AgentConfig
  active: boolean
  status: AgentStatusData | undefined
  last: LastMessage | null
  isTyping: boolean
  unread: boolean
}) {
  const photo = AGENT_PHOTOS[agent.id]
  const dot = isTyping ? "var(--vq-yellow)" : STATUS_DOT[status?.status ?? "idle"]
  const preview = previewLine(last, status?.lastActivity)
  const time = isTyping ? "now" : formatRelative(last?.createdAt)

  return (
    <Link
      href={`/assistants/${agent.id}`}
      data-tour={`assistant-row-${agent.id}`}
      className={cn(
        "relative flex items-center gap-3 border-b border-(--vq-line-2) px-3.5 py-3 text-foreground no-underline transition-colors hover:bg-muted/60",
        active ? "bg-muted" : "bg-transparent"
      )}
    >
      <div className="relative shrink-0 size-11.5 overflow-hidden rounded-full" style={{ background: agent.color }}>
        {photo ? (
          <Image
            src={photo}
            alt={agent.name}
            width={46}
            height={46}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-head text-sm">
            {agent.initials}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-head text-[15px] tracking-tight text-foreground">
            {agent.name}
          </span>
          {time && (
            <span className="shrink-0 font-mono text-[10px] tracking-[0.02em] text-muted-foreground">
              {time}
            </span>
          )}
        </div>
        <div className="mt-px mb-1 truncate text-xs text-muted-foreground">
          {agent.role}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.75 shrink-0 rounded-full" style={{ background: dot }} />
          <span className="flex-1 truncate font-body text-[13px] text-foreground/80">
            {isTyping ? <TypingDots /> : preview}
          </span>
          {unread && !active && (
            <span className="grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-chart-2 px-1 font-mono text-[9px] font-bold text-white shadow-sm">
              1
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function UpcomingAgentRow({ agent, active }: { agent: UpcomingAgent; active: boolean }) {
  return (
    <Link
      href={`/assistants/upcoming/${agent.id}`}
      className={cn(
        "relative flex items-center gap-3 border-b border-(--vq-line-2) px-3.5 py-3 text-foreground no-underline opacity-75 transition-colors hover:bg-muted/60",
        active ? "bg-muted" : "bg-transparent"
      )}
    >
      <div className="relative shrink-0">
        <div
          className="grid size-11.5 place-items-center rounded-full font-head text-sm text-white"
          style={{ background: agent.color ?? "var(--muted-foreground)" }}
        >
          {agent.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="absolute right-0 bottom-0 grid size-4.5 place-items-center rounded-full border border-(--vq-line-2) bg-card">
          <Lock className="size-2.5 text-muted-foreground" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-head text-[15px] tracking-tight text-foreground">
          {agent.name}
        </div>
        <div className="mt-0.5 truncate font-body text-xs text-muted-foreground">
          {agent.tagline}
        </div>
      </div>
    </Link>
  )
}

function RailAvatar({
  href,
  active,
  color,
  initials,
  photo,
  unread,
  isTyping,
  title,
}: {
  href: string
  active: boolean
  color: string
  initials: string
  photo?: string
  unread: boolean
  isTyping: boolean
  title: string
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className="relative flex justify-center py-1.5"
    >
      <div
        className="relative size-10.5 overflow-hidden rounded-full"
        style={{
          background: color,
          boxShadow: active ? "0 0 0 2px var(--card), 0 0 0 4px var(--ring)" : "none",
        }}
      >
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={42}
            height={42}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-head text-[13px] text-white">
            {initials}
          </div>
        )}
        <span
          className={cn(
            "absolute -right-px -bottom-px size-2.5 rounded-full",
            (unread || isTyping) && "border-2 border-card"
          )}
          style={{ background: isTyping ? "var(--vq-yellow)" : unread ? "var(--vq-green)" : "transparent" }}
        />
      </div>
    </Link>
  )
}

export default function ChatList({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
} = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const isMobile = useIsMobile()
  // The rail is a desktop-only affordance — mobile always gets the full,
  // readable list since it already has its own single-pane view.
  const showRail = collapsed && !isMobile

  const { data: statuses } = useAgentStatuses(organizationId)
  const { data: lastMap } = useLastMessages(organizationId)
  const { data: upcomingAgents } = useUpcomingAgents()
  const [query, setQuery] = useState("")
  const unreadSet = useUnreadTracker(lastMap, pathname, organizationId)

  // Search is scoped to whichever single agent's chat is open — "one long
  // relationship per coworker", not a global cross-agent search. Outside a
  // chat, the same box just filters the crew list below (existing behaviour).
  const activeAgentMatch = pathname.match(/^\/assistants\/(\w+)$/)?.[1]
  const activeAgentSlug =
    activeAgentMatch && AGENTS.some((a) => a.id === activeAgentMatch) ? (activeAgentMatch as AgentSlug) : null
  const debouncedQuery = useDebounced(query, 300)
  const { data: messageResults, isFetching: isSearchingMessages } = useSearchMessages(
    activeAgentSlug,
    debouncedQuery,
  )
  const showMessageResults = !!activeAgentSlug && debouncedQuery.trim().length >= 2

  // Detect which agents have an in-flight sendMessage mutation.
  // useMutationState lives on the QueryClient so it survives navigation.
  const pendingMutations = useMutationState({
    filters: { status: "pending" },
    select: (m) => m.options.mutationKey,
  })
  const typingAgentIds = new Set(
    pendingMutations
      .filter((key): key is unknown[] => Array.isArray(key) && key[0] === "sendMessage")
      .map((key) => key[1] as string)
  )

  const filtered = AGENTS.filter((a) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    )
  })

  if (showRail) {
    return (
      <aside
        data-tour="assistants-sidebar"
        className="flex h-full w-full flex-col items-center overflow-hidden bg-card"
      >
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Expand assistants list"
            aria-label="Expand assistants list"
            className="mt-3 flex size-9 items-center justify-center rounded-[var(--vq-r-sm)] text-muted-foreground transition-colors hover:bg-muted"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        <Link
          href="/assistants/team"
          title="Team"
          aria-label="Team"
          className="mt-2 flex size-9 items-center justify-center rounded-[var(--vq-r-sm)] text-muted-foreground transition-colors hover:bg-muted"
        >
          <Users className="size-4" />
        </Link>
        <div className="my-1.5 h-px w-6 bg-(--vq-line-2)" />
        <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-2">
          {AGENTS.map((agent) => (
            <RailAvatar
              key={agent.id}
              href={`/assistants/${agent.id}`}
              active={pathname === `/assistants/${agent.id}`}
              color={agent.color as string}
              initials={agent.initials}
              photo={AGENT_PHOTOS[agent.id]}
              unread={unreadSet.has(agent.id)}
              isTyping={typingAgentIds.has(agent.id)}
              title={agent.name}
            />
          ))}
        </div>
      </aside>
    )
  }

  return (
    <aside
      data-tour="assistants-sidebar"
      className="flex h-full w-full flex-col overflow-hidden bg-card"
    >
      <div className="flex items-start justify-between gap-2 border-b border-(--vq-line-2) bg-card px-4 pt-4 pb-3">
        <div>
          <h2 className="m-0 font-head text-xl leading-none font-bold text-foreground">
            Assistants
          </h2>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Six focused workspaces
          </div>
        </div>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse assistants list"
            aria-label="Collapse assistants list"
            className="hidden size-8 shrink-0 items-center justify-center rounded-[var(--vq-r-sm)] text-muted-foreground transition-colors hover:bg-muted md:flex"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <div className="border-b border-(--vq-line-2) bg-card px-3 py-2">
        <div className="flex items-center gap-2 rounded-[var(--vq-r-sm)] border border-border bg-background px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeAgentSlug ? `Search ${activeAgentSlug}'s messages` : "Search assistants"}
            className="flex-1 border-none bg-transparent font-body text-[13px] text-foreground outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {showMessageResults ? (
          <div className="px-1 py-1">
            {isSearchingMessages && !messageResults ? (
              <div className="px-2.5 py-3 text-center text-[12px] text-muted-foreground">Searching…</div>
            ) : messageResults && messageResults.length > 0 ? (
              messageResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (!m.id || !activeAgentSlug) return
                    router.push(
                      `/assistants/${activeAgentSlug}?jump=${encodeURIComponent(m.id)}&at=${encodeURIComponent(m.createdAt)}`,
                    )
                  }}
                  className="block w-full cursor-pointer rounded-[var(--vq-r-sm)] border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {m.role === "user" ? "You" : activeAgentSlug}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatRelative(m.createdAt)}
                    </span>
                  </div>
                  <div className="truncate font-body text-[13px] text-foreground">
                    {stripMarkdown(m.content) || "(no text)"}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-2.5 py-3 text-center text-[12px] text-muted-foreground">
                No messages match &ldquo;{debouncedQuery}&rdquo;.
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Pinned above the six: one room where the agents you own work a
                single task together. Not filtered by search — it is a place, not
                an agent. */}
            <TeamRow />
            {filtered.map((agent) => {
              const active = pathname === `/assistants/${agent.id}`
              return (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  active={active}
                  status={statuses?.[agent.id]}
                  last={lastMap?.[agent.id] ?? null}
                  isTyping={typingAgentIds.has(agent.id)}
                  unread={unreadSet.has(agent.id)}
                />
              )
            })}

            {upcomingAgents && upcomingAgents.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-b border-(--vq-line-2) px-3.5 pt-2.5 pb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </div>
                {upcomingAgents.map((agent) => (
                  <UpcomingAgentRow
                    key={agent.id}
                    agent={agent}
                    active={pathname === `/assistants/upcoming/${agent.id}`}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
