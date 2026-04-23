import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as messagesService from "./messages.service.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

export const getLastMessages = async (req: Request, res: Response) => {
  if (!req.organizationId) {
    throw new UnauthenticatedError("Missing organization context");
  }
  const data = await messagesService.getLastMessages(req.organizationId);
  res.status(StatusCodes.OK).json(data);
};
