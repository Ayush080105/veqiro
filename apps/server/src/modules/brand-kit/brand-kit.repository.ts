import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";

export const findBrandKit = (organizationId: string) =>
  prisma.brandKit.findUnique({ where: { organizationId } });

export const upsertBrandKit = (
  organizationId: string,
  data: Prisma.BrandKitUncheckedUpdateInput,
) =>
  prisma.brandKit.upsert({
    where: { organizationId },
    create: { ...(data as Prisma.BrandKitUncheckedCreateInput), organizationId },
    update: data,
  });
