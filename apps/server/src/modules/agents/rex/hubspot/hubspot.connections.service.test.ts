import { describe, it, assert, beforeEach } from "vitest";
import { BadRequestError } from "../../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../../common/errors/notFound.js";
import { HubSpotAuthError, HubSpotScopeError, type HubSpotClient, type RequestOptions } from "./hubspot.client.js";
import { createConnectionsService } from "./hubspot.connections.service.js";
import { packCredential, unpackCredential } from "./hubspot.credentials.js";
import { FakeBlobs, FakeStore } from "./hubspot.testkit.js";

const TOKEN = "pat-na1-0000-1111-2222-secret";

beforeEach(() => {
  process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 3).toString("base64");
});

type Handler = (method: string, path: string, opts: RequestOptions) => unknown;
const fakeClient = (handler: Handler): HubSpotClient => {
  let n = 0;
  return { callsMade: () => n, request: async <T,>(m: "GET" | "POST", p: string, o: RequestOptions = {}) => { n++; return handler(m, p, o) as T; } };
};

const allowEverything: Handler = (_m, path) => {
  if (path.includes("/search")) return { total: 12, results: [] };
  if (path === "/account-info/v3/details") return { portalId: 4242 };
  if (path === "/crm/v3/schemas") return { results: [{ objectTypeId: "2-9", name: "projects", labels: { plural: "Projects" } }] };
  if (path.startsWith("/crm/v3/properties/")) return { results: [
    { name: "dealname", label: "Deal name", type: "string", hubspotDefined: true, groupName: "dealinformation" },
    { name: "contract_tier", label: "Contract tier", type: "enumeration", hubspotDefined: false, groupName: "dealinformation" },
    { name: "email", label: "Email", type: "string", hubspotDefined: true },
    { name: "firstname", label: "First name", type: "string", hubspotDefined: true },
  ] };
  throw new Error(`unexpected ${path}`);
};

function setup(handler: Handler = allowEverything) {
  const store = new FakeStore();
  const blobs = new FakeBlobs();
  const client = fakeClient(handler);
  const service = createConnectionsService({ store, blobs, clientFor: () => client, clientForCredential: () => client });
  return { store, blobs, service, client };
}

describe("connectWithToken", () => {
  it("sanitises a pasted token, verifies it, encrypts it and reports what it can read", async () => {
    const { service, store } = setup();
    const out = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: `  Bearer ${TOKEN}\n` });
    assert.equal(out.verify.account, "HubSpot account 4242");
    const deals = out.verify.objects.find((o) => o.type === "deals")!;
    assert.deepInclude(deals, { ok: true, count: 12, tier: 1 });
    assert.isTrue(out.verify.objects.some((o) => o.type === "2-9" && o.tier === 3));
    const stored = (await store.findConnectionById(out.connectionId))!;
    assert.notInclude(stored.credentialEnc, TOKEN);
    assert.deepEqual(unpackCredential(stored.credentialEnc), { type: "token", token: TOKEN });
    assert.equal(stored.status, "active");
  });

  it("explains a rejected key and stores nothing", async () => {
    const { service, store } = setup(() => { throw new HubSpotAuthError("no"); });
    let err: unknown;
    try { await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN }); } catch (e) { err = e; }
    assert.instanceOf(err, BadRequestError);
    assert.match((err as Error).message, /rejected that key/i);
    assert.equal(store.connections.size, 0);
  });

  it("marks objects the key cannot read and says which scope is missing", async () => {
    const { service } = setup((m, p, o) => {
      if (p === "/crm/v3/objects/tickets/search") throw new HubSpotScopeError("no", "tickets");
      return allowEverything(m, p, o);
    });
    const out = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const tickets = out.verify.objects.find((o) => o.type === "tickets")!;
    assert.isFalse(tickets.ok);
    assert.equal(tickets.missingScope, "tickets");
    assert.isTrue(out.verify.objects.find((o) => o.type === "deals")!.ok);
  });

  it("rejects values that cannot be a token", async () => {
    const { service } = setup();
    for (const token of ["", "short", "has spaces inside the token value"]) {
      let err: unknown;
      try { await service.connectWithToken({ organizationId: "o", userId: "u", token }); } catch (e) { err = e; }
      assert.instanceOf(err, BadRequestError, token);
    }
  });

  it("refuses to store anything when the server has no encryption key", async () => {
    delete process.env.INTEGRATION_SECRET_KEY;
    const { service, store } = setup();
    let err: unknown;
    try { await service.connectWithToken({ organizationId: "o", userId: "u", token: TOKEN }); } catch (e) { err = e; }
    assert.instanceOf(err, BadRequestError);
    assert.equal(store.connections.size, 0);
  });

  it("reconnecting the same HubSpot account updates the key instead of adding a second connection", async () => {
    const { service, store } = setup();
    const first = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    await store.updateConnection(first.connectionId, { status: "auth_error", lastError: "revoked" });
    const second = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: `${TOKEN}-rotated` });
    assert.equal(second.connectionId, first.connectionId);
    assert.equal(store.connections.size, 1);
    const row = (await store.findConnectionById(first.connectionId))!;
    assert.equal(row.status, "active");
    assert.isNull(row.lastError);
    assert.equal((unpackCredential(row.credentialEnc) as { token: string }).token, `${TOKEN}-rotated`);
  });
});

