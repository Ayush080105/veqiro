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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AgentCard } from "@/components/ui/agent-card"
import { ChatImage } from "@/components/chat/ChatImage"
import { ActionRow } from "@/components/ui/action-row"
import { CopyButton } from "@/components/ui/copy-button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { VIDEO_FEATURES_LOCKED } from "@/lib/config/features"
import { PublishDialog, CampaignPublishDialog } from "./publish-dialog"
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
        <svg viewBox="0 0 24 24" width={12} height={12} fill="#fff">
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
        <svg viewBox="0 0 24 24" width={11} height={11} fill="#fff">
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
      <svg viewBox="0 0 24 24" width={12} height={12} fill="#fff">
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
    <div className="flex flex-col gap-2 border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-xs font-semibold leading-snug">{idea.title}</p>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {idea.content_type.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="text-[10px]">
          {idea.platform}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {idea.predicted_engagement}
        </Badge>
      </div>

      {idea.hook && (
        <p className="text-[11px] italic text-muted-foreground">&ldquo;{idea.hook}&rdquo;</p>
      )}

      {idea.reasoning && (
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80">
          <Lightbulb className="mt-0.5 size-3 shrink-0 text-chart-2" />
          {idea.reasoning}
        </p>
      )}

      {idea.suggested_hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {[...new Set(idea.suggested_hashtags)].map((h) => (
            <Badge key={h} variant="outline" className="text-[10px]">
              {h.startsWith("#") ? h : `#${h}`}
            </Badge>
          ))}
        </div>
      )}

      {onFollowUpAction && (
        <div className="flex gap-1.5 pt-0.5">
          <Button
            variant="chat-action"
            className="flex-1"
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
            variant="chat-action"
            className="flex-1"
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
    </div>
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
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {ideas.length} ideas
          </Badge>
        }
      />
      <AgentCard.Body>
        <div className="flex flex-col gap-2">
          {ideas.map((idea, i) => (
            <ContentIdeaCard key={i} idea={idea} onFollowUpAction={onFollowUpAction} />
          ))}
          {ideas.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No ideas generated.</p>
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
  const headerBtnCls = "flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] hover:text-foreground transition-colors"
  const fullText = `${body}${cta ? `\n\n${cta}` : ""}${
    hashtags.length
      ? `\n\n${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
      : ""
  }`
  const captionWithCta = `${body}${cta ? `\n\n${cta}` : ""}`
  const len = fullText.length
  return (
    <div className="flex w-full flex-col overflow-hidden">
      {/* post header */}
      <div className="flex items-center justify-between px-3 py-2">
        <PlatformIcon platform={platform} />
        <div className="flex items-center gap-1">
          {previousImage && onRevertImage && (
            <Tooltip>
              <TooltipTrigger
                type="button"
                aria-label="Revert to original image"
                onClick={onRevertImage}
                className={headerBtnCls}
              >
                <Undo2 className="size-3" />
              </TooltipTrigger>
              <TooltipContent>Revert to original image</TooltipContent>
            </Tooltip>
          )}
          {onFollowUpAction && (
            <>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label="Adapt to other platforms"
                  onClick={() =>
                    onFollowUpAction("maya:generate-variants", {
                      original_content: fullText,
                      original_platform: platform,
                    })
                  }
                  className={headerBtnCls}
                >
                  <Shuffle className="size-3" />
                </TooltipTrigger>
                <TooltipContent>Adapt to other platforms</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label="Revise the caption"
                  onClick={() =>
                    onFollowUpAction("maya:revise", {
                      original_content: fullText,
                      platform,
                    })
                  }
                  className={headerBtnCls}
                >
                  <Wand2 className="size-3" />
                </TooltipTrigger>
                <TooltipContent>Revise the caption</TooltipContent>
              </Tooltip>
              {src && (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label="Regenerate image"
                    onClick={() =>
                      onFollowUpAction("maya:regenerate-image", {
                        image_url: src,
                        prompt: "",
                        platform,
                      })
                    }
                    className={headerBtnCls}
                  >
                    <ImageIcon className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>Regenerate image</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
          <span
            className={cn(
              "ml-1 text-[9px]",
              len > limit ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {len}/{limit}
          </span>
        </div>
      </div>

      {/* image */}
      {src && (
        <div className="group relative w-full overflow-hidden bg-[#E8E8E8]">
          <ChatImage src={src} alt="generated" borderRadius={0} maxWidth={1200} />
          {/* hover actions */}
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {onFollowUpAction && (
              <button
                type="button"
                onClick={() => onFollowUpAction("maya:regenerate-image", { image_url: src, prompt: "", platform })}
                className="flex items-center justify-center"
                style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer" }}
              >
                <ImageIcon size={11} />
              </button>
            )}
            <a
              href={src}
              download={`maya-${platform}.png`}
              className="flex items-center justify-center"
              style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", textDecoration: "none" }}
            >
              <Download size={11} />
            </a>
          </div>
        </div>
      )}

      {/* caption */}
      <div className="flex flex-col gap-2 p-3">
        {title && (
          <p className="text-sm font-semibold leading-snug">{title}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>
        {cta && (
          <p className="text-xs italic text-muted-foreground">{cta}</p>
        )}
        {hashtags.length > 0 && (
          <p className="text-xs leading-relaxed text-primary/80">
            {[...new Set(hashtags)]
              .map((h) => (h.startsWith("#") ? h : `#${h}`))
              .join(" ")}
          </p>
        )}
      </div>

      {/* actions */}
      <div className="border-t border-border/50 px-3 py-2">
        <ActionRow
          copy={{ text: fullText, label: "Copy post" }}
          download={src ? { href: src, name: `maya-${platform}.png`, label: "Image" } : undefined}
        >
          <PublishDialog
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
            <Badge variant="secondary" className="text-[10px]">
              tone: {d.tone_used}
            </Badge>
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
  const fullText = `${result.revised.body}\n\n${result.revised.cta ?? ""}\n\n${result.revised.hashtags.join(" ")}`
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Wand2 />} title="Revised post" />
      <AgentCard.Body className="flex flex-col gap-3">
        {result.revised.title && (
          <p className="text-xs font-medium">{result.revised.title}</p>
        )}
        <p className="whitespace-pre-wrap border border-border bg-muted/20 p-2 text-[11px] leading-relaxed">
          {result.revised.body}
        </p>
        {result.revised.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {[...new Set(result.revised.hashtags)].map((h) => (
              <Badge key={h} variant="outline" className="text-[10px]">
                {h.startsWith("#") ? h : `#${h}`}
              </Badge>
            ))}
          </div>
        )}
        {result.revised.cta && (
          <p className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] italic">
            {result.revised.cta}
          </p>
        )}
        {result.changes_made.length > 0 && (
          <div>
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
              {"// changes"}
            </p>
            <ul className="list-disc pl-4 text-[11px] leading-relaxed">
              {result.changes_made.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton text={fullText} />
        <PublishDialog
          platform={result.platform}
          caption={`${result.revised.body}${result.revised.cta ? `\n\n${result.revised.cta}` : ""}`}
          hashtags={result.revised.hashtags}
          image={undefined}
        />
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
      <AgentCard.Body className="flex flex-col gap-2">
        {src && <ChatImage src={src} alt="regenerated" borderRadius={8} maxWidth={9999} />}
        <p className="text-[10px] italic text-muted-foreground">
          Prompt: {result.image?.prompt_used ?? "—"}
        </p>
      </AgentCard.Body>
      {src && (
        <AgentCard.Footer>
          <Button variant="chat-utility" asChild>
            <a href={src} download="maya-image.png">
              <Download className="size-3" /> Download
            </a>
          </Button>
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
        </AgentCard.Footer>
      )}
    </AgentCard>
  )
}

// ─── Content regen card ──────────────────────────────────────────────────────

export function ContentRegenCard({ result }: { result: MayaContentRegenResult }) {
  const fullText = `${result.caption}\n\n${result.cta}\n\n${result.hashtags.join(" ")}`
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Wand2 />} title="Rewritten caption" />
      <AgentCard.Body className="flex flex-col gap-2">
        <p className="whitespace-pre-wrap border border-border bg-muted/20 p-2 text-[11px] leading-relaxed">
          {result.caption}
        </p>
        {result.cta && (
          <p className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] italic">
            {result.cta}
          </p>
        )}
        {result.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {[...new Set(result.hashtags)].map((h) => (
              <Badge key={h} variant="outline" className="text-[10px]">
                {h.startsWith("#") ? h : `#${h}`}
              </Badge>
            ))}
          </div>
        )}
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton text={fullText} />
        <PublishDialog
          platform={result.platform}
          caption={result.caption}
          hashtags={result.hashtags}
          image={undefined}
        />
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

  const navBtnCls =
    "flex size-7 items-center justify-center border border-foreground bg-background text-foreground shadow-[1px_1px_0_var(--foreground)] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_var(--foreground)] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-30 disabled:pointer-events-none"

  const fullText = `${d.body}${d.cta ? `\n\n${d.cta}` : ""}${
    d.hashtags?.length ? `\n\n${d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : ""
  }`

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<GalleryHorizontal />}
        title="Carousel post"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {total} images
          </Badge>
        }
      />
      <AgentCard.Body>
        <div className="mx-auto flex w-full max-w-[320px] flex-col border border-border bg-background">
          {/* Image strip with navigation */}
          <div className="relative w-full">
            {currentSrc && (
              <ChatImage src={currentSrc} alt={`Slide ${current + 1}`} borderRadius={0} maxWidth={1200} />
            )}
            {/* Overlay nav arrows */}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrent((c) => c - 1)}
                  disabled={current === 0}
                  aria-label="Previous image"
                  className="absolute left-1 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full bg-background/80 border border-border shadow disabled:opacity-0"
                >
                  <ChevronLeft className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrent((c) => c + 1)}
                  disabled={current === total - 1}
                  aria-label="Next image"
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full bg-background/80 border border-border shadow disabled:opacity-0"
                >
                  <ChevronRight className="size-3" />
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrent(i)}
                      aria-label={`Go to image ${i + 1}`}
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

          {/* Single caption — same for all slides */}
          <div className="flex flex-col gap-1 px-2.5 py-2">
            {d.title && (
              <p className="text-[11px] font-semibold leading-tight">{d.title}</p>
            )}
            <p className="whitespace-pre-wrap text-[11px] leading-snug">{d.body}</p>
            {d.cta && (
              <p className="text-[10px] italic text-muted-foreground">{d.cta}</p>
            )}
            {d.hashtags && d.hashtags.length > 0 && (
              <p className="text-[10px] leading-relaxed text-primary/70">
                {[...new Set(d.hashtags)]
                  .map((h) => (h.startsWith("#") ? h : `#${h}`))
                  .join(" ")}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-border px-2.5 py-1.5">
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
              <PublishDialog
                platform={result.platform}
                caption={`${d.body}${d.cta ? `\n\n${d.cta}` : ""}`}
                hashtags={d.hashtags ?? []}
                image={currentSlide.image}
              />
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
      <AgentCard.Header icon={<Rocket size={14} />} title="Product Campaign">
        <span className="text-xs text-muted-foreground">{photos.length} photos</span>
      </AgentCard.Header>
      <AgentCard.Body className="pb-2">
        <div className="w-full">
          <div
            className="grid gap-0.5"
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
                  className="group relative overflow-hidden bg-[#E8E8E8]"
                  style={{
                    gridColumn: spansFullWidth ? "1 / -1" : undefined,
                    borderRadius: count === 1 ? 10 : (
                      i === 0 ? "10px 0 0 0" :
                      count === 2 ? (i === 1 ? "0 10px 10px 0" : "10px 0 0 10px") :
                      count === 4 ? (
                        i === 0 ? "10px 0 0 0" :
                        i === 1 ? "0 10px 0 0" :
                        i === 2 ? "0 0 0 10px" :
                        "0 0 10px 0"
                      ) : undefined
                    ),
                  }}
                >
                  {src ? (
                    <ChatImage src={src} alt={`Campaign photo ${i + 1}`} borderRadius={0} maxWidth={1200} />
                  ) : (
                    <div className="aspect-square w-full animate-pulse bg-[#D8D8D8] flex items-center justify-center text-[11px] text-muted-foreground">
                      Generating…
                    </div>
                  )}

                  {/* overflow scrim on last cell */}
                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-lg font-semibold"
                         style={{ background: "rgba(0,0,0,0.45)" }}>
                      +{overflow}
                    </div>
                  )}

                  {/* Action icons — bottom-right, revealed on hover */}
                  {!isLast && (
                    <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {rawSrc && onFollowUpAction && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onFollowUpAction("maya:regenerate-image", { image_url: rawSrc, prompt: "" })}
                              className="flex items-center justify-center"
                              style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer" }}
                            >
                              <ImageIcon size={10} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Regenerate</TooltipContent>
                        </Tooltip>
                      )}
                      {rawSrc && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={src ?? rawSrc}
                              download={`campaign-photo-${i + 1}.png`}
                              className="flex items-center justify-center"
                              style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", textDecoration: "none" }}
                            >
                              <Download size={10} />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {result.caption && (
          <div className="mt-2 mb-2 rounded-none border-t border-border/50 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Caption</p>
              <CopyButton text={captionBody} label="Copy caption" />
            </div>
            <Textarea
              value={captionBody}
              onChange={(e) => setCaptionBody(e.target.value)}
              placeholder="Write a caption for this campaign…"
              className="min-h-32 text-sm leading-relaxed"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 px-3 pb-3 pt-2">
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
        </div>
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
  result: MayaGenerateVideoResult | MayaCampaignVideoResult
  title?: string
  platform?: ContentPlatform | string | null
}) {
  const src = videoSrc(result?.video)
  const [captionBody, setCaptionBody] = React.useState(result?.caption?.body ?? "")

  if (!src) return null

  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Clapperboard />} title={title ?? "Generated video"} />
      <AgentCard.Body className="flex flex-col gap-2">
        <video
          src={src}
          controls
          playsInline
          className="w-full rounded"
          style={{ maxHeight: 480, background: "#000" }}
        />
        <Textarea
          value={captionBody}
          onChange={(e) => setCaptionBody(e.target.value)}
          placeholder="Write a caption for this video…"
          className="text-xs"
        />
      </AgentCard.Body>
      <AgentCard.Footer>
        <Button variant="chat-utility" asChild>
          <a href={src} download="maya-video.mp4">
            <Download className="size-3" /> Download
          </a>
        </Button>
        <PublishDialog
          platform={platform}
          caption={captionBody}
          hashtags={result.caption?.hashtags ?? []}
          video={result.video}
        />
      </AgentCard.Footer>
    </AgentCard>
  )
}
