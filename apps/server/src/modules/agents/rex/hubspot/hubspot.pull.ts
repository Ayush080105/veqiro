/**
 * Getting records out of HubSpot.
 *
 * Full pull: the list endpoint, 100 per page, no result ceiling. Incremental pull: the search
 * endpoint filtered on "modified since", oldest first. Search stops at 10,000 results per query, so
 * when a window fills up the next window starts at the last timestamp seen (>=, so records that share
 * it are not skipped) and ids are de-duplicated. If a single timestamp holds more records than a
 * window can, the pull stops and reports itself truncated rather than loop.
 */
import { HubSpotRequestError, HubSpotScopeError, type HubSpotClient } from "./hubspot.client.js";
import type { HsProperty } from "./hubspot.fields.js";
import type { ObjectSpec } from "./hubspot.objects.js";

export interface RawRecord {
  id: string;
  properties: Record<string, string | null>;
}

export interface PullResult {
  records: RawRecord[];
  truncated: boolean;
  calls: number;
  maxModified: string | null;
}

interface ApiRecord {
  id: string;
  properties?: Record<string, string | null>;
  updatedAt?: string;
}
interface ApiPage {
  results?: ApiRecord[];
  paging?: { next?: { after?: string } };
  total?: number;
}

/** Search refuses to page past 10,000; stop a window a little short of that. */
const WINDOW_LIMIT = 9_800;
const DEFAULT_OVERLAP_MS = 120_000;

const toMs = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(n) ? n : null;
};

const toRaw = (r: ApiRecord, modifiedProp: string): RawRecord => ({
  id: String(r.id),
  properties: { ...(r.properties ?? {}), [modifiedProp]: r.properties?.[modifiedProp] ?? r.updatedAt ?? null },
});

const withModified = (spec: ObjectSpec, properties: string[]) => [...new Set([...properties, spec.modifiedProp])];

function finish(map: Map<string, RawRecord>, spec: ObjectSpec, calls: number, truncated: boolean): PullResult {
  let max: number | null = null;
  for (const r of map.values()) {
    const ms = toMs(r.properties[spec.modifiedProp]);
    if (ms !== null && (max === null || ms > max)) max = ms;
  }
  return { records: [...map.values()], truncated, calls, maxModified: max === null ? null : new Date(max).toISOString() };
}

export async function fullPull(
  c: HubSpotClient,
  spec: ObjectSpec,
  properties: string[],
  opts: { cap?: number; onProgress?: (n: number) => void } = {},
): Promise<PullResult> {
  const cap = opts.cap ?? spec.rowCap;
  const start = c.callsMade();
  const records = new Map<string, RawRecord>();
  const props = withModified(spec, properties).join(",");
  let after: string | undefined;
  let truncated = false;
  for (;;) {
    const page = await c.request<ApiPage>("GET", `/crm/v3/objects/${spec.type}`, {
      query: { limit: 100, after, properties: props, archived: "false" },
    });
    for (const r of page.results ?? []) records.set(String(r.id), toRaw(r, spec.modifiedProp));
    const next = page.paging?.next?.after;
    if (records.size >= cap) {
      truncated = Boolean(next) || records.size > cap;
      if (records.size > cap) for (const id of [...records.keys()].slice(cap)) records.delete(id);
      opts.onProgress?.(records.size);
      break;
    }
    opts.onProgress?.(records.size);
    if (!next) break;
    after = next;
  }
  return finish(records, spec, c.callsMade() - start, truncated);
}

export async function incrementalPull(
  c: HubSpotClient,
  spec: ObjectSpec,
  properties: string[],
  sinceIso: string,
  opts: { cap?: number; overlapMs?: number } = {},
): Promise<PullResult> {
  const cap = opts.cap ?? spec.rowCap;
  const start = c.callsMade();
  const props = withModified(spec, properties);
  const records = new Map<string, RawRecord>();
  let watermark = (toMs(sinceIso) ?? 0) - (opts.overlapMs ?? DEFAULT_OVERLAP_MS);
  let truncated = false;
  let filterProp = spec.modifiedProp;

  for (;;) {
    let after: string | undefined;
    let inWindow = 0;
    let lastModified = watermark;
    let windowFull = false;
    for (;;) {
      const search = () => c.request<ApiPage>("POST", `/crm/v3/objects/${spec.type}/search`, {
        search: true,
        body: {
          filterGroups: [{ filters: [{ propertyName: filterProp, operator: "GTE", value: String(Math.max(0, watermark)) }] }],
          sorts: [{ propertyName: filterProp, direction: "ASCENDING" }],
          properties: props,
          limit: 200,
          ...(after ? { after } : {}),
        },
      });
      let page: ApiPage;
      try {
        page = await search();
      } catch (err) {
        // Some accounts reject a standard "modified" property name; try the documented alternative once.
        if (err instanceof HubSpotRequestError && err.status === 400 && spec.alternateModifiedProp && filterProp === spec.modifiedProp) {
          filterProp = spec.alternateModifiedProp;
          page = await search();
        } else {
          throw err;
        }
      }
      for (const r of page.results ?? []) {
        const raw = toRaw(r, spec.modifiedProp);
        records.set(raw.id, raw);
        const ms = toMs(raw.properties[spec.modifiedProp]);
        if (ms !== null && ms > lastModified) lastModified = ms;
      }
      inWindow += page.results?.length ?? 0;
      const next = page.paging?.next?.after;
      if (records.size >= cap) {
        truncated = Boolean(next) || records.size > cap;
        if (records.size > cap) for (const id of [...records.keys()].slice(cap)) records.delete(id);
        return finish(records, spec, c.callsMade() - start, truncated);
      }
      if (!next) break;
      if (inWindow >= WINDOW_LIMIT) { windowFull = true; break; }
      after = next;
    }
    if (!windowFull) break;
    if (lastModified <= watermark) { truncated = true; break; }   // one timestamp fills a whole window
    watermark = lastModified;
  }
  return finish(records, spec, c.callsMade() - start, truncated);
}

