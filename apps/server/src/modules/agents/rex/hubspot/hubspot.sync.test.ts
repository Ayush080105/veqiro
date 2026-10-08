import { describe, it, assert, beforeEach } from "vitest";
import {
  HubSpotAuthError, HubSpotRateLimitError, HubSpotScopeError, type HubSpotClient, type RequestOptions,
} from "./hubspot.client.js";
import { packCredential } from "./hubspot.credentials.js";
import { createSync, decideMode, DAILY_BUDGET } from "./hubspot.sync.js";
import { fromCsv } from "./hubspot.table.js";
import { FakeBlobs, FakeStore } from "./hubspot.testkit.js";
import type { ConnectionRecord, DatasetRecord } from "./hubspot.types.js";

beforeEach(() => {
  process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 4).toString("base64");
});

// ── A tiny fake HubSpot ─────────────────────────────────────────────────────

interface FakeDeal { id: string; name: string; amount: string; stage: string; owner: string; modified: number; company?: string }

class FakeHubSpot {
  deals: FakeDeal[] = [];
  failWith: Error | null = null;
  failPaths: Record<string, Error> = {};
  calls: string[] = [];
  onRequest?: () => Promise<void>;

  client(): HubSpotClient {
    let n = 0;
    return {
      callsMade: () => n,
      request: async <T,>(method: "GET" | "POST", path: string, opts: RequestOptions = {}) => {
        n++;
        this.calls.push(`${method} ${path}`);
        if (this.onRequest) await this.onRequest();
        if (this.failWith) throw this.failWith;
        if (this.failPaths[path]) throw this.failPaths[path];
        return this.handle(method, path, opts) as T;
      },
    };
  }

  private row(d: FakeDeal) {
    return { id: d.id, updatedAt: new Date(d.modified).toISOString(), properties: {
      dealname: d.name, amount: d.amount, dealstage: d.stage, pipeline: "default", hubspot_owner_id: d.owner, contract_tier: "gold", hs_lastmodifieddate: new Date(d.modified).toISOString(),
    } };
  }

  private handle(method: string, path: string, opts: RequestOptions): unknown {
    if (path === "/crm/v3/schemas") return { results: [] };
    if (path === "/crm/v3/properties/deals") return { results: ["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id", "hs_lastmodifieddate", "closedate", "createdate", "contract_tier"].map((name) => ({
      name, label: name, type: name === "amount" ? "number" : name.endsWith("date") ? "datetime" : "string", hubspotDefined: name !== "contract_tier",
    })) };
    if (path === "/crm/v3/owners") return opts.query?.archived === "true" ? { results: [] } : { results: [{ id: "7", firstName: "Asha", lastName: "Rao" }] };
    if (path === "/crm/v3/pipelines/deals") return { results: [{ id: "default", label: "Sales", stages: [
      { id: "open", label: "Open", metadata: { isClosed: "false", probability: "0.5" } },
      { id: "won", label: "Won", metadata: { isClosed: "true", probability: "1.0" } } ] }] };
    if (path === "/crm/v4/associations/deals/companies/batch/read") return { results: [] };
    if (path === "/crm/v3/objects/deals" && method === "GET") return { results: this.deals.map((d) => this.row(d)) };
    if (path === "/crm/v3/objects/deals/search") {
      const body = opts.body as { filterGroups: Array<{ filters: Array<{ value: string }> }> };
      const since = Number(body.filterGroups[0]!.filters[0]!.value);
      return { results: this.deals.filter((d) => d.modified >= since).map((d) => this.row(d)) };
    }
    throw new Error(`unexpected ${method} ${path}`);
  }
}

// ── Harness ─────────────────────────────────────────────────────────────────

const T0 = new Date("2026-10-07T10:00:00.000Z");

