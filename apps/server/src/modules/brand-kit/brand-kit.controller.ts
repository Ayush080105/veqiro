import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { saveBrandKitSchema } from "./brand-kit.schema.js";
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
  const input = saveBrandKitSchema.parse(req.body);
  const kit = await brandKitService.saveBrandKit(organizationId, input);
  res.status(StatusCodes.OK).json(kit);
};
