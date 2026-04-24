"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Copy,
  Download,
  Sparkles,
  Shuffle,
  Wand2,
  Image as ImageIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

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
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Content ideas</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {result.ideas.length} ideas
        </Badge>
      </div>
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
            <p className="text-[10px] text-muted-foreground leading-relaxed">
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
    </Card>
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
  const full = `${body}${cta ? `\n\n${cta}` : ""}${
    hashtags.length ? `\n\n${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : ""
  }`
  const len = full.length
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
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
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
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button variant="outline" size="xs" onClick={() => copy(full)}>
          <Copy data-icon="inline-start" /> Copy post
        </Button>
        {src && (
          <a
            href={src}
            download={`maya-${platform}.png`}
            className="inline-flex h-6 items-center gap-1 border border-border px-2 text-xs hover:bg-muted"
          >
            <Download className="size-3" /> Image
          </a>
        )}
        <PublishDialog
          platform={platform}
          caption={`${body}${cta ? `\n\n${cta}` : ""}`}
          hashtags={hashtags}
          image={image}
        />
      </div>
    </div>
  )
}

// ─── Draft card ──────────────────────────────────────────────────────────────

export function DraftCard({ result }: { result: MayaDraftResult }) {
  const d = result.draft
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Draft post</p>
        {d.tone_used && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            tone: {d.tone_used}
          </Badge>
        )}
      </div>
      <DraftPreview
        platform={d.platform}
        body={d.body}
        hashtags={d.hashtags}
        cta={d.cta}
        title={d.title}
        image={result.image}
      />
    </Card>
  )
}

// ─── Variants tabs card ──────────────────────────────────────────────────────

export function VariantsTabsCard({ result }: { result: MayaVariantResult }) {
  const first = result.variants[0]?.platform ?? "linkedin"
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Shuffle className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">
          Adapted for {result.variants.length} platforms
        </p>
      </div>
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
    </Card>
  )
}

// ─── Revision diff card ──────────────────────────────────────────────────────

export function RevisionDiffCard({ result }: { result: MayaReviseResult }) {
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Wand2 className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Revised post</p>
      </div>
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
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Changes
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.changes_made.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-1.5">
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            copy(
              `${result.revised.body}\n\n${result.revised.cta ?? ""}\n\n${result.revised.hashtags.join(" ")}`
            )
          }
        >
          <Copy data-icon="inline-start" /> Copy
        </Button>
        <PublishDialog
          platform={result.platform}
          caption={`${result.revised.body}${result.revised.cta ? `\n\n${result.revised.cta}` : ""}`}
          hashtags={result.revised.hashtags}
          image={undefined}
        />
      </div>
    </Card>
  )
}

// ─── Image regen card ────────────────────────────────────────────────────────

export function ImageRegenCard({ result }: { result: MayaImageRegenResult }) {
  const src = imageSrc(result.image)
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Regenerated image</p>
      </div>
      {src && (
        <img
          src={src}
          alt="regenerated"
          className="w-full rounded-none"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
      )}
      <p className="text-[10px] italic text-muted-foreground">
        Prompt: {result.image?.prompt_used ?? "—"}
      </p>
      {src && (
        <div className="flex justify-end">
          <a
            href={src}
            download="maya-image.png"
            className="inline-flex h-6 items-center gap-1 border border-border px-2 text-xs hover:bg-muted"
          >
            <Download className="size-3" /> Download
          </a>
        </div>
      )}
    </Card>
  )
}

// ─── Content regen card ──────────────────────────────────────────────────────

export function ContentRegenCard({ result }: { result: MayaContentRegenResult }) {
  const full = `${result.caption}\n\n${result.cta}\n\n${result.hashtags.join(" ")}`
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Wand2 className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Rewritten caption</p>
      </div>
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
      <div className="flex justify-end gap-1.5">
        <Button variant="outline" size="xs" onClick={() => copy(full)}>
          <Copy data-icon="inline-start" /> Copy
        </Button>
        <PublishDialog
          platform={result.platform}
          caption={result.caption}
          hashtags={result.hashtags}
          image={undefined}
        />
      </div>
    </Card>
  )
}