function setup() {
  const store = new FakeStore();
  const blobs = new FakeBlobs();
  const hs = new FakeHubSpot();
  const refreshed: string[] = [];
  let clock = new Date(T0);
  store.clock = () => clock;
  const sync = createSync({
    store, blobs, clientFor: () => hs.client(), now: () => clock,
    refreshDashboard: async (_org, id) => {
      refreshed.push(id);
      const dash = store.dashboards.find((x) => x.id === id);
      if (dash) dash.lastRefreshedAt = clock;
    },
  });

  const connection = async (patch: Partial<ConnectionRecord> = {}) => store.createConnection({
    organizationId: "org1", userId: "u1", provider: "hubspot", authType: "token", credentialEnc: packCredential({ type: "token", token: "pat-na1-xxxxxxxxxxxx" }),
    accountLabel: "HubSpot account 1", scopes: [{ type: "deals", ok: true }], config: { objects: { deals: { extra: [], includePii: [] } } },
    status: "active", lastError: null, ...patch,
  });
  const dataset = async (connectionId: string) => store.createConnectorDataset({
    organizationId: "org1", userId: "u1", connectionId, sourceObject: "deals", name: "HubSpot · Deals", metricKey: "hubspot_deals",
  });
  return { store, blobs, hs, sync, refreshed, connection, dataset, tick: (ms: number) => { clock = new Date(clock.getTime() + ms); }, now: () => clock };
}

const seed = (hs: FakeHubSpot) => {
  hs.deals = [
    { id: "1", name: "Alpha", amount: "1000", stage: "open", owner: "7", modified: T0.getTime() - 5 * 3600_000 },
    { id: "2", name: "Beta", amount: "500", stage: "won", owner: "7", modified: T0.getTime() - 4 * 3600_000 },
  ];
};

const csvOf = async (blobs: FakeBlobs, d: DatasetRecord) =>
  fromCsv(await blobs.get((d.meta as { rawTable: { fileKey: string } }).rawTable.fileKey));

// ── decideMode ──────────────────────────────────────────────────────────────

describe("decideMode", () => {
  const cursor = { modifiedSince: "2026-10-07T00:00:00.000Z" };
  it("starts with a full pull and then goes incremental", () => {
    assert.equal(decideMode({ syncCursor: null, lastFullSyncAt: null }, T0), "full");
    assert.equal(decideMode({ syncCursor: cursor, lastFullSyncAt: null }, T0), "full");
    assert.equal(decideMode({ syncCursor: cursor, lastFullSyncAt: new Date(T0.getTime() - 3600_000) }, T0), "incremental");
  });
  it("reconciles deletions with a full pull once a day, after 02:00 UTC only", () => {
    const at = (iso: string) => ({ now: new Date(iso), old: new Date(new Date(iso).getTime() - 25 * 3600_000) });
    const night = at("2026-10-07T03:00:00Z");
    const early = at("2026-10-07T01:00:00Z");
    assert.equal(decideMode({ syncCursor: cursor, lastFullSyncAt: night.old }, night.now), "full");
    assert.equal(decideMode({ syncCursor: cursor, lastFullSyncAt: early.old }, early.now), "incremental");
    assert.equal(decideMode({ syncCursor: cursor, lastFullSyncAt: night.old }, night.now, false), "incremental");
  });
});

// ── syncDataset ─────────────────────────────────────────────────────────────

describe("first sync", () => {
  it("pulls everything, stores a CSV with readable values and refreshes the dashboards that use the dataset", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.store.dashboards.push({ id: "dash1", organizationId: "org1", datasetIds: [ds.id] }, { id: "dash2", organizationId: "org1", datasetIds: ["other"] });

    const out = await c.sync.syncDataset(ds.id);
    assert.deepEqual(out, { status: "synced", rows: 2 });

    const d = (await c.store.findDataset(ds.id))!;
    const rows = await csvOf(c.blobs, d);
    assert.deepEqual(rows.map((r) => [r.id, r.deal_name, r.stage, r.owner_name, r.is_won]), [["1", "Alpha", "Open", "Asha Rao", "false"], ["2", "Beta", "Won", "Asha Rao", "true"]]);
    assert.equal(d.rowCount, 2);
    assert.isNotNull(d.lastFullSyncAt);
    assert.isNull(d.syncError);
    assert.isNull(d.syncStartedAt, "lock released");
    const newest = new Date(T0.getTime() - 4 * 3600_000).toISOString();
    assert.deepEqual(d.syncCursor, { modifiedSince: newest, tail: { "2": newest } });
    assert.equal((d.meta as { rawTable: { headers: string[] } }).rawTable.headers[0], "id");
    assert.deepEqual(c.refreshed, ["dash1"]);
  });
});

