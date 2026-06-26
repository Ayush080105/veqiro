"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronUp,
  MessageSquare,
  Search,
  Plus,
  TrendingUp,
  Clock,
  Flame,
} from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Sticker } from "@/components/ui/sticker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SubmitFeedbackDrawer } from "@/components/feedback/SubmitFeedbackDrawer"
import {
  useFeedbackList,
  useUpcomingAgents,
  useToggleVote,
  useToggleUpcomingVote,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackPost,
  type UpcomingAgent,
} from "@/lib/api/feedback"
import { FONT } from "@/lib/fonts"
import { cn } from "@/lib/utils"

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_SLUGS = ["vega", "scout", "maya", "sage", "lex", "rex"] as const

const AGENT_COLORS: Record<string, string> = {
  vega: "#6FCDE8",
  scout: "#F5C518",
  maya: "#F06464",
  sage: "#F79FD4",
  lex: "#8A8AF0",
  rex: "#1DBC87",
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: "New", color: "#666", bg: "#f0f0f0" },
  UNDER_REVIEW: { label: "Under Review", color: "#111", bg: "#F5C518" },
  PLANNED: { label: "Planned", color: "#fff", bg: "#8A8AF0" },
  IN_PROGRESS: { label: "In Progress", color: "#111", bg: "#6FCDE8" },
  LAUNCHED: { label: "Launched", color: "#fff", bg: "#1DBC87" },
  DECLINED: { label: "Declined", color: "#fff", bg: "#F06464" },
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  FEATURE_REQUEST: "Feature",
  BUG_REPORT: "Bug",
  INTEGRATION: "Integration",
  NEW_AGENT: "New Agent",
  UX_IMPROVEMENT: "UX",
  GENERAL: "General",
}

const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  FEATURE_REQUEST: "#F5C518",
  BUG_REPORT: "#F06464",
  INTEGRATION: "#8A8AF0",
  NEW_AGENT: "#1DBC87",
  UX_IMPROVEMENT: "#6FCDE8",
  GENERAL: "#F79FD4",
}

const CATEGORY_FILTERS: Array<{ value: FeedbackCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "FEATURE_REQUEST", label: "Feature Requests" },
  { value: "BUG_REPORT", label: "Bugs" },
  { value: "INTEGRATION", label: "Integrations" },
  { value: "NEW_AGENT", label: "New Agent" },
]

