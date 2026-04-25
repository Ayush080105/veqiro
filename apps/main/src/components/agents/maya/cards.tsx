"use client"

import * as React from "react"
import {
  Sparkles,
  Shuffle,
  Wand2,
  Image as ImageIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/ui/agent-card"
import { ActionRow } from "@/components/ui/action-row"
import { CopyButton } from "@/components/ui/copy-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { PublishDialog } from "./publish-dialog"
import type {
  MayaIdeationResult,
  MayaDraftResult,
  MayaVariantResult,
  MayaReviseResult,
  MayaImageRegenResult,
  MayaContentRegenResult,
  ContentPlatform,
  ImageResult,
} from "@/lib/types/agents"

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

// ─── Ideas grid ──────────────────────────────────────────────────────────────

export function IdeasGridCard({ result }: { result: MayaIdeationResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Sparkles />}
        title="Content ideas"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {result.ideas.length} ideas
          </Badge>
        }
      />
      <AgentCard.Body>
        <div className="grid gap-2 sm:grid-cols-2">
          {result.ideas.map((idea, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 border border-border bg-muted/30 p-2"
            >
              <div className="flex items-start gap-1.5">
                <p className="flex-1 text-xs font-medium">{idea.title}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {idea.predicted_engagement}
                </Badge>
              </div>
              <p className="text-[11px] italic text-muted-foreground">“{idea.hook}”</p>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {idea.reasoning}
              </p>
              <div className="flex flex-wrap gap-1">
                {idea.suggested_hashtags.map((h) => (
                  <Badge key={h} variant="outline" className="text-[10px]">
                    {h}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
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
}: {
  platform: ContentPlatform
  body: string
  hashtags: string[]
  cta?: string
  title?: string
  image?: ImageResult | null
}) {
  const src = imageSrc(image)
  const limit = PLATFORM_LIMITS[platform]
  const fullText = `${body}${cta ? `\n\n${cta}` : ""}${
    hashtags.length
      ? `\n\n${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
      : ""
  }`
  const len = fullText.length
  return (
    <div className="flex flex-col gap-2 border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {PLATFORM_LABEL[platform]}
        </Badge>
        <span
          className={cn(
            "text-[10px]",
            len > limit ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {len}/{limit}
        </span>
      </div>
      {src && (
        <img
          src={src}
          alt="generated"
          className="max-h-72 w-full rounded-none object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = "none"
          }}
        />
      )}
      {title && <p className="text-xs font-medium">{title}</p>}
      <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{body}</p>
      {cta && (
        <p className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] italic">
          {cta}
        </p>
      )}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hashtags.map((h) => (
            <Badge key={h} variant="outline" className="text-[10px]">
              {h.startsWith("#") ? h : `#${h}`}
            </Badge>
          ))}
        </div>
      )}
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
  )
}

// ─── Draft card ──────────────────────────────────────────────────────────────

export function DraftCard({ result }: { result: MayaDraftResult }) {
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
        />
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Variants tabs card ──────────────────────────────────────────────────────

export function VariantsTabsCard({ result }: { result: MayaVariantResult }) {
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
            {result.revised.hashtags.map((h) => (
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
              // changes
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
            {result.hashtags.map((h) => (
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
