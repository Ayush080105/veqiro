"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, FileText, ImageIcon, Layers, Play } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { usePublishedPosts } from "@/lib/api/assistants"
import type { PublishedPost } from "@/lib/api/assistants"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { Skeleton } from "@/components/ui/skeleton"
import { PLATFORM_STYLE, STATUS_TONE, STATUS_TONE_PENDING } from "./post-style"

/**
 * Every post Maya has made, as media. The calendar answers "what goes out when";
 * this answers "what have we made" — so it is a grid you scan, not a schedule.
 * It reads the same list the calendar does; nothing here is stored separately.
 */

const PLATFORM = PLATFORM_STYLE

type StatusFilter = "all" | "success" | "scheduled" | "failed"
type PlatformFilter = "all" | "LINKEDIN" | "TWITTER" | "INSTAGRAM"

const STATUS_LABEL: Record<string, string> = {
  success: "Published",
  scheduled: "Scheduled",
  failed: "Failed",
  cancelled: "Cancelled",
  pending: "Pending",
  publishing: "Publishing",
}

/** A carousel's slides, or the single image, or nothing. */
function slidesOf(p: PublishedPost): string[] {
  if (p.imageUrls && p.imageUrls.length > 0) return p.imageUrls
  return p.imageUrl ? [p.imageUrl] : []
}

function postDate(p: PublishedPost): Date {
  return parseISO(p.publishedAt ?? p.scheduledAt ?? p.createdAt)
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 border ${
        STATUS_TONE[status] ?? STATUS_TONE_PENDING
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function PlatformTag({ platform }: { platform: string }) {
  const cfg = PLATFORM[platform] ?? { label: platform, color: "var(--muted-foreground)", ink: "var(--background)" }
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5"
      style={{ background: cfg.color, color: cfg.ink }}
    >
      {cfg.label}
    </span>
  )
}

function Tile({ post, onOpen }: { post: PublishedPost; onOpen: () => void }) {
  const slides = slidesOf(post)
  const hasVideo = !!post.videoUrl

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-muted text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      aria-label={`Open post: ${post.caption.slice(0, 60)}`}
    >
      {hasVideo ? (
        // #t=0.1 makes browsers paint a frame as the poster without autoplaying.
        <video
          src={`${post.videoUrl}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="size-full object-cover"
        />
      ) : slides[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slides[0]}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        // A text-only post is still a post; show what it said.
        <div className="flex size-full flex-col gap-2 p-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <p className="line-clamp-6 text-xs leading-relaxed text-foreground">{post.caption}</p>
        </div>
      )}

      <div className="absolute left-1.5 top-1.5">
        <PlatformTag platform={post.platform} />
      </div>
      <div className="absolute right-1.5 top-1.5 flex gap-1">
        {hasVideo && (
          <span className="grid size-5 place-items-center bg-black/70 text-white" title="Video">
            <Play className="size-3" />
          </span>
        )}
        {!hasVideo && slides.length > 1 && (
          <span
            className="flex items-center gap-0.5 bg-black/70 px-1 py-0.5 text-[10px] text-white"
            title={`${slides.length} slides`}
          >
            <Layers className="size-3" />
            {slides.length}
          </span>
        )}
      </div>
      {post.status !== "success" && (
        <div className="absolute bottom-1.5 left-1.5">
          <StatusBadge status={post.status} />
        </div>
      )}
    </button>
  )
}

function Lightbox({ post, onClose }: { post: PublishedPost | null; onClose: () => void }) {
  const [slide, setSlide] = React.useState(0)
  // A different post starts from its first slide.
  React.useEffect(() => setSlide(0), [post?.id])

  const slides = post ? slidesOf(post) : []
  const current = slides[Math.min(slide, Math.max(slides.length - 1, 0))]

  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {post && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <PlatformTag platform={post.platform} />
                <StatusBadge status={post.status} />
              </DialogTitle>
              <DialogDescription>{format(postDate(post), "MMM d, yyyy 'at' h:mm a")}</DialogDescription>
            </DialogHeader>

            {post.videoUrl ? (
              <video src={post.videoUrl} controls playsInline className="w-full bg-black" />
            ) : current ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current} alt="" className="w-full bg-muted object-contain" />
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSlide((s) => (s - 1 + slides.length) % slides.length)}
                      className="absolute left-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--vq-line-2)] bg-background shadow-[var(--vq-shadow-sm)]"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlide((s) => (s + 1) % slides.length)}
                      className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--vq-line-2)] bg-background shadow-[var(--vq-shadow-sm)]"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                    <span className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                      {Math.min(slide, slides.length - 1) + 1} / {slides.length}
                    </span>
                  </>
                )}
              </div>
            ) : null}

            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{post.caption}</p>
            {post.hashtags.length > 0 && (
              <p className="text-[11px] text-chart-1">
                {post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
              </p>
            )}
            {post.status === "failed" && post.error && (
              <p className="text-[11px] text-destructive">{post.error}</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function MayaGalleryTab() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: posts = [], isPending } = usePublishedPosts(organizationId)

  const [status, setStatus] = React.useState<StatusFilter>("success")
  const [platform, setPlatform] = React.useState<PlatformFilter>("all")
  const [openId, setOpenId] = React.useState<string | null>(null)

  const shown = React.useMemo(() => {
    return posts
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (platform === "all" ? true : p.platform === platform))
      .sort((a, b) => postDate(b).getTime() - postDate(a).getTime())
  }, [posts, status, platform])

  const open = openId ? (posts.find((p) => p.id === openId) ?? null) : null

  return (
    <div className="flex h-full flex-col bg-[var(--card)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--vq-line-2)] px-5 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <SegmentedGroup<StatusFilter>
            size="sm"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "success", label: "Published" },
              { value: "scheduled", label: "Scheduled" },
              { value: "failed", label: "Failed" },
              { value: "all", label: "All" },
            ]}
          />
          <SegmentedGroup<PlatformFilter>
            size="sm"
            value={platform}
            onValueChange={setPlatform}
            options={[
              { value: "all", label: "All platforms" },
              { value: "LINKEDIN", label: "LinkedIn" },
              { value: "TWITTER", label: "X" },
              { value: "INSTAGRAM", label: "Instagram" },
            ]}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {shown.length} post{shown.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title={posts.length === 0 ? "No posts yet" : "Nothing matches"}
            description={
              posts.length === 0
                ? "Posts Maya publishes or schedules will collect here."
                : "Try a different status or platform."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => (
              <Tile key={p.id} post={p} onOpen={() => setOpenId(p.id)} />
            ))}
          </div>
        )}
      </div>

      <Lightbox post={open} onClose={() => setOpenId(null)} />
    </div>
  )
}
