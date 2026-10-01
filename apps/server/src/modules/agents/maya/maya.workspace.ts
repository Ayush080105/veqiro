import { prisma } from "../../../config/prisma.js";
import {
  ActorKind,
  Agent,
  CampaignStatus,
  WorkObjectStatus,
} from "../../../../prisma/generated/prisma/client.js";
import { recordActivityEvent } from "../../activity/activity-event.service.js";
import {
  projectWorkObject,
  unprojectWorkObject,
  reprojectAll,
} from "../../workspace/work-objects.projector.js";

/**
 * Maya's bridge into the workspace framework — the same shape as Lex's, which
 * is the point: the second agent should be a copy with different nouns, and if
 * it is not, the framework is not carrying its weight.
 */

export const MAYA_KINDS = {
  post: "maya.post",
  campaign: "maya.campaign",
} as const;

/** Publishing lifecycle -> the shared one. */
const STATUS_BY_POST_STATUS: Record<string, WorkObjectStatus> = {
  pending: WorkObjectStatus.DRAFT,
  scheduled: WorkObjectStatus.ACTIVE,
  publishing: WorkObjectStatus.ACTIVE,
  success: WorkObjectStatus.DONE,
  // A failed publish is the definition of something needing a human.
  failed: WorkObjectStatus.NEEDS_REVIEW,
  cancelled: WorkObjectStatus.ARCHIVED,
};

const STATUS_BY_CAMPAIGN_STATUS: Record<CampaignStatus, WorkObjectStatus> = {
  BRIEF: WorkObjectStatus.DRAFT,
  GENERATING: WorkObjectStatus.ACTIVE,
  REVIEW: WorkObjectStatus.NEEDS_REVIEW,
  SCHEDULED: WorkObjectStatus.ACTIVE,
  PUBLISHED: WorkObjectStatus.DONE,
  ARCHIVED: WorkObjectStatus.ARCHIVED,
};

/** First line of a caption, which is what people recognise a post by. */
const titleFromCaption = (caption: string): string => {
  const firstLine = caption.split("\n").find((l) => l.trim().length > 0) ?? "Post";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
};

export async function projectPublishedPost(postId: string): Promise<void> {
  // projection-guard: the index is derived bookkeeping, so a failure here
  // must never propagate into the publish or upload that triggered it.
  try {
    const post = await prisma.publishedPost.findUnique({ where: { id: postId } });
    if (!post) {
      await unprojectWorkObject(MAYA_KINDS.post, postId);
      return;
    }

    await projectWorkObject({
      organizationId: post.organizationId,
      agent: Agent.MAYA,
      kind: MAYA_KINDS.post,
      sourceId: post.id,
      title: titleFromCaption(post.caption),
      status: STATUS_BY_POST_STATUS[post.status] ?? WorkObjectStatus.ACTIVE,
      // Only a scheduled post has a date that needs anything of anyone.
      dueAt: post.status === "scheduled" ? post.scheduledAt : null,
      ownerUserId: post.userId,
      preview: {
        platform: post.platform,
        status: post.status,
        imageUrl: post.imageUrl,
        hasVideo: Boolean(post.videoUrl),
        error: post.error,
        campaignId: post.campaignId,
      },
      sourceUpdatedAt: post.publishedAt ?? post.scheduledAt ?? post.createdAt,
    });

  } catch (err) {
    console.error("[maya] projection failed", err);
  }
}

export async function projectCampaign(campaignId: string): Promise<void> {
  // projection-guard: the index is derived bookkeeping, so a failure here
  // must never propagate into the publish or upload that triggered it.
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      await unprojectWorkObject(MAYA_KINDS.campaign, campaignId);
      return;
    }

    await projectWorkObject({
      organizationId: campaign.organizationId,
      agent: Agent.MAYA,
      kind: MAYA_KINDS.campaign,
      sourceId: campaign.id,
      title: campaign.name,
      status: STATUS_BY_CAMPAIGN_STATUS[campaign.status],
      dueAt: campaign.scheduledFor,
      ownerUserId: campaign.userId,
      preview: {
        platform: campaign.platform,
        status: campaign.status,
        objective: campaign.objective,
        imageUrl: campaign.productImageUrls[0] ?? null,
      },
      sourceUpdatedAt: campaign.updatedAt,
    });

  } catch (err) {
    console.error("[maya] projection failed", err);
  }
}

export async function recordMayaEvent(input: {
  organizationId: string;
  userId?: string | null;
  byAgent?: boolean;
  verb: string;
  summary: string;
  objectKind?: string;
  objectId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordActivityEvent({
    organizationId: input.organizationId,
    agent: Agent.MAYA,
    actorKind: input.byAgent ? ActorKind.AGENT : ActorKind.USER,
    actorUserId: input.userId ?? null,
    verb: input.verb,
    summary: input.summary,
    objectKind: input.objectKind ?? null,
    objectId: input.objectId ?? null,
    metadata: input.metadata as never,
  });
}

// ─── Reindex ─────────────────────────────────────────────────────────────────

/** Rebuild every post index row from published_post. */
export async function reindexMayaPosts(organizationId?: string) {
  const posts = await prisma.publishedPost.findMany({
    where: organizationId ? { organizationId } : undefined,
  });
  return reprojectAll(
    MAYA_KINDS.post,
    posts.map((post) => ({
      organizationId: post.organizationId,
      agent: Agent.MAYA,
      kind: MAYA_KINDS.post,
      sourceId: post.id,
      title: titleFromCaption(post.caption),
      status: STATUS_BY_POST_STATUS[post.status] ?? WorkObjectStatus.ACTIVE,
      dueAt: post.status === "scheduled" ? post.scheduledAt : null,
      ownerUserId: post.userId,
      preview: {
        platform: post.platform,
        status: post.status,
        imageUrl: post.imageUrl,
        hasVideo: Boolean(post.videoUrl),
        error: post.error,
        campaignId: post.campaignId,
      },
      sourceUpdatedAt: post.publishedAt ?? post.scheduledAt ?? post.createdAt,
    })),
    organizationId,
  );
}

/** Rebuild every campaign index row from campaign. */
export async function reindexMayaCampaigns(organizationId?: string) {
  const campaigns = await prisma.campaign.findMany({
    where: organizationId ? { organizationId } : undefined,
  });
  return reprojectAll(
    MAYA_KINDS.campaign,
    campaigns.map((campaign) => ({
      organizationId: campaign.organizationId,
      agent: Agent.MAYA,
      kind: MAYA_KINDS.campaign,
      sourceId: campaign.id,
      title: campaign.name,
      status: STATUS_BY_CAMPAIGN_STATUS[campaign.status],
      dueAt: campaign.scheduledFor,
      ownerUserId: campaign.userId,
      preview: {
        platform: campaign.platform,
        status: campaign.status,
        objective: campaign.objective,
        imageUrl: campaign.productImageUrls[0] ?? null,
      },
      sourceUpdatedAt: campaign.updatedAt,
    })),
    organizationId,
  );
}
