import { describe, it, assert } from "vitest";
import {
  createHubSpotClient,
  sanitizeToken,
  HubSpotAuthError,
  HubSpotScopeError,
  HubSpotRateLimitError,
  HubSpotTransientError,
  type TokenProvider,
} from "./hubspot.client.js";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

function fakeFetch(replies: Reply[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const r = replies.shift() ?? { status: 200, body: {} };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  }) as typeof fetch;
  return { fn, calls };
}

const tokens = (t = "secret-token-123"): TokenProvider => ({ get: async () => t });
const noSleep = () => {
  const slept: number[] = [];
  return { sleep: async (ms: number) => void slept.push(ms), slept };
};

describe("sanitizeToken", () => {
  it("removes pasted Bearer prefixes, whitespace and quotes", () => {
    assert.equal(sanitizeToken("  Bearer   pat-na1-abc \n"), "pat-na1-abc");
    assert.equal(sanitizeToken('"pat-na1-abc"'), "pat-na1-abc");
  });
});

describe("request", () => {
  it("sends the bearer token to the fixed host and returns JSON", async () => {
    const f = fakeFetch([{ status: 200, body: { ok: 1 } }]);
    const c = createHubSpotClient(tokens(), { fetch: f.fn, ...noSleep() });
    const out = await c.request<{ ok: number }>("GET", "/crm/v3/objects/deals", { query: { limit: 100, after: undefined } });
    assert.deepEqual(out, { ok: 1 });
    assert.equal(f.calls[0]!.url, "https://api.hubapi.com/crm/v3/objects/deals?limit=100");
    assert.equal((f.calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer secret-token-123");
    assert.equal(c.callsMade(), 1);
  });

  it("only accepts API paths, never a full URL", async () => {
    const c = createHubSpotClient(tokens(), { fetch: fakeFetch([]).fn, ...noSleep() });
    for (const bad of ["https://evil.com/x", "//evil.com", "crm/v3/x"]) {
      let err: unknown;
      try { await c.request("GET", bad); } catch (e) { err = e; }
      assert.instanceOf(err, Error, bad);
    }
  });

  it("retries 429 using Retry-After then succeeds", async () => {
    const f = fakeFetch([
      { status: 429, body: { policyName: "SECONDLY" }, headers: { "retry-after": "2" } },
      { status: 200, body: { ok: true } },
    ]);
    const s = noSleep();
    const c = createHubSpotClient(tokens(), { fetch: f.fn, sleep: s.sleep });
    assert.deepEqual(await c.request("GET", "/x"), { ok: true });
    assert.isAtLeast(Math.max(...s.slept), 2000);
    assert.equal(c.callsMade(), 2);
  });

  it("does not retry a daily limit", async () => {
    const f = fakeFetch([{ status: 429, body: { policyName: "DAILY" } }]);
    const c = createHubSpotClient(tokens(), { fetch: f.fn, ...noSleep() });
    let err: unknown;
    try { await c.request("GET", "/x"); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotRateLimitError);
    assert.isTrue((err as HubSpotRateLimitError).daily);
    assert.equal(f.calls.length, 1);
  });

  it("retries 5xx up to 4 attempts, then reports a transient error", async () => {
    const f = fakeFetch([{ status: 502 }, { status: 503 }, { status: 502 }, { status: 500 }]);
    const c = createHubSpotClient(tokens(), { fetch: f.fn, ...noSleep() });
    let err: unknown;
    try { await c.request("GET", "/x"); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotTransientError);
    assert.equal(f.calls.length, 4);
  });

  it("on 401 asks for a fresh token once and retries", async () => {
    const f = fakeFetch([{ status: 401, body: { message: "expired" } }, { status: 200, body: { ok: 1 } }]);
    let refreshed = 0;
    const provider: TokenProvider = { get: async () => "old", onUnauthorized: async () => { refreshed++; return "new"; } };
    const c = createHubSpotClient(provider, { fetch: f.fn, ...noSleep() });
    assert.deepEqual(await c.request("GET", "/x"), { ok: 1 });
    assert.equal(refreshed, 1);
    assert.equal((f.calls[1]!.init.headers as Record<string, string>).Authorization, "Bearer new");
  });

  it("throws an auth error when 401 persists", async () => {
    const f = fakeFetch([{ status: 401 }, { status: 401 }]);
    const provider: TokenProvider = { get: async () => "old", onUnauthorized: async () => "new" };
    const c = createHubSpotClient(provider, { fetch: f.fn, ...noSleep() });
    let err: unknown;
    try { await c.request("GET", "/x"); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotAuthError);
  });

  it("reports a missing scope on 403 and parses the scope name", async () => {
    const f = fakeFetch([{ status: 403, body: { message: "This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https://developers.hubspot.com/scopes. Required scope: crm.objects.deals.read", category: "MISSING_SCOPES" } }]);
    const c = createHubSpotClient(tokens(), { fetch: f.fn, ...noSleep() });
    let err: unknown;
    try { await c.request("GET", "/crm/v3/objects/deals"); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotScopeError);
    assert.equal((err as HubSpotScopeError).scope, "crm.objects.deals.read");
  });

  it("never leaks the token into an error message", async () => {
    const f = fakeFetch([{ status: 400, body: { message: "bad request for secret-token-123" } }]);
    const c = createHubSpotClient(tokens(), { fetch: f.fn, ...noSleep() });
    let err: unknown;
    try { await c.request("GET", "/x"); } catch (e) { err = e; }
    assert.notInclude((err as Error).message, "secret-token-123");
  });

  it("spaces search calls so the 5 per second limit is respected", async () => {
    const f = fakeFetch([{ status: 200, body: {} }, { status: 200, body: {} }, { status: 200, body: {} }]);
    const s = noSleep();
    let now = 1000;
    const c = createHubSpotClient(tokens(), { fetch: f.fn, sleep: async (ms) => { s.slept.push(ms); now += ms; }, now: () => now, searchRps: 4 });
    await c.request("POST", "/crm/v3/objects/deals/search", { body: {}, search: true });
    await c.request("POST", "/crm/v3/objects/deals/search", { body: {}, search: true });
    await c.request("POST", "/crm/v3/objects/deals/search", { body: {}, search: true });
    assert.equal(s.slept.filter((ms) => ms >= 249).length, 2);
  });
});
