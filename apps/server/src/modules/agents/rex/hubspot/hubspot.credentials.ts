/**
 * How a HubSpot credential is stored and turned into a client. Both a pasted token and OAuth tokens
 * live in `credentialEnc` as an encrypted JSON blob; nothing else ever holds them.
 */
import { open, seal } from "../../../../common/utils/secretBox.js";
import { createHubSpotClient, HubSpotAuthError, sanitizeToken, type ClientDeps, type TokenProvider } from "./hubspot.client.js";
import { oauthTokenProvider, type OAuthTokens } from "./hubspot.oauth.js";
import type { ClientFactory, ConnectionRecord, Store } from "./hubspot.types.js";

export type Credential = { type: "token"; token: string } | ({ type: "oauth" } & OAuthTokens);

export const packCredential = (c: Credential): string => seal(JSON.stringify(c));

export function unpackCredential(enc: string): Credential {
  const parsed = JSON.parse(open(enc)) as Credential;
  if (parsed.type === "token" && typeof parsed.token === "string") return { type: "token", token: sanitizeToken(parsed.token) };
  if (parsed.type === "oauth" && typeof parsed.accessToken === "string" && typeof parsed.refreshToken === "string") return parsed;
  throw new HubSpotAuthError("This connection's credential is unreadable. Reconnect HubSpot.");
}

/** A client for a credential that is not stored yet (the first check when connecting). */
export function createStaticClient(cred: Credential, deps: ClientDeps = {}) {
  const token = cred.type === "token" ? cred.token : cred.accessToken;
  return createHubSpotClient({ get: async () => token }, deps);
}

export function createClientFactory(store: Store, deps: ClientDeps = {}): ClientFactory {
  return (conn: ConnectionRecord) => {
    const cred = unpackCredential(conn.credentialEnc);
    let provider: TokenProvider;
    if (cred.type === "token") {
      provider = { get: async () => cred.token };
    } else {
      provider = oauthTokenProvider(
        async () => {
          // Always read the latest stored tokens: another sync may have just refreshed them.
          const fresh = await store.findConnectionById(conn.id);
          if (!fresh) throw new HubSpotAuthError("This HubSpot connection was removed.");
          const c = unpackCredential(fresh.credentialEnc);
          if (c.type !== "oauth") throw new HubSpotAuthError("This HubSpot connection changed. Reconnect it.");
          return { accessToken: c.accessToken, refreshToken: c.refreshToken, expiresAt: c.expiresAt };
        },
        async (t) => store.updateConnection(conn.id, { credentialEnc: packCredential({ type: "oauth", ...t }) }),
      );
    }
    return createHubSpotClient(provider, deps);
  };
}
