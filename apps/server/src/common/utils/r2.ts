import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

let client: S3Client | null = null;

const getClient = (): S3Client => {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY."
    );
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
};

export const isR2Configured = (): boolean =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );

export interface UploadImageArgs {
  organizationId: string;
  // Identifies the kind of asset (e.g. "logo", "mascot", "maya"). Goes into
  // the filename so we can find/clean up by org+kind without per-org folders.
  name: string;
  base64: string;
  contentType?: string;
  // Top-level "folder" in R2. Defaults to "images". Stays coarse on purpose:
  // R2 has no real folders, just key prefixes — keeping the top-level small
  // (images/ vs documents/) makes bucket listings sane.
  category?: string;
}

export interface UploadImageResult {
  url: string;
  key: string;
}

export const uploadImageBase64 = async (
  args: UploadImageArgs
): Promise<UploadImageResult> => {
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    throw new Error("R2_BUCKET and R2_PUBLIC_URL must be set to upload images.");
  }

  const contentType = args.contentType || "image/png";
  const extension = contentType.split("/")[1]?.split(";")[0] || "png";
  const key = buildObjectKey({
    category: args.category ?? "images",
    organizationId: args.organizationId,
    name: args.name,
    extension,
  });

  const cleanBase64 = args.base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    url: `${publicUrl.replace(/\/$/, "")}/${key}`,
    key,
  };
};

export const fetchImageAsBuffer = async (url: string): Promise<Buffer> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image at ${url}: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

export interface UploadBufferArgs {
  organizationId: string;
  // Identifies the kind of asset (e.g. "lex", "uploads"). Baked into the
  // filename, see UploadImageArgs.name for rationale.
  name: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
  // Top-level folder. Defaults to "documents" since uploadBuffer is mostly
  // used for non-image binaries (PDFs etc).
  category?: string;
}

export const uploadBuffer = async (
  args: UploadBufferArgs
): Promise<{ url: string; key: string }> => {
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    throw new Error("R2_BUCKET and R2_PUBLIC_URL must be set to upload files.");
  }

  const key = buildObjectKey({
    category: args.category ?? "documents",
    organizationId: args.organizationId,
    name: args.name,
    extension: args.extension,
  });

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: args.buffer,
      ContentType: args.contentType,
    })
  );

  return {
    url: `${publicUrl.replace(/\/$/, "")}/${key}`,
    key,
  };
};

export const deleteObject = async (key: string): Promise<void> => {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET must be set to delete objects.");
  }
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
};

// ── Presigned-PUT + HeadObject (direct-to-R2 uploads) ──────────────────────
// The browser uploads the file directly to R2 with a short-lived presigned
// PUT URL, then calls back to finalize. Avoids multer + base64 round-trips
// and keeps the bucket private (no public write).

export interface PresignPutArgs {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

export interface PresignPutResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export interface BuildObjectKeyArgs {
  /** Top-level R2 "folder", e.g. "images" or "documents". */
  category: string;
  organizationId: string;
  /** Kind tag baked into the filename, e.g. "logo", "mascot", "lex", "maya". */
  name: string;
  extension: string;
}

// Layout: `<category>/<orgId>-<name>-<uuid>.<ext>`. Flat top-level folders
// (no per-org folders) so bucket listings group by purpose, with the orgId
// in the filename so we can still find/clean up by org. orgId comes from
// Better Auth (alphanumeric, no hyphens) so the prefix `<orgId>-` uniquely
// identifies the owner even though uuids contain hyphens.
export const buildObjectKey = (args: BuildObjectKeyArgs): string => {
  const safeExt =
    args.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const safeName = args.name.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "asset";
  return `${args.category}/${args.organizationId}-${safeName}-${randomUUID()}.${safeExt}`;
};

// Defence-in-depth helper: refuse to "claim" a key whose filename doesn't
// start with the caller's orgId. Presign-time enforcement already pins this,
// but finalize endpoints accept a key from the client and need to verify.
export const keyBelongsToOrg = (key: string, organizationId: string): boolean => {
  const filename = key.split("/").pop() ?? "";
  return filename.startsWith(`${organizationId}-`);
};

export const getPublicUrl = (key: string): string => {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) throw new Error("R2_PUBLIC_URL must be set.");
  const base = publicUrl.replace(/\/$/, "");
  // Allow R2_PUBLIC_URL to be either a bare host ("blob.veqiro.com") or a
  // full origin ("https://blob.veqiro.com"). Default to https when absent.
  return /^https?:\/\//i.test(base) ? `${base}/${key}` : `https://${base}/${key}`;
};

export const getPresignedPutUrl = async (
  args: PresignPutArgs,
): Promise<PresignPutResult> => {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET must be set to presign uploads.");

  const expiresIn = args.expiresInSeconds ?? 300; // 5 min — enough for a slow client.
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: args.key,
    ContentType: args.contentType,
    ContentLength: args.contentLength,
  });

  const uploadUrl = await getSignedUrl(getClient(), cmd, { expiresIn });

  return {
    uploadUrl,
    key: args.key,
    publicUrl: getPublicUrl(args.key),
    expiresIn,
  };
};

export interface HeadObjectResult {
  size: number;
  contentType: string;
}

// Returns null if the object doesn't exist or HEAD fails for any reason —
// callers should treat null as "client lied / didn't actually upload".
export const headObject = async (
  key: string,
): Promise<HeadObjectResult | null> => {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET must be set to head objects.");
  try {
    const res = await getClient().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      size: typeof res.ContentLength === "number" ? res.ContentLength : 0,
      contentType: res.ContentType ?? "",
    };
  } catch {
    return null;
  }
};