describe("later syncs", () => {
  async function synced() {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.store.dashboards.push({ id: "dash1", organizationId: "org1", datasetIds: [ds.id] });
    await c.sync.syncDataset(ds.id);
    c.refreshed.length = 0; c.hs.calls.length = 0;
    c.tick(3 * 60_000);
    return { ...c, conn, ds };
  }

  it("costs one call and changes nothing when nothing changed in HubSpot", async () => {
    const c = await synced();
    const before = (await c.store.findDataset(c.ds.id))!;
    const out = await c.sync.syncDataset(c.ds.id);
    assert.equal(out.status, "unchanged");
    assert.deepEqual(c.hs.calls, ["POST /crm/v3/objects/deals/search"], "one search, no property or lookup calls");
    const after = (await c.store.findDataset(c.ds.id))!;
    assert.equal((after.meta as { rawTable: { fileKey: string } }).rawTable.fileKey, (before.meta as { rawTable: { fileKey: string } }).rawTable.fileKey);
    assert.deepEqual(c.refreshed, []);
    assert.equal(after.lastSyncedAt!.getTime(), c.now().getTime());
  });

  it("merges only what changed, replaces the old file and refreshes dashboards", async () => {
    const c = await synced();
    const oldKey = ((await c.store.findDataset(c.ds.id))!.meta as { rawTable: { fileKey: string } }).rawTable.fileKey;
    c.hs.deals[0] = { ...c.hs.deals[0]!, amount: "2500", modified: c.now().getTime() - 1000 };
    c.hs.deals.push({ id: "3", name: "Gamma", amount: "10", stage: "open", owner: "7", modified: c.now().getTime() - 500 });

    const out = await c.sync.syncDataset(c.ds.id);
    assert.deepEqual(out, { status: "synced", rows: 3 });
    const d = (await c.store.findDataset(c.ds.id))!;
    const rows = await csvOf(c.blobs, d);
    assert.deepEqual(rows.map((r) => [r.id, r.amount]), [["1", "2500"], ["2", "500"], ["3", "10"]]);
    assert.include(c.blobs.deleted, oldKey);
    assert.notInclude(Object.keys(Object.fromEntries(c.blobs.files)), oldKey);
    assert.deepEqual(c.refreshed, ["dash1"]);
  });

  it("starts over with a full pull when the chosen columns changed", async () => {
    const c = await synced();
    await c.store.updateConnection(c.conn.id, { config: { objects: { deals: { extra: ["contract_tier"], includePii: [] } } } });
    c.hs.calls.length = 0;
    await c.sync.syncDataset(c.ds.id);
    assert.include(c.hs.calls, "GET /crm/v3/objects/deals");
    const rows = await csvOf(c.blobs, (await c.store.findDataset(c.ds.id))!);
    assert.property(rows[0]!, "contract_tier");
  });

  it("does a full reconcile when asked, so deletions in HubSpot disappear", async () => {
    const c = await synced();
    c.hs.deals = c.hs.deals.filter((d) => d.id !== "2");
    await c.sync.syncDataset(c.ds.id, { mode: "full" });
    const rows = await csvOf(c.blobs, (await c.store.findDataset(c.ds.id))!);
    assert.deepEqual(rows.map((r) => r.id), ["1"]);
  });
});

