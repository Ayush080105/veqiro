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
    create: {
      ...(data as Prisma.BrandKitUncheckedCreateInput),
      organizationId,
    },
    update: data,
  });

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

export const setBrandAsset = (
  organizationId: string,
  kind: "logo" | "mascot",
  url: string | null,
  key: string | null,
) => {
  const assetData =
    kind === "logo"
      ? { logo_url: url, logo_key: key }
      : { mascot_url: url, mascot_key: key };
  return prisma.brandKit.upsert({
    where: { organizationId },
    create: {
      organizationId,
      ...assetData,
    } as Prisma.BrandKitUncheckedCreateInput,
    update: assetData as Prisma.BrandKitUncheckedUpdateInput,
  });
};
