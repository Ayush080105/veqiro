"use client"

import Image from "next/image"
import { Megaphone } from "lucide-react"

import {
  useCampaignAction,
  useCampaigns,
  type Campaign,
  type CampaignStatus,
} from "@/lib/api/workspace"
import type { WorkListProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"

const LEVEL: Record<CampaignStatus, "info" | "ok" | "warn"> = {
  BRIEF: "info",
  GENERATING: "info",
  // The one state that wants a human, so the one that looks like it.
  REVIEW: "warn",
  SCHEDULED: "ok",
  PUBLISHED: "ok",
  ARCHIVED: "info",
}

const LABEL: Record<CampaignStatus, string> = {
  BRIEF: "Brief",
  GENERATING: "Generating",
  REVIEW: "Needs your approval",
  SCHEDULED: "Approved",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
}

/**
 * Campaigns as durable objects rather than images scrolled past in a thread.
 *
 * This is what the Campaign model bought: the PRD's brief → assets → approval
 * → schedule flow now has somewhere to happen, and a campaign generated last
 * week can still be found.
 */
export function MayaCampaignsWork({ organizationId }: WorkListProps) {
  const { data, isLoading } = useCampaigns()
  const action = useCampaignAction(organizationId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-28 rounded-[var(--vq-r)]" />
        <Skeleton className="h-28 rounded-[var(--vq-r)]" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title="No campaigns yet"
        description="Give Maya a product photo and a brief, and the campaign will be kept here with its assets, approval and schedule."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((campaign) => (
        <CampaignRow
          key={campaign.id}
          campaign={campaign}
          busy={action.isPending}
          onApprove={() => action.mutate({ id: campaign.id, action: "approve" })}
          onArchive={() => action.mutate({ id: campaign.id, action: "archive" })}
        />
      ))}
    </ul>
  )
}

function CampaignRow({
  campaign,
  busy,
  onApprove,
  onArchive,
}: {
  campaign: Campaign
  busy: boolean
  onApprove: () => void
  onArchive: () => void
}) {
  const photos = campaign.assets?.photos ?? []
  const thumbnails = photos
    .map((p) => p.image?.image_url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4)

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3">
      <div className="flex shrink-0 gap-1">
        {thumbnails.length > 0 ? (
          thumbnails.map((url) => (
            <span
              key={url}
              className="relative size-12 overflow-hidden rounded-[var(--vq-r-sm)] border border-border"
            >
              <Image src={url} alt="" fill sizes="48px" className="object-cover" />
            </span>
          ))
        ) : (
          <span className="grid size-12 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
            <Megaphone className="size-5 text-muted-foreground" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{campaign.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {campaign.platform}
          {photos.length > 0 &&
            ` · ${photos.length} ${photos.length === 1 ? "asset" : "assets"}`}
        </p>
      </div>

      <StatusPill level={LEVEL[campaign.status]} className="shrink-0">
        {LABEL[campaign.status]}
      </StatusPill>

      <div className="flex shrink-0 gap-1">
        {campaign.status === "REVIEW" && (
          <Button size="sm" onClick={onApprove} disabled={busy}>
            Approve
          </Button>
        )}
        {campaign.status !== "ARCHIVED" && (
          <Button size="sm" variant="ghost" onClick={onArchive} disabled={busy}>
            Archive
          </Button>
        )}
      </div>
    </li>
  )
}
