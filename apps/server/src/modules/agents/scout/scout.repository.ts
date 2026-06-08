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
      agent: Agent.SCOUT,
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
      agent: Agent.SCOUT,
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
    where: { organizationId, agent: Agent.SCOUT },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllScoutMessages = (organizationId: string) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.SCOUT },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      customInput: true,
    },
  });

// ── Competitor Watchlist ──────────────────────────────────────────────────────

export const findCompetitorWatches = (_organizationId: string) =>
  Promise.resolve([]);

export const upsertCompetitorWatch = (data: {
  organizationId: string;
  name: string;
  url: string;
  latestHash?: string | null;
  lastScannedAt?: Date | null;
}) =>
  Promise.resolve({
    id: "",
    organizationId: data.organizationId,
    name: data.name,
    url: data.url,
    latestHash: data.latestHash ?? null,
    lastScannedAt: data.lastScannedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

export const deleteCompetitorWatch = (id: string, organizationId: string) =>
  Promise.resolve({ count: id && organizationId ? 0 : 0 });
