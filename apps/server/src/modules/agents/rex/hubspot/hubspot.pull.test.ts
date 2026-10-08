import { describe, it, assert } from "vitest";
import { HubSpotRequestError, HubSpotScopeError, type HubSpotClient, type RequestOptions } from "./hubspot.client.js";
import { OBJECT_SPECS } from "./hubspot.objects.js";
import {
  fullPull, incrementalPull, countRecords, fetchOwners, fetchStages, fetchPrimaryCompanies, listSchemas, fetchProperties,
} from "./hubspot.pull.js";

type Handler = (method: string, path: string, opts: RequestOptions) => unknown;

function client(handler: Handler): HubSpotClient & { log: Array<{ method: string; path: string; opts: RequestOptions }> } {
  const log: Array<{ method: string; path: string; opts: RequestOptions }> = [];
  return {
    log,
    callsMade: () => log.length,
    request: async <T,>(method: "GET" | "POST", path: string, opts: RequestOptions = {}) => {
      log.push({ method, path, opts });
      return handler(method, path, opts) as T;
    },
  };
}

/** A fake CRM that enforces HubSpot's search rules: 200 per page, nothing past 10,000, filter on modified date. */
function fakeCrm(records: Array<{ id: string; modified: number }>) {
  const iso = (ms: number) => new Date(ms).toISOString();
  const row = (r: { id: string; modified: number }) => ({ id: r.id, properties: { hs_lastmodifieddate: iso(r.modified), dealname: `d${r.id}` }, updatedAt: iso(r.modified) });
  return client((method, path, opts) => {
    if (method === "POST" && path.endsWith("/search")) {
      const body = opts.body as { filterGroups?: Array<{ filters: Array<{ value: string }> }>; limit: number; after?: string };
      const after = Number(body.after ?? 0);
      if (after >= 10_000) throw new HubSpotRequestError("past 10,000", 400);
      const since = Number(body.filterGroups?.[0]?.filters[0]?.value ?? 0);
      const sorted = records.filter((r) => r.modified >= since).sort((a, b) => a.modified - b.modified || Number(a.id) - Number(b.id));
      const page = sorted.slice(after, after + body.limit);
      const more = after + body.limit < sorted.length && after + body.limit < 10_000;
      return { total: sorted.length, results: page.map(row), paging: more ? { next: { after: String(after + body.limit) } } : undefined };
    }
    if (method === "GET" && path.startsWith("/crm/v3/objects/")) {
      const after = Number(opts.query?.after ?? 0);
      const limit = Number(opts.query?.limit);
      const page = records.slice(after, after + limit);
      return { results: page.map(row), paging: after + limit < records.length ? { next: { after: String(after + limit) } } : undefined };
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const DEALS = OBJECT_SPECS.deals!;
const mkRecords = (n: number, ts: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), modified: ts(i) }));

describe("fullPull", () => {
  it("follows paging, asks for the chosen properties and reports progress", async () => {
    const c = fakeCrm(mkRecords(250, (i) => 1_000 + i));
    const seen: number[] = [];
    const out = await fullPull(c, DEALS, ["dealname", "amount"], { onProgress: (n) => seen.push(n) });
    assert.equal(out.records.length, 250);
    assert.equal(out.truncated, false);
    assert.equal(c.log.length, 3);
    assert.equal(c.log[0]!.opts.query?.limit, 100);
    assert.include(String(c.log[0]!.opts.query?.properties), "dealname");
    assert.include(String(c.log[0]!.opts.query?.properties), "hs_lastmodifieddate");
    assert.deepEqual(seen, [100, 200, 250]);
    assert.equal(out.maxModified, new Date(1_000 + 249).toISOString());
  });

  it("stops at the row cap and says it was truncated", async () => {
    const c = fakeCrm(mkRecords(450, (i) => i));
    const out = await fullPull(c, DEALS, ["dealname"], { cap: 300 });
    assert.equal(out.records.length, 300);
    assert.equal(out.truncated, true);
  });
});

describe("incrementalPull", () => {
  it("asks only for records modified since the watermark (minus the overlap), oldest first", async () => {
    const c = fakeCrm(mkRecords(10, (i) => 10_000_000 + i * 1000));
    const out = await incrementalPull(c, DEALS, ["dealname"], new Date(10_000_000 + 5000).toISOString(), { overlapMs: 1000 });
    assert.deepEqual(out.records.map((r) => r.id), ["5", "6", "7", "8", "9", "10"]);
    const body = c.log[0]!.opts.body as { filterGroups: Array<{ filters: Array<{ propertyName: string; operator: string }> }>; sorts: unknown[]; limit: number };
    assert.equal(body.filterGroups[0]!.filters[0]!.operator, "GTE");
    assert.equal(body.filterGroups[0]!.filters[0]!.propertyName, "hs_lastmodifieddate");
    assert.equal(body.limit, 200);
    assert.isTrue(c.log[0]!.opts.search);
  });

  it("returns nothing, cheaply, when nothing changed", async () => {
    const c = fakeCrm(mkRecords(5, (i) => i));
    const out = await incrementalPull(c, DEALS, ["dealname"], new Date(10_000_000).toISOString());
    assert.equal(out.records.length, 0);
    assert.equal(c.log.length, 1);
  });

  it("gets past the 10,000 result limit without losing or duplicating records, even when many share a timestamp", async () => {
    // 25,300 records; 300 of them share one timestamp that falls on the 9,800 window boundary.
    const recs = mkRecords(25_300, (i) => 1_000_000 + Math.floor(i / 2) * 10);
    for (let i = 9_700; i < 10_000; i++) recs[i]!.modified = recs[9_799]!.modified;
    recs.sort((a, b) => a.modified - b.modified || Number(a.id) - Number(b.id));
    const c = fakeCrm(recs);
    const out = await incrementalPull(c, DEALS, ["dealname"], new Date(0).toISOString(), { overlapMs: 0, cap: 100_000 });
    const ids = out.records.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, "no duplicates");
    assert.equal(ids.length, 25_300, "no losses");
  });

  it("stops rather than looping forever if one timestamp holds more records than a window", async () => {
    const recs = mkRecords(12_000, () => 5_000);
    const c = fakeCrm(recs);
    const out = await incrementalPull(c, DEALS, ["dealname"], new Date(0).toISOString(), { overlapMs: 0 });
    assert.isTrue(out.truncated);
    assert.isBelow(c.log.length, 400);
  });

  it("honours the row cap", async () => {
    const c = fakeCrm(mkRecords(1000, (i) => 1_000 + i));
    const out = await incrementalPull(c, DEALS, ["dealname"], new Date(0).toISOString(), { overlapMs: 0, cap: 450 });
    assert.equal(out.records.length, 450);
    assert.isTrue(out.truncated);
  });
});

