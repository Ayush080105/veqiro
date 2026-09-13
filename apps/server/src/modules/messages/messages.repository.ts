import { prisma } from "../../config/prisma.js";
import type { Agent } from "../../../prisma/generated/prisma/client.js";

export type LastMessageRow = {
  agent: Agent;
  content: string;
  createdAt: Date;
  role: string;
};

export const findLastMessagePerAgent = (organizationId: string) =>
  prisma.$queryRaw<LastMessageRow[]>`
    SELECT DISTINCT ON (agent) agent, content, "createdAt", role
    FROM message
    WHERE "organizationId" = ${organizationId}
    ORDER BY agent, "createdAt" DESC
  `;

const MESSAGE_LIST_SELECT = {
  id: true,
  role: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  customInput: true,
  pinned: true,
  pinnedAt: true,
  agent: true,
} as const;

/** Ownership check before mutating — a message id alone isn't enough to
 * trust, since it's client-supplied. */
export const findMessageForOrg = (id: string, organizationId: string) =>
  prisma.message.findFirst({ where: { id, organizationId } });

export const setPinned = (id: string, pinned: boolean) =>
  prisma.message.update({
    where: { id },
    data: { pinned, pinnedAt: pinned ? new Date() : null },
    select: MESSAGE_LIST_SELECT,
  });

export const findPinnedMessages = (organizationId: string, agent: Agent) =>
  prisma.message.findMany({
    where: { organizationId, agent, isTeam: false, pinned: true },
    orderBy: { pinnedAt: "desc" },
    select: MESSAGE_LIST_SELECT,
  });

export const searchMessages = (
  organizationId: string,
  agent: Agent,
  query: string,
  limit = 20,
) =>
  prisma.message.findMany({
    where: {
      organizationId,
      agent,
      isTeam: false,
      content: { contains: query, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: MESSAGE_LIST_SELECT,
  });
