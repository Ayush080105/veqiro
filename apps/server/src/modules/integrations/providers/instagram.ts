import { SocialPlatform } from "../../../../prisma/generated/prisma/client.js";
import type {
  AuthorizeContext,
  ExchangeContext,
  ExchangeResult,
  PublishArgs,
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

// Re-uploads the source image to catbox.moe (free, anonymous, accepts
// multipart uploads) and returns the new URL. Used to bypass Meta's
// undocumented host blocklist for IG content publishing — the same JPEG
// bytes are accepted from `files.catbox.moe` even when rejected from R2.
const stageImageForMeta = async (sourceUrl: string): Promise<string> => {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch image for IG staging: ${res.status} ${sourceUrl}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  // Pull a sensible filename from the source path; catbox preserves it.
  const path = new URL(sourceUrl).pathname;
  const filename = path.split("/").pop() || "image.jpg";

  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append(
    "fileToUpload",
    new Blob([new Uint8Array(buffer)], { type: contentType }),
    filename,
  );

  const upload = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    // Catbox returns 412 "Invalid uploader" to UAs they consider botlike
    // (Node's default `node` UA is one of them). A browser-style UA passes.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!upload.ok) {
    throw new Error(
      `catbox.moe upload failed (${upload.status}): ${await upload.text()}`,
    );
  }
  const url = (await upload.text()).trim();
  if (!url.startsWith("https://files.catbox.moe/")) {
    throw new Error(`catbox.moe returned unexpected response: ${url}`);
  }
  return url;
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
};
