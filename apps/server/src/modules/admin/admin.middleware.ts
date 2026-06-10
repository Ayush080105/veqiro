import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../../lib/auth.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new UnauthenticatedError("Unauthorized");
    if (session.user.role !== "admin") {
      res.status(StatusCodes.FORBIDDEN).json({ error: "Forbidden" });
      return;
    }
    req.userId = session.user.id;
    next();
  } catch (error) {
    next(error);
  }
}
