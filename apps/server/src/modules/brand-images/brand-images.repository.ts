import { prisma } from "../../config/prisma.js";

export const MAX_BRAND_IMAGES = 20;

export const findAll = (organizationId: string) =>
  prisma.brandImage.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });

export const findById = (id: string, organizationId: string) =>
  prisma.brandImage.findFirst({ where: { id, organizationId } });

export const countForOrg = (organizationId: string) =>
  prisma.brandImage.count({ where: { organizationId } });

export const create = (
  organizationId: string,
  data: { key: string; name: string },
) => prisma.brandImage.create({ data: { organizationId, ...data } });

export const updateMeta = (
  id: string,
  organizationId: string,
  data: { name?: string },
) => prisma.brandImage.updateMany({ where: { id, organizationId }, data });

export const remove = (id: string, organizationId: string) =>
  prisma.brandImage.deleteMany({ where: { id, organizationId } });
