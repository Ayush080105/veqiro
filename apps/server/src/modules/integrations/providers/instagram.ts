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

const GRAPH_VERSION = "v21.0";
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;

interface InstagramMetadata {
  igUserId?: string;
  pageId?: string;
  pageName?: string;
  username?: string;
}

export const instagram: SocialProvider = {
  platform: SocialPlatform.INSTAGRAM,
  slug: "instagram",
  scopes:
    "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
  usesPkce: false,

  buildAuthorizeUrl({ state, redirectUri }: AuthorizeContext) {
    const appId = process.env.META_APP_ID;
    if (!appId) throw new Error("META_APP_ID not configured");
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
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("META_APP_ID / META_APP_SECRET not configured");
    }

    // 1. short-lived token
    const shortParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });
    const shortRes = await fetch(`${TOKEN_URL}?${shortParams.toString()}`);
    if (!shortRes.ok) {
      const err = await shortRes.text();
      throw new Error(`Meta short-token exchange failed (${shortRes.status}): ${err}`);
    }
    const shortTok = (await shortRes.json()) as {
      access_token: string;
      expires_in?: number;
    };

    // 2. long-lived user token (~60 days)
    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortTok.access_token,
    });
    const longRes = await fetch(`${TOKEN_URL}?${longParams.toString()}`);
    if (!longRes.ok) {
      const err = await longRes.text();
      throw new Error(`Meta long-token exchange failed (${longRes.status}): ${err}`);
    }
    const longTok = (await longRes.json()) as {
      access_token: string;
      expires_in?: number;
    };

    // 3. find FB pages with IG business account linked
    const pagesRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longTok.access_token}`
    );
    if (!pagesRes.ok) throw new Error(`Meta /me/accounts failed: ${pagesRes.status}`);
    const pagesJson = (await pagesRes.json()) as {
      data: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
    };

    const page = pagesJson.data.find((p) => p.instagram_business_account?.id);
    if (!page?.instagram_business_account) {
      throw new Error(
        "No Instagram Business account linked to any of your Facebook Pages. " +
          "Convert your IG account to Business/Creator and link it to a Page in the Meta Business Suite."
      );
    }

    const igUserId = page.instagram_business_account.id;

    // 4. fetch IG username for display
    let username: string | undefined;
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}?fields=username&access_token=${page.access_token}`
      );
      if (igRes.ok) {
        username = ((await igRes.json()) as { username?: string }).username;
      }
    } catch {
      /* ignore */
    }

    return {
      accessToken: page.access_token,
      expiresAt: longTok.expires_in
        ? new Date(Date.now() + longTok.expires_in * 1000)
        : undefined,
      providerAccountId: igUserId,
      accountName: username ? `@${username}` : page.name,
      metadata: {
        igUserId,
        pageId: page.id,
        pageName: page.name,
        username,
      },
    };
  },

  async refresh(currentToken: string): Promise<RefreshResult> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("META_APP_ID / META_APP_SECRET not configured");
    }
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentToken,
    });
    const res = await fetch(`${TOKEN_URL}?${params.toString()}`);
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

    // 1. Create media container
    const createParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: account.accessToken,
    });
    const createRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
      { method: "POST", body: createParams }
    );
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Instagram media create failed (${createRes.status}): ${err}`);
    }
    const { id: creationId } = (await createRes.json()) as { id: string };

    // 2. Publish
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: account.accessToken,
    });
    const pubRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
      { method: "POST", body: publishParams }
    );
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
