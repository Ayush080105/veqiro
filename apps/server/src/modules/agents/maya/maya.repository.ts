import { prisma } from "../../../config/prisma.js";
import { Agent, Prisma, SocialPlatform } from "../../../../prisma/generated/prisma/client.js";
import { recordDirectActionContextForAssistantMessage } from "../../../common/utils/contextService.js";

export const createUserMessage = (data: {
  organizationId: string;
  userId: string;
  content: string;
  customInput?: unknown;
}) =>
  prisma.message.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      role: "user",
      content: data.content,
      agent: Agent.MAYA,
      customInput: data.customInput as Prisma.InputJsonValue | undefined,
    },
  });

export const createAssistantMessage = (data: {
  organizationId: string;
  userId: string;
  content: string;
  imageUrl?: string;
  tokensUsed?: number;
  model?: string;
  customInput?: unknown;
}) =>
  prisma.message.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      role: "assistant",
      content: data.content,
      agent: Agent.MAYA,
      imageUrl: data.imageUrl,
      tokensUsed: data.tokensUsed,
      model: data.model,
      customInput: data.customInput as Prisma.InputJsonValue | undefined,
    },
  }).then((message) => {
    const customInput = data.customInput as { actionId?: unknown } | undefined;
    if (typeof customInput?.actionId === "string") {
      void recordDirectActionContextForAssistantMessage(message.id);
    }
    return message;
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.MAYA, isTeam: false },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { id: true, role: true, content: true, imageUrl: true },
  });

export const updateMessageImage = async (
  messageId: string,
  imageUrl: string,
  imageResult: { image_url: string; content_type: string; prompt_used: string }
) => {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { customInput: true },
  });
  const current = (existing?.customInput as Record<string, unknown> | null) ?? {};
  const currentResult = (current.result as Record<string, unknown> | null) ?? {};
  return prisma.message.update({
    where: { id: messageId },
    data: {
      imageUrl,
      customInput: {
        ...current,
        result: { ...currentResult, image: imageResult },
      } as Prisma.InputJsonValue,
    },
  });
};

export const findAllMayaMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => {
  const { before, limit = 20 } = opts;
  return prisma.message
    .findMany({
      where: {
        organizationId,
        agent: Agent.MAYA,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        customInput: true,
      },
    })
    .then((rows) => rows.reverse());
};

const publishedPostSelect = {
  id: true,
  platform: true,
  caption: true,
  hashtags: true,
  imageUrl: true,
  status: true,
  error: true,
  publishedAt: true,
  scheduledAt: true,
  createdAt: true,
  platformPostId: true,
} as const;

export const findPublishedPosts = (organizationId: string) =>
  prisma.publishedPost.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: publishedPostSelect,
  });

export const findPublishedPostById = (id: string, organizationId: string) =>
  prisma.publishedPost.findFirst({ where: { id, organizationId } });

// Atomically claims scheduled posts whose fire time has passed, across
// concurrent server instances — mirrors tasks.repository.ts::claimDueTasks.
// "publishing" is a transient status that only exists between the claim and
// firePublishedPost/firePublishedCarousel's success/failed update moments later.
export async function claimDueScheduledPosts() {
  return prisma.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      userId: string;
      socialAccountId: string | null;
      platform: string;
      caption: string;
      imageUrl: string | null;
      videoUrl: string | null;
      imageUrls: string[];
      postType: string | null;
      failureNotifiedAt: Date | null;
    }>
  >`
    UPDATE "published_post"
    SET status = 'publishing'
    WHERE id IN (
      SELECT id FROM "published_post"
      WHERE status = 'scheduled' AND "scheduledAt" <= NOW()
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "organizationId", "userId", "socialAccountId", platform, caption, "imageUrl", "videoUrl", "imageUrls", "postType", "failureNotifiedAt"
  `;
}

export const findRecipientEmail = (userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });

export const getRecentIdeas = (
  organizationId: string,
  platform: SocialPlatform,
  limit = 100
) =>
  prisma.mayaContentIdea.findMany({
    where: { organizationId, platform },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { title: true, hook: true, contentType: true },
  });

export const saveIdeas = (
  ideas: {
    organizationId: string;
    platform: SocialPlatform;
    title: string;
    hook: string;
    contentType: string;
  }[]
) => prisma.mayaContentIdea.createMany({ data: ideas });
