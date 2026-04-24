import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

export const internalKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers["x-internal-key"];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized" });
    return;
  }
  next();
};
