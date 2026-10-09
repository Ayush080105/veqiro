import { describe, it, assert } from "vitest";
import type { HubSpotClient, RequestOptions } from "../../src/modules/agents/rex/hubspot/hubspot.client.js";
import { buildPlan, type PlanOptions } from "./plan.js";
import { cleanup, discover, execute } from "./run.js";

type Call = { method: string; path: string; body?: unknown };

/** A pretend HubSpot that records every call and hands out ids. */
function fakeHubSpot(over: { keepCreateDate?: boolean; batchErrors?: boolean; dropUnique?: boolean; noOwners?: boolean; noPortal?: boolean } = {}) {
  const calls: Call[] = [];
  let n = 0;
  const created = new Map<string, Record<string, string>>();
  const client: HubSpotClient = {
    callsMade: () => calls.length,
    request: async <T,>(method: "GET" | "POST", path: string, opts: RequestOptions = {}) => {
      calls.push({ method, path, body: opts.body });
      let out: unknown;
      if (path === "/account-info/v3/details") { if (over.noPortal) throw new Error("no"); out = { portalId: 4242 }; }
      else if (path === "/crm/v3/owners") out = { results: over.noOwners ? [] : [{ id: "11" }, { id: "22" }] };
      else if (path.startsWith("/crm/v3/properties/")) out = { options: [{ value: "A" }, { value: "B", hidden: true }] };
      else if (path === "/crm/v3/pipelines/deals") out = { results: [{ id: "default", label: "Sales", stages: [
        { id: "open1", label: "Open", metadata: { isClosed: "false", probability: "0.3" } },
        { id: "closedwon", label: "Won", metadata: { isClosed: "true", probability: "1.0" } },
        { id: "closedlost", label: "Lost", metadata: { isClosed: "true", probability: "0.0" } } ] }, { id: "other", label: "Other", stages: [{ id: "x", label: "X", metadata: { isClosed: "false" } }] }] };
      else if (path === "/crm/v3/pipelines/tickets") out = { results: [{ id: "0", label: "Support", stages: [
        { id: "1", label: "New", metadata: { ticketState: "OPEN" } }, { id: "4", label: "Closed", metadata: { ticketState: "CLOSED" } } ] }] };
      else if (path.endsWith("/batch/create")) {
        const inputs = (opts.body as { inputs: Array<{ properties: Record<string, string> }> }).inputs;
        const type = path.split("/")[4]!;
        const results = inputs.map((i) => { const id = `${type}-${++n}`; created.set(id, i.properties); return { id, properties: over.dropUnique ? {} : i.properties }; }).reverse();
        out = over.batchErrors ? { results, errors: [{ message: "bad" }] } : { results };
      } else if (path.includes("/batch/associate/default") || path.endsWith("/batch/archive")) out = {};
      else if (method === "GET" && path.startsWith("/crm/v3/objects/deals/")) {
        const props = created.get(path.split("/").pop()!);
        out = { properties: { createdate: over.keepCreateDate === false ? new Date().toISOString() : props?.createdate } };
      } else throw new Error(`unexpected ${method} ${path}`);
      return out as T;
    },
  };
  return { client, calls };
}

const options = async (client: HubSpotClient, scale = 1): Promise<PlanOptions> => {
  const { found } = await discover(client);
  return { ...found, seed: 1, now: new Date("2026-10-09T10:00:00Z"), scale };
};

describe("discover", () => {
  it("reads the account, owners, dropdown values and the default pipelines, and writes nothing", async () => {
    const { client, calls } = fakeHubSpot();
    const { found } = await discover(client);
    assert.equal(found.portalId, "4242");
    assert.deepEqual(found.ownerIds, ["11", "22"]);
    assert.deepEqual(found.allowed.industry, ["A"], "hidden options are not used");
    assert.equal(found.dealPipelineId, "default");
    assert.deepEqual(found.dealStages.map((s) => s.id), ["open1", "closedwon", "closedlost"]);
    assert.deepEqual(found.ticketStages, [{ id: "1", closed: false }, { id: "4", closed: true }]);
    assert.isTrue(calls.every((c) => c.method === "GET" || c.path.includes("/pipelines/")), "discovery only reads");
    assert.isTrue(calls.every((c) => !c.path.includes("/batch/")));
  });

  it("refuses to continue when it cannot tell which account the key belongs to", async () => {
    let err: unknown;
    try { await discover(fakeHubSpot({ noPortal: true }).client); } catch (e) { err = e; }
    assert.match((err as Error).message, /account id/i);
  });

  it("warns, rather than fails, when there are no owners", async () => {
    const { warnings } = await discover(fakeHubSpot({ noOwners: true }).client);
    assert.isTrue(warnings.some((w) => /owner/i.test(w)));
  });
});

