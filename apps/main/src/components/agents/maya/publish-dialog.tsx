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
import type { ContentPlatform, ImageResult } from "@/lib/types/agents"

interface PublishDialogProps {
  platform: ContentPlatform
  caption: string
  hashtags: string[]
  image?: ImageResult | null
}

interface CampaignPublishDialogProps {
  imageUrls: string[]
  photoCount: number
}

export function CampaignPublishDialog({ imageUrls, photoCount }: CampaignPublishDialogProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const { data: accounts = [], isLoading: loading, isError, error } = useIntegrations()

  const eligible = useMemo(
    () => accounts.filter((a) => a.platform.toUpperCase() === "INSTAGRAM"),
    [accounts]
  )

  const handlePublish = async (accountId: string) => {
    if (!organizationId) {
      toast.error("No active organization selected")
      return
    }
    setPublishing(true)
    try {
      const result = await publishCarousel(organizationId, {
        socialAccountId: accountId,
        caption: "",
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!imageUrls.length}>
        <Images data-icon="inline-start" /> Publish as Carousel
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
                  className="flex items-center justify-between border border-border px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-60"
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
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PublishDialog({ platform, caption, hashtags, image }: PublishDialogProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // useIntegrations auto-fetches on mount and revalidates on focus, so a
  // freshly-connected account appears next time the dialog opens without
  // any manual cache-busting.
  const { data: accounts = [], isLoading: loading, isError, error } = useIntegrations()

  // Case-insensitive match — defends against any backend casing drift
  // (Prisma serialises enums as upper-case strings; ContentPlatform is lower-case).
  const target = platform.toUpperCase()
  const eligible = useMemo(
    () => accounts.filter((a) => a.platform.toUpperCase() === target),
    [accounts, target]
  )

  if (open && accounts.length > 0 && eligible.length === 0) {
    console.warn("PublishDialog: no eligible accounts for platform", {
      platform,
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
        imageUrl: image?.image_url,
        imageBase64: image?.image_url ? undefined : image?.image_base64,
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
      <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
        <Send data-icon="inline-start" /> Publish
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to {platform}</DialogTitle>
          <DialogDescription>
            Choose a connected {platform} account to publish this post.
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
            <p className="text-muted-foreground">
              No {platform} account connected yet.
            </p>
            <a
              href="/settings/integrations"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              Connect {platform} <ExternalLink className="size-3" />
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {eligible.map((a) => (
              <button
                key={a.id}
                onClick={() => handlePublish(a.id)}
                disabled={publishing}
                className="flex items-center justify-between border border-border px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-60"
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
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
