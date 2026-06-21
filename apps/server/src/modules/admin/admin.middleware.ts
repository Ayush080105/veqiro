import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../../lib/auth.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { prisma } from "../../config/prisma.js";

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
    const activeOrganizationId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    const fallbackMembership = activeOrganizationId
      ? null
      : await prisma.member.findFirst({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
          select: { organizationId: true },
        });
    req.userId = session.user.id;
    req.organizationId = activeOrganizationId ?? fallbackMembership?.organizationId;
    next();
  } catch (error) {
    next(error);
  }
}
