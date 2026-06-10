import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { BadRequestError } from "../../common/errors/badRequest.js";
import * as waitlistService from "./waitlist.service.js";

const joinSchema = z.object({ email: z.string().email() });

export const join = async (req: Request, res: Response) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError("Valid email is required");

  const { alreadyJoined } = await waitlistService.addToWaitlist(parsed.data.email);
  res.status(StatusCodes.OK).json({ success: true, alreadyJoined });
};

export const count = async (_req: Request, res: Response) => {
  const total = await waitlistService.getCount();
  res.status(StatusCodes.OK).json({ count: total, max: 100 });
};