const SORT_OPTIONS: Array<{ value: "votes" | "newest" | "trending"; label: string; icon: React.ElementType }> = [
  { value: "votes", label: "Votes", icon: ChevronUp },
  { value: "newest", label: "Newest", icon: Clock },
  { value: "trending", label: "Trending", icon: Flame },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor(diff / 60000)
  if (days > 30) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

// ─── Agent Detail Dialog ──────────────────────────────────────────────────────

function AgentDetailDialog({
  agent,
  onClose,
  onVote,
  isVoting,
}: {
  agent: UpcomingAgent | null
  onClose: () => void
  onVote: (id: string) => void
  isVoting: boolean
}) {
  return (
    <Dialog open={!!agent} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md border-[3px] border-foreground shadow-[8px_8px_0_var(--foreground)] rounded-xl p-0 overflow-hidden">
        {agent && (
          <>
            {/* Color bar */}
            {agent.color && (
              <div className="h-2 w-full" style={{ background: agent.color }} />
            )}
            <div className="flex flex-col gap-5 p-6">
              {/* Header */}
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {agent.emoji && (
                    <span className="text-4xl leading-none">{agent.emoji}</span>
                  )}
                  <div>
                    <DialogTitle
                      className="text-xl font-semibold tracking-tight"
                      style={{ fontFamily: FONT.head }}
                    >
                      {agent.name}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mt-0.5 leading-snug">
                      {agent.tagline}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {agent.description}
                </p>
              )}

              {/* Vote button */}
              <button
                onClick={() => onVote(agent.id)}
                disabled={isVoting}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border-[2.5px] border-foreground px-4 py-2.5 transition-all",
                  agent.hasVoted
                    ? "shadow-none translate-y-px"
                    : "shadow-[4px_4px_0_var(--foreground)] hover:shadow-[2px_2px_0_var(--foreground)] hover:translate-y-px"
                )}
                style={{
                  background: agent.hasVoted ? (agent.color ?? "#1DBC87") : "var(--card)",
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                <ChevronUp className="size-4" />
                <span className="font-medium">{agent.voteCount}</span>
                <span className="text-muted-foreground">{agent.hasVoted ? "voted" : "vote for this agent"}</span>
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Upcoming Agents Section ──────────────────────────────────────────────────

function UpcomingAgentsSection() {
  const { data: agents, isPending } = useUpcomingAgents()
  const { mutate: toggleVote, isPending: isVoting } = useToggleUpcomingVote()
  const [selectedAgent, setSelectedAgent] = useState<UpcomingAgent | null>(null)

  if (isPending) {
    return (
      <section className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          [ vote for the next agent ]
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </section>
    )
  }

  if (!agents || agents.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          [ vote for the next agent ]
        </span>
        <Sticker rotate={3} tone="violet" className="text-[9px] px-2 py-1">
          coming soon
        </Sticker>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className="relative flex flex-col gap-3 rounded-lg border-[3px] border-foreground bg-card p-4 shadow-[5px_5px_0_var(--foreground)] cursor-pointer transition-all hover:shadow-[3px_3px_0_var(--foreground)] hover:translate-x-0.5 hover:translate-y-0.5"
          >
            {agent.color && (
              <div
                className="absolute inset-x-0 top-0 h-1 rounded-t-md"
                style={{ background: agent.color }}
              />
            )}
            <div className="flex items-start gap-2.5 pt-1">
              {agent.emoji && (
                <span className="text-2xl leading-none shrink-0">{agent.emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="font-head text-sm font-medium text-foreground tracking-tight"
                  style={{ fontFamily: FONT.head }}
                >
                  {agent.name}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
                  {agent.tagline}
                </div>
                {agent.description && (
                  <div className="mt-1.5 text-[10px] text-muted-foreground/70 leading-relaxed line-clamp-2">
                    {agent.description}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleVote(agent.id)
              }}
              disabled={isVoting}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md border-[2.5px] border-foreground px-3 py-1.5 transition-all",
                agent.hasVoted
                  ? "shadow-none translate-y-px"
                  : "shadow-[3px_3px_0_var(--foreground)] hover:shadow-[1px_1px_0_var(--foreground)] hover:translate-y-px"
              )}
              style={{
                background: agent.hasVoted ? (agent.color ?? "#1DBC87") : "var(--card)",
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              <ChevronUp className="size-3.5" />
              <span>{agent.voteCount}</span>
              <span className="text-muted-foreground">{agent.hasVoted ? "voted" : "vote"}</span>
            </button>
          </div>
        ))}
      </div>

      <AgentDetailDialog
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onVote={(id) => toggleVote(id)}
        isVoting={isVoting}
      />
    </section>
  )
}

// ─── Feedback Card ────────────────────────────────────────────────────────────

function FeedbackCard({ post, onVote }: { post: FeedbackPost; onVote: (id: string) => void }) {
  const statusConfig = STATUS_CONFIG[post.status]
  const agentColor = post.agentSlug ? AGENT_COLORS[post.agentSlug] : null
  const categoryLabel = CATEGORY_LABELS[post.category]
  const categoryColor = CATEGORY_COLORS[post.category]

  return (
    <Link
      href={`/feedback/${post.id}`}
      className="flex items-stretch gap-0 rounded-lg border-[3px] border-foreground bg-card shadow-[4px_4px_0_var(--foreground)] no-underline transition-all hover:shadow-[2px_2px_0_var(--foreground)] hover:translate-x-0.5 hover:translate-y-0.5 group"
    >
      {/* Vote button column */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onVote(post.id)
        }}
        className={cn(
          "flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-l-md border-r-[3px] border-foreground py-3 transition-all duration-150 sm:w-14",
          post.hasVoted ? "text-foreground" : "bg-muted/50 hover:bg-muted text-foreground"
        )}
        style={post.hasVoted ? { background: categoryColor } : undefined}
      >
        <ChevronUp className={cn("size-4", post.hasVoted && "fill-current")} />
        <span
          style={{ fontFamily: FONT.mono, fontSize: 13 }}
          className="font-medium leading-none"
        >
          {post.voteCount}
        </span>
      </button>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-start gap-1.5">
          {/* Category badge */}
          <span
            className="rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] uppercase tracking-wide"
            style={{ fontFamily: FONT.mono, background: "var(--muted)" }}
          >
            {categoryLabel}
          </span>
          {/* Agent badge */}
          {post.agentSlug && agentColor && (
            <span
              className="rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium"
              style={{ fontFamily: FONT.mono, background: agentColor + "33", color: agentColor, borderColor: agentColor + "66" }}
            >
              {post.agentSlug}
            </span>
          )}
          {/* Status badge */}
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium"
            style={{
              fontFamily: FONT.mono,
              background: statusConfig.bg,
              color: statusConfig.color,
              border: `1px solid ${statusConfig.bg === "#f0f0f0" ? "var(--border)" : statusConfig.bg}`,
            }}
          >
            {statusConfig.label}
          </span>
        </div>

        <h3
          className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-foreground/80 transition-colors"
          style={{ fontFamily: FONT.head }}
        >
          {post.title}
        </h3>

        {post.isMerged && (
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
            merged into another post
          </span>
        )}

        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1 text-[11px]">
            <MessageSquare className="size-3" />
            {post._count.comments}
          </span>
          <span className="text-[11px]" style={{ fontFamily: FONT.mono }}>
            {timeAgo(post.createdAt)}
          </span>
          <span className="text-[11px]" style={{ fontFamily: FONT.mono }}>
            by {post.createdBy.name}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | undefined>(undefined)
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<"votes" | "newest" | "trending">("votes")
  const [search, setSearch] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: posts, isPending, isError } = useFeedbackList({
    category: categoryFilter,
    agentSlug: agentFilter,
    sort,
    search: search.length >= 2 ? search : undefined,
  })

  const { mutate: toggleVote } = useToggleVote()

  return (
    <div className="flex flex-col gap-6 pb-10 sm:gap-8">
      {/* Header */}
      <PageHeader
        kicker="community"
        title="feedback & roadmap."
        subtitle="Vote on features, report bugs, and shape what we build next."
        sticker={<Sticker rotate={-5} tone="pink">your voice</Sticker>}
        right={
          <Button
            variant="brand-dark"
            size="brand-sm"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus className="size-4" />
            Submit Feedback
          </Button>
        }
      />

      {/* Upcoming Agents */}
      <UpcomingAgentsSection />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-[3px] flex-1 bg-foreground/10" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          [ community feedback ]
        </span>
        <div className="h-[3px] flex-1 bg-foreground/10" />
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-col gap-3">
        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_FILTERS.map((f) => {
            const isActive = f.value === "ALL" ? !categoryFilter : categoryFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value === "ALL" ? undefined : f.value)}
                className={cn(
                  "rounded-full border-[2.5px] border-foreground px-3 py-1 text-xs font-head uppercase tracking-wide transition-all",
                  isActive
                    ? "bg-foreground text-background shadow-none translate-y-px"
                    : "bg-card shadow-[3px_3px_0_var(--foreground)] hover:shadow-[1px_1px_0_var(--foreground)] hover:translate-y-px"
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Agent filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span
            className="text-muted-foreground mr-1"
            style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Agent:
          </span>
          <button
            onClick={() => setAgentFilter(undefined)}
            className={cn(
              "rounded-full border-[2px] border-foreground/40 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide transition-all",
              !agentFilter ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted"
            )}
          >
            All
          </button>
          {AGENT_SLUGS.map((slug) => (
            <button
              key={slug}
              onClick={() => setAgentFilter(agentFilter === slug ? undefined : slug)}
              className={cn(
                "rounded-full border-[2px] border-foreground/40 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide transition-all",
                agentFilter === slug ? "border-foreground" : "bg-card hover:bg-muted"
              )}
              style={{
                background: agentFilter === slug ? AGENT_COLORS[slug] : undefined,
                borderColor: agentFilter === slug ? AGENT_COLORS[slug] : undefined,
              }}
            >
              {slug}
            </button>
          ))}
          <button
            onClick={() => setAgentFilter(agentFilter === "__platform" ? undefined : "__platform")}
            className={cn(
              "rounded-full border-[2px] border-foreground/40 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide transition-all",
              agentFilter === "__platform" ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted"
            )}
          >
            Platform
          </button>
        </div>

        {/* Sort + Search + Submit button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border-[2.5px] border-foreground p-0.5 shadow-[3px_3px_0_var(--foreground)]">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide transition-colors",
                    sort === opt.value ? "bg-foreground text-background" : "hover:bg-muted"
                  )}
                >
                  <Icon className="size-3" />
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search feedback..."
              className="w-full rounded-md border-[2.5px] border-foreground bg-card pl-8 pr-3 py-1.5 text-sm shadow-[3px_3px_0_var(--foreground)] outline-none focus:shadow-[1px_1px_0_var(--foreground)] focus:translate-x-0.5 focus:translate-y-0.5 transition-all placeholder:text-muted-foreground"
              style={{ fontFamily: FONT.body }}
            />
          </div>

          <Button
            variant="brand-dark"
            size="brand-sm"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0"
          >
            <Plus className="size-4" />
            Submit
          </Button>
        </div>
      </div>

      {/* Feedback list */}
      <div className="flex flex-col gap-3">
        {isPending ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-[3px] border-foreground bg-card py-16 shadow-[5px_5px_0_var(--foreground)]">
            <div
              className="grid size-12 place-items-center rounded-lg border-[2.5px] border-foreground bg-muted shadow-[3px_3px_0_var(--foreground)]"
              style={{ transform: "rotate(-4deg)" }}
            >
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-head text-base font-medium text-foreground">Failed to load feedback</p>
              <p className="mt-1 text-sm text-muted-foreground">Something went wrong. Please try refreshing the page.</p>
            </div>
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-[3px] border-foreground bg-card py-16 shadow-[5px_5px_0_var(--foreground)]">
            <div
              className="grid size-12 place-items-center rounded-lg border-[2.5px] border-foreground bg-muted shadow-[3px_3px_0_var(--foreground)]"
              style={{ transform: "rotate(-4deg)" }}
            >
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-head text-base font-medium text-foreground">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search
                  ? "Try a different search term."
                  : (categoryFilter ?? agentFilter)
                  ? "No one's asked for this yet — be the first to raise it."
                  : "Be the first to submit feedback!"}
              </p>
            </div>
            <Button variant="brand-dark" size="brand-sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="size-4" />
              Submit Feedback
            </Button>
          </div>
        ) : (
          posts.map((post) => (
            <FeedbackCard key={post.id} post={post} onVote={toggleVote} />
          ))
        )}
      </div>

      {/* Submit drawer */}
      <SubmitFeedbackDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}