describe("execute", () => {
  it("creates everything in batches of 100, links it, and records every id", async () => {
    const { client, calls } = fakeHubSpot();
    const plan = buildPlan(await options(client));
    calls.length = 0;
    const manifestSaves: number[] = [];
    const { manifest } = await execute(client, plan, "4242", { onManifest: (m) => manifestSaves.push(m.ids.companies.length + m.ids.contacts.length + m.ids.deals.length + m.ids.tickets.length) });

    const creates = (type: string) => calls.filter((c) => c.path === `/crm/v3/objects/${type}/batch/create`).length;
    assert.deepEqual([creates("companies"), creates("contacts"), creates("deals"), creates("tickets")], [1, 3, 5, 2]);
    assert.deepEqual([manifest.ids.companies.length, manifest.ids.contacts.length, manifest.ids.deals.length, manifest.ids.tickets.length], [60, 260, 420, 130]);
    assert.isAbove(manifestSaves.length, 5, "the manifest is saved as it goes");
    assert.deepEqual(manifestSaves, [...manifestSaves].sort((a, b) => a - b), "it only ever grows");

    const assoc = calls.filter((c) => c.path.includes("/batch/associate/default")).map((c) => c.path.split("/").slice(4, 6).join(">"));
    assert.includeMembers(assoc, ["contacts>companies", "deals>companies", "deals>contacts", "tickets>contacts", "tickets>companies"]);
    // Creation happens before linking: no association call precedes the last create call.
    const lastCreate = calls.map((c) => c.path.endsWith("/batch/create")).lastIndexOf(true);
    const firstLink = calls.findIndex((c) => c.path.includes("/associate/"));
    assert.isAbove(firstLink, lastCreate);
  });

  it("matches created records back to the plan even if HubSpot answers in a different order", async () => {
    const { client, calls } = fakeHubSpot();
    const plan = buildPlan(await options(client, 0.05));
    calls.length = 0;
    await execute(client, plan, "4242");
    const dealContactLinks = calls.find((c) => c.path.includes("/deals/contacts/batch/associate"))!.body as { inputs: Array<{ from: { id: string }; to: { id: string } }> };
    assert.equal(dealContactLinks.inputs.length, plan.deals.length);
    assert.isTrue(dealContactLinks.inputs.every((i) => i.from.id.startsWith("deals-") && i.to.id.startsWith("contacts-")));
  });

  it("stops and says how to undo if HubSpot rejects part of a batch", async () => {
    const { client } = fakeHubSpot({ batchErrors: true });
    const plan = buildPlan(await options(client, 0.05));
    let err: unknown;
    try { await execute(client, plan, "4242"); } catch (e) { err = e; }
    assert.match((err as Error).message, /--cleanup/);
  });

  it("stops rather than link the wrong records when it cannot match results to the plan", async () => {
    const { client, calls } = fakeHubSpot({ dropUnique: true });
    const plan = buildPlan(await options(client, 0.05));
    calls.length = 0;
    let err: unknown;
    try { await execute(client, plan, "4242"); } catch (e) { err = e; }
    assert.match((err as Error).message, /match/i);
    assert.isTrue(calls.every((c) => !c.path.includes("/associate/")));
  });

  it("tells the person when HubSpot ignores the creation dates", async () => {
    const { client } = fakeHubSpot({ keepCreateDate: false });
    const plan = buildPlan(await options(client, 0.05));
    const { notes } = await execute(client, plan, "4242");
    assert.isTrue(notes.some((n) => /creation dates/i.test(n)));
    const ok = fakeHubSpot();
    const plan2 = buildPlan(await options(ok.client, 0.05));
    assert.deepEqual((await execute(ok.client, plan2, "4242")).notes, []);
  });
});

describe("cleanup", () => {
  it("archives exactly what was recorded, children before parents, 100 at a time", async () => {
    const { client, calls } = fakeHubSpot();
    const plan = buildPlan(await options(client));
    const { manifest } = await execute(client, plan, "4242");
    calls.length = 0;
    await cleanup(client, manifest);
    const order = calls.map((c) => c.path.split("/")[4]);
    assert.deepEqual([...new Set(order)], ["tickets", "deals", "contacts", "companies"]);
    assert.equal(calls.filter((c) => c.path.includes("/deals/")).length, 5);
    const archived = calls.flatMap((c) => (c.body as { inputs: Array<{ id: string }> }).inputs.map((i) => i.id));
    assert.deepEqual([...archived].sort(), [...manifest.ids.tickets, ...manifest.ids.deals, ...manifest.ids.contacts, ...manifest.ids.companies].sort());
  });

  it("does nothing for an empty record", async () => {
    const { client, calls } = fakeHubSpot();
    await cleanup(client, { portalId: "1", createdAt: "", ids: { companies: [], contacts: [], deals: [], tickets: [] } });
    assert.equal(calls.length, 0);
  });
});
