import { createHash } from "node:crypto";
import { SocialPlatform } from "../../../../prisma/generated/prisma/client.js";
import type {
  AuthorizeContext,
  ExchangeContext,
  ExchangeResult,
  PublishArgs,
  PublishCarouselArgs,
  PublishResult,
  RefreshResult,
  SocialProvider,
} from "../integrations.types.js";

// "Instagram API with Instagram Login" — direct IG OAuth, no Facebook Page
// required. Token returned IS the IG User access token; user_id IS the
// IG-Scoped User ID we publish under. See:
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
const GRAPH_VERSION = "v23.0";
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_TOKEN_URL = "https://graph.instagram.com/access_token";
const REFRESH_TOKEN_URL = "https://graph.instagram.com/refresh_access_token";
const ME_URL = `https://graph.instagram.com/${GRAPH_VERSION}/me`;
const MEDIA_URL = (igUserId: string) =>
  `https://graph.instagram.com/${GRAPH_VERSION}/${igUserId}/media`;
const PUBLISH_URL = (igUserId: string) =>
  `https://graph.instagram.com/${GRAPH_VERSION}/${igUserId}/media_publish`;

interface InstagramMetadata {
  igUserId?: string;
  /** The IG-Scoped User ID returned by OAuth — kept for reference only;
   * publishing uses the IG User ID resolved from /me. */
  scopedUserId?: string;
  username?: string;
}

// Polls the container's status_code until IG has finished ingesting the
// staged media. Returns once status is FINISHED; throws on EXPIRED/ERROR
// or after the timeout. Image containers usually settle in <5s; we cap at
// 60s to stay well under Meta's 24h container TTL while not hanging on
// hot-loop failures.
const waitForContainerReady = async (
  containerId: string,
  accessToken: string,
): Promise<void> => {
  const start = Date.now();
  const timeoutMs = 60_000;
  const intervalMs = 1500;
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      `https://graph.instagram.com/${GRAPH_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Instagram status_code lookup failed (${res.status}): ${err}`);
    }
    const { status_code } = (await res.json()) as { status_code?: string };
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram container ${containerId} ${status_code}`);
    }
    // IN_PROGRESS or unknown — keep polling
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Instagram container ${containerId} did not become ready within ${timeoutMs / 1000}s`,
  );
};

// Re-uploads the source image to Cloudinary and returns the resulting
// `res.cloudinary.com` URL. Meta's IG content-publishing API enforces an
// undocumented host allow-list that rejects our R2/CDN domains
// (blob.veqiro.com, cdn.veqiro.com, pub-...r2.dev, *.ngrok-free.app,
// *.trycloudflare.com) but accepts cloudinary.com — so we restage at
// publish time. Earlier we used catbox/litterbox; their anti-bot filter
// kept locking out our IP. Cloudinary is purpose-built for this.
//
// Uses Cloudinary's signed-upload REST endpoint directly so we don't pull
// in the cloudinary npm SDK. Signature spec:
// https://cloudinary.com/documentation/signatures
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

const stageImageForMeta = async (sourceUrl: string): Promise<string> => {
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
      `Failed to fetch image for IG staging: ${sourceRes.status} ${sourceUrl}`,
    );
  }
  const buffer = Buffer.from(await sourceRes.arrayBuffer());
  const contentType = sourceRes.headers.get("content-type") ?? "image/jpeg";
  const filename = new URL(sourceUrl).pathname.split("/").pop() || "image.jpg";

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
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
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

