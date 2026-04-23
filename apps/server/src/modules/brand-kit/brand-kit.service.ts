import type { SaveBrandKitInput } from "./brand-kit.schema.js";
import * as repo from "./brand-kit.repository.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";

export const getBrandKit = async (organizationId: string) => {
  return repo.findBrandKit(organizationId);
};

export const saveBrandKit = async (
  organizationId: string,
  input: SaveBrandKitInput,
) => {
  // organizationId from the body is ignored — the session is the source of truth.
  const {
    organizationId: _ignored,
    brand_colors,
    platform_tones,
    competitors,
    ...scalars
  } = input;

  const data: Prisma.BrandKitUncheckedUpdateInput = { ...scalars };
  if (brand_colors !== undefined) {
    data.brand_colors = brand_colors as Prisma.InputJsonValue;
  }
  if (platform_tones !== undefined) {
    data.platform_tones = platform_tones as Prisma.InputJsonValue;
  }
  if (competitors !== undefined) {
    data.competitors = competitors as Prisma.InputJsonValue;
  }

  return repo.upsertBrandKitAndMarkOnboarded(organizationId, data);
};
