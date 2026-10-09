/**
 * The part of the demo-data tool that talks to HubSpot: look at the account, create the records in
 * batches, link them together, and remove them again. Writes are only reachable through `execute`
 * and `cleanup`, which the command-line wrapper only calls after the person confirms.
 */
import type { HubSpotClient } from "../../src/modules/agents/rex/hubspot/hubspot.client.js";
import { fetchStages } from "../../src/modules/agents/rex/hubspot/hubspot.pull.js";
import type { Plan, PlanOptions } from "./plan.js";

export type Discovered = Omit<PlanOptions, "seed" | "now" | "scale"> & { portalId: string };

export interface Manifest {
  portalId: string;
  createdAt: string;
  ids: { companies: string[]; contacts: string[]; deals: string[]; tickets: string[] };
}

const BATCH = 100;
const ASSOC_BATCH = 1000;
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Read only: who is this account, who can own records, and which values do its dropdowns accept. */
export async function discover(c: HubSpotClient): Promise<{ found: Discovered; warnings: string[] }> {
  const warnings: string[] = [];
  // Either endpoint names the account; some keys may only be allowed to read one of them.
  const details = await c.request<{ portalId?: number }>("GET", "/account-info/v3/details")
    .catch(() => c.request<{ portalId?: number }>("GET", "/integrations/v1/me"))
    .catch(() => ({} as { portalId?: number }));
  if (!details.portalId) throw new Error("Could not read the HubSpot account id. Add the 'oauth' or account-info scope, or check the key.");

  const owners = await c.request<{ results?: Array<{ id: string }> }>("GET", "/crm/v3/owners", { query: { limit: 500 } }).catch(() => ({ results: [] }));
  if (!owners.results?.length) warnings.push("No owners found, so records will be created without an owner.");

  const options = async (type: string, prop: string): Promise<string[]> => {
    try {
      const p = await c.request<{ options?: Array<{ value: string; hidden?: boolean }> }>("GET", `/crm/v3/properties/${type}/${prop}`);
      return (p.options ?? []).filter((o) => !o.hidden).map((o) => o.value);
    } catch {
      warnings.push(`Could not read the choices for ${type}.${prop}; that field will be left empty.`);
      return [];
    }
  };

  const deals = await fetchStages(c, "deals");
  const tickets = await fetchStages(c, "tickets");
  const dealPipelineId = deals.stages.size ? ([...deals.stages.values()].find((s) => s.pipelineId === "default")?.pipelineId ?? [...deals.stages.values()][0]!.pipelineId) : "";
  const ticketPipelineId = tickets.stages.size ? ([...tickets.stages.values()].find((s) => s.pipelineId === "0")?.pipelineId ?? [...tickets.stages.values()][0]!.pipelineId) : "";
  if (!dealPipelineId) throw new Error("No deal pipeline found. The key needs access to deals and their pipelines.");
  if (!ticketPipelineId) warnings.push("No ticket pipeline found; tickets will be skipped.");

  return {
    warnings,
    found: {
      portalId: String(details.portalId),
      ownerIds: (owners.results ?? []).map((o) => String(o.id)),
      allowed: {
        industry: await options("companies", "industry"),
        lifecyclestage: await options("contacts", "lifecyclestage"),
        leadStatus: await options("contacts", "hs_lead_status"),
        dealType: await options("deals", "dealtype"),
        ticketPriority: await options("tickets", "hs_ticket_priority"),
        ticketCategory: await options("tickets", "hs_ticket_category"),
        ticketSource: await options("tickets", "source_type"),
      },
      dealPipelineId,
      dealStages: [...deals.stages.entries()].filter(([, s]) => s.pipelineId === dealPipelineId).map(([id, s]) => ({ id, closed: s.closed, won: s.won })),
      ticketPipelineId,
      ticketStages: [...tickets.stages.entries()].filter(([, s]) => s.pipelineId === ticketPipelineId).map(([id, s]) => ({ id, closed: s.closed })),
    },
  };
}

type BatchReply = { results?: Array<{ id: string; properties?: Record<string, string | null> }>; errors?: unknown[] };

/** Create records 100 at a time and return code -> HubSpot id, matched on a property we made unique. */
async function createAll(
  c: HubSpotClient,
  type: string,
  uniqueProp: string,
  rows: Array<{ code: string; props: Record<string, string> }>,
  onCreated: (ids: string[]) => void,
): Promise<Map<string, string>> {
  const byUnique = new Map(rows.map((r) => [r.props[uniqueProp]!, r.code]));
  const out = new Map<string, string>();
  for (const part of chunk(rows, BATCH)) {
    const reply = await c.request<BatchReply>("POST", `/crm/v3/objects/${type}/batch/create`, { body: { inputs: part.map((r) => ({ properties: r.props })) } });
    if (reply.errors?.length) throw new Error(`HubSpot rejected part of a ${type} batch (${reply.errors.length} errors). Nothing further was created; run --cleanup to remove what exists.`);
    const ids: string[] = [];
    for (const res of reply.results ?? []) {
      const code = byUnique.get(res.properties?.[uniqueProp] ?? "");
      if (code) out.set(code, String(res.id));
      ids.push(String(res.id));
    }
    onCreated(ids);
  }
  const missing = rows.filter((r) => !out.has(r.code));
  if (missing.length) throw new Error(`Could not match ${missing.length} created ${type} back to the plan (first: ${missing[0]!.code}). Run --cleanup and report this.`);
  return out;
}

