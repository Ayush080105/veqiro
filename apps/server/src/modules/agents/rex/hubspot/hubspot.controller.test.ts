import { describe, it, assert, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const connectWithOAuthTokens = vi.fn();
const connectWithToken = vi.fn();
const listConnections = vi.fn();

vi.mock("./hubspot.runtime.js", () => ({
  hubspotConnections: {
    connectWithOAuthTokens: (...a: unknown[]) => connectWithOAuthTokens(...a),
    connectWithToken: (...a: unknown[]) => connectWithToken(...a),
    listConnections: (...a: unknown[]) => listConnections(...a),
  },
  hubspotSync: { syncDataset: vi.fn(), syncConnection: vi.fn() },
}));
const exchangeCode = vi.fn();
vi.mock("./hubspot.oauth.js", async (orig) => ({ ...(await orig<typeof import("./hubspot.oauth.js")>()), exchangeCode: (...a: unknown[]) => exchangeCode(...a) }));

import { signState } from "../../../../common/utils/secretBox.js";
import * as c from "./hubspot.controller.js";

beforeEach(() => {
  process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 8).toString("base64");
  process.env.HUBSPOT_CLIENT_ID = "cid";
  process.env.HUBSPOT_CLIENT_SECRET = "secret";
  process.env.HUBSPOT_REDIRECT_URI = "https://api.test/cb";
  connectWithOAuthTokens.mockReset(); connectWithToken.mockReset(); listConnections.mockReset(); exchangeCode.mockReset();
});

function res() {
  const out: { redirected?: string; status?: number; body?: unknown } = {};
  const r = {
    redirect: (u: string) => { out.redirected = u; },
    status: (s: number) => { out.status = s; return r; },
    json: (b: unknown) => { out.body = b; return r; },
    end: () => r,
  } as unknown as Response;
  return { r, out };
}
const req = (over: Partial<Request>) => ({ query: {}, params: {}, body: {}, userId: "u1", organizationId: "org1", ...over }) as unknown as Request;
const goodState = (returnTo = "/agents/rex/work/dashboards") => signState({ organizationId: "org1", userId: "u1", returnTo }, 60_000);

describe("oauthCallback", () => {
  it("rejects a tampered state without touching HubSpot or the database", async () => {
    const { r, out } = res();
    await c.oauthCallback(req({ query: { code: "abc", state: goodState().slice(0, -3) + "xyz" } }), r);
    assert.match(out.redirected!, /hubspot=error/);
    assert.match(out.redirected!, /reason=state/);
    assert.equal(exchangeCode.mock.calls.length, 0);
    assert.equal(connectWithOAuthTokens.mock.calls.length, 0);
  });

  it("rejects an expired state", async () => {
    const { r, out } = res();
    await c.oauthCallback(req({ query: { code: "abc", state: signState({ organizationId: "o", userId: "u", returnTo: "/" }, -1) } }), r);
    assert.match(out.redirected!, /reason=state/);
    assert.equal(exchangeCode.mock.calls.length, 0);
  });

  it("sends the person back with a clear flag when they decline on HubSpot", async () => {
    const { r, out } = res();
    await c.oauthCallback(req({ query: { error: "access_denied", state: goodState() } }), r);
    assert.match(out.redirected!, /\/agents\/rex\/work\/dashboards/);
    assert.match(out.redirected!, /reason=denied/);
    assert.equal(exchangeCode.mock.calls.length, 0);
  });

  it("connects, then returns to the page they came from with the connection id", async () => {
    exchangeCode.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresAt: 1 });
    connectWithOAuthTokens.mockResolvedValue({ connectionId: "conn9", verify: {} });
    const { r, out } = res();
    await c.oauthCallback(req({ query: { code: "the-code", state: goodState() } }), r);
    assert.equal(exchangeCode.mock.calls[0]![0], "the-code");
    assert.deepInclude(connectWithOAuthTokens.mock.calls[0]![0], { organizationId: "org1", userId: "u1" });
    const url = new URL(out.redirected!);
    assert.equal(url.pathname, "/agents/rex/work/dashboards");
    assert.equal(url.searchParams.get("hubspot"), "connected");
    assert.equal(url.searchParams.get("connection"), "conn9");
  });

  it("reports an exchange failure without exposing why", async () => {
    exchangeCode.mockRejectedValue(new Error("code the-code secret leaked?"));
    const { r, out } = res();
    await c.oauthCallback(req({ query: { code: "the-code", state: goodState() } }), r);
    assert.match(out.redirected!, /reason=exchange/);
    assert.notInclude(out.redirected!, "the-code");
    assert.notInclude(out.redirected!, "secret");
  });

  it("never redirects off-site, whatever the state says", async () => {
    exchangeCode.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresAt: 1 });
    connectWithOAuthTokens.mockResolvedValue({ connectionId: "c", verify: {} });
    const { r, out } = res();
    await c.oauthCallback(req({ query: { code: "x", state: goodState("//evil.example/steal") } }), r);
    assert.equal(new URL(out.redirected!).hostname, new URL(process.env.CLIENT_URL ?? "http://localhost:3001").hostname);
  });
});

describe("connectToken", () => {
  it("validates input before doing anything", async () => {
    for (const body of [{}, { token: "" }, { token: "x".repeat(5000) }]) {
      let err: unknown;
      try { await c.connectToken(req({ body }), res().r); } catch (e) { err = e; }
      assert.instanceOf(err, Error);
    }
    assert.equal(connectWithToken.mock.calls.length, 0);
  });

  it("limits how often one workspace can try", async () => {
    connectWithToken.mockResolvedValue({ connectionId: "c", verify: {} });
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      try { await c.connectToken(req({ organizationId: "spammy", body: { token: "pat-na1-aaaaaaaaaaaaaaaa" } }), res().r); } catch { blocked = true; }
    }
    assert.isTrue(blocked);
    assert.isAtMost(connectWithToken.mock.calls.length, 10);
  });
});

describe("list", () => {
  it("reports whether OAuth is available and never includes credentials", async () => {
    listConnections.mockResolvedValue([{ id: "c1", accountLabel: "HubSpot account 1" }]);
    const { r, out } = res();
    await c.list(req({}), r);
    const body = out.body as { oauthAvailable: boolean; connections: unknown[] };
    assert.isTrue(body.oauthAvailable);
    assert.equal(body.connections.length, 1);
    delete process.env.HUBSPOT_CLIENT_SECRET;
    const second = res();
    await c.list(req({}), second.r);
    assert.isFalse((second.out.body as { oauthAvailable: boolean }).oauthAvailable);
  });
});

describe("oauthStart", () => {
  it("returns a HubSpot authorize URL and refuses when OAuth is not configured", async () => {
    const { r, out } = res();
    await c.oauthStart(req({ body: { returnTo: "/agents/rex" } }), r);
    assert.match((out.body as { url: string }).url, /^https:\/\/app\.hubspot\.com\/oauth\/authorize\?/);
    delete process.env.HUBSPOT_REDIRECT_URI;
    let err: unknown;
    try { await c.oauthStart(req({ body: {} }), res().r); } catch (e) { err = e; }
    assert.instanceOf(err, Error);
  });
});
