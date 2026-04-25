import { Request, Response } from "express";
import path from "node:path";
import { StatusCodes } from "http-status-codes";
import {
  presignUploadSchema,
  KIND_CONFIG,
  type UploadKind,
} from "./uploads.schema.js";
import {
  isR2Configured,
  getPresignedPutUrl,
  buildObjectKey,
} from "../../common/utils/r2.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { organizationId: string } => {
  if (!req.organizationId) throw new UnauthenticatedError("Missing user context");
  return { organizationId: req.organizationId };
};

// POST /api/v1/uploads/presign
// Body: { kind, contentType, filename, size }
// Returns { ok, uploadUrl, key, publicUrl, expiresIn } so the client can PUT
// the file straight to R2. The presigned URL pins both Content-Type and
// Content-Length so a client can't deviate from what they asked for.
export const presignUpload = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);

  if (!isR2Configured()) {
    throw new BadRequestError(
      "Asset uploads aren't configured on the server. Set R2_* env vars.",
    );
  }

  const input = presignUploadSchema.parse(req.body);
  const cfg = KIND_CONFIG[input.kind as UploadKind];

  if (!cfg.contentTypes.includes(input.contentType)) {
    res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).json({
      message: `Unsupported content type for ${input.kind}.`,
    });
    return;
  }

  if (input.size > cfg.maxBytes) {
    res.status(StatusCodes.REQUEST_TOO_LONG).json({
      message: `File too large. Max ${Math.floor(cfg.maxBytes / 1024 / 1024)}MB.`,
    });
    return;
  }

  // Derive an extension from the filename, falling back to a guess from
  // contentType. Random UUID below makes the final key collision-proof
  // regardless.
  const fromName = path.extname(input.filename).slice(1).toLowerCase();
  const fromType = input.contentType.split("/")[1]?.split(";")[0] ?? "";
  const ext = fromName || fromType || "bin";

  const key = buildObjectKey(organizationId, cfg.prefix, ext);

  const result = await getPresignedPutUrl({
    key,
    contentType: input.contentType,
    contentLength: input.size,
  });

  res.status(StatusCodes.OK).json(result);
};
