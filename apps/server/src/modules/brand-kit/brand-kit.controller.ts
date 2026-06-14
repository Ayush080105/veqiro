import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
  partialBrandKitSchema,
  finalizeBrandKitSchema,
  finalizeAssetSchema,
} from "./brand-kit.schema.js";
import * as brandKitService from "./brand-kit.service.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

const scrapeRequestSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(1000)
    .refine((v) => /^https?:\/\//u.test(v), "Must be a valid http(s) URL"),
  // organizationId in the body is advisory only — the session is authoritative
  // and is what we persist against. Accept it so legacy clients don't 400.
  organizationId: z.string().optional(),
  persist: z.boolean().optional(),
});

const requireAuthContext = (
  req: Request,
): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const getBrandKit = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const kit = await brandKitService.getBrandKit(organizationId);
  if (!kit) {
    res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Brand kit not found" });
    return;
  }
  res.status(StatusCodes.OK).json(kit);
};

export const saveBrandKit = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = partialBrandKitSchema.parse(req.body);
  const kit = await brandKitService.saveBrandKit(organizationId, input);
  res.status(StatusCodes.OK).json(kit);
};

export const finalizeBrandKit = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = finalizeBrandKitSchema.parse(req.body);
  const kit = await brandKitService.finalizeBrandKit(organizationId, input);
  res.status(StatusCodes.OK).json(kit);
};

export const finalizeAssetUpload = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = finalizeAssetSchema.parse(req.body);
  const result = await brandKitService.finalizeAssetUpload(organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const removeAsset = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const kindRaw = req.params.kind;
  if (kindRaw !== "logo" && kindRaw !== "mascot" && kindRaw !== "letterhead") {
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "kind must be 'logo', 'mascot', or 'letterhead'" });
    return;
  }
  const kit = await brandKitService.removeAsset(organizationId, kindRaw);
  res.status(StatusCodes.OK).json(kit);
};

// POST /scrape — crawls a URL via Jina Reader (with fetch fallback) and
// returns { content, summary, source }. If `persist=true`, also writes the
// result to the BrandKit row for the active org so the brain page picks it up.
export const scrapeBrandKit = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const parsed = scrapeRequestSchema.parse(req.body);
  try {
    const result = await brandKitService.scrapeWebsite(
      parsed.url,
      organizationId,
      { persist: parsed.persist ?? true },
    );
    res.status(StatusCodes.OK).json({
      content: result.content,
      summary: result.summary,
      source: result.source,
    });
  } catch (err) {
    res.status(StatusCodes.BAD_GATEWAY).json({
      message:
        err instanceof Error
          ? err.message
          : "Could not reach that URL. Try again or fill the field manually.",
    });
  }
};

// Internal — called by apps/ai with x-internal-key. Returns the raw Prisma row
// (snake_case) to keep the existing Python contract working untouched.
export const getBrandKitInternal = async (req: Request, res: Response) => {
  const raw = req.params.organizationId;
  const organizationId = Array.isArray(raw) ? raw[0] : raw;
  if (!organizationId) {
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "organizationId required" });
    return;
  }
  const kit = await brandKitService.getBrandKitRaw(organizationId);
  if (!kit) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "Brand kit not found" });
    return;
  }
  res.status(StatusCodes.OK).json(kit);
};