describe("recompute throttle", () => {
  async function twoChanges() {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.store.dashboards.push({ id: "dash1", organizationId: "org1", datasetIds: [ds.id] });
    await c.sync.syncDataset(ds.id);
    c.refreshed.length = 0;
    c.tick(30_000);
    c.hs.deals[0] = { ...c.hs.deals[0]!, amount: "1", modified: c.now().getTime() - 1000 };
    return { ...c, ds };
  }

  it("stores the change right away but holds back a recompute that just happened", async () => {
    const c = await twoChanges();
    const out = await c.sync.syncDataset(c.ds.id);
    assert.equal(out.status, "synced");
    assert.deepEqual(c.refreshed, [], "dashboard was recomputed 30s ago");
    const d = (await c.store.findDataset(c.ds.id))!;
    assert.equal((await csvOf(c.blobs, d))[0]!.amount, "1", "the snapshot itself is current");
    assert.isTrue((d.meta as { pendingRefresh: boolean }).pendingRefresh);
  });

  it("applies the held-back recompute on a later sync, even one that finds nothing new", async () => {
    const c = await twoChanges();
    await c.sync.syncDataset(c.ds.id);
    c.tick(3 * 60_000);
    const out = await c.sync.syncDataset(c.ds.id);
    assert.equal(out.status, "unchanged");
    assert.deepEqual(c.refreshed, ["dash1"]);
    assert.isFalse(((await c.store.findDataset(c.ds.id))!.meta as { pendingRefresh: boolean }).pendingRefresh);
    c.refreshed.length = 0; c.tick(3 * 60_000);
    await c.sync.syncDataset(c.ds.id);
    assert.deepEqual(c.refreshed, [], "nothing owed, nothing recomputed");
  });
});

describe("safety", () => {
  it("runs one sync at a time per dataset", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    let release!: () => void;
    c.hs.onRequest = () => new Promise<void>((r) => { release = r; });
    const first = c.sync.syncDataset(ds.id);
    await new Promise((r) => setTimeout(r, 5));
    assert.equal((await c.sync.syncDataset(ds.id)).status, "busy");
    c.hs.onRequest = undefined; release();
    assert.equal((await first).status, "synced");
  });

  it("ignores a lock left behind by a crashed sync", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    await c.store.updateDataset(ds.id, { syncStartedAt: new Date(T0.getTime() - 11 * 60_000) });
    assert.equal((await c.sync.syncDataset(ds.id)).status, "synced");
  });

  it("keeps the last good snapshot and asks for a reconnect when HubSpot rejects the key", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    await c.sync.syncDataset(ds.id);
    const good = (await c.store.findDataset(ds.id))!;
    c.hs.failWith = new HubSpotAuthError("x");
    c.tick(60_000);
    const out = await c.sync.syncDataset(ds.id);
    assert.equal(out.status, "error");
    const after = (await c.store.findDataset(ds.id))!;
    assert.deepEqual(after.meta, good.meta);
    assert.match(after.syncError ?? "", /reconnect/i);
    const connAfter = (await c.store.findConnectionById(conn.id))!;
    assert.equal(connAfter.status, "auth_error");
    assert.equal((await c.sync.syncDataset(ds.id)).status, "error", "does not keep hammering a rejected key");
    assert.isTrue((await c.blobs.get(((good.meta as { rawTable: { fileKey: string } }).rawTable.fileKey))).length > 0);
  });

  it("reports a missing scope for one object without blocking the others", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection({ scopes: [{ type: "deals", ok: true }, { type: "tickets", ok: true }] });
    const deals = await c.dataset(conn.id);
    const tickets = await c.store.createConnectorDataset({ organizationId: "org1", userId: "u1", connectionId: conn.id, sourceObject: "tickets", name: "HubSpot · Tickets", metricKey: "hubspot_tickets" });
    c.hs.failPaths["/crm/v3/properties/tickets"] = new HubSpotScopeError("no", "tickets");
    const { results } = await c.sync.syncConnection("org1", conn.id);
    assert.equal(results.find((r) => r.datasetId === deals.id)!.status, "synced");
    assert.equal(results.find((r) => r.datasetId === tickets.id)!.status, "error");
    assert.match((await c.store.findDataset(tickets.id))!.syncError ?? "", /needs tickets/);
    assert.equal((await c.store.findConnectionById(conn.id))!.status, "active");
  });

  it("stops for the day on HubSpot's daily limit without marking the connection broken", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.hs.failWith = new HubSpotRateLimitError("daily", true, 0);
    assert.equal((await c.sync.syncDataset(ds.id)).status, "error");
    c.hs.failWith = null;
    const out = await c.sync.syncDataset(ds.id);
    assert.equal(out.status, "error");
    assert.match(out.message ?? "", /tomorrow/i);
    assert.equal((await c.store.findConnectionById(conn.id))!.status, "active");
    c.tick(24 * 3600_000);
    assert.equal((await c.sync.syncDataset(ds.id)).status, "synced");
  });

  it("does not sync a connection that has used its daily budget", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection({ config: { objects: {}, usage: { day: "2026-10-07", calls: DAILY_BUDGET } } });
    const ds = await c.dataset(conn.id);
    assert.equal((await c.sync.syncDataset(ds.id)).status, "error");
    assert.equal(c.hs.calls.length, 0);
  });

  it("stores nothing if the connection is removed while the sync runs", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.hs.onRequest = async () => { await c.store.updateDataset(ds.id, { connectionId: null }); await c.store.deleteConnection(conn.id); c.hs.onRequest = undefined; };
    const out = await c.sync.syncDataset(ds.id);
    assert.equal(out.status, "error");
    assert.equal(c.blobs.files.size, 0, "no orphan file");
    assert.isNull((await c.store.findDataset(ds.id))!.rowCount);
  });

  it("answers 'timeout' when asked to wait but leaves the sync running to completion", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    let release!: () => void;
    c.hs.onRequest = () => new Promise<void>((r) => { release = r; c.hs.onRequest = undefined; });
    const out = await c.sync.syncDataset(ds.id, { waitMs: 20 });
    assert.equal(out.status, "timeout");
    release();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal((await c.store.findDataset(ds.id))!.rowCount, 2);
    assert.isNull((await c.store.findDataset(ds.id))!.syncStartedAt);
  });

  it("refuses datasets that are not HubSpot datasets or are switched off", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    await c.store.updateDataset(ds.id, { syncEnabled: false });
    assert.equal((await c.sync.syncDataset(ds.id)).status, "disabled");
    assert.equal((await c.sync.syncDataset("nope")).status, "error");
  });
});

