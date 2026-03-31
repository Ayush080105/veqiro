import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { UnauthenticatedError } from "../errors/unauthenticated.js";

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // Internal API key auth
    if (authHeader) {
      const [scheme, token] = authHeader.split(" ");

      if (scheme === "Bearer" && token) {
        if (token === process.env.INTERNAL_API_KEY) {
          return next();
        }
      }

      throw new UnauthenticatedError("Unauthorized");
    }

    //  Session auth (user-based)
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session) {
      return next();
    }

    throw new UnauthenticatedError("Unauthorized");
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;