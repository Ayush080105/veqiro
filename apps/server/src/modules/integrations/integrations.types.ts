import type { SocialAccount, SocialPlatform } from "../../../prisma/generated/prisma/client.js";

export type { SocialAccount, SocialPlatform };

export type PlatformSlug = "twitter" | "linkedin" | "instagram";

export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  providerAccountId: string;
  accountName?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizeContext {
  state: string;
  redirectUri: string;
  codeChallenge?: string;
}

export interface ExchangeContext {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface RefreshResult {
  accessToken: string;
  expiresAt?: Date | null;
  refreshToken?: string;
}

export interface PublishArgs {
  account: SocialAccount;
  caption: string;
  imageUrl?: string;
}

export interface PublishResult {
  platformPostId: string;
  url?: string;
}

export interface SocialProvider {
  platform: SocialPlatform;
  slug: PlatformSlug;
  scopes: string;
  usesPkce: boolean;
  buildAuthorizeUrl(ctx: AuthorizeContext): string;
  exchangeCode(ctx: ExchangeContext): Promise<ExchangeResult>;
  refresh?(refreshToken: string): Promise<RefreshResult>;
  publish(args: PublishArgs): Promise<PublishResult>;
  revoke?(account: SocialAccount): Promise<void>;
}

export interface StatePayload {
  orgId: string;
  userId: string;
  platform: PlatformSlug;
  nonce: string;
  codeVerifier?: string;
  exp: number;
}
