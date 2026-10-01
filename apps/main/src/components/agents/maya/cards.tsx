"use client"

import * as React from "react"
import {
  Sparkles,
  Shuffle,
  Wand2,
  Image as ImageIcon,
  PenLine,
  Lightbulb,
  Undo2,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  Rocket,
  Download,
  Clapperboard,
  Film,
  Lock,
  LayoutGrid,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AgentCard } from "@/components/ui/agent-card"
import { ChatImage } from "@/components/chat/ChatImage"
import { ActionRow } from "@/components/ui/action-row"
import { CopyButton } from "@/components/ui/copy-button"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusPill } from "@/components/ui/status-pill"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { VIDEO_FEATURES_LOCKED } from "@/lib/config/features"
import { PublishDialog, CampaignPublishDialog } from "./publish-dialog"
import { ScheduleDialog, CampaignScheduleDialog } from "./schedule-dialog"
import type { AgentActionId } from "@/lib/types/agents"
import type {
  MayaIdeationResult,
  MayaDraftResult,
  MayaVariantResult,
  MayaReviseResult,
  MayaImageRegenResult,
  MayaContentRegenResult,
  MayaCarouselDraftResult,
  MayaCampaignResult,
  MayaGenerateVideoResult,
  MayaCampaignVideoResult,
  MayaCampaignVideoStoryboardResult,
  MayaLogoAnimationResult,
  ContentIdea,
  ContentPlatform,
  ImageResult,
  VideoResult,
} from "@/lib/types/agents"

export type FollowUpHandler = (
  actionId: AgentActionId,
  prefill?: Record<string, unknown>
) => void

function imageSrc(img?: ImageResult | null): string | undefined {
  if (!img) return undefined
  if (img.image_url) return img.image_url
  if (img.image_base64)
    return `data:${img.content_type || "image/png"};base64,${img.image_base64}`
  return undefined
}

function videoSrc(video?: VideoResult | null): string | undefined {
  if (!video) return undefined
  if (video.video_url) return video.video_url
  if (video.video_base64)
    return `data:${video.content_type || "video/mp4"};base64,${video.video_base64}`
  return undefined
}

// Converts CDN URLs to blob: URLs so <img> renders and <a download> works cross-origin.
function useBlobUrls(srcs: (string | undefined)[]): (string | undefined)[] {
  const [blobUrls, setBlobUrls] = React.useState<(string | undefined)[]>(() =>
    srcs.map((s) => (s?.startsWith("data:") ? s : undefined))
  )

  React.useEffect(() => {
    let cancelled = false
    const created: string[] = []

    Promise.all(
      srcs.map(async (src, i) => {
        if (!src) return undefined
        if (src.startsWith("data:") || src.startsWith("blob:")) return src
        try {
          const res = await fetch(src)
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          created.push(url)
          return url
        } catch {
          return src
        }
      })
    ).then((resolved) => {
      if (!cancelled) setBlobUrls(resolved)
    })

    return () => {
      cancelled = true
      created.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join(",")])

  return blobUrls
}

const PLATFORM_LIMITS: Record<ContentPlatform, number> = {
  linkedin: 3000,
  twitter: 280,
  instagram: 2200,
}

const PLATFORM_LABEL: Record<ContentPlatform, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  instagram: "Instagram",
}

const surfaceCls =
  "rounded-[var(--vq-r)] border border-border/70 bg-card shadow-[var(--vq-shadow-sm)]"
const innerSurfaceCls =
  "rounded-[var(--vq-r-sm)] border border-border/60 bg-background/60"
const metaTextCls = "text-xs leading-relaxed text-muted-foreground"

function formatHashtag(tag: string) {
  return tag.startsWith("#") ? tag : `#${tag}`
}

function uniqueHashtags(tags: string[] = []) {
  return [...new Set(tags)].map(formatHashtag)
}

function PlatformMeta({ platform }: { platform: ContentPlatform }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
      <PlatformIcon platform={platform} />
      {PLATFORM_LABEL[platform]}
    </span>
  )
}

