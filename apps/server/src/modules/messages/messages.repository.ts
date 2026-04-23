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
