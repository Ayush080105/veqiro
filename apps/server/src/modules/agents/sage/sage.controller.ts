import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { sendMessageSchema } from "./sage.schema.js";
import * as sageService from "./sage.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";

export const msgSage = async (req: Request, res: Response) => {
  const input = sendMessageSchema.parse(req.body);
  const result = await sageService.sendMessage(input);
  res.status(StatusCodes.OK).json(result);
};

export const getSageMessages = async (req: Request, res: Response) => {
  const organizationId = req.query.organizationId as string;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await sageService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};