function HashtagRow({ tags }: { tags: string[] }) {
  const unique = uniqueHashtags(tags)
  if (!unique.length) return null
  return (
    <p className="break-words text-xs leading-relaxed text-muted-foreground">
      {unique.join(" ")}
    </p>
  )
}

function ResultSection({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(innerSurfaceCls, "p-3", className)}>{children}</div>
}

function IconButton({
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className={cn(
          "flex size-8 cursor-pointer items-center justify-center rounded-[var(--vq-r-sm)] border border-border/60 bg-card text-muted-foreground shadow-[var(--vq-shadow-sm)] transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5",
          className
        )}
        {...props}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// ─── Platform icon ───────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<ContentPlatform, string> = {
  linkedin: "#0A66C2",
  twitter: "#000000",
  instagram: "#E1306C",
}

function PlatformIcon({ platform }: { platform: ContentPlatform }) {
  const color = PLATFORM_COLORS[platform]
  if (platform === "linkedin") {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          background: color,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" width={12} height={12} fill="white">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </div>
    )
  }
  if (platform === "twitter") {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          background: color,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" width={11} height={11} fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>
    )
  }
  // instagram
  return (
    <div
      style={{
        width: 20,
        height: 20,
        background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width={12} height={12} fill="white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    </div>
  )
}

// ─── Ideas grid ──────────────────────────────────────────────────────────────

function ContentIdeaCard({
  idea,
  onFollowUpAction,
}: {
  idea: ContentIdea
  onFollowUpAction?: FollowUpHandler
}) {
  return (
    <article className={cn(surfaceCls, "flex flex-col gap-3 p-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{idea.title}</p>
          {idea.hook && (
            <p className="text-xs leading-relaxed text-muted-foreground">&ldquo;{idea.hook}&rdquo;</p>
          )}
        </div>
        <StatusPill icon={null} className="shrink-0">
          {idea.content_type.replace(/_/g, " ")}
        </StatusPill>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill icon={null}>{PLATFORM_LABEL[idea.platform]}</StatusPill>
        <StatusPill level="ok" icon={null}>
          {idea.predicted_engagement}
        </StatusPill>
      </div>

      {idea.reasoning && (
        <p className={cn(metaTextCls, "flex items-start gap-2")}>
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {idea.reasoning}
        </p>
      )}

      <HashtagRow tags={idea.suggested_hashtags} />

      {onFollowUpAction && (
        <div className="flex flex-wrap justify-end gap-1.5 border-t border-border/50 pt-3">
          <Button
            variant="chat-action"
            onClick={() =>
              onFollowUpAction("maya:draft-content", {
                topic: idea.title,
                platform: idea.platform,
                include_image: true,
                additional_context: idea.visual_description ?? "",
              })
            }
          >
            <PenLine className="size-3" />
            Generate post
          </Button>
          <Button
            variant="chat-utility"
            disabled={VIDEO_FEATURES_LOCKED}
            title={VIDEO_FEATURES_LOCKED ? "Video generation is coming soon" : undefined}
            onClick={() =>
              onFollowUpAction("maya:generate-video", {
                prompt: idea.visual_description || idea.hook || idea.title,
                platform: idea.platform,
              })
            }
          >
            {VIDEO_FEATURES_LOCKED ? <Lock className="size-3" /> : <Clapperboard className="size-3" />}
            Generate video
          </Button>
        </div>
      )}
    </article>
  )
}

export function IdeasGridCard({
  result,
  onFollowUpAction,
}: {
  result: MayaIdeationResult
  onFollowUpAction?: FollowUpHandler
}) {
  const ideas = result.ideas ?? []
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Sparkles />}
        title="Content ideas"
        badge={<StatusPill icon={null}>{ideas.length} ideas</StatusPill>}
      />
      <AgentCard.Body>
        <div className="flex flex-col gap-2">
          {ideas.map((idea, i) => (
            <ContentIdeaCard key={i} idea={idea} onFollowUpAction={onFollowUpAction} />
          ))}
          {ideas.length === 0 && (
            <EmptyState
              tone="plain"
              icon={<Sparkles />}
              title="No ideas generated"
              description="Try a narrower topic or add more context for Maya."
              className="py-6"
            />
          )}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Draft preview ───────────────────────────────────────────────────────────

export function DraftPreview({
  platform,
  body,
  hashtags,
  cta,
  title,
  image,
  previousImage,
  onFollowUpAction,
  onRevertImage,
}: {
  platform: ContentPlatform
  body: string
  hashtags: string[]
  cta?: string
  title?: string
  image?: ImageResult | null
  previousImage?: ImageResult | null
  onFollowUpAction?: FollowUpHandler
  onRevertImage?: () => void
}) {
  const src = imageSrc(image)
  const limit = PLATFORM_LIMITS[platform]
  const fullText = `${body}${cta ? `\n\n${cta}` : ""}${
    hashtags.length
      ? `\n\n${uniqueHashtags(hashtags).join(" ")}`
      : ""
  }`
  const len = fullText.length
  return (
    <div className={cn(surfaceCls, "flex w-full flex-col overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
        <PlatformMeta platform={platform} />
        <div className="flex items-center gap-1.5">
          {previousImage && onRevertImage && (
            <IconButton label="Revert to original image" onClick={onRevertImage}>
              <Undo2 />
            </IconButton>
          )}
          {onFollowUpAction && (
            <>
              <IconButton
                label="Adapt to other platforms"
                onClick={() =>
                  onFollowUpAction("maya:generate-variants", {
                    original_content: fullText,
                    original_platform: platform,
                  })
                }
              >
                <Shuffle />
              </IconButton>
              <IconButton
                label="Revise the caption"
                onClick={() =>
                  onFollowUpAction("maya:revise", {
                    original_content: fullText,
                    platform,
                  })
                }
              >
                <Wand2 />
              </IconButton>
              {src && (
                <IconButton
                  label="Regenerate image"
                  onClick={() =>
                    onFollowUpAction("maya:regenerate-image", {
                      image_url: src,
                      prompt: "",
                      platform,
                    })
                  }
                >
                  <ImageIcon />
                </IconButton>
              )}
            </>
          )}
          <StatusPill
            level={len > limit ? "danger" : "info"}
            icon={null}
            className="ml-1"
          >
            {len}/{limit}
          </StatusPill>
        </div>
      </div>

      {src && (
        <div className="w-full overflow-hidden bg-muted/50">
          <ChatImage src={src} alt="Generated post visual" borderRadius={0} maxWidth={1200} />
        </div>
      )}

      <div className="flex flex-col gap-2 p-3">
        {title && (
          <p className="text-sm font-semibold leading-snug">{title}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>
        {cta && (
          <p className="text-xs italic text-muted-foreground">{cta}</p>
        )}
        <HashtagRow tags={hashtags} />
      </div>

      <div className="border-t border-border/50 px-3 py-2.5">
        <ActionRow
          copy={{ text: fullText, label: "Copy post" }}
          download={src ? { href: src, name: `maya-${platform}.png`, label: "Image" } : undefined}
          className="justify-end"
        >
          <PublishDialog
            platform={platform}
            caption={`${body}${cta ? `\n\n${cta}` : ""}`}
            hashtags={hashtags}
            image={image}
          />
          <ScheduleDialog
            platform={platform}
            caption={`${body}${cta ? `\n\n${cta}` : ""}`}
            hashtags={hashtags}
            image={image}
          />
        </ActionRow>
      </div>
    </div>
  )
}

// ─── Draft card ──────────────────────────────────────────────────────────────

export function DraftCard({
  result,
  onFollowUpAction,
  onRevertImage,
}: {
  result: MayaDraftResult
  onFollowUpAction?: FollowUpHandler
  onRevertImage?: () => void
}) {
  const d = result.draft
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Sparkles />}
        title="Draft post"
        badge={
          d.tone_used ? (
            <StatusPill icon={null}>Tone: {d.tone_used}</StatusPill>
          ) : undefined
        }
      />
      <AgentCard.Body className="!px-0 pb-0">
        <DraftPreview
          platform={d.platform}
          body={d.body}
          hashtags={d.hashtags}
          cta={d.cta}
          title={d.title}
          image={result.image}
          previousImage={result._previousImage}
          onFollowUpAction={onFollowUpAction}
          onRevertImage={onRevertImage}
        />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Variants tabs card ──────────────────────────────────────────────────────

export function VariantsTabsCard({
  result,
  onFollowUpAction,
}: {
  result: MayaVariantResult
  onFollowUpAction?: FollowUpHandler
}) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Shuffle />}
        title={`Adapted for ${result.variants.length} platforms`}
      />
      <AgentCard.Body className="!px-0 pb-0">
        <div className="flex flex-col gap-4">
          {result.variants.map((v) => (
            <DraftPreview
              key={v.platform}
              platform={v.platform}
              body={v.body}
              hashtags={v.hashtags}
              title={v.title}
              image={v.image ?? result._originalImage}
              onFollowUpAction={onFollowUpAction}
            />
          ))}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Revision diff card ──────────────────────────────────────────────────────

export function RevisionDiffCard({ result }: { result: MayaReviseResult }) {
  const fullText = `${result.revised.body}\n\n${result.revised.cta ?? ""}\n\n${uniqueHashtags(result.revised.hashtags).join(" ")}`
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Wand2 />} title="Revised post" />
      <AgentCard.Body className="flex flex-col gap-3">
        {result.revised.title && (
          <p className="text-sm font-semibold leading-snug">{result.revised.title}</p>
        )}
        <ResultSection className="space-y-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.revised.body}</p>
          {result.revised.cta && (
            <p className="text-xs italic text-muted-foreground">{result.revised.cta}</p>
          )}
          <HashtagRow tags={result.revised.hashtags} />
        </ResultSection>
        {result.changes_made.length > 0 && (
          <ResultSection className="space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Changes made
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {result.changes_made.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </ResultSection>
        )}
      </AgentCard.Body>
      <AgentCard.Footer className="border-t border-border/50 pt-2">
        <ActionRow
          copy={{ text: fullText, label: "Copy post" }}
        >
          <PublishDialog
            platform={result.platform}
            caption={`${result.revised.body}${result.revised.cta ? `\n\n${result.revised.cta}` : ""}`}
            hashtags={result.revised.hashtags}
            image={undefined}
          />
          <ScheduleDialog
            platform={result.platform}
            caption={`${result.revised.body}${result.revised.cta ? `\n\n${result.revised.cta}` : ""}`}
            hashtags={result.revised.hashtags}
            image={undefined}
          />
        </ActionRow>
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Image regen card ────────────────────────────────────────────────────────

export function ImageRegenCard({
  result,
  onFollowUpAction,
}: {
  result: MayaImageRegenResult
  onFollowUpAction?: FollowUpHandler
}) {
  const src = imageSrc(result.image)
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<ImageIcon />} title="Regenerated image" />
      <AgentCard.Body className="flex flex-col gap-3">
        {src ? (
          <div className={cn(surfaceCls, "overflow-hidden bg-muted/50")}>
            <ChatImage src={src} alt="Regenerated campaign visual" borderRadius={0} maxWidth={1200} />
          </div>
        ) : (
          <EmptyState
            tone="plain"
            icon={<ImageIcon />}
            title="No image returned"
            description="Try regenerating with a clearer visual prompt."
            className="py-6"
          />
        )}
        <p className={metaTextCls}>
          Prompt: {result.image?.prompt_used ?? "No prompt metadata returned."}
        </p>
      </AgentCard.Body>
      {src && (
        <AgentCard.Footer className="border-t border-border/50 pt-2">
          <ActionRow
            download={{ href: src, name: "maya-image.png", label: "Image" }}
          >
            {onFollowUpAction && (
              <Button
                variant="chat-action"
                onClick={() =>
                  onFollowUpAction("maya:regenerate-image", { image_url: src, prompt: "" })
                }
              >
                <ImageIcon className="size-3" />
                Regenerate
              </Button>
            )}
          </ActionRow>
        </AgentCard.Footer>
      )}
    </AgentCard>
  )
}

// ─── Content regen card ──────────────────────────────────────────────────────

export function ContentRegenCard({ result }: { result: MayaContentRegenResult }) {
  const fullText = `${result.caption}\n\n${result.cta}\n\n${uniqueHashtags(result.hashtags).join(" ")}`
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Wand2 />} title="Rewritten caption" />
      <AgentCard.Body className="flex flex-col gap-3">
        <ResultSection className="space-y-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {result.caption}
          </p>
          {result.cta && (
            <p className="text-xs italic text-muted-foreground">{result.cta}</p>
          )}
          <HashtagRow tags={result.hashtags} />
        </ResultSection>
      </AgentCard.Body>
      <AgentCard.Footer className="border-t border-border/50 pt-2">
        <ActionRow copy={{ text: fullText, label: "Copy caption" }}>
          <PublishDialog
            platform={result.platform}
            caption={result.caption}
            hashtags={result.hashtags}
            image={undefined}
          />
          <ScheduleDialog
            platform={result.platform}
            caption={result.caption}
            hashtags={result.hashtags}
            image={undefined}
          />
        </ActionRow>
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Carousel draft card ──────────────────────────────────────────────────────

export function CarouselDraftCard({
  result,
  onFollowUpAction,
}: {
  result: MayaCarouselDraftResult
  onFollowUpAction?: FollowUpHandler
}) {
  const [current, setCurrent] = React.useState(0)
  const slides = result.slides ?? []
  const total = slides.length
  const d = result.draft

  if (total === 0 || !d) return null

  const currentSlide = slides[current]
  // Pre-resolve all slide CDN URLs to blob: URLs so images render and download works cross-origin
  const rawSrcs = React.useMemo(() => slides.map((s) => imageSrc(s.image)), [slides])
  const blobSrcs = useBlobUrls(rawSrcs)
  const currentSrc = blobSrcs[current] ?? rawSrcs[current]
  const publishableUrls = rawSrcs.filter((src): src is string => !!src)
  // Instagram is the only platform this app can actually publish a multi-image
  // carousel to (see firePublishedCarousel) — other platforms fall back to
  // publishing just the currently-viewed slide as a single image.
  const canPublishAsCarousel = result.platform === "instagram" && publishableUrls.length >= 2

  const fullText = `${d.body}${d.cta ? `\n\n${d.cta}` : ""}${
    d.hashtags?.length ? `\n\n${uniqueHashtags(d.hashtags).join(" ")}` : ""
  }`

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<GalleryHorizontal />}
        title="Carousel post"
        badge={<StatusPill icon={null}>{total} images</StatusPill>}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className={cn(surfaceCls, "mx-auto flex w-full max-w-[520px] flex-col overflow-hidden")}>
          <div className="relative w-full bg-muted/50">
            {currentSrc && (
              <ChatImage src={currentSrc} alt={`Carousel slide ${current + 1}`} borderRadius={0} maxWidth={1200} />
            )}
            {total > 1 && (
              <>
                <IconButton
                  label="Previous slide"
                  onClick={() => setCurrent((c) => c - 1)}
                  disabled={current === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/90"
                >
                  <ChevronLeft className="size-3" />
                </IconButton>
                <IconButton
                  label="Next slide"
                  onClick={() => setCurrent((c) => c + 1)}
                  disabled={current === total - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/90"
                >
                  <ChevronRight className="size-3" />
                </IconButton>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/50 bg-background/90 px-2 py-1 shadow-[var(--vq-shadow-sm)]">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrent(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className={cn(
                        "size-1.5 rounded-full transition-colors",
                        i === current ? "bg-foreground" : "bg-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PlatformMeta platform={result.platform} />
              <StatusPill icon={null}>Slide {current + 1} of {total}</StatusPill>
            </div>
            {d.title && (
              <p className="text-sm font-semibold leading-snug">{d.title}</p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.body}</p>
            {d.cta && (
              <p className="text-xs italic text-muted-foreground">{d.cta}</p>
            )}
            <HashtagRow tags={d.hashtags ?? []} />
          </div>

          <div className="border-t border-border/50 px-3 py-2.5">
            <ActionRow
              copy={{ text: fullText, label: "Copy caption" }}
              download={
                rawSrcs[current]
                  ? { href: currentSrc ?? rawSrcs[current]!, name: `maya-carousel-${current + 1}.png`, label: `Image ${current + 1}` }
                  : undefined
              }
            >
              {onFollowUpAction && rawSrcs[current] && (
                <Button
                  variant="chat-action"
                  onClick={() =>
                    onFollowUpAction("maya:regenerate-image", {
                      image_url: rawSrcs[current],
                      prompt: "",
                    })
                  }
                >
                  <ImageIcon className="size-3" />
                  Regenerate
                </Button>
              )}
              {canPublishAsCarousel ? (
                <>
                  <CampaignPublishDialog
                    imageUrls={publishableUrls}
                    photoCount={publishableUrls.length}
                    caption={fullText}
                  />
                  <CampaignScheduleDialog
                    imageUrls={publishableUrls}
                    photoCount={publishableUrls.length}
                    caption={fullText}
                  />
                </>
              ) : (
                <>
                  <PublishDialog
                    platform={result.platform}
                    caption={`${d.body}${d.cta ? `\n\n${d.cta}` : ""}`}
                    hashtags={d.hashtags ?? []}
                    image={currentSlide.image}
                  />
                  <ScheduleDialog
                    platform={result.platform}
                    caption={`${d.body}${d.cta ? `\n\n${d.cta}` : ""}`}
                    hashtags={d.hashtags ?? []}
                    image={currentSlide.image}
                  />
                </>
              )}
            </ActionRow>
          </div>
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Campaign Result Card ────────────────────────────────────────────────────

export function CampaignResultCard({
  result,
  onFollowUpAction,
}: {
  result: MayaCampaignResult
  onFollowUpAction?: FollowUpHandler
}) {
  const photos = result?.photos ?? []
  const rawSrcs = photos.map((p) => imageSrc(p.image))
  const blobUrls = useBlobUrls(rawSrcs)
  const [captionBody, setCaptionBody] = React.useState(() =>
    [
      result?.caption?.body,
      result?.caption?.cta,
      result?.caption?.hashtags?.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
    ]
      .filter(Boolean)
      .join("\n\n")
  )

  if (!photos.length) return null

  const publishableUrls = rawSrcs.filter((src): src is string => !!src)

  // WhatsApp-style grouping: show max 4 cells, "+N" overlay on last if overflow
  const MAX_VISIBLE = 4
  const visiblePhotos = photos.slice(0, MAX_VISIBLE)
  const overflow = photos.length > MAX_VISIBLE ? photos.length - MAX_VISIBLE : 0
  const count = visiblePhotos.length

  // Determine which cells span full width (2 columns)
  const fullWidthIndices = new Set<number>()
  if (count === 3 || count === 5) fullWidthIndices.add(0) // first spans full width
  if (count === 5) {
    // index 0 spans full width, indices 1-4 are 2x2
  }

  return (
    <AgentCard>
      <AgentCard.Header
        icon={<Rocket size={14} />}
        title="Product campaign"
        badge={<StatusPill icon={null}>{photos.length} photos</StatusPill>}
      />
      <AgentCard.Body className="flex flex-col gap-3 pb-3">
        <div className={cn(surfaceCls, "overflow-hidden")}>
          <div
            className="grid gap-px bg-border/60"
            style={{ gridTemplateColumns: count === 1 ? "1fr" : "1fr 1fr" }}
          >
            {visiblePhotos.map((photo, i) => {
              const src = blobUrls[i] ?? rawSrcs[i]
              const rawSrc = rawSrcs[i]
              const isLast = i === MAX_VISIBLE - 1 && overflow > 0
              const spansFullWidth = fullWidthIndices.has(i)

              return (
                <div
                  key={i}
                  className="relative overflow-hidden bg-muted/50"
                  style={{
                    gridColumn: spansFullWidth ? "1 / -1" : undefined,
                  }}
                >
                  {src ? (
                    <ChatImage src={src} alt={`Campaign photo ${i + 1}`} borderRadius={0} maxWidth={1200} />
                  ) : (
                    <div className="flex aspect-square w-full animate-pulse items-center justify-center bg-muted text-xs text-muted-foreground">
                      Generating...
                    </div>
                  )}

                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-lg font-semibold"
                         style={{ background: "rgba(0,0,0,0.45)" }}>
                      +{overflow}
                    </div>
                  )}

                  {!isLast && rawSrc && (
                    <div className="absolute bottom-2 right-2 flex gap-1.5">
                      {onFollowUpAction && (
                        <IconButton
                          label={`Regenerate photo ${i + 1}`}
                          onClick={() => onFollowUpAction("maya:regenerate-image", { image_url: rawSrc, prompt: "" })}
                          className="size-7 bg-background/90"
                        >
                          <ImageIcon />
                        </IconButton>
                      )}
                      <Button
                        variant="chat-utility"
                        size="icon-sm"
                        asChild
                        className="size-7 bg-background/90 px-0"
                      >
                        <a
                          href={src ?? rawSrc}
                          download={`campaign-photo-${i + 1}.png`}
                          aria-label={`Download photo ${i + 1}`}
                        >
                          <Download className="size-3.5" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {result.caption && (
          <ResultSection className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Caption</p>
              <CopyButton text={captionBody} label="Copy caption" />
            </div>
            <Textarea
              value={captionBody}
              onChange={(e) => setCaptionBody(e.target.value)}
              placeholder="Write a caption for this campaign…"
              className="min-h-32 text-sm leading-relaxed"
            />
          </ResultSection>
        )}
        <ActionRow>
          {publishableUrls.length > 0 && publishableUrls.length <= 5 && onFollowUpAction && (
            <Button
              variant="chat-action"
              disabled={VIDEO_FEATURES_LOCKED}
              title={VIDEO_FEATURES_LOCKED ? "Video generation is coming soon" : undefined}
              onClick={() => {
                if (VIDEO_FEATURES_LOCKED) return
                onFollowUpAction("maya:campaign-video", {
                  product_image_urls: publishableUrls,
                  campaign_brief: "",
                })
              }}
            >
              {VIDEO_FEATURES_LOCKED ? <Lock className="size-3" /> : <Film className="size-3" />}
              Turn into video
            </Button>
          )}
          <CampaignPublishDialog
            imageUrls={publishableUrls}
            photoCount={photos.length}
            caption={captionBody}
          />
          <CampaignScheduleDialog
            imageUrls={publishableUrls}
            photoCount={photos.length}
            caption={captionBody}
          />
        </ActionRow>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Video result card ────────────────────────────────────────────────────────

export function VideoResultCard({
  result,
  title,
  platform,
}: {
  result: MayaGenerateVideoResult | MayaCampaignVideoResult | MayaLogoAnimationResult
  title?: string
  platform?: ContentPlatform | string | null
}) {
  const src = videoSrc(result?.video)
  const [captionBody, setCaptionBody] = React.useState(result?.caption?.body ?? "")
  const [showStoryboard, setShowStoryboard] = React.useState(false)
  const storyboardUrls = (result as MayaCampaignVideoResult)?.storyboard_image_urls

  if (!src) return null

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Clapperboard />}
        title={title ?? "Generated video"}
        badge={platform ? <StatusPill icon={null}>{String(platform)}</StatusPill> : undefined}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        {!!storyboardUrls?.length && (
          <ResultSection className="flex flex-col gap-2">
            <Button
              type="button"
              variant="chat-utility"
              onClick={() => setShowStoryboard((v) => !v)}
              className="self-start"
            >
              {showStoryboard ? "Hide storyboard" : "View storyboard"}
            </Button>
            {showStoryboard && (
              <div className="flex gap-1.5 overflow-x-auto">
                {storyboardUrls.map((url, i) => (
                  <img
                    key={url}
                    src={url}
                    alt={
                      storyboardUrls.length > 1
                        ? `Storyboard sheet ${i + 1} of ${storyboardUrls.length}`
                      : "Storyboard"
                    }
                    className="max-h-48 shrink-0 rounded-[var(--vq-r-sm)] border border-border object-contain"
                  />
                ))}
              </div>
            )}
          </ResultSection>
        )}
        <div className={cn(surfaceCls, "overflow-hidden bg-black")}>
          <video
            src={src}
            controls
            playsInline
            className="w-full"
            style={{ maxHeight: 520, background: "black" }}
          />
        </div>
        <Textarea
          value={captionBody}
          onChange={(e) => setCaptionBody(e.target.value)}
          placeholder="Write a caption for this video…"
          className="min-h-24 text-sm leading-relaxed"
        />
      </AgentCard.Body>
      <AgentCard.Footer className="border-t border-border/50 pt-2">
        <ActionRow download={{ href: src, name: "maya-video.mp4", label: "Video" }}>
        <PublishDialog
          platform={platform}
          caption={captionBody}
          hashtags={result.caption?.hashtags ?? []}
          video={result.video}
        />
        <ScheduleDialog
          platform={platform}
          caption={captionBody}
          hashtags={result.caption?.hashtags ?? []}
          video={result.video}
        />
        </ActionRow>
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Storyboard result card ───────────────────────────────────────────────────

export function StoryboardResultCard({
  result,
  input,
  onFollowUpAction,
}: {
  result: MayaCampaignVideoStoryboardResult
  input?: {
    product_image_urls?: string[]
    campaign_brief?: string
    platform?: string
    aspect_ratio?: string
    duration_seconds?: number
    use_logo?: boolean
  }
  onFollowUpAction?: FollowUpHandler
}) {
  // One sheet per 10s segment: a 10s video has a single sheet, a 40s video has four.
  const sources =
    result?.storyboard_image_urls?.length
      ? result.storyboard_image_urls
      : (result?.storyboard_images_base64 ?? []).map((b64) => `data:image/png;base64,${b64}`)

  if (!sources.length) return null

  const beatsPerSheet = sources.length > 0 ? Math.ceil((result.beats?.length ?? 0) / sources.length) : 0

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<LayoutGrid />}
        title="Storyboard"
        badge={<StatusPill icon={null}>{sources.length} sheet{sources.length === 1 ? "" : "s"}</StatusPill>}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        {sources.map((sheetSrc, sheetIndex) => (
          <ResultSection key={sheetSrc} className="flex flex-col gap-2">
            {sources.length > 1 && (
              <span className="text-xs font-medium text-muted-foreground">
                {`Seconds ${sheetIndex * 10}–${(sheetIndex + 1) * 10}`}
              </span>
            )}
            <img
              src={sheetSrc}
              alt={sources.length > 1 ? `Storyboard sheet ${sheetIndex + 1}` : "Storyboard"}
              className="w-full rounded-[var(--vq-r-sm)] border border-border object-contain"
            />
            {result.beats?.length > 0 && (
              <ol
                start={sheetIndex * beatsPerSheet + 1}
                className="flex list-decimal flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground"
              >
                {result.beats
                  .slice(sheetIndex * beatsPerSheet, (sheetIndex + 1) * beatsPerSheet)
                  .map((beat, i) => (
                    <li key={i}>{beat}</li>
                  ))}
              </ol>
            )}
          </ResultSection>
        ))}
      </AgentCard.Body>
      <AgentCard.Footer className="border-t border-border/50 pt-2">
        {sources.map((sheetSrc, i) => (
          <Button key={sheetSrc} variant="chat-utility" asChild>
            <a href={sheetSrc} download={`maya-storyboard${sources.length > 1 ? `-${i + 1}` : ""}.png`}>
              <Download className="size-3" />
              {sources.length > 1 ? `Sheet ${i + 1}` : "Download"}
            </a>
          </Button>
        ))}
        {onFollowUpAction && input?.product_image_urls?.length && input?.campaign_brief && (
          <Button
            variant="chat-action"
            disabled={VIDEO_FEATURES_LOCKED}
            title={VIDEO_FEATURES_LOCKED ? "Video generation is coming soon" : undefined}
            onClick={() => {
              if (VIDEO_FEATURES_LOCKED) return
              onFollowUpAction("maya:campaign-video", {
                ...input,
                storyboard_beats: result.beats,
                storyboard_image_urls: result.storyboard_image_urls,
              })
            }}
          >
            {VIDEO_FEATURES_LOCKED ? <Lock className="size-3" /> : <Film className="size-3" />}
            Turn into video
          </Button>
        )}
      </AgentCard.Footer>
    </AgentCard>
  )
}
