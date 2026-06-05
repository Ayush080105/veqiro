// One-off (re-runnable) script to set the CORS policy on the R2 bucket so the
// browser can PUT directly to a presigned URL (logo/mascot/brand-image uploads).
//
// Without a CORS rule, the browser preflight is rejected and R2 answers the PUT
// with 403 — surfacing as "CORS error + 403" in the client. See
// apps/main/src/lib/api/uploads.ts (putToR2) for the request this unblocks.
//
// Run from apps/server:  pnpm tsx scripts/set-r2-cors.ts
import "dotenv/config";
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const clientUrl = process.env.CLIENT_URL ?? "http://localhost:3001";

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error(
    "Missing R2 config. Need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.",
  );
}

// Allowed browser origins. CLIENT_URL covers the current env (dev: :3001);
// extra production origins are listed explicitly so a prod run still works
// even if CLIENT_URL points elsewhere.
const allowedOrigins = Array.from(
  new Set([
    clientUrl,
    "http://localhost:3001",
    "https://app.veqiro.com",
    "https://console.veqiro.com",
  ]),
);

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const corsRules = [
  {
    AllowedOrigins: allowedOrigins,
    AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedHeaders: ["content-type", "content-length"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  },
];

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: { CORSRules: corsRules },
  }),
);

const check = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log(`✓ CORS set on bucket "${bucket}". Allowed origins:`);
for (const o of allowedOrigins) console.log(`  - ${o}`);
console.log("\nLive policy:");
console.log(JSON.stringify(check.CORSRules, null, 2));
