import { describe, it, assert, beforeEach } from "vitest";
import { SecretBoxError, signState } from "../../../../common/utils/secretBox.js";
import { HubSpotAuthError } from "./hubspot.client.js";
import {
  oauthConfigured, buildAuthorizeUrl, readCallbackState, exchangeCode, refreshTokens, oauthTokenProvider,
  safeReturnTo, REQUIRED_SCOPES, OPTIONAL_SCOPES, type OAuthTokens,
} from "./hubspot.oauth.js";

beforeEach(() => {
  process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 5).toString("base64");
  process.env.HUBSPOT_CLIENT_ID = "client-123";
  process.env.HUBSPOT_CLIENT_SECRET = "client-secret-xyz";
  process.env.HUBSPOT_REDIRECT_URI = "https://api.veqiro.test/api/v1/agents/rex/connections/hubspot/oauth/callback";
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("configuration", () => {
  it("is only available when all three settings are present", () => {
    assert.isTrue(oauthConfigured());
    delete process.env.HUBSPOT_CLIENT_SECRET;
    assert.isFalse(oauthConfigured());
  });
});

describe("safeReturnTo", () => {
  it("only lets people return to a path on this site", () => {
    assert.equal(safeReturnTo("/agents/rex/work/dashboards?x=1"), "/agents/rex/work/dashboards?x=1");
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "", undefined]) {
      assert.equal(safeReturnTo(bad as string | undefined), "/", String(bad));
    }
  });
});

describe("authorize url and state", () => {
  it("carries the app id, redirect, scopes and a signed state", () => {
    const url = new URL(buildAuthorizeUrl({ organizationId: "org1", userId: "u1", returnTo: "/data" }));
    assert.equal(url.origin + url.pathname, "https://app.hubspot.com/oauth/authorize");
    assert.equal(url.searchParams.get("client_id"), "client-123");
    assert.equal(url.searchParams.get("redirect_uri"), process.env.HUBSPOT_REDIRECT_URI);
    assert.equal(url.searchParams.get("scope"), REQUIRED_SCOPES.join(" "));
    assert.equal(url.searchParams.get("optional_scope"), OPTIONAL_SCOPES.join(" "));
    const state = readCallbackState(url.searchParams.get("state")!);
    assert.deepEqual(state, { organizationId: "org1", userId: "u1", returnTo: "/data" });
  });

  it("never embeds the client secret", () => {
    assert.notInclude(buildAuthorizeUrl({ organizationId: "o", userId: "u", returnTo: "/" }), "client-secret-xyz");
  });

  it("rejects tampered, expired and foreign state", () => {
    const url = new URL(buildAuthorizeUrl({ organizationId: "o", userId: "u", returnTo: "/" }));
    const state = url.searchParams.get("state")!;
    assert.throws(() => readCallbackState(state.slice(0, -3) + "abc"), SecretBoxError);
    assert.throws(() => readCallbackState(signState({ organizationId: "o", userId: "u", returnTo: "/" }, -5)), /expired/);
    assert.throws(() => readCallbackState(signState({ nope: true }, 60_000)), SecretBoxError);
  });

  it("sanitises a hostile return path inside the state", () => {
    const url = new URL(buildAuthorizeUrl({ organizationId: "o", userId: "u", returnTo: "//evil.com" }));
    assert.equal(readCallbackState(url.searchParams.get("state")!).returnTo, "/");
  });
});

describe("token exchange", () => {
  it("posts the code as a form and returns an absolute expiry", async () => {
    let seen: { url: string; body: string; type: string } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen = { url, body: String(init.body), type: (init.headers as Record<string, string>)["Content-Type"]! };
      return json(200, { access_token: "at", refresh_token: "rt", expires_in: 1800 });
    }) as unknown as typeof fetch;
    const t = await exchangeCode("the-code", { fetch: fetchFn, now: () => 1_000_000 });
    assert.equal(seen!.url, "https://api.hubapi.com/oauth/v3/token");
    assert.equal(seen!.type, "application/x-www-form-urlencoded");
    const form = new URLSearchParams(seen!.body);
    assert.equal(form.get("grant_type"), "authorization_code");
    assert.equal(form.get("code"), "the-code");
    assert.equal(form.get("client_secret"), "client-secret-xyz");
    assert.deepEqual(t, { accessToken: "at", refreshToken: "rt", expiresAt: 1_000_000 + 1_800_000 });
  });

  it("never leaks the code, tokens or secret in an error", async () => {
    const fetchFn = (async () => json(400, { status: "BAD_AUTH_CODE", message: "the-code client-secret-xyz rt-old" })) as unknown as typeof fetch;
    let msg = "";
    try { await exchangeCode("the-code", { fetch: fetchFn }); } catch (e) { msg = (e as Error).message; }
    assert.notMatch(msg, /the-code|client-secret-xyz|rt-old/);
  });

  it("treats an invalid refresh token as an auth failure", async () => {
    const fetchFn = (async () => json(400, { status: "BAD_REFRESH_TOKEN" })) as unknown as typeof fetch;
    let err: unknown;
    try { await refreshTokens("rt-old", { fetch: fetchFn }); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotAuthError);
  });
});