describe("countRecords", () => {
  it("reads the total from a one-row search", async () => {
    const c = client(() => ({ total: 4321, results: [] }));
    assert.equal(await countRecords(c, DEALS), 4321);
    assert.equal((c.log[0]!.opts.body as { limit: number }).limit, 1);
  });
});

describe("fetchOwners", () => {
  it("pages through active and archived owners and prefers a person's name", async () => {
    const c = client((_m, _p, opts) => {
      if (opts.query?.archived === "true") return { results: [{ id: "3", firstName: "Old", lastName: "Hand" }] };
      if (!opts.query?.after) return { results: [{ id: "1", firstName: "Asha", lastName: "Rao" }], paging: { next: { after: "x" } } };
      return { results: [{ id: "2", email: "ravi@acme.test" }] };
    });
    const owners = await fetchOwners(c);
    assert.equal(owners.get("1"), "Asha Rao");
    assert.equal(owners.get("2"), "ravi@acme.test");
    assert.equal(owners.get("3"), "Old Hand");
  });
});

describe("fetchStages", () => {
  it("labels stages and flags won, lost and open for deals", async () => {
    const c = client(() => ({
      results: [{ id: "default", label: "Sales Pipeline", stages: [
        { id: "qualified", label: "Qualified", metadata: { isClosed: "false", probability: "0.2" } },
        { id: "closedwon", label: "Closed won", metadata: { isClosed: "true", probability: "1.0" } },
        { id: "closedlost", label: "Closed lost", metadata: { isClosed: "true", probability: "0.0" } },
      ] }],
    }));
    const { stages, pipelines } = await fetchStages(c, "deals");
    assert.equal(pipelines.get("default"), "Sales Pipeline");
    assert.deepEqual(stages.get("qualified"), { pipelineId: "default", pipeline: "Sales Pipeline", stage: "Qualified", probability: 0.2, closed: false, won: false });
    assert.equal(stages.get("closedwon")!.won, true);
    assert.equal(stages.get("closedlost")!.closed, true);
    assert.equal(stages.get("closedlost")!.won, false);
  });

  it("reads ticket state", async () => {
    const c = client(() => ({ results: [{ id: "p", label: "Support", stages: [
      { id: "1", label: "New", metadata: { ticketState: "OPEN" } }, { id: "4", label: "Closed", metadata: { ticketState: "CLOSED" } } ] }] }));
    const { stages } = await fetchStages(c, "tickets");
    assert.equal(stages.get("1")!.closed, false);
    assert.equal(stages.get("4")!.closed, true);
  });
});