describe("listConnections", () => {
  it("never exposes the credential, even indirectly", async () => {
    const { service } = setup();
    await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const json = JSON.stringify(await service.listConnections("org1"));
    assert.notInclude(json, TOKEN);
    assert.notInclude(json, "credential");
    assert.notInclude(json, "v1:");
  });

  it("only lists the caller's organization", async () => {
    const { service } = setup();
    await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    assert.equal((await service.listConnections("org2")).length, 0);
  });
});

describe("discoverFields", () => {
  it("groups properties and flags personal data", async () => {
    const { service } = setup();
    const { connectionId } = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const f = await service.discoverFields("org1", connectionId, "contacts");
    const all = [...f.recommended, ...f.custom, ...f.other];
    assert.isTrue(all.find((x) => x.property === "email")!.pii);
    assert.isTrue(all.find((x) => x.property === "firstname")!.pii);
    assert.isAbove(f.cap, 40);
  });

  it("cannot read another organization's connection", async () => {
    const { service } = setup();
    const { connectionId } = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    let err: unknown;
    try { await service.discoverFields("org2", connectionId, "deals"); } catch (e) { err = e; }
    assert.instanceOf(err, NotFoundError);
  });
});

describe("saveSelection", () => {
  it("creates one named dataset per object and is idempotent", async () => {
    const { service, store } = setup();
    const { connectionId } = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const sel = { organizationId: "org1", userId: "u1", connectionId, objects: [{ type: "deals", extra: [], includePii: [] }, { type: "companies", extra: [], includePii: [] }] };
    const a = await service.saveSelection(sel);
    const b = await service.saveSelection(sel);
    assert.equal(a.datasets.length, 2);
    assert.deepEqual(a.datasets.map((d) => d.id).sort(), b.datasets.map((d) => d.id).sort());
    const deals = [...store.datasets.values()].find((d) => d.sourceObject === "deals")!;
    assert.equal(deals.name, "HubSpot · Deals");
    assert.equal(deals.sourceKind, "hubspot");
    assert.equal(store.datasets.size, 2);
  });

  it("forces a full resync when the chosen fields change", async () => {
    const { service, store } = setup();
    const { connectionId } = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const base = { organizationId: "org1", userId: "u1", connectionId };
    const { datasets } = await service.saveSelection({ ...base, objects: [{ type: "deals", extra: [], includePii: [] }] });
    await store.updateDataset(datasets[0]!.id, { syncCursor: { modifiedSince: "2026-01-01T00:00:00.000Z" }, lastFullSyncAt: new Date() });
    await service.saveSelection({ ...base, objects: [{ type: "deals", extra: ["contract_tier"], includePii: [] }] });
    const d = (await store.findDataset(datasets[0]!.id))!;
    assert.isNull(d.syncCursor);
    assert.isNull(d.lastFullSyncAt);
  });

  it("does not touch the cursor when nothing changed", async () => {
    const { service, store } = setup();
    const { connectionId } = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const base = { organizationId: "org1", userId: "u1", connectionId, objects: [{ type: "deals", extra: ["contract_tier"], includePii: [] }] };
    const { datasets } = await service.saveSelection(base);
    await store.updateDataset(datasets[0]!.id, { syncCursor: { modifiedSince: "2026-01-01T00:00:00.000Z" } });
    await service.saveSelection(base);
    assert.deepEqual((await store.findDataset(datasets[0]!.id))!.syncCursor, { modifiedSince: "2026-01-01T00:00:00.000Z" });
  });

  it("refuses an object the key cannot read and unknown objects", async () => {
    const { service } = setup((m, p, o) => (p === "/crm/v3/objects/tickets/search" ? (() => { throw new HubSpotScopeError("no", "tickets"); })() : allowEverything(m, p, o)));
    const { connectionId } = await service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    for (const type of ["tickets", "not_an_object"]) {
      let err: unknown;
      try { await service.saveSelection({ organizationId: "org1", userId: "u1", connectionId, objects: [{ type, extra: [], includePii: [] }] }); } catch (e) { err = e; }
      assert.instanceOf(err, BadRequestError, type);
    }
  });
});

