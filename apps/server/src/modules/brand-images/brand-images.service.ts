import * as repo from "./brand-images.repository.js";
import {
  isR2Configured,
  deleteObject,
  headObject,
  keyBelongsToOrg,
} from "../../common/utils/r2.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

type BrandImageRow = NonNullable<Awaited<ReturnType<typeof repo.findById>>>;

export interface BrandImageDto {
  id: string;
  organizationId: string;
  url: string;
  key: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const serialize = (row: BrandImageRow): BrandImageDto => ({
  id: row.id,
  organizationId: row.organizationId,
  url: row.url,
  key: row.key,
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const listBrandImages = async (
  organizationId: string,
): Promise<BrandImageDto[]> => {
  const rows = await repo.findAll(organizationId);
  return rows.map(serialize);
};

export const finalizeBrandImageUpload = async (
  organizationId: string,
  input: { key: string; url: string; name: string },
): Promise<BrandImageDto> => {
  if (!isR2Configured()) {
    throw new BadRequestError(
      "Asset uploads aren't configured on the server. Set R2_* env vars.",
    );
  }

  if (!keyBelongsToOrg(input.key, organizationId)) {
    throw new BadRequestError("Invalid object key.");
  }

  const count = await repo.countForOrg(organizationId);
  if (count >= repo.MAX_BRAND_IMAGES) {
    throw new BadRequestError(
      `Maximum of ${repo.MAX_BRAND_IMAGES} brand images reached. Delete one to upload another.`,
    );
  }

  const head = await headObject(input.key);
  if (!head) {
    throw new BadRequestError("Upload not found in storage. Try again.");
  }
  if (!ALLOWED_TYPES.has(head.contentType)) {
    throw new BadRequestError(
      "Uploaded file is not an allowed image type (PNG, JPEG, WebP).",
    );
  }
  if (head.size > MAX_BYTES) {
    throw new BadRequestError("Image must be under 10MB.");
  }

  const row = await repo.create(organizationId, input);
  return serialize(row);
};

export const updateBrandImage = async (
  organizationId: string,
  id: string,
  data: { name?: string },
): Promise<BrandImageDto> => {
  const result = await repo.updateMeta(id, organizationId, data);
  if (result.count === 0) throw new NotFoundError("Brand image not found.");
  const row = await repo.findById(id, organizationId);
  if (!row) throw new NotFoundError("Brand image not found.");
  return serialize(row);
};

export const deleteBrandImage = async (
  organizationId: string,
  id: string,
): Promise<void> => {
  const existing = await repo.findById(id, organizationId);
  if (!existing) throw new NotFoundError("Brand image not found.");
  const result = await repo.remove(id, organizationId);
  if (result.count === 0) throw new NotFoundError("Brand image not found.");
  if (existing.key && isR2Configured()) {
    deleteObject(existing.key).catch((err) =>
      console.warn(
        `[brand-images] failed to delete R2 object ${existing.key}:`,
        err,
      ),
    );
  }
};

// Used by Maya service: given selected image IDs, return {id, url} for each.
// Silently skips IDs that no longer exist (image may have been deleted).
export const getBrandImagesForGeneration = async (
  organizationId: string,
  ids: string[],
): Promise<Array<{ id: string; url: string }>> => {
  if (!ids.length) return [];
  const all = await repo.findAll(organizationId);
  return ids
    .map((id) => all.find((img) => img.id === id))
    .filter((img): img is BrandImageRow => img !== undefined)
    .map(({ id, url }) => ({ id, url }));
};