export async function countRecords(c: HubSpotClient, spec: ObjectSpec): Promise<number> {
  const page = await c.request<ApiPage>("POST", `/crm/v3/objects/${spec.type}/search`, { search: true, body: { limit: 1 } });
  return page.total ?? 0;
}

export async function fetchOwners(c: HubSpotClient): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  for (const archived of ["false", "true"]) {
    let after: string | undefined;
    do {
      const page = await c.request<{
        results?: Array<{ id: string; firstName?: string; lastName?: string; email?: string }>;
        paging?: { next?: { after?: string } };
      }>("GET", "/crm/v3/owners", { query: { limit: 500, after, archived } });
      for (const o of page.results ?? []) {
        const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || String(o.id);
        if (!owners.has(String(o.id))) owners.set(String(o.id), name);
      }
      after = page.paging?.next?.after;
    } while (after);
  }
  return owners;
}

export interface StageInfo {
  pipelineId: string;
  pipeline: string;
  stage: string;
  probability: number | null;
  closed: boolean;
  won: boolean;
}

export async function fetchStages(c: HubSpotClient, pipelineObject: "deals" | "tickets") {
  const page = await c.request<{
    results?: Array<{ id: string; label: string; stages?: Array<{ id: string; label: string; metadata?: Record<string, string> }> }>;
  }>("GET", `/crm/v3/pipelines/${pipelineObject}`);
  const stages = new Map<string, StageInfo>();
  const pipelines = new Map<string, string>();
  for (const p of page.results ?? []) {
    pipelines.set(String(p.id), p.label);
    for (const s of p.stages ?? []) {
      const meta = s.metadata ?? {};
      const probability = meta.probability !== undefined && meta.probability !== "" ? Number(meta.probability) : null;
      const closed = pipelineObject === "deals" ? meta.isClosed === "true" : meta.ticketState === "CLOSED";
      const won = pipelineObject === "deals" && closed && probability !== null && probability >= 0.999;
      stages.set(String(s.id), {
        pipelineId: String(p.id), pipeline: p.label, stage: s.label,
        probability: Number.isFinite(probability as number) ? probability : null, closed, won,
      });
    }
  }
  return { stages, pipelines };
}

/** Each record's primary company (id and name). Without company access this is simply empty. */
export async function fetchPrimaryCompanies(c: HubSpotClient, fromType: string, ids: string[]) {
  const result = new Map<string, { id: string; name: string | null }>();
  try {
    const companyOf = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 1000) {
      const page = await c.request<{
        results?: Array<{ from: { id: string }; to?: Array<{ toObjectId: number | string; associationTypes?: Array<{ label?: string | null }> }> }>;
      }>("POST", `/crm/v4/associations/${fromType}/companies/batch/read`, {
        body: { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) },
      });
      for (const r of page.results ?? []) {
        const to = r.to ?? [];
        const primary = to.find((t) => t.associationTypes?.some((a) => a.label === "Primary")) ?? to[0];
        if (primary) companyOf.set(String(r.from.id), String(primary.toObjectId));
      }
    }
    const names = new Map<string, string | null>();
    const companyIds = [...new Set(companyOf.values())];
    for (let i = 0; i < companyIds.length; i += 100) {
      try {
        const page = await c.request<{ results?: Array<{ id: string; properties?: { name?: string | null } }> }>(
          "POST", "/crm/v3/objects/companies/batch/read",
          { body: { properties: ["name"], inputs: companyIds.slice(i, i + 100).map((id) => ({ id })) } },
        );
        for (const r of page.results ?? []) names.set(String(r.id), r.properties?.name ?? null);
      } catch (err) {
        if (!(err instanceof HubSpotScopeError)) throw err;
      }
    }
    for (const [recordId, companyId] of companyOf) result.set(recordId, { id: companyId, name: names.get(companyId) ?? null });
  } catch (err) {
    if (!(err instanceof HubSpotScopeError)) throw err;
    result.clear();
  }
  return result;
}

export async function listSchemas(c: HubSpotClient) {
  try {
    const page = await c.request<{
      results?: Array<{ objectTypeId: string; name: string; labels: { plural: string }; primaryDisplayProperty?: string }>;
    }>("GET", "/crm/v3/schemas");
    return page.results ?? [];
  } catch (err) {
    if (err instanceof HubSpotScopeError) return [];
    throw err;
  }
}

export async function fetchProperties(c: HubSpotClient, type: string): Promise<HsProperty[]> {
  const page = await c.request<{ results?: HsProperty[] }>("GET", `/crm/v3/properties/${type}`);
  return page.results ?? [];
}