describe("disconnect", () => {
  async function connected() {
    const ctx = setup();
    const { connectionId } = await ctx.service.connectWithToken({ organizationId: "org1", userId: "u1", token: TOKEN });
    const { datasets } = await ctx.service.saveSelection({ organizationId: "org1", userId: "u1", connectionId, objects: [{ type: "deals", extra: [], includePii: [] }] });
    const key = await ctx.blobs.put("org1", Buffer.from("id\n1\n"));
    await ctx.store.updateDataset(datasets[0]!.id, { meta: { rawTable: { headers: ["id"], rows: [], columnTypes: {}, fileKey: key } } });
    return { ...ctx, connectionId, datasetId: datasets[0]!.id, key };
  }

  it("keep: removes the credential, stops syncing and leaves the snapshot", async () => {
    const { service, store, blobs, connectionId, datasetId, key } = await connected();
    await service.disconnect("org1", connectionId, "keep");
    assert.isNull(await store.findConnectionById(connectionId));
    const d = (await store.findDataset(datasetId))!;
    assert.isFalse(d.syncEnabled);
    assert.isNull(d.connectionId);
    assert.match(d.syncError ?? "", /disconnected/i);
    assert.isTrue(blobs.files.has(key));
  });

  it("delete: also removes the datasets and their stored files", async () => {
    const { service, store, blobs, connectionId, datasetId, key } = await connected();
    await service.disconnect("org1", connectionId, "delete");
    assert.isNull(await store.findDataset(datasetId));
    assert.deepEqual(blobs.deleted, [key]);
  });

  it("cannot disconnect someone else's connection", async () => {
    const { service, connectionId } = await connected();
    let err: unknown;
    try { await service.disconnect("org2", connectionId, "keep"); } catch (e) { err = e; }
    assert.instanceOf(err, NotFoundError);
  });
});

describe("credentials", () => {
  it("round-trips both kinds and rejects garbage", () => {
    const t = packCredential({ type: "token", token: TOKEN });
    assert.deepEqual(unpackCredential(t), { type: "token", token: TOKEN });
    const o = packCredential({ type: "oauth", accessToken: "a", refreshToken: "r", expiresAt: 5 });
    assert.deepEqual(unpackCredential(o), { type: "oauth", accessToken: "a", refreshToken: "r", expiresAt: 5 });
    assert.throws(() => unpackCredential("garbage"));
  });
});
