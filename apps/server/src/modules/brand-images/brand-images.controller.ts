import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  finalizeBrandImageSchema,
  updateBrandImageSchema,
} from "./brand-images.schema.js";
import * as service from "./brand-images.service.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { organizationId: string } => {
  if (!req.organizationId) throw new UnauthenticatedError("Missing user context");
  return { organizationId: req.organizationId };
};

export const listBrandImages = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const images = await service.listBrandImages(organizationId);
  res.status(StatusCodes.OK).json(images);
};

export const finalizeBrandImageUpload = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = finalizeBrandImageSchema.parse(req.body);
  const image = await service.finalizeBrandImageUpload(organizationId, input);
  res.status(StatusCodes.CREATED).json(image);
};

export const updateBrandImage = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const input = updateBrandImageSchema.parse(req.body);
  const image = await service.updateBrandImage(organizationId, id, input);
  res.status(StatusCodes.OK).json(image);
};

export const deleteBrandImage = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  await service.deleteBrandImage(organizationId, id);
  res.status(StatusCodes.NO_CONTENT).send();
};