export const instagram: SocialProvider = {
  platform: SocialPlatform.INSTAGRAM,
  slug: "instagram",
  // The minimum needed to publish a feed image. Add `_manage_messages` /
  // `_manage_comments` later if we surface those features.
  scopes: "instagram_business_basic,instagram_business_content_publish",
  usesPkce: false,

  buildAuthorizeUrl({ state, redirectUri }: AuthorizeContext) {
    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) throw new Error("INSTAGRAM_APP_ID not configured");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: appId,
      redirect_uri: redirectUri,
      scope: instagram.scopes,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }: ExchangeContext): Promise<ExchangeResult> {
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not configured");
    }

    // 1. Short-lived token (~1 hour) — POST form-data, NOT query string
    const shortBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const shortRes = await fetch(SHORT_TOKEN_URL, {
      method: "POST",
      body: shortBody,
    });
    if (!shortRes.ok) {
      const err = await shortRes.text();
      throw new Error(`Instagram short-token exchange failed (${shortRes.status}): ${err}`);
    }
    const shortTok = (await shortRes.json()) as {
      access_token: string;
      user_id: number | string;
      // Newer IG Login returns this as an array; older docs show a CSV
      // string. Normalise to a single CSV string for the DB column.
      permissions?: string | string[];
    };
    const igUserId = String(shortTok.user_id);
    const grantedScopes = Array.isArray(shortTok.permissions)
      ? shortTok.permissions.join(",")
      : shortTok.permissions;

    // 2. Long-lived token (~60 days)
    const longParams = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortTok.access_token,
    });
    const longRes = await fetch(`${LONG_TOKEN_URL}?${longParams.toString()}`);
    if (!longRes.ok) {
      const err = await longRes.text();
      throw new Error(`Instagram long-token exchange failed (${longRes.status}): ${err}`);
    }
    const longTok = (await longRes.json()) as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
    };

    // 3. Resolve the actual IG User ID via /me. The user_id returned by the
    // OAuth flow is an "Instagram-Scoped User ID" — different from the
    // "Instagram User ID" the Graph API needs for /media + /media_publish.
    // /me?fields=user_id,username returns the publishing ID. Endpoint shape:
    // { data: [{ user_id, username }] } on newer versions, or { user_id, username }
    // on older ones — handle both.
    let publishUserId = igUserId;
    let username: string | undefined;
    const meRes = await fetch(
      `${ME_URL}?fields=user_id,username&access_token=${longTok.access_token}`
    );
    if (!meRes.ok) {
      const err = await meRes.text();
      throw new Error(`Instagram /me lookup failed (${meRes.status}): ${err}`);
    }
    const meJson = (await meRes.json()) as
      | { user_id?: string; username?: string }
      | { data?: Array<{ user_id?: string; username?: string }> };
    const meRow =
      "data" in meJson && Array.isArray(meJson.data)
        ? meJson.data[0]
        : (meJson as { user_id?: string; username?: string });
    if (meRow?.user_id) publishUserId = String(meRow.user_id);
    username = meRow?.username;

    return {
      accessToken: longTok.access_token,
      expiresAt: longTok.expires_in
        ? new Date(Date.now() + longTok.expires_in * 1000)
        : undefined,
      providerAccountId: publishUserId,
      accountName: username ? `@${username}` : `Instagram (${publishUserId})`,
      scope: grantedScopes ?? instagram.scopes,
      metadata: { igUserId: publishUserId, scopedUserId: igUserId, username },
    };
  },

  async refresh(currentToken: string): Promise<RefreshResult> {
    // ig_refresh_token only works on a long-lived token that is at least 24h
    // old. The 60-day window resets each refresh.
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: currentToken,
    });
    const res = await fetch(`${REFRESH_TOKEN_URL}?${params.toString()}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Instagram token refresh failed (${res.status}): ${err}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    return {
      accessToken: json.access_token,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null,
    };
  },

  async publish({ account, caption, imageUrl }: PublishArgs): Promise<PublishResult> {
    if (!imageUrl) {
      throw new Error("Instagram publishing requires an image URL");
    }

    const meta = (account.metadata ?? {}) as InstagramMetadata;
    const igUserId = meta.igUserId ?? account.providerAccountId;

    // Meta's IG content-publishing API maintains a host allow-list at the
    // network level. Tested combinations that fail with a generic
    // "Only photo or video can be accepted" error even though the bytes are
    // a perfectly valid JPEG: blob.veqiro.com, cdn.veqiro.com, pub-...r2.dev,
    // *.ngrok-free.app, *.trycloudflare.com. Combinations that succeed:
    // images.unsplash.com, cdnjs.cloudflare.com, files.catbox.moe.
    //
    // Workaround: stage the image to a Meta-trusted host (catbox.moe is free,
    // anonymous, and accepts the bytes our R2 hosts) right before publish.
    // Catbox auto-cleans unused uploads, so no GC needed on our side.
    const stagedUrl = await stageImageForMeta(imageUrl);

    // 1. Create media container
    const createBody = new URLSearchParams({
      image_url: stagedUrl,
      caption,
      access_token: account.accessToken,
    });
    const createRes = await fetch(MEDIA_URL(igUserId), {
      method: "POST",
      body: createBody,
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Instagram media create failed (${createRes.status}): ${err}`);
    }
    const { id: creationId } = (await createRes.json()) as { id: string };

    // 2. Wait for IG to finish ingesting the staged image. Calling
    //    /media_publish too soon returns code 9007 / subcode 2207027
    //    "Media ID is not available". Per Meta docs, poll
    //    /<container-id>?fields=status_code until FINISHED.
    await waitForContainerReady(creationId, account.accessToken);

    // 3. Publish container
    const publishBody = new URLSearchParams({
      creation_id: creationId,
      access_token: account.accessToken,
    });
    const pubRes = await fetch(PUBLISH_URL(igUserId), {
      method: "POST",
      body: publishBody,
    });
    if (!pubRes.ok) {
      const err = await pubRes.text();
      throw new Error(`Instagram media_publish failed (${pubRes.status}): ${err}`);
    }
    const { id: mediaId } = (await pubRes.json()) as { id: string };

    const handle = meta.username;
    const url = handle ? `https://www.instagram.com/${handle}/` : undefined;
    return { platformPostId: mediaId, url };
  },

  async publishCarousel({ account, caption, imageUrls }: PublishCarouselArgs): Promise<PublishResult> {
    if (!imageUrls.length) {
      throw new Error("At least one image URL is required for a carousel post");
    }

    const meta = (account.metadata ?? {}) as InstagramMetadata;
    const igUserId = meta.igUserId ?? account.providerAccountId;

    // Stage all images to Cloudinary in parallel (Meta's API rejects our CDN domains)
    const stagedUrls = await Promise.all(imageUrls.map(stageImageForMeta));

    // Create one media container per image (carousel items — no caption, no publish)
    const containerIds = await Promise.all(
      stagedUrls.map(async (stagedUrl) => {
        const body = new URLSearchParams({
          image_url: stagedUrl,
          is_carousel_item: "true",
          access_token: account.accessToken,
        });
        const res = await fetch(MEDIA_URL(igUserId), { method: "POST", body });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Instagram carousel item create failed (${res.status}): ${err}`);
        }
        const { id } = (await res.json()) as { id: string };
        return id;
      })
    );

    // Wait for every item container to finish ingesting before creating the carousel
    await Promise.all(containerIds.map((id) => waitForContainerReady(id, account.accessToken)));

    // Create the carousel container (holds caption + references to item containers)
    const carouselBody = new URLSearchParams({
      media_type: "CAROUSEL",
      children: containerIds.join(","),
      caption,
      access_token: account.accessToken,
    });
    const carouselRes = await fetch(MEDIA_URL(igUserId), { method: "POST", body: carouselBody });
    if (!carouselRes.ok) {
      const err = await carouselRes.text();
      throw new Error(`Instagram carousel container create failed (${carouselRes.status}): ${err}`);
    }
    const { id: carouselId } = (await carouselRes.json()) as { id: string };

    await waitForContainerReady(carouselId, account.accessToken);

    // Publish the carousel
    const publishBody = new URLSearchParams({
      creation_id: carouselId,
      access_token: account.accessToken,
    });
    const pubRes = await fetch(PUBLISH_URL(igUserId), { method: "POST", body: publishBody });
    if (!pubRes.ok) {
      const err = await pubRes.text();
      throw new Error(`Instagram carousel publish failed (${pubRes.status}): ${err}`);
    }
    const { id: mediaId } = (await pubRes.json()) as { id: string };

    const handle = meta.username;
    const url = handle ? `https://www.instagram.com/${handle}/` : undefined;
    return { platformPostId: mediaId, url };
  },
};
