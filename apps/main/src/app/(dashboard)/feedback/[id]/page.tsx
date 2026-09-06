"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronUp,
  MessageSquare,
  Calendar,
  GitMerge,
  Shield,
} from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useFeedbackDetail,
  useToggleVote,
  useAddComment,
  type FeedbackCategory,
  type FeedbackStatus,
} from "@/lib/api/feedback"
import { FONT } from "@/lib/fonts"
import { cn } from "@/lib/utils"

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  vega: "var(--vq-blue)",
  scout: "var(--vq-yellow)",
  maya: "var(--vq-red)",
  sage: "var(--vq-pink)",
  lex: "var(--vq-violet)",
  rex: "var(--vq-green)",
}

// `color` is a darkened mix of the accent (not the raw token) so status text
// stays readable on the light tinted `bg` — matching the accent 1:1 reads
// too bright/low-contrast for small uppercase labels.
const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: "New", color: "var(--muted-foreground)", bg: "var(--muted)" },
  UNDER_REVIEW: { label: "Under Review", color: "color-mix(in srgb, var(--vq-yellow) 65%, black)", bg: "color-mix(in srgb, var(--vq-yellow) 15%, transparent)" },
  PLANNED: { label: "Planned", color: "color-mix(in srgb, var(--vq-violet) 55%, black)", bg: "color-mix(in srgb, var(--vq-violet) 15%, transparent)" },
  IN_PROGRESS: { label: "In Progress", color: "color-mix(in srgb, var(--vq-blue) 55%, black)", bg: "color-mix(in srgb, var(--vq-blue) 15%, transparent)" },
  LAUNCHED: { label: "Launched", color: "color-mix(in srgb, var(--vq-green) 60%, black)", bg: "color-mix(in srgb, var(--vq-green) 15%, transparent)" },
  DECLINED: { label: "Declined", color: "color-mix(in srgb, var(--vq-red) 55%, black)", bg: "color-mix(in srgb, var(--vq-red) 15%, transparent)" },
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  FEATURE_REQUEST: "Feature",
  BUG_REPORT: "Bug",
  INTEGRATION: "Integration",
  NEW_AGENT: "New Agent",
  UX_IMPROVEMENT: "UX",
  GENERAL: "General",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor(diff / 60000)
  if (days > 30)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: post, isPending, isError } = useFeedbackDetail(id)
  const { mutate: toggleVote, isPending: isVoting } = useToggleVote()
  const { mutate: addComment, isPending: isCommenting } = useAddComment(id)

  const [commentText, setCommentText] = useState("")

  const handleSubmitComment = () => {
    const trimmed = commentText.trim()
    if (trimmed.length < 1) return
    addComment(trimmed, {
      onSuccess: () => setCommentText(""),
    })
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div
          className="grid size-14 place-items-center rounded-lg border border-(--vq-line-2) bg-muted shadow-(--vq-shadow-sm)"
        >
          <MessageSquare className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-head text-lg font-medium text-foreground">Failed to load post</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong. Please try again.
          </p>
        </div>
        <Button variant="brand-ghost" size="brand-sm" onClick={() => router.push("/feedback")}>
          <ArrowLeft className="size-4" />
          Back to Feedback
        </Button>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div
          className="grid size-14 place-items-center rounded-lg border border-(--vq-line-2) bg-muted shadow-(--vq-shadow-sm)"
        >
          <MessageSquare className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-head text-lg font-medium text-foreground">Post not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This feedback post may have been removed or doesn&apos;t exist.
          </p>
        </div>
        <Button variant="brand-ghost" size="brand-sm" onClick={() => router.push("/feedback")}>
          <ArrowLeft className="size-4" />
          Back to Feedback
        </Button>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[post.status]
  const agentColor = post.agentSlug ? AGENT_COLORS[post.agentSlug] : null
  const categoryLabel = CATEGORY_LABELS[post.category]

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Back button */}
      <Link
        href="/feedback"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground transition-colors w-fit"
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        <ArrowLeft className="size-3.5" />
        Back to Feedback
      </Link>

      {/* Merged notice */}
      {post.isMerged && (
        <div className="flex items-center gap-2.5 rounded-md border border-(--vq-line-2) bg-muted px-4 py-3 shadow-(--vq-shadow-sm)">
          <GitMerge className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This request has been merged into another post.
          </p>
        </div>
      )}

      {/* Post header */}
      <div className="flex items-start gap-5">
        {/* Vote button */}
        <button
          onClick={() => toggleVote(id)}
          disabled={isVoting}
          className={cn(
            "flex shrink-0 flex-col items-center gap-1 rounded-lg border border-(--vq-line-2) px-4 py-3 transition-colors",
            post.hasVoted
              ? "bg-foreground text-background"
              : "bg-card shadow-(--vq-shadow-sm) hover:bg-muted"
          )}
        >
          <ChevronUp className={cn("size-5", post.hasVoted && "fill-current")} />
          <span
            className="font-medium leading-none"
            style={{ fontFamily: FONT.mono, fontSize: 16 }}
          >
            {post.voteCount}
          </span>
          <span
            className="leading-none opacity-60"
            style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}
          >
            {post.hasVoted ? "voted" : "vote"}
          </span>
        </button>

        {/* Title and meta */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category */}
            <span
              className="rounded-full border border-foreground/20 px-2.5 py-1 text-[10px] uppercase tracking-wide"
              style={{ fontFamily: FONT.mono, background: "var(--muted)" }}
            >
              {categoryLabel}
            </span>
            {/* Agent */}
            {post.agentSlug && agentColor && (
              <span
                className="rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide font-medium"
                style={{
                  fontFamily: FONT.mono,
                  background: `color-mix(in srgb, ${agentColor} 20%, transparent)`,
                  color: agentColor,
                  borderColor: `color-mix(in srgb, ${agentColor} 40%, transparent)`,
                }}
              >
                {post.agentSlug}
              </span>
            )}
            {/* Status */}
            <span
              className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide font-medium"
              style={{
                fontFamily: FONT.mono,
                background: statusConfig.bg,
                color: statusConfig.color,
              }}
            >
              {statusConfig.label}
            </span>
          </div>

          <h1
            className="text-2xl font-medium text-foreground leading-snug tracking-tight"
            style={{ fontFamily: FONT.head }}
          >
            {post.title}
          </h1>

          <div
            className="flex items-center gap-3 text-muted-foreground"
            style={{ fontFamily: FONT.mono, fontSize: 11 }}
          >
            <span>by {post.createdBy.name}</span>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" />
              {post._count.comments} comment{post._count.comments !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-(--vq-line-2) bg-card p-5 shadow-(--vq-shadow)">
        <p
          className="text-sm leading-relaxed text-foreground whitespace-pre-wrap"
          style={{ fontFamily: FONT.body }}
        >
          {post.description}
        </p>
      </div>

      {/* Roadmap ETA */}
      {post.roadmapEta && (
        <div className="flex items-center gap-2.5 rounded-md border border-(--vq-line-2) bg-(--vq-violet)/10 px-4 py-3 shadow-(--vq-shadow-sm)">
          <Calendar className="size-4 shrink-0 text-(--vq-violet)" />
          <div>
            <span
              className="text-foreground"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              Roadmap ETA
            </span>
            <p className="text-sm font-medium text-foreground mt-0.5" style={{ fontFamily: FONT.head }}>
              {post.roadmapEta}
            </p>
          </div>
        </div>
      )}

      {/* Admin reply */}
      {post.adminReply && (
        <div className="rounded-lg border border-(--vq-line-2) bg-(--vq-green)/10 p-5 shadow-(--vq-shadow)">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 rounded-full border border-(--vq-line-2) bg-foreground px-2.5 py-1">
              <Shield className="size-3 text-background" />
              <span
                className="text-background"
                style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase" }}
              >
                Team
              </span>
            </div>
            <span
              className="text-muted-foreground"
              style={{ fontFamily: FONT.mono, fontSize: 10 }}
            >
              Official response
            </span>
          </div>
          <p
            className="text-sm leading-relaxed text-foreground whitespace-pre-wrap"
            style={{ fontFamily: FONT.body }}
          >
            {post.adminReply}
          </p>
        </div>
      )}

      {/* Comments */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="h-0.5 flex-1 bg-foreground/10" />
          <span
            className="text-muted-foreground"
            style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}
          >
            [ {post.comments?.length ?? 0} comment{(post.comments?.length ?? 0) !== 1 ? "s" : ""} ]
          </span>
          <div className="h-0.5 flex-1 bg-foreground/10" />
        </div>

        {post.comments && post.comments.length > 0 && (
          <div className="flex flex-col gap-3">
            {post.comments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "rounded-lg border border-(--vq-line-2) p-4 shadow-(--vq-shadow-sm)",
                  comment.isAdminReply ? "bg-(--vq-green)/10" : "bg-card"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="grid size-6 shrink-0 place-items-center rounded-full border border-(--vq-line-2) font-head text-xs"
                    style={{
                      background: comment.isAdminReply ? "var(--vq-green)" : "var(--vq-yellow)",
                      color: "var(--foreground)",
                    }}
                  >
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className="font-medium text-foreground text-xs"
                    style={{ fontFamily: FONT.head }}
                  >
                    {comment.user.name}
                  </span>
                  {comment.isAdminReply && (
                    <div className="flex items-center gap-1 rounded-full border border-(--vq-line-2) bg-foreground px-2 py-0.5">
                      <Shield className="size-2.5 text-background" />
                      <span
                        className="text-background"
                        style={{ fontFamily: FONT.mono, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase" }}
                      >
                        Team
                      </span>
                    </div>
                  )}
                  <span
                    className="ml-auto text-muted-foreground"
                    style={{ fontFamily: FONT.mono, fontSize: 10 }}
                  >
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed text-foreground whitespace-pre-wrap"
                  style={{ fontFamily: FONT.body }}
                >
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="flex flex-col gap-3 rounded-lg border border-(--vq-line-2) bg-card p-5 shadow-(--vq-shadow)">
          <span
            className="text-muted-foreground"
            style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}
          >
            Add a comment
          </span>
          <Textarea
            variant="brand"
            placeholder="Share your thoughts, use case, or workaround..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              variant="brand-dark"
              size="brand-sm"
              onClick={handleSubmitComment}
              disabled={isCommenting || commentText.trim().length < 1}
            >
              {isCommenting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
