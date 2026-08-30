"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronUp,
  MessageSquare,
  Search,
  Plus,
  Clock,
  Flame,
} from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Sticker } from "@/components/ui/sticker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under Review",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  LAUNCHED: "Launched",
  DECLINED: "Declined",
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  FEATURE_REQUEST: "Feature",
  BUG_REPORT: "Bug",
  INTEGRATION: "Integration",
  NEW_AGENT: "New Agent",
  UX_IMPROVEMENT: "UX",
  GENERAL: "General",
}

const CATEGORY_FILTERS: Array<{ value: FeedbackCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "FEATURE_REQUEST", label: "Feature Requests" },
  { value: "BUG_REPORT", label: "Bugs" },
  { value: "INTEGRATION", label: "Integrations" },
  { value: "NEW_AGENT", label: "New Agent" },
  { value: "UX_IMPROVEMENT", label: "UX" },
  { value: "GENERAL", label: "General" },
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
      <DialogContent className="max-w-md overflow-hidden p-0">
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
              <Button
                type="button"
                variant={agent.hasVoted ? "secondary" : "outline"}
                size="lg"
                onClick={() => onVote(agent.id)}
                disabled={isVoting}
                className="w-full gap-2 font-mono text-[11px] uppercase tracking-[0.12em]"
              >
                <ChevronUp className="size-4" />
                <span className="font-medium">{agent.voteCount}</span>
                <span className="text-muted-foreground">{agent.hasVoted ? "voted" : "vote for this agent"}</span>
              </Button>
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
          <Card
            variant="brand"
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className="relative cursor-pointer gap-3 overflow-hidden p-4 transition-shadow hover:shadow-[var(--vq-shadow-lg)]"
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
            <Button
              type="button"
              variant={agent.hasVoted ? "secondary" : "outline"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                toggleVote(agent.id)
              }}
              disabled={isVoting}
              className="w-full gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
            >
              <ChevronUp className="size-3.5" />
              <span>{agent.voteCount}</span>
              <span className="text-muted-foreground">{agent.hasVoted ? "voted" : "vote"}</span>
            </Button>
          </Card>
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
  const categoryLabel = CATEGORY_LABELS[post.category]

  return (
    <Card
      variant="brand"
      className="group gap-0 overflow-hidden p-0 py-0 transition-shadow hover:shadow-[var(--vq-shadow-lg)]"
    >
      <Link
        href={`/feedback/${post.id}`}
        className="flex items-stretch gap-0 no-underline"
      >
        {/* Vote button column */}
        <Button
          type="button"
          variant={post.hasVoted ? "secondary" : "ghost"}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onVote(post.id)
          }}
          className="h-auto w-12 shrink-0 flex-col gap-0.5 self-stretch rounded-none border-0 border-r border-[var(--vq-line-2)] py-3 sm:w-14"
        >
          <ChevronUp className={cn("size-4", post.hasVoted && "fill-current")} />
          <span className="font-mono text-[13px] font-medium leading-none">
            {post.voteCount}
          </span>
        </Button>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-start gap-1.5">
            <Badge
              variant="secondary"
              className="rounded-full font-mono text-[10px] uppercase tracking-wide"
            >
              {categoryLabel}
            </Badge>
            {post.agentSlug && (
              <Badge
                variant="outline"
                className="rounded-full font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                {post.agentSlug}
              </Badge>
            )}
            <Badge
              variant="brand-mono"
              className="ml-auto rounded-full bg-muted px-2 tracking-wide"
            >
              {STATUS_LABELS[post.status]}
            </Badge>
          </div>

          <h3
            className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-foreground/80"
            style={{ fontFamily: FONT.head }}
          >
            {post.title}
          </h3>

          {post.isMerged && (
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              merged into another post
            </span>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="flex items-center gap-1 text-[11px]">
              <MessageSquare className="size-3" />
              {post._count.comments}
            </span>
            <span className="font-mono text-[11px]">{timeAgo(post.createdAt)}</span>
            <span className="font-mono text-[11px]">by {post.createdBy.name}</span>
          </div>
        </div>
      </Link>
    </Card>
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
      <Card variant="brand" size="sm" className="gap-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORY_FILTERS.map((filter) => {
              const isActive = filter.value === "ALL"
                ? !categoryFilter
                : categoryFilter === filter.value
              return (
                <Button
                  key={filter.value}
                  type="button"
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() =>
                    setCategoryFilter(filter.value === "ALL" ? undefined : filter.value)
                  }
                  className="shrink-0 rounded-full px-3 font-display"
                >
                  {filter.label}
                </Button>
              )
            })}
          </div>

          <Select
            value={agentFilter ?? "__all"}
            onValueChange={(value) =>
              setAgentFilter(!value || value === "__all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-full shrink-0 rounded-md bg-card sm:w-[150px]">
              <SelectValue placeholder="All agents">
                {(value) => {
                  if (!value || value === "__all") return "All agents"
                  if (value === "__platform") return "Platform"
                  const slug = String(value)
                  return slug.charAt(0).toUpperCase() + slug.slice(1)
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All agents</SelectItem>
              {AGENT_SLUGS.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {slug.charAt(0).toUpperCase() + slug.slice(1)}
                </SelectItem>
              ))}
              <SelectItem value="__platform">Platform</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--vq-line-2)] bg-card p-0.5">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant={sort === opt.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSort(opt.value)}
                  className="gap-1 rounded-md px-2 font-mono text-[10px] uppercase tracking-wide sm:px-2.5"
                >
                  <Icon className="size-3" />
                  {opt.label}
                </Button>
              )
            })}
          </div>

          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search feedback..."
              className="bg-card pl-8 font-body"
            />
          </div>

          <Button
            type="button"
            variant="brand-dark"
            size="brand-sm"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0"
          >
            <Plus className="size-4" />
            Submit
          </Button>
        </div>
      </Card>

      {/* Feedback list */}
      <div className="flex flex-col gap-3">
        {isPending ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </>
        ) : isError ? (
          <Card variant="brand" className="items-center gap-3 px-4 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-lg border border-[var(--vq-line-2)] bg-muted shadow-[var(--vq-shadow-sm)]">
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-head text-base font-medium text-foreground">Failed to load feedback</p>
              <p className="mt-1 text-sm text-muted-foreground">Something went wrong. Please try refreshing the page.</p>
            </div>
          </Card>
        ) : !posts || posts.length === 0 ? (
          <Card variant="brand" className="items-center gap-3 px-4 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-lg border border-[var(--vq-line-2)] bg-muted shadow-[var(--vq-shadow-sm)]">
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-head text-base font-medium text-foreground">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search
                  ? "Try a different search term."
                  : (categoryFilter ?? agentFilter)
                  ? "No one's asked for this yet — be the first to raise it."
                  : "Be the first to submit feedback!"}
              </p>
            </div>
            <Button type="button" variant="brand-dark" size="brand-sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="size-4" />
              Submit Feedback
            </Button>
          </Card>
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
