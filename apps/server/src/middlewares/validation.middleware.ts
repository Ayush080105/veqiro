import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

// TODO: consider adding params/query validation variants
export const validate =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
