import { prisma } from "../../../config/prisma.js";
import { Agent, Prisma } from "../../../../prisma/generated/prisma/client.js";
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
      agent: Agent.SAGE,
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
      agent: Agent.SAGE,
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
    where: { organizationId, agent: Agent.SAGE, isTeam: false },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllSageMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => {
  const { before, limit = 20 } = opts;
  return prisma.message
    .findMany({
      where: {
        organizationId,
        agent: Agent.SAGE,
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

// ── Saved Keywords ─────────────────────────────────────────────────────────────

export const findSavedKeywords = (organizationId: string) =>
  prisma.sageSavedKeyword.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

export const upsertSavedKeyword = (data: {
  organizationId: string;
  keyword: string;
  searchIntent: string;
  estimatedDifficulty: number;
  relevanceScore: number;
  searchVolumeEstimate?: string | null;
  suggestedContentType: string;
}) =>
  prisma.sageSavedKeyword.upsert({
    where: { organizationId_keyword: { organizationId: data.organizationId, keyword: data.keyword } },
    create: data,
    update: {
      searchIntent: data.searchIntent,
      estimatedDifficulty: data.estimatedDifficulty,
      relevanceScore: data.relevanceScore,
      searchVolumeEstimate: data.searchVolumeEstimate,
      suggestedContentType: data.suggestedContentType,
    },
  });

export const deleteSavedKeyword = (id: string, organizationId: string) =>
  prisma.sageSavedKeyword.deleteMany({ where: { id, organizationId } });