describe("fetchPrimaryCompanies", () => {
  it("batches associations, prefers the Primary company and resolves names", async () => {
    const c = client((_m, path, opts) => {
      if (path === "/crm/v4/associations/deals/companies/batch/read") {
        const inputs = (opts.body as { inputs: Array<{ id: string }> }).inputs;
        return { results: inputs.map((i) => i.id === "1"
          ? { from: { id: "1" }, to: [{ toObjectId: 11, associationTypes: [{ label: null }] }, { toObjectId: 22, associationTypes: [{ label: "Primary" }] }] }
          : { from: { id: i.id }, to: [{ toObjectId: 33, associationTypes: [{ label: null }] }] }) };
      }
      if (path === "/crm/v3/objects/companies/batch/read") {
        const inputs = (opts.body as { inputs: Array<{ id: string }> }).inputs;
        return { results: inputs.map((i) => ({ id: i.id, properties: { name: `Co ${i.id}` } })) };
      }
      throw new Error(path);
    });
    const m = await fetchPrimaryCompanies(c, "deals", ["1", "2", "3"]);
    assert.deepEqual(m.get("1"), { id: "22", name: "Co 22" });
    assert.deepEqual(m.get("2"), { id: "33", name: "Co 33" });
  });

  it("splits large id lists into batches of 1000", async () => {
    const c = client((_m, path, opts) => path.includes("associations")
      ? { results: [] } : { results: [] });
    await fetchPrimaryCompanies(c, "deals", Array.from({ length: 2500 }, (_, i) => String(i)));
    assert.equal(c.log.filter((l) => l.path.includes("associations")).length, 3);
  });

  it("degrades to no company columns when the key cannot read companies", async () => {
    const c = client(() => { throw new HubSpotScopeError("no", "crm.objects.companies.read"); });
    const m = await fetchPrimaryCompanies(c, "deals", ["1"]);
    assert.equal(m.size, 0);
  });
});

describe("schemas and properties", () => {
  it("lists custom object schemas and treats a missing scope as none", async () => {
    const ok = client(() => ({ results: [{ objectTypeId: "2-1", name: "projects", labels: { plural: "Projects" } }] }));
    assert.equal((await listSchemas(ok)).length, 1);
    const denied = client(() => { throw new HubSpotScopeError("no"); });
    assert.deepEqual(await listSchemas(denied), []);
  });

  it("fetches the property catalogue", async () => {
    const c = client(() => ({ results: [{ name: "amount", label: "Amount", type: "number" }] }));
    assert.equal((await fetchProperties(c, "deals"))[0]!.name, "amount");
  });
});

describe("incrementalPull modified-date fallback", () => {
  it("retries contacts once with the alternative property when HubSpot rejects the first", async () => {
    const contacts = OBJECT_SPECS.contacts!;
    const rejected: string[] = [];
    const c = client((_m, _p, opts) => {
      const prop = (opts.body as { filterGroups: Array<{ filters: Array<{ propertyName: string }> }> }).filterGroups[0]!.filters[0]!.propertyName;
      if (prop === "lastmodifieddate") { rejected.push(prop); throw new HubSpotRequestError("Property lastmodifieddate does not exist", 400); }
      return { results: [{ id: "1", updatedAt: "2026-01-01T00:00:00.000Z", properties: {} }] };
    });
    const out = await incrementalPull(c, contacts, ["lifecyclestage"], "2025-12-31T00:00:00.000Z");
    assert.equal(out.records.length, 1);
    assert.deepEqual(rejected, ["lastmodifieddate"]);
    assert.equal(c.log.length, 2, "one rejected call, one retry");
  });

  it("does not hide other 400 errors on objects with no alternative", async () => {
    const c = client(() => { throw new HubSpotRequestError("bad", 400); });
    let err: unknown;
    try { await incrementalPull(c, DEALS, ["dealname"], "2026-01-01T00:00:00.000Z"); } catch (e) { err = e; }
    assert.instanceOf(err, HubSpotRequestError);
    assert.equal(c.log.length, 1);
  });
});
