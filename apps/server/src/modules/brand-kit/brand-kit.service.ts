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
import { crawlWebsite, type CrawlResult } from "./crawler.js";

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
  valueProposition: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  logoUrl: string | null;
  logoKey: string | null;
  mascotUrl: string | null;
  mascotKey: string | null;
  letterheadUrl: string | null;
  letterheadKey: string | null;
  brandColors: { primary?: string; secondary?: string; accent?: string };
  platformTones: { twitter?: string; linkedin?: string; instagram?: string };
  competitors: string[];
  keyDifferentiators: string;
  websiteUrl: string;
  location: string;
  crawledContent: string | null;
  crawledSummary: string | null;
  crawledAt: Date | null;
  crawlSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const serializeBrandKit = (row: BrandKitRow): BrandKitDto => ({
  id: row.id,
  organizationId: row.organizationId,
  companyName: row.company_name,
  companyDescription: row.company_description,
  valueProposition: row.value_proposition,
  industry: row.industry,
  targetAudience: row.target_audience,
  brandVoice: row.brand_voice,
  logoUrl: row.logo_url,
  logoKey: row.logo_key,
  mascotUrl: row.mascot_url,
  mascotKey: row.mascot_key,
  letterheadUrl: row.letterhead_url,
  letterheadKey: row.letterhead_key,
  brandColors: (row.brand_colors as BrandKitDto["brandColors"]) ?? {},
  platformTones: (row.platform_tones as BrandKitDto["platformTones"]) ?? {},
  competitors: (row.competitors as string[]) ?? [],
  keyDifferentiators: row.key_differentiators,
  websiteUrl: row.website_url,
  location: row.location ?? "",
  crawledContent: row.crawled_content,
  crawledSummary: row.crawled_summary,
  crawledAt: row.crawled_at,
  crawlSource: row.crawl_source,
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
  if (input.valueProposition !== undefined)
    data.value_proposition = input.valueProposition;
  if (input.industry !== undefined) data.industry = input.industry;
  if (input.targetAudience !== undefined)
    data.target_audience = input.targetAudience;
  if (input.brandVoice !== undefined) data.brand_voice = input.brandVoice;
  if (input.logoUrl !== undefined) data.logo_url = input.logoUrl;
  if (input.logoKey !== undefined) data.logo_key = input.logoKey;
  if (input.mascotUrl !== undefined) data.mascot_url = input.mascotUrl;
  if (input.mascotKey !== undefined) data.mascot_key = input.mascotKey;
  const p = input as PartialBrandKitInput;
  if (p.letterheadUrl !== undefined) data.letterhead_url = p.letterheadUrl ?? null;
  if (p.letterheadKey !== undefined) data.letterhead_key = p.letterheadKey ?? null;
  if (input.brandColors !== undefined)
    data.brand_colors = input.brandColors as Prisma.InputJsonValue;
  if (input.platformTones !== undefined)
    data.platform_tones = input.platformTones as Prisma.InputJsonValue;
  if (input.competitors !== undefined)
    data.competitors = input.competitors as Prisma.InputJsonValue;
  if (input.keyDifferentiators !== undefined)
    data.key_differentiators = input.keyDifferentiators;
  if (input.websiteUrl !== undefined) data.website_url = input.websiteUrl;
  if (input.location !== undefined) data.location = input.location;
  if (input.crawledContent !== undefined)
    data.crawled_content = input.crawledContent;
  if (input.crawledSummary !== undefined)
    data.crawled_summary = input.crawledSummary;
  if (input.crawlSource !== undefined) data.crawl_source = input.crawlSource;
  // crawled_at is set whenever a new crawl is persisted (see persistCrawl).
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

  // Best-effort background crawl: if a website was provided and we don't yet
  // have crawled context for this org, fire-and-forget Jina Reader so brain
  // and agents have richer grounding next time they load. Failures only log.
  const shouldBackgroundCrawl =
    !!input.websiteUrl &&
    /^https?:\/\//u.test(input.websiteUrl) &&
    !row.crawled_content;
  if (shouldBackgroundCrawl) {
    setImmediate(() => {
      void crawlAndPersist(organizationId, input.websiteUrl as string).catch(
        (err) => {
          console.warn(
            `[brand-kit] background crawl failed for org ${organizationId}:`,
            err,
          );
        },
      );
    });
  }

  return serializeBrandKit(row);
};

// Used by both POST /scrape (when client wants to persist immediately) and the
// background crawl on finalize. Sets the four crawl_* columns atomically.
export const persistCrawl = async (
  organizationId: string,
  result: CrawlResult,
) => {
  const data: Prisma.BrandKitUncheckedUpdateInput = {
    crawled_content: result.content,
    crawled_summary: result.summary,
    crawled_at: new Date(),
    crawl_source: result.source,
  };
  const row = await repo.upsertBrandKit(organizationId, data);
  return serializeBrandKit(row);
};

const crawlAndPersist = async (organizationId: string, url: string) => {
  const result = await crawlWebsite(url);
  await persistCrawl(organizationId, result);
};

// POST /scrape — runs the crawler and returns the result (does NOT persist
// unless the caller asks via persist=true). Persisting separately lets the
// onboarding flow show the user what was found before committing.
export const scrapeWebsite = async (
  url: string,
  organizationId: string | undefined,
  options: { persist?: boolean } = {},
): Promise<CrawlResult> => {
  const result = await crawlWebsite(url);
  if (options.persist && organizationId) {
    await persistCrawl(organizationId, result);
  }
  return result;
};

// POST /upload-asset/finalize — called after the browser has PUT the file
// directly to R2 via a presigned URL. We HeadObject to verify the upload
// actually happened (and matches the expected size/content-type) before
// persisting the URL/key.
export const finalizeAssetUpload = async (
  organizationId: string,
  input: FinalizeAssetInput,
): Promise<{ url: string; key: string; kind: "logo" | "mascot" | "letterhead" }> => {
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
    input.kind === "logo"
      ? existing?.logo_key
      : input.kind === "mascot"
        ? existing?.mascot_key
        : existing?.letterhead_key;

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
  kind: "logo" | "mascot" | "letterhead",
): Promise<BrandKitDto> => {
  const existing = await repo.findBrandKit(organizationId);
  const oldKey =
    kind === "logo"
      ? existing?.logo_key
      : kind === "mascot"
        ? existing?.mascot_key
        : existing?.letterhead_key;
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
