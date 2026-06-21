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
import { fetchImageAsBuffer } from "../../../common/utils/r2.js";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";
const TWEET_URL = "https://api.twitter.com/2/tweets";
const MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";

const basicAuth = () => {
  const id = process.env.TWITTER_CLIENT_ID;
  const secret = process.env.TWITTER_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET not configured");
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
};

function detectMimeFromBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  if (buffer.slice(0, 4).toString() === "RIFF") return "image/webp";
  return "image/png";
}

const uploadMedia = async (accessToken: string, imageUrl: string): Promise<string> => {
  const buffer = await fetchImageAsBuffer(imageUrl);
  const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  const mimeType = (ext && mimeMap[ext]) || detectMimeFromBuffer(buffer);
  const filename = `image.${ext ?? "png"}`;
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  form.append("media", blob, filename);
  form.append("media_category", "tweet_image");

  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter media upload failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data?: { id: string }; id?: string; media_id_string?: string };
  const mediaId = json.data?.id ?? json.id ?? json.media_id_string;
  if (!mediaId) throw new Error("Twitter media upload returned no id");
  return mediaId;
};

export const twitter: SocialProvider = {
  platform: SocialPlatform.TWITTER,
  slug: "twitter",
  scopes: "tweet.read tweet.write users.read offline.access media.write",
  usesPkce: true,

  buildAuthorizeUrl({ state, redirectUri, codeChallenge }: AuthorizeContext) {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) throw new Error("TWITTER_CLIENT_ID not configured");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: twitter.scopes,
      state,
      code_challenge: codeChallenge ?? "",
      code_challenge_method: "S256",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, codeVerifier }: ExchangeContext): Promise<ExchangeResult> {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId || !codeVerifier) {
      throw new Error("Twitter exchange requires TWITTER_CLIENT_ID and codeVerifier");
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twitter token exchange failed (${res.status}): ${err}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    const meRes = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (!meRes.ok) throw new Error(`Twitter /users/me failed: ${meRes.status}`);
    const me = (await meRes.json()) as { data: { id: string; username: string; name: string } };

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
      scope: json.scope,
      providerAccountId: me.data.id,
      accountName: `@${me.data.username}`,
      metadata: { name: me.data.name, username: me.data.username },
    };
  },

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) throw new Error("TWITTER_CLIENT_ID not configured");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twitter refresh failed (${res.status}): ${err}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async publish({ account, caption, imageUrl }: PublishArgs): Promise<PublishResult> {
    // 280-char safety trim
    const text = caption.length > 280 ? `${caption.slice(0, 277)}...` : caption;

    const payload: { text: string; media?: { media_ids: string[] } } = { text };
    if (imageUrl) {
      const mediaId = await uploadMedia(account.accessToken, imageUrl);
      payload.media = { media_ids: [mediaId] };
    }

    const res = await fetch(TWEET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Twitter POST /2/tweets failed (${res.status}): ${body}`);
    }
    const json = (await res.json()) as { data: { id: string; text: string } };
    const handle = (account.metadata as { username?: string } | null)?.username;
    const url = handle
      ? `https://x.com/${handle}/status/${json.data.id}`
      : `https://x.com/i/status/${json.data.id}`;
    return { platformPostId: json.data.id, url };
  },

  async revoke(account) {
    try {
      await fetch("https://api.twitter.com/2/oauth2/revoke", {
        method: "POST",
        headers: {
          Authorization: basicAuth(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: account.accessToken,
          token_type_hint: "access_token",
        }),
      });
    } catch {
      /* best effort */
    }
  },
};