describe("ensureFresh", () => {
  const settle = () => new Promise((r) => setTimeout(r, 20));

  it("syncs a stale dataset in the background and leaves a fresh one alone", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.sync.ensureFresh("org1", [ds.id], 60_000); await settle();
    assert.equal((await c.store.findDataset(ds.id))!.rowCount, 2);
    c.hs.calls.length = 0; c.tick(30_000);
    c.sync.ensureFresh("org1", [ds.id], 60_000); await settle();
    assert.equal(c.hs.calls.length, 0, "still fresh");
    c.tick(40_000);
    c.sync.ensureFresh("org1", [ds.id], 60_000); await settle();
    assert.isAbove(c.hs.calls.length, 0, "stale again");
  });

  it("never triggers for another organization's dataset and never throws", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.sync.ensureFresh("someone-else", [ds.id], 0); await settle();
    assert.equal(c.hs.calls.length, 0);
    assert.doesNotThrow(() => c.sync.ensureFresh("org1", ["missing"], 0));
  });

  it("backs off after an error instead of retrying on every poll", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    c.hs.failWith = new Error("boom");
    await c.sync.syncDataset(ds.id);
    c.hs.calls.length = 0; c.hs.failWith = null;
    c.sync.ensureFresh("org1", [ds.id], 0); await settle();
    assert.equal(c.hs.calls.length, 0);
  });
});

