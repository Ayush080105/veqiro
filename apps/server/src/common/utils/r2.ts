import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
  base64: string;
  contentType?: string;
  prefix?: string;
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
  const prefix = args.prefix || "maya";
  const key = `${args.organizationId}/${prefix}/${randomUUID()}.${extension}`;

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
