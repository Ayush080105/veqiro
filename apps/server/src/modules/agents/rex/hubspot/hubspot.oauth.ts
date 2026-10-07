/**
 * "Connect with HubSpot": the OAuth 2.0 authorization-code flow.
 *
 * Enabled only when HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET and HUBSPOT_REDIRECT_URI are set (the
 * HubSpot app is a one-time registration on the product owner's side). The browser round trip is
 * protected by an HMAC-signed, expiring `state` so the public callback needs no session cookie, and
 * the return path is restricted to this site. Access tokens last 30 minutes; the provider below
 * refreshes them a minute early, and exactly once when several callers need it at the same time.
 */
import { SecretBoxError, signState, verifyState } from "../../../../common/utils/secretBox.js";
import { HubSpotAuthError, HubSpotTransientError, type TokenProvider } from "./hubspot.client.js";

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const STATE_TTL_MS = 10 * 60_000;
const REFRESH_EARLY_MS = 60_000;

/** Read access to the four default objects and what is needed to label them. */
export const REQUIRED_SCOPES = [
  "crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read", "crm.objects.owners.read",
  "crm.schemas.contacts.read", "crm.schemas.companies.read", "crm.schemas.deals.read",
];
/** Dropped gracefully on plans that do not have them, so smaller accounts can still connect. */
export const OPTIONAL_SCOPES = [
  "tickets", "crm.objects.custom.read", "crm.schemas.custom.read", "crm.objects.line_items.read",
  "crm.objects.quotes.read", "e-commerce", "crm.pipelines.orders.read",
];

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

interface Deps {
  fetch?: typeof fetch;
  now?: () => number;
}

export function oauthConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET && process.env.HUBSPOT_REDIRECT_URI);
}

/** Only a relative path on this site; anything that could leave it becomes "/". */
export function safeReturnTo(path: string | undefined): string {
  if (!path || path.length > 500 || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f]/.test(path)) return "/";
  return path;
}

interface StatePayload { organizationId: string; userId: string; returnTo: string }

export function buildAuthorizeUrl(input: StatePayload): string {
  const state = signState({ organizationId: input.organizationId, userId: input.userId, returnTo: safeReturnTo(input.returnTo) }, STATE_TTL_MS);
  const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
  return `${AUTHORIZE_URL}?${[
    q("client_id", process.env.HUBSPOT_CLIENT_ID!),
    q("redirect_uri", process.env.HUBSPOT_REDIRECT_URI!),
    q("scope", REQUIRED_SCOPES.join(" ")),
    q("optional_scope", OPTIONAL_SCOPES.join(" ")),
    q("state", state),
  ].join("&")}`;
}

export function readCallbackState(state: string): StatePayload {
  const p = verifyState<Partial<StatePayload>>(state);
  if (typeof p.organizationId !== "string" || typeof p.userId !== "string" || !p.organizationId || !p.userId) {
    throw new SecretBoxError("invalid state");
  }
  return { organizationId: p.organizationId, userId: p.userId, returnTo: safeReturnTo(p.returnTo) };
}

async function tokenRequest(form: Record<string, string>, deps: Deps, previousRefresh?: string): Promise<OAuthTokens> {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  let res: Response;
  try {
    res = await doFetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        ...form,
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HubSpotTransientError("HubSpot could not be reached");
  }
  if (res.status >= 500) throw new HubSpotTransientError("HubSpot is having trouble");
  const body = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number } | null;
  // The response body is deliberately never echoed: it can contain the code or tokens.
  if (!res.ok || !body?.access_token) throw new HubSpotAuthError("HubSpot did not accept the authorization");
  const refreshToken = body.refresh_token ?? previousRefresh;
  if (!refreshToken) throw new HubSpotAuthError("HubSpot did not return a refresh token");
  return { accessToken: body.access_token, refreshToken, expiresAt: now() + (body.expires_in ?? 1800) * 1000 };
}

export const exchangeCode = (code: string, deps: Deps = {}) =>
  tokenRequest({ grant_type: "authorization_code", redirect_uri: process.env.HUBSPOT_REDIRECT_URI!, code }, deps);

export const refreshTokens = (refreshToken: string, deps: Deps = {}) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, deps, refreshToken);

export function oauthTokenProvider(
  load: () => Promise<OAuthTokens>,
  save: (t: OAuthTokens) => Promise<void>,
  deps: Deps = {},
): TokenProvider {
  const now = deps.now ?? Date.now;
  let inflight: Promise<OAuthTokens> | null = null;

  /** One refresh at a time per provider; everyone waiting shares its result. */
  const refresh = (current: OAuthTokens): Promise<OAuthTokens> => {
    if (!inflight) {
      inflight = (async () => {
        try {
          const next = await refreshTokens(current.refreshToken, deps);
          await save(next);
          return next;
        } finally {
          inflight = null;
        }
      })();
    }
    return inflight;
  };

  return {
    async get() {
      const tokens = await load();
      if (inflight) return (await inflight).accessToken;
      if (tokens.expiresAt - now() > REFRESH_EARLY_MS) return tokens.accessToken;
      return (await refresh(tokens)).accessToken;
    },
    async onUnauthorized() {
      if (inflight) return (await inflight).accessToken;
      return (await refresh(await load())).accessToken;
    },
  };
}