describe("syncMany (the Refresh button)", () => {
  it("syncs the HubSpot datasets among the ids it is given and ignores everything else", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection(); const ds = await c.dataset(conn.id);
    const sheet = await c.store.createConnectorDataset({ organizationId: "org1", userId: "u1", connectionId: conn.id, sourceObject: "x", name: "sheet", metricKey: "x" });
    await c.store.updateDataset(sheet.id, { connectionId: null });
    (c.store.datasets.get(sheet.id) as DatasetRecord).sourceKind = "link";
    const results = await c.sync.syncMany("org1", [ds.id, sheet.id, "missing"], { waitMs: 5000 });
    assert.deepEqual(results.map((r) => [r.datasetId, r.status]), [[ds.id, "synced"]]);
    assert.isTrue((await c.store.findDataset(ds.id))!.containsPii === false);
  });
});

describe("syncAllHubspot", () => {
  it("syncs only datasets that a dashboard reads and that are due", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection();
    const used = await c.dataset(conn.id);
    const unused = await c.store.createConnectorDataset({ organizationId: "org1", userId: "u1", connectionId: conn.id, sourceObject: "companies", name: "HubSpot · Companies", metricKey: "hubspot_companies" });
    c.store.dashboards.push({ id: "d", organizationId: "org1", datasetIds: [used.id] });
    await c.sync.syncAllHubspot();
    assert.equal((await c.store.findDataset(used.id))!.rowCount, 2);
    assert.isNull((await c.store.findDataset(unused.id))!.lastSyncedAt);
    c.hs.calls.length = 0; c.tick(60_000);
    await c.sync.syncAllHubspot();
    assert.equal(c.hs.calls.length, 0, "synced a minute ago, not due");
  });

  it("skips connections that need attention", async () => {
    const c = setup(); seed(c.hs);
    const conn = await c.connection({ status: "auth_error", lastError: "revoked" });
    const ds = await c.dataset(conn.id);
    c.store.dashboards.push({ id: "d", organizationId: "org1", datasetIds: [ds.id] });
    await c.sync.syncAllHubspot();
    assert.equal(c.hs.calls.length, 0);
  });
});

describe("a recompute that did not happen is not forgotten", () => {
  async function failing(outcome: "busy" | "throws") {
    const store = new FakeStore();
    const blobs = new FakeBlobs();
    const hs = new FakeHubSpot();
    seed(hs);
    let clock = new Date(T0);
    store.clock = () => clock;
    let attempts = 0;
    const sync = createSync({
      store, blobs, clientFor: () => hs.client(), now: () => clock,
      refreshDashboard: async () => {
        attempts++;
        if (attempts === 1) {
          if (outcome === "throws") throw new Error("AI service down");
          return { skipped: "already refreshing" };
        }
        return { refreshed: true };
      },
    });
    const conn = await store.createConnection({
      organizationId: "org1", userId: "u1", provider: "hubspot", authType: "token", credentialEnc: packCredential({ type: "token", token: "pat-na1-xxxxxxxxxxxx" }),
      accountLabel: "a", scopes: [{ type: "deals", ok: true }], config: { objects: { deals: { extra: [], includePii: [] } } }, status: "active", lastError: null,
    });
    const ds = await store.createConnectorDataset({ organizationId: "org1", userId: "u1", connectionId: conn.id, sourceObject: "deals", name: "HubSpot \u00b7 Deals", metricKey: "hubspot_deals" });
    store.dashboards.push({ id: "dash1", organizationId: "org1", datasetIds: [ds.id] });
    return { store, sync, ds, attempts: () => attempts, tick: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
  }

  for (const outcome of ["busy", "throws"] as const) {
    it(`retries on the next sync when the dashboard was ${outcome === "busy" ? "already recomputing" : "unable to recompute"}`, async () => {
      const c = await failing(outcome);
      assert.equal((await c.sync.syncDataset(c.ds.id)).status, "synced");
      assert.isTrue(((await c.store.findDataset(c.ds.id))!.meta as { pendingRefresh: boolean }).pendingRefresh);
      c.tick(60_000);
      assert.equal((await c.sync.syncDataset(c.ds.id)).status, "unchanged");
      assert.equal(c.attempts(), 2);
      assert.isFalse(((await c.store.findDataset(c.ds.id))!.meta as { pendingRefresh: boolean }).pendingRefresh);
    });
  }
});
