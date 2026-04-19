import { createHash, createHmac, randomBytes } from "node:crypto";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import * as repo from "./integrations.repository.js";
import { getProvider } from "./providers/index.js";
import type { PlatformSlug, StatePayload } from "./integrations.types.js";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

const getStateSecret = (): string => {
  const secret = process.env.INTEGRATIONS_STATE_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("INTEGRATIONS_STATE_SECRET (or BETTER_AUTH_SECRET) must be set");
  }
  return secret;
};

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const base64urlDecode = (input: string): Buffer => {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
};

const signState = (payload: StatePayload): string => {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(
    createHmac("sha256", getStateSecret()).update(body).digest()
  );
  return `${body}.${sig}`;
};

const verifyState = (state: string): StatePayload => {
  const parts = state.split(".");
  if (parts.length !== 2) throw new BadRequestError("Malformed OAuth state");
  const [body, sig] = parts;
  const expected = base64url(
    createHmac("sha256", getStateSecret()).update(body).digest()
  );
  if (expected !== sig) throw new UnauthenticatedError("Invalid OAuth state signature");
  const payload = JSON.parse(base64urlDecode(body).toString()) as StatePayload;
  if (!payload.exp || payload.exp < Date.now()) {
    throw new UnauthenticatedError("OAuth state expired — restart the connect flow");
  }
  return payload;
};

const resolveBaseUrl = (): string => {
  const url = process.env.BETTER_AUTH_URL;
  if (!url) throw new Error("BETTER_AUTH_URL not configured");
  return url.replace(/\/$/, "");
};

const apiVersion = () => process.env.API_VERSION || "v1";

export const buildRedirectUri = (slug: PlatformSlug): string =>
  `${resolveBaseUrl()}/api/${apiVersion()}/integrations/${slug}/callback`;

const generatePkcePair = (): { verifier: string; challenge: string } => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
};

export const list = (organizationId: string) => repo.findByOrg(organizationId);

export interface BeginConnectArgs {
  organizationId: string;
  userId: string;
  platform: PlatformSlug;
}

export const beginConnect = ({ organizationId, userId, platform }: BeginConnectArgs) => {
  const provider = getProvider(platform);
  const redirectUri = buildRedirectUri(platform);

  const pkce = provider.usesPkce ? generatePkcePair() : null;

  const state = signState({
    orgId: organizationId,
    userId,
    platform,
    nonce: base64url(randomBytes(16)),
    codeVerifier: pkce?.verifier,
    exp: Date.now() + STATE_TTL_MS,
  });

  return provider.buildAuthorizeUrl({
    state,
    redirectUri,
    codeChallenge: pkce?.challenge,
  });
};

export interface HandleCallbackArgs {
  platform: PlatformSlug;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface HandleCallbackResult {
  redirectTo: string;
}

export const handleCallback = async (
  args: HandleCallbackArgs
): Promise<HandleCallbackResult> => {
  const clientBase = (process.env.CLIENT_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const failRedirect = (msg: string) =>
    `${clientBase}/settings/integrations?error=${encodeURIComponent(msg)}`;

  if (args.error) {
    return { redirectTo: failRedirect(args.errorDescription || args.error) };
  }
  if (!args.code || !args.state) {
    return { redirectTo: failRedirect("Missing code or state") };
  }

  let payload: StatePayload;
  try {
    payload = verifyState(args.state);
  } catch (err) {
    return { redirectTo: failRedirect((err as Error).message) };
  }
  if (payload.platform !== args.platform) {
    return { redirectTo: failRedirect("Platform mismatch in OAuth state") };
  }

  try {
    const provider = getProvider(args.platform);
    const result = await provider.exchangeCode({
      code: args.code,
      redirectUri: buildRedirectUri(args.platform),
      codeVerifier: payload.codeVerifier,
    });

    await repo.upsert({
      organizationId: payload.orgId,
      userId: payload.userId,
      platform: provider.platform,
      providerAccountId: result.providerAccountId,
      accountName: result.accountName,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: result.expiresAt,
      scope: result.scope,
      metadata: result.metadata,
    });

    return {
      redirectTo: `${clientBase}/settings/integrations?connected=${args.platform}`,
    };
  } catch (err) {
    console.error("[integrations] callback failed", err);
    return { redirectTo: failRedirect((err as Error).message) };
  }
};

export const disconnect = async (organizationId: string, id: string) => {
  const account = await repo.findById(id);
  if (!account) throw new NotFoundError("Integration not found");
  if (account.organizationId !== organizationId) {
    throw new NotFoundError("Integration not found");
  }
  const slugMap: Record<string, PlatformSlug> = {
    TWITTER: "twitter",
    LINKEDIN: "linkedin",
    INSTAGRAM: "instagram",
  };
  const provider = getProvider(slugMap[account.platform]);
  if (provider.revoke) {
    try {
      await provider.revoke(account);
    } catch (err) {
      console.error("[integrations] revoke failed (continuing)", err);
    }
  }
  await repo.remove(id);
};
