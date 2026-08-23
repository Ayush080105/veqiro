import { createHash } from "node:crypto";

/**
 * Re-hosts media on Cloudinary so Meta will accept it.
 *
 * Meta's IG content-publishing API enforces an undocumented host allow-list
 * that rejects our own domains (blob.veqiro.com, cdn.veqiro.com,
 * pub-...r2.dev, *.ngrok-free.app, *.trycloudflare.com) but accepts
 * cloudinary.com — so media is restaged at publish time. An earlier attempt
 * used catbox/litterbox; their anti-bot filter kept locking out our IP.
 *
 * This is a *Meta-side* constraint, not a quirk of how we call the API, so it
 * applies identically whether publishing goes through the native Graph provider
 * or through Composio — which is why it lives here rather than inside either
 * one. Extracted from providers/instagram.ts when the Composio publisher was
 * added, so the two paths cannot drift.
 *
 * Uses Cloudinary's signed-upload REST endpoint directly so we don't pull in
 * the cloudinary npm SDK. Signature spec:
 * https://cloudinary.com/documentation/signatures
 */

const CLOUDINARY_UPLOAD_FOLDER = "instagram-staging";

const signCloudinaryParams = (
  params: Record<string, string>,
  apiSecret: string,
): string => {
  // SHA1 of `key1=value1&key2=value2...&<api_secret>` with keys sorted
  // alphabetically. `file`, `cloud_name`, `resource_type`, `api_key`,
  // and `signature` itself are excluded from the signed string.
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(sorted + apiSecret).digest("hex");
};

export const stageMediaForMeta = async (
  sourceUrl: string,
  resourceType: "image" | "video",
  defaultContentType: string,
  defaultFilename: string,
): Promise<string> => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET — required for IG publishing.",
    );
  }

  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) {
    throw new Error(
      `Failed to fetch ${resourceType} for IG staging: ${sourceRes.status} ${sourceUrl}`,
    );
  }
  const buffer = Buffer.from(await sourceRes.arrayBuffer());
  const contentType = sourceRes.headers.get("content-type") ?? defaultContentType;
  const filename = new URL(sourceUrl).pathname.split("/").pop() || defaultFilename;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams: Record<string, string> = {
    folder: CLOUDINARY_UPLOAD_FOLDER,
    timestamp,
  };
  const signature = signCloudinaryParams(signedParams, apiSecret);

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: contentType }),
    filename,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", CLOUDINARY_UPLOAD_FOLDER);
  form.append("signature", signature);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: form },
  );
  if (!uploadRes.ok) {
    throw new Error(
      `Cloudinary upload failed (${uploadRes.status}): ${await uploadRes.text()}`,
    );
  }
  const json = (await uploadRes.json()) as { secure_url?: string };
  if (!json.secure_url) {
    throw new Error("Cloudinary upload returned no secure_url");
  }
  return json.secure_url;
};

export const stageImageForMeta = (sourceUrl: string): Promise<string> =>
  stageMediaForMeta(sourceUrl, "image", "image/jpeg", "image.jpg");

/** Video ingestion is much slower than image ingestion on Meta's side, so
 *  callers must allow a longer container-ready timeout after staging. */
export const stageVideoForMeta = (sourceUrl: string): Promise<string> =>
  stageMediaForMeta(sourceUrl, "video", "video/mp4", "video.mp4");
