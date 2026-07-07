import CustomApiError from "../common/errors/customApiError.js";
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

// Single-line JSON to stdout — readable by any log aggregator (Datadog, Loki,
// CloudWatch, etc.). Pretty-prints in dev for grep-ability.
function emit(level: "error" | "warn", payload: Record<string, unknown>) {
  const entry = { level, ts: new Date().toISOString(), ...payload };
  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify(entry));
  } else {
    console.error(`[${level}]`, entry);
  }
}

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  let statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = "Something went wrong, try again later";
  let issues: Array<{ path: (string | number)[]; message: string }> = [];

  if (err instanceof CustomApiError) {
    statusCode = err.statusCode;
    // Only trust the message for intentional 4xx-class errors. An
    // unexpected error (or a CustomApiError misused with a 5xx code) must
    // never leak internal detail (e.g. raw Prisma text) to the client.
    if (statusCode < 500) message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    issues = err.issues.map((i) => ({
      path: i.path.filter(
        (p): p is string | number => typeof p === "string" || typeof p === "number"
      ),
      message: i.message,
    }));
    message = issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
  }

  // 5xx is a programmer/infra problem — log full detail.
  // 4xx is a caller problem — log compact, skip stack.
  const level = statusCode >= 500 ? "error" : "warn";
  emit(level, {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: statusCode >= 500 ? err.message : message,
    userId: (req as Request & { userId?: string }).userId,
    organizationId: (req as Request & { organizationId?: string }).organizationId,
    ...(statusCode >= 500 && err.stack ? { stack: err.stack } : {}),
  });

  return res.status(statusCode).json(
    issues.length > 0 ? { message, errors: issues } : { message }
  );
};

export default errorHandler;
