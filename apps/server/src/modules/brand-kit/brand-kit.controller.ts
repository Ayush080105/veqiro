import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  partialBrandKitSchema,
  finalizeBrandKitSchema,
  finalizeAssetSchema,
} from "./brand-kit.schema.js";
import * as brandKitService from "./brand-kit.service.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

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
  if (kindRaw !== "logo" && kindRaw !== "mascot") {
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "kind must be 'logo' or 'mascot'" });
    return;
  }
  const kit = await brandKitService.removeAsset(organizationId, kindRaw);
  res.status(StatusCodes.OK).json(kit);
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
