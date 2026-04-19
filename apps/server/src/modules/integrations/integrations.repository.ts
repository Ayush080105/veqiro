import { prisma } from "../../config/prisma.js";
import {
  Prisma,
  SocialPlatform,
} from "../../../prisma/generated/prisma/client.js";

export const findByOrg = (organizationId: string) =>
  prisma.socialAccount.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      platform: true,
      providerAccountId: true,
      accountName: true,
      scope: true,
      metadata: true,
      accessTokenExpiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const findById = (id: string) =>
  prisma.socialAccount.findUnique({ where: { id } });

export interface UpsertInput {
  organizationId: string;
  userId: string;
  platform: SocialPlatform;
  providerAccountId: string;
  accountName?: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date | null;
  scope?: string;
  metadata?: Record<string, unknown>;
}

export const upsert = (input: UpsertInput) =>
  prisma.socialAccount.upsert({
    where: {
      organizationId_platform_providerAccountId: {
        organizationId: input.organizationId,
        platform: input.platform,
        providerAccountId: input.providerAccountId,
      },
    },
    create: {
      organizationId: input.organizationId,
      userId: input.userId,
      platform: input.platform,
      providerAccountId: input.providerAccountId,
      accountName: input.accountName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt ?? undefined,
      scope: input.scope,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      userId: input.userId,
      accountName: input.accountName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt ?? undefined,
      scope: input.scope,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

export const update = (
  id: string,
  data: {
    accessToken?: string;
    refreshToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    scope?: string;
    metadata?: Record<string, unknown>;
  }
) =>
  prisma.socialAccount.update({
    where: { id },
    data: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? undefined,
      accessTokenExpiresAt: data.accessTokenExpiresAt ?? undefined,
      scope: data.scope,
      metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

export const remove = (id: string) =>
  prisma.socialAccount.delete({ where: { id } });