describe("oauthTokenProvider", () => {
  const stored = (expiresAt: number): OAuthTokens => ({ accessToken: "at-old", refreshToken: "rt-old", expiresAt });

  it("uses a token that is not about to expire", async () => {
    let refreshes = 0;
    const p = oauthTokenProvider(async () => stored(1_000_000 + 600_000), async () => {}, {
      now: () => 1_000_000, fetch: (async () => { refreshes++; return json(200, {}); }) as unknown as typeof fetch,
    });
    assert.equal(await p.get(), "at-old");
    assert.equal(refreshes, 0);
  });

  it("refreshes a minute before expiry, saves the new tokens, and shares one refresh between concurrent callers", async () => {
    let refreshes = 0;
    let saved: OAuthTokens | null = null;
    const p = oauthTokenProvider(async () => saved ?? stored(1_000_000 + 30_000), async (t) => { saved = t; }, {
      now: () => 1_000_000,
      fetch: (async () => { refreshes++; await new Promise((r) => setTimeout(r, 10)); return json(200, { access_token: "at-new", refresh_token: "rt-new", expires_in: 1800 }); }) as unknown as typeof fetch,
    });
    const [a, b, c] = await Promise.all([p.get(), p.get(), p.get()]);
    assert.deepEqual([a, b, c], ["at-new", "at-new", "at-new"]);
    assert.equal(refreshes, 1);
    assert.equal(saved!.refreshToken, "rt-new");
  });

  it("keeps the old refresh token when HubSpot does not send a new one", async () => {
    let saved: OAuthTokens | null = null;
    const p = oauthTokenProvider(async () => stored(0), async (t) => { saved = t; }, {
      now: () => 5_000_000, fetch: (async () => json(200, { access_token: "at2", expires_in: 1800 })) as unknown as typeof fetch,
    });
    await p.get();
    assert.equal(saved!.refreshToken, "rt-old");
  });

  it("refreshes once after a 401 and gives up if refreshing fails", async () => {
    const ok = oauthTokenProvider(async () => stored(9_999_999_999), async () => {}, {
      now: () => 1, fetch: (async () => json(200, { access_token: "at-fresh", refresh_token: "rt2", expires_in: 1800 })) as unknown as typeof fetch,
    });
    assert.equal(await ok.onUnauthorized!(), "at-fresh");
    const bad = oauthTokenProvider(async () => stored(9_999_999_999), async () => {}, {
      now: () => 1, fetch: (async () => json(400, { status: "BAD_REFRESH_TOKEN" })) as unknown as typeof fetch,
    });
    let err: unknown;
    try { await bad.onUnauthorized!(); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotAuthError);
  });
});

describe("reconnecting through OAuth", () => {
  it("carries the connection to replace inside the signed state, and only a string", () => {
    const url = new URL(buildAuthorizeUrl({ organizationId: "o", userId: "u", returnTo: "/x", connectionId: "conn1" }));
    assert.equal(readCallbackState(url.searchParams.get("state")!).connectionId, "conn1");
    const plain = new URL(buildAuthorizeUrl({ organizationId: "o", userId: "u", returnTo: "/x" }));
    assert.notProperty(readCallbackState(plain.searchParams.get("state")!), "connectionId");
    const forged = signState({ organizationId: "o", userId: "u", returnTo: "/x", connectionId: { $ne: 1 } }, 60_000);
    assert.notProperty(readCallbackState(forged), "connectionId");
  });
});
