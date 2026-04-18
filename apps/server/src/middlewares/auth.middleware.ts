import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { UnauthenticatedError } from "../common/errors/unauthenticated.js";
import { BadRequestError } from "../common/errors/badRequest.js";

const pickString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const readFromRequest = (req: Request, key: string): string | undefined =>
  pickString(req.body?.[key]) ??
  pickString((req.query as Record<string, unknown> | undefined)?.[key]);

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log(authHeader);

    // Internal API key path — userId & organizationId must be supplied explicitly
    if (authHeader) {
      const [scheme, token] = authHeader.split(" ");
      if (scheme !== "Bearer" || token !== process.env.INTERNAL_API_KEY) {
        throw new UnauthenticatedError("Unauthorized");
      }

      const userId = readFromRequest(req, "userId");
      const organizationId = readFromRequest(req, "organizationId");
      if (!userId || !organizationId) {
        throw new BadRequestError(
          "Internal requests must supply userId and organizationId in body or query"
        );
      }
      req.userId = userId;
      req.organizationId = organizationId;
      return next();
    }

    // Session path — resolve from Better Auth session
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      throw new UnauthenticatedError("Unauthorized");
    }

    const activeOrganizationId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    if (!activeOrganizationId) {
      throw new BadRequestError("No active organization selected");
    }

    req.userId = session.user.id;
    req.organizationId = activeOrganizationId;
    return next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
