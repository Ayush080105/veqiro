"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Send, ExternalLink, Images } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIntegrations } from "@/lib/api/integrations"
import { publishPost, publishCarousel } from "@/lib/api/assistants"
import type { ContentPlatform, ImageResult, VideoResult } from "@/lib/types/agents"

const CONTENT_PLATFORMS = ["linkedin", "twitter", "instagram"] as const

export function normalizePlatform(platform?: ContentPlatform | string | null): ContentPlatform | null {
  const normalized = platform?.toLowerCase()
  return CONTENT_PLATFORMS.find((p) => p === normalized) ?? null
}

const POST_TYPES = [
  { value: "reel" as const, label: "Reel" },
  { value: "post" as const, label: "Post" },
]

export function PostTypeToggle({ value, onChange }: { value: "post" | "reel"; onChange: (v: "post" | "reel") => void }) {
  return (
    <div className="flex gap-1.5">
      {POST_TYPES.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${value === opt.value ? "#1A1A1A" : "#D4C9B0"}`,
            background: value === opt.value ? "#1A1A1A" : "#FFF9ED",
            color: value === opt.value ? "#FFF9ED" : "#1A1A1A",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export interface PublishDialogProps {
  platform?: ContentPlatform | string | null
  caption: string
  hashtags: string[]
  image?: ImageResult | null
  video?: VideoResult | null
}

export interface CampaignPublishDialogProps {
  imageUrls: string[]
  photoCount: number
  caption?: string
  hashtags?: string[]
}

export function CampaignPublishDialog({ imageUrls, photoCount, caption, hashtags }: CampaignPublishDialogProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const { data: accounts = [], isLoading: loading, isError, error } = useIntegrations()

  const eligible = useMemo(
    () => accounts.filter((a) => String(a.platform ?? "").toUpperCase() === "INSTAGRAM"),
    [accounts]
  )

  const handlePublish = async (accountId: string) => {
    if (!organizationId) {
      toast.error("No active organization selected")
      return
    }
    setPublishing(true)
    try {
      const fullCaption = [caption, hashtags?.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")]
        .filter(Boolean)
        .join("\n\n")
      const result = await publishCarousel(organizationId, {
        socialAccountId: accountId,
        caption: fullCaption,
        hashtags: [],
        imageUrls,
      })
      toast.success(
        result.url ? (
          <span>
            Campaign published — <a href={result.url} target="_blank" rel="noreferrer" className="underline">view on Instagram</a>
          </span>
        ) : (
          "Campaign published to Instagram"
        )
      )
      setOpen(false)
    } catch (err) {
      toast.error(`Publish failed: ${(err as Error).message}`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <Button variant="chat-action" onClick={() => setOpen(true)} disabled={!imageUrls.length}>
        <Images className="size-3" /> Publish as Carousel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Campaign to Instagram</DialogTitle>
            <DialogDescription>
              All {photoCount} photos will be published as a single carousel post.
              Choose a connected Instagram account.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading accounts…</p>
          ) : isError ? (
            <p className="text-xs text-destructive">
              Couldn&apos;t load accounts: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          ) : eligible.length === 0 ? (
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-muted-foreground">No Instagram account connected yet.</p>
              <a
                href="/settings/integrations"
                className="inline-flex items-center gap-1 text-foreground hover:underline"
              >
                Connect Instagram <ExternalLink className="size-3" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {eligible.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handlePublish(a.id)}
                  disabled={publishing}
                  className="flex items-center justify-between rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5 text-left text-xs hover:bg-[#EFE7D6] transition-colors disabled:opacity-60"
                >
                  <span className="font-medium">{a.accountName ?? a.providerAccountId}</span>
                  <span className="text-muted-foreground">
                    {publishing ? "Publishing…" : "Publish"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="chat-utility" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PublishDialog({ platform, caption, hashtags, image, video }: PublishDialogProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [postType, setPostType] = useState<"post" | "reel">("reel")

  // useIntegrations auto-fetches on mount and revalidates on focus, so a
  // freshly-connected account appears next time the dialog opens without
  // any manual cache-busting.
  const { data: accounts = [], isLoading: loading, isError, error } = useIntegrations()

  // Case-insensitive match — defends against any backend casing drift
  // (Prisma serialises enums as upper-case strings; ContentPlatform is lower-case).
  const normalizedPlatform = normalizePlatform(platform)
  const platformLabel = normalizedPlatform ?? "this platform"
  const target = normalizedPlatform?.toUpperCase()
  const eligible = useMemo(
    () => accounts.filter((a) => String(a.platform ?? "").toUpperCase() === target),
    [accounts, target]
  )

  if (open && accounts.length > 0 && eligible.length === 0) {
    console.warn("PublishDialog: no eligible accounts for platform", {
      platform: normalizedPlatform,
      platforms: accounts.map((a) => a.platform),
    })
  }

  const handlePublish = async (accountId: string) => {
    if (!organizationId) {
      toast.error("No active organization selected")
      return
    }
    setPublishing(true)
    try {
      const result = await publishPost(organizationId, {
        socialAccountId: accountId,
        caption,
        hashtags,
        imageUrl: video ? undefined : image?.image_url,
        imageBase64: video ? undefined : image?.image_url ? undefined : image?.image_base64,
        videoUrl: video?.video_url,
        videoBase64: video?.video_url ? undefined : video?.video_base64,
        postType: video ? postType : undefined,
      })
      toast.success(
        result.url ? (
          <span>
            Published — <a href={result.url} target="_blank" rel="noreferrer" className="underline">view</a>
          </span>
        ) : (
          "Post published"
        )
      )
      setOpen(false)
    } catch (err) {
      toast.error(`Publish failed: ${(err as Error).message}`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <Button variant="chat-action" onClick={() => setOpen(true)} disabled={!normalizedPlatform}>
        <Send className="size-3" /> Publish
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to {platformLabel}</DialogTitle>
          <DialogDescription>
            Choose a connected {platformLabel} account to publish this post.
          </DialogDescription>
        </DialogHeader>

        {video && normalizedPlatform === "instagram" && (
          <PostTypeToggle value={postType} onChange={setPostType} />
        )}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading accounts…</p>
        ) : isError ? (
          <p className="text-xs text-destructive">
            Couldn&apos;t load accounts: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : eligible.length === 0 ? (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-muted-foreground">
              No {platformLabel} account connected yet.
            </p>
            <a
              href="/settings/integrations"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              Connect {platformLabel} <ExternalLink className="size-3" />
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {eligible.map((a) => (
              <button
                key={a.id}
                onClick={() => handlePublish(a.id)}
                disabled={publishing}
                className="flex items-center justify-between rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5 text-left text-xs hover:bg-[#EFE7D6] transition-colors disabled:opacity-60"
              >
                <span className="font-medium">{a.accountName ?? a.providerAccountId}</span>
                <span className="text-muted-foreground">
                  {publishing ? "Publishing…" : "Publish"}
                </span>
              </button>
            ))}
          </div>
        )}

          <DialogFooter>
            <Button variant="chat-utility" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
