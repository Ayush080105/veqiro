import { SocialPlatform } from "../../../../prisma/generated/prisma/client.js";
import type {
  AnalyticsResult,
  AuthorizeContext,
  ExchangeContext,
  ExchangeResult,
  GetAnalyticsArgs,
  PublishArgs,
  PublishResult,
  RefreshResult,
  SocialProvider,
} from "../integrations.types.js";
import { fetchImageAsBuffer } from "../../../common/utils/r2.js";

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
const IMAGES_INIT_URL = "https://api.linkedin.com/rest/images?action=initializeUpload";

// LinkedIn supports each `LinkedIn-Version` for ~12 months on a rolling window.
// Override via env (LINKEDIN_API_VERSION=YYYYMM) when bumping; default tracks
// a recent stable release. Older values produce 426 NONEXISTENT_VERSION.
// https://learn.microsoft.com/en-us/linkedin/marketing/versioning
const API_VERSION = process.env.LINKEDIN_API_VERSION ?? "202602";

interface LinkedInMetadata {
  authorUrn?: string;
  name?: string;
  email?: string;
}

const uploadImage = async (
  accessToken: string,
  authorUrn: string,
  imageUrl: string
): Promise<string> => {
  const initRes = await fetch(IMAGES_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`LinkedIn image init failed (${initRes.status}): ${body}`);
  }
  const init = (await initRes.json()) as {
    value: { uploadUrl: string; image: string };
  };

  const buffer = await fetchImageAsBuffer(imageUrl);
  const uploadRes = await fetch(init.value.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(buffer),
  });
  if (!uploadRes.ok && uploadRes.status !== 201) {
    const body = await uploadRes.text();
    throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${body}`);
  }

  return init.value.image;
};

export const linkedin: SocialProvider = {
  platform: SocialPlatform.LINKEDIN,
  slug: "linkedin",
  scopes: "openid profile email w_member_social",
  usesPkce: false,

  buildAuthorizeUrl({ state, redirectUri }: AuthorizeContext) {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) throw new Error("LINKEDIN_CLIENT_ID not configured");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: linkedin.scopes,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }: ExchangeContext): Promise<ExchangeResult> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const tokRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokRes.ok) {
      const err = await tokRes.text();
      throw new Error(`LinkedIn token exchange failed (${tokRes.status}): ${err}`);
    }
    const tok = (await tokRes.json()) as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
    };

    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!userRes.ok) throw new Error(`LinkedIn /userinfo failed: ${userRes.status}`);
    const user = (await userRes.json()) as {
      sub: string;
      name?: string;
      email?: string;
    };
    const authorUrn = `urn:li:person:${user.sub}`;

    return {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : undefined,
      scope: tok.scope,
      providerAccountId: user.sub,
      accountName: user.name ?? user.email,
      metadata: { authorUrn, name: user.name, email: user.email },
    };
  },

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn refresh failed (${res.status}): ${err}`);
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
    const meta = (account.metadata ?? {}) as LinkedInMetadata;
    const authorUrn = meta.authorUrn ?? `urn:li:person:${account.providerAccountId}`;

    const body: Record<string, unknown> = {
      author: authorUrn,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (imageUrl) {
      const imageUrn = await uploadImage(account.accessToken, authorUrn, imageUrl);
      body.content = { media: { id: imageUrn } };
    }

    const res = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": API_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`LinkedIn POST /rest/posts failed (${res.status}): ${errBody}`);
    }

    const postUrn =
      res.headers.get("x-restli-id") ??
      res.headers.get("X-RestLi-Id") ??
      res.headers.get("location")?.split("/").pop() ??
      "";
    const id = postUrn.split(":").pop() ?? postUrn;
    const url = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : undefined;
    if (!postUrn) {
      console.warn("[linkedin] publish succeeded but no post URN in response headers");
    }
    return { platformPostId: postUrn || id, url };
  },

  async getAnalytics({ platformPostId, account }: GetAnalyticsArgs): Promise<AnalyticsResult> {
    // LinkedIn's socialActions endpoint is a Partner API (partnerApiSocialActions)
    // and returns 403 ACCESS_DENIED for standard member OAuth tokens.
    // Personal post analytics are not available via the standard w_member_social scope —
    // they require LinkedIn Marketing Partner program access.
    // We still attempt the call so that if the app is ever approved as a partner,
    // it works automatically.
    const encodedUrn = encodeURIComponent(platformPostId);
    const res = await fetch(
      `https://api.linkedin.com/rest/socialActions/${encodedUrn}`,
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "LinkedIn-Version": API_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      let parsed: { code?: string } = {};
      try { parsed = JSON.parse(body); } catch { /* ignore */ }
      if (res.status === 403 && parsed.code === "ACCESS_DENIED") {
        throw new Error("LINKEDIN_PARTNER_REQUIRED");
      }
      throw new Error(`LinkedIn GET /rest/socialActions failed (${res.status}): ${body}`);
    }
    const json = (await res.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalFirstLevelComments?: number };
      sharesSummary?: { totalShares?: number };
    };
    return {
      likes: json.likesSummary?.totalLikes ?? 0,
      comments: json.commentsSummary?.totalFirstLevelComments ?? 0,
      shares: json.sharesSummary?.totalShares ?? 0,
    };
  },
};
