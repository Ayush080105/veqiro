import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";

export const findBrandKit = (organizationId: string) =>
  prisma.brandKit.findUnique({ where: { organizationId } });

export const upsertBrandKitAndMarkOnboarded = (
  organizationId: string,
  data: Prisma.BrandKitUncheckedUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    const kit = await tx.brandKit.upsert({
      where: { organizationId },
      create: {
        ...(data as Prisma.BrandKitUncheckedCreateInput),
        organizationId,
      },
      update: data,
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: { onboarded: true },
    });
    return kit;
  });
