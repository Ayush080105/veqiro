import type {
  PartialBrandKitInput,
  FinalizeBrandKitInput,
  FinalizeAssetInput,
} from "./brand-kit.schema.js";
import * as repo from "./brand-kit.repository.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";
import {
  isR2Configured,
  deleteObject,
  headObject,
  keyBelongsToOrg,
} from "../../common/utils/r2.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

const ALLOWED_ASSET_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_ASSET_BYTES = 5 * 1024 * 1024;

// ── Wire ⇄ DB translation ────────────────────────────────────────────────
// HTTP/JSON uses camelCase (matches the Express camelize middleware + the
// Next/React frontend convention). Prisma columns are snake_case (legacy from
// when the table was added). We translate at this boundary so the rest of the
// app stays consistent.

type BrandKitRow = NonNullable<Awaited<ReturnType<typeof repo.findBrandKit>>>;

export interface BrandKitDto {
  id: string;
  organizationId: string;
  companyName: string;
  companyDescription: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  logoUrl: string | null;
  logoKey: string | null;
  mascotUrl: string | null;
  mascotKey: string | null;
  brandColors: { primary?: string; secondary?: string; accent?: string };
  platformTones: { twitter?: string; linkedin?: string; instagram?: string };
  competitors: string[];
  keyDifferentiators: string;
  websiteUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export const serializeBrandKit = (row: BrandKitRow): BrandKitDto => ({
  id: row.id,
  organizationId: row.organizationId,
  companyName: row.company_name,
  companyDescription: row.company_description,
  industry: row.industry,
  targetAudience: row.target_audience,
  brandVoice: row.brand_voice,
  logoUrl: row.logo_url,
  logoKey: row.logo_key,
  mascotUrl: row.mascot_url,
  mascotKey: row.mascot_key,
  brandColors: (row.brand_colors as BrandKitDto["brandColors"]) ?? {},
  platformTones: (row.platform_tones as BrandKitDto["platformTones"]) ?? {},
  competitors: (row.competitors as string[]) ?? [],
  keyDifferentiators: row.key_differentiators,
  websiteUrl: row.website_url,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPrismaInput = (
  input: PartialBrandKitInput | FinalizeBrandKitInput,
): Prisma.BrandKitUncheckedUpdateInput => {
  const data: Prisma.BrandKitUncheckedUpdateInput = {};
  if (input.companyName !== undefined) data.company_name = input.companyName;
  if (input.companyDescription !== undefined)
    data.company_description = input.companyDescription;
  if (input.industry !== undefined) data.industry = input.industry;
  if (input.targetAudience !== undefined)
    data.target_audience = input.targetAudience;
  if (input.brandVoice !== undefined) data.brand_voice = input.brandVoice;
  if (input.logoUrl !== undefined) data.logo_url = input.logoUrl;
  if (input.logoKey !== undefined) data.logo_key = input.logoKey;
  if (input.mascotUrl !== undefined) data.mascot_url = input.mascotUrl;
  if (input.mascotKey !== undefined) data.mascot_key = input.mascotKey;
  if (input.brandColors !== undefined)
    data.brand_colors = input.brandColors as Prisma.InputJsonValue;
  if (input.platformTones !== undefined)
    data.platform_tones = input.platformTones as Prisma.InputJsonValue;
  if (input.competitors !== undefined)
    data.competitors = input.competitors as Prisma.InputJsonValue;
  if (input.keyDifferentiators !== undefined)
    data.key_differentiators = input.keyDifferentiators;
  if (input.websiteUrl !== undefined) data.website_url = input.websiteUrl;
  return data;
};

// ── Operations ────────────────────────────────────────────────────────────

export const getBrandKit = async (organizationId: string) => {
  const row = await repo.findBrandKit(organizationId);
  return row ? serializeBrandKit(row) : null;
};

// Internal endpoint (called by apps/ai with x-internal-key) keeps snake_case
// to match the existing Python contract.
export const getBrandKitRaw = (organizationId: string) =>
  repo.findBrandKit(organizationId);

// PATCH — auto-save. Permissive: any subset of fields, no minimums.
export const saveBrandKit = async (
  organizationId: string,
  input: PartialBrandKitInput,
) => {
  const data = toPrismaInput(input);
  const row = await repo.upsertBrandKit(organizationId, data);
  return serializeBrandKit(row);
};

// POST /finalize — strict. Marks Organization.onboarded = true on success.
export const finalizeBrandKit = async (
  organizationId: string,
  input: FinalizeBrandKitInput,
) => {
  const data = toPrismaInput(input);
  const row = await repo.upsertBrandKitAndMarkOnboarded(organizationId, data);
  return serializeBrandKit(row);
};

// POST /upload-asset/finalize — called after the browser has PUT the file
// directly to R2 via a presigned URL. We HeadObject to verify the upload
// actually happened (and matches the expected size/content-type) before
// persisting the URL/key.
export const finalizeAssetUpload = async (
  organizationId: string,
  input: FinalizeAssetInput,
): Promise<{ url: string; key: string; kind: "logo" | "mascot" }> => {
  if (!isR2Configured()) {
    throw new BadRequestError(
      "Asset uploads aren't configured on the server. Set R2_* env vars.",
    );
  }

  // Defence-in-depth: a key the client posts must belong to that org.
  // Presign already enforces this, but a malicious client might try to
  // "claim" another org's key here.
  if (!keyBelongsToOrg(input.key, organizationId)) {
    throw new BadRequestError("Invalid object key.");
  }

  const head = await headObject(input.key);
  if (!head) {
    throw new BadRequestError("Upload not found in storage. Try again.");
  }
  if (!ALLOWED_ASSET_TYPES.has(head.contentType)) {
    throw new BadRequestError("Uploaded file is not an allowed image type.");
  }
  if (head.size > MAX_ASSET_BYTES) {
    throw new BadRequestError("Image must be under 5MB.");
  }

  // If there was an old object, drop it from R2 (best-effort — failure
  // shouldn't block the upload, the new URL is what matters).
  const existing = await repo.findBrandKit(organizationId);
  const oldKey =
    input.kind === "logo" ? existing?.logo_key : existing?.mascot_key;

  await repo.setBrandAsset(organizationId, input.kind, input.url, input.key);

  if (oldKey && oldKey !== input.key) {
    try {
      await deleteObject(oldKey);
    } catch (err) {
      console.warn(
        `[brand-kit] failed to delete old ${input.kind} object ${oldKey}:`,
        err,
      );
    }
  }

  return { url: input.url, key: input.key, kind: input.kind };
};

// DELETE-style helper (called from PATCH with logoUrl=null) — clean up R2 too.
export const removeAsset = async (
  organizationId: string,
  kind: "logo" | "mascot",
): Promise<BrandKitDto> => {
  const existing = await repo.findBrandKit(organizationId);
  const oldKey = kind === "logo" ? existing?.logo_key : existing?.mascot_key;
  const row = await repo.setBrandAsset(organizationId, kind, null, null);
  if (oldKey && isR2Configured()) {
    try {
      await deleteObject(oldKey);
    } catch (err) {
      console.warn(
        `[brand-kit] failed to delete ${kind} object ${oldKey}:`,
        err,
      );
    }
  }
  return serializeBrandKit(row);
};