async function link(c: HubSpotClient, from: string, to: string, pairs: Array<[string, string]>) {
  for (const part of chunk(pairs, ASSOC_BATCH)) {
    await c.request("POST", `/crm/v4/associations/${from}/${to}/batch/associate/default`, {
      body: { inputs: part.map(([f, t]) => ({ from: { id: f }, to: { id: t } })) },
    });
  }
}

export async function execute(
  c: HubSpotClient,
  plan: Plan,
  portalId: string,
  hooks: { onStep?: (msg: string) => void; onManifest?: (m: Manifest) => void } = {},
): Promise<{ manifest: Manifest; notes: string[] }> {
  const say = hooks.onStep ?? (() => undefined);
  const manifest: Manifest = { portalId, createdAt: new Date().toISOString(), ids: { companies: [], contacts: [], deals: [], tickets: [] } };
  const save = () => hooks.onManifest?.(manifest);
  const notes: string[] = [];

  say(`Creating ${plan.companies.length} companies`);
  const companies = await createAll(c, "companies", "domain", plan.companies, (ids) => { manifest.ids.companies.push(...ids); save(); });
  say(`Creating ${plan.contacts.length} contacts`);
  const contacts = await createAll(c, "contacts", "email", plan.contacts, (ids) => { manifest.ids.contacts.push(...ids); save(); });
  say(`Creating ${plan.deals.length} deals`);
  const deals = await createAll(c, "deals", "dealname", plan.deals, (ids) => { manifest.ids.deals.push(...ids); save(); });
  let tickets = new Map<string, string>();
  if (plan.tickets.length) {
    say(`Creating ${plan.tickets.length} tickets`);
    tickets = await createAll(c, "tickets", "subject", plan.tickets, (ids) => { manifest.ids.tickets.push(...ids); save(); });
  }

  const idx = (m: Map<string, string>, list: Array<{ code: string }>, i: number) => m.get(list[i]!.code)!;
  say("Linking contacts, deals and tickets to their companies and contacts");
  await link(c, "contacts", "companies", plan.contacts.map((p, i) => [idx(contacts, plan.contacts, i), idx(companies, plan.companies, p.company)]));
  await link(c, "deals", "companies", plan.deals.map((p, i) => [idx(deals, plan.deals, i), idx(companies, plan.companies, p.company)]));
  await link(c, "deals", "contacts", plan.deals.map((p, i) => [idx(deals, plan.deals, i), idx(contacts, plan.contacts, p.contact)]));
  if (plan.tickets.length) {
    await link(c, "tickets", "contacts", plan.tickets.map((p, i) => [idx(tickets, plan.tickets, i), idx(contacts, plan.contacts, p.contact)]));
    await link(c, "tickets", "companies", plan.tickets.map((p, i) => [idx(tickets, plan.tickets, i), idx(companies, plan.companies, p.company)]));
  }

  // HubSpot may ignore a requested creation date. Say so, because the "per month" charts depend on it.
  const firstId = manifest.ids.deals[0];
  if (firstId) {
    const wanted = plan.deals.find((d) => deals.get(d.code) === firstId)?.props.createdate;
    const got = await c.request<{ properties?: { createdate?: string } }>("GET", `/crm/v3/objects/deals/${firstId}`, { query: { properties: "createdate" } }).catch(() => null);
    if (wanted && got?.properties?.createdate && Math.abs(Date.parse(got.properties.createdate) - Date.parse(wanted)) > 2 * 86_400_000) {
      notes.push("HubSpot did not keep the creation dates we asked for, so charts of 'created per month' will show one lump. Close dates and amounts are unaffected.");
    }
  }
  return { manifest, notes };
}

/** Removes exactly the records listed in a manifest (HubSpot keeps archived records for 90 days). */
export async function cleanup(c: HubSpotClient, manifest: Manifest, say: (m: string) => void = () => undefined) {
  for (const type of ["tickets", "deals", "contacts", "companies"] as const) {
    const ids = manifest.ids[type];
    if (!ids.length) continue;
    say(`Archiving ${ids.length} ${type}`);
    for (const part of chunk(ids, BATCH)) {
      await c.request("POST", `/crm/v3/objects/${type}/batch/archive`, { body: { inputs: part.map((id) => ({ id })) } });
    }
  }
}
