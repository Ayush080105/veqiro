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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentCard } from "@/components/ui/agent-card"
import { ActionRow } from "@/components/ui/action-row"
import { CopyButton } from "@/components/ui/copy-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PublishDialog } from "./publish-dialog"
import type { AgentActionId } from "@/lib/types/agents"
import type {
  MayaIdeationResult,
  MayaDraftResult,
  MayaVariantResult,
  MayaReviseResult,
  MayaImageRegenResult,
  MayaContentRegenResult,
  ContentIdea,
  ContentPlatform,
  ImageResult,
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

// ─── Image overlay action button ─────────────────────────────────────────────

function ImageOverlayButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={title}
        onClick={onClick}
        className="flex size-7 cursor-pointer items-center justify-center border border-foreground bg-background/90 text-foreground shadow-[2px_2px_0_var(--foreground)] backdrop-blur-sm transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_var(--foreground)] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_var(--foreground)]"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
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
        <div className="pt-0.5">
          <Button
            size="xs"
            variant="outline"
            className="w-full gap-1"
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
  const headerBtnCls = "flex size-6 cursor-pointer items-center justify-center border border-foreground bg-background text-foreground shadow-[1px_1px_0_var(--foreground)] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_var(--foreground)] active:translate-x-0 active:translate-y-0 active:shadow-none"
  const fullText = `${body}${cta ? `\n\n${cta}` : ""}${
    hashtags.length
      ? `\n\n${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
      : ""
  }`
  const captionWithCta = `${body}${cta ? `\n\n${cta}` : ""}`
  const len = fullText.length
  return (
    <div className="mx-auto flex w-full max-w-[320px] flex-col border border-border bg-background">
      {/* post header */}
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <Badge variant="outline" className="text-[9px]">
          {PLATFORM_LABEL[platform]}
        </Badge>
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
                  aria-label="Revise a post"
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
                <TooltipContent>Revise a post</TooltipContent>
              </Tooltip>
              {src && (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label="Regenerate image"
                    onClick={() =>
                      onFollowUpAction("maya:regenerate-image", {
                        image_url: src,
                        prompt: image?.prompt_used ?? "",
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
        <div className="w-full">
          <img
            src={src}
            alt="generated"
            className="w-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </div>
      )}

      {/* caption */}
      <div className="flex flex-col gap-1 px-2.5 py-2">
        {title && (
          <p className="text-[11px] font-semibold leading-tight">{title}</p>
        )}
        <p className="whitespace-pre-wrap text-[11px] leading-snug">{body}</p>
        {cta && (
          <p className="text-[10px] italic text-muted-foreground">{cta}</p>
        )}
        {hashtags.length > 0 && (
          <p className="text-[10px] leading-relaxed text-primary/70">
            {[...new Set(hashtags)]
              .map((h) => (h.startsWith("#") ? h : `#${h}`))
              .join(" ")}
          </p>
        )}
      </div>

      {/* actions */}
      <div className="border-t border-border px-2.5 py-1.5">
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
      <AgentCard.Body>
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
  const first = result.variants[0]?.platform ?? "linkedin"
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Shuffle />}
        title={`Adapted for ${result.variants.length} platforms`}
      />
      <AgentCard.Body>
        <Tabs defaultValue={first}>
          <TabsList>
            {result.variants.map((v) => (
              <TabsTrigger key={v.platform} value={v.platform}>
                {PLATFORM_LABEL[v.platform]}
              </TabsTrigger>
            ))}
          </TabsList>
          {result.variants.map((v) => (
            <TabsContent key={v.platform} value={v.platform}>
              <DraftPreview
                platform={v.platform}
                body={v.body}
                hashtags={v.hashtags}
                title={v.title}
                image={v.image}
                onFollowUpAction={onFollowUpAction}
              />
            </TabsContent>
          ))}
        </Tabs>
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
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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

export function ImageRegenCard({ result }: { result: MayaImageRegenResult }) {
  const src = imageSrc(result.image)
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<ImageIcon />} title="Regenerated image" />
      <AgentCard.Body className="flex flex-col gap-2">
        {src && (
          <img
            src={src}
            alt="regenerated"
            className="w-full rounded-none"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        )}
        <p className="text-[10px] italic text-muted-foreground">
          Prompt: {result.image?.prompt_used ?? "—"}
        </p>
      </AgentCard.Body>
      {src && (
        <AgentCard.Footer>
          <ActionRow
            download={{ href: src, name: "maya-image.png", label: "Download" }}
          />
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
