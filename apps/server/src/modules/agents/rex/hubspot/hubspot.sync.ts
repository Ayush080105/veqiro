/**
 * Keeps each HubSpot dataset's snapshot current.
 *
 * One sync = pull (full, or only what changed), shape into a table, and, only if the bytes really
 * changed, store a new CSV, point the dataset at it and recompute the dashboards that read it. A
 * failure of any kind leaves the previous snapshot in place, so dashboards keep showing the last
 * good data. Triggers: the 5-minute cron (datasets a dashboard uses), `ensureFresh` while someone
 * has a dashboard open, and the Refresh button.
 */
import { createHash } from "crypto";
import {
  HubSpotAuthError, HubSpotRateLimitError, HubSpotScopeError, HubSpotTransientError, type HubSpotClient,
} from "./hubspot.client.js";
import { planColumns, type HsProperty } from "./hubspot.fields.js";
import { OBJECT_SPECS, specFor, type ObjectSpec } from "./hubspot.objects.js";
import {
  fetchOwners, fetchPrimaryCompanies, fetchProperties, fetchStages, fullPull, incrementalPull, listSchemas,
  type PullResult, type RawRecord,
} from "./hubspot.pull.js";
import {
  fromCsv, mergeSnapshot, requestProperties, shapeRecords, toCsvWithin, toRawTable, MAX_CSV_BYTES, type Lookups,
} from "./hubspot.table.js";
import type { Blobs, ClientFactory, ConnectionRecord, DatasetRecord, ObjectSelection, Store } from "./hubspot.types.js";

export type SyncMode = "auto" | "incremental" | "full";
export type SyncStatus = "synced" | "unchanged" | "busy" | "disabled" | "error" | "timeout";
export interface SyncOutcome { status: SyncStatus; rows?: number; message?: string }

/** 40% of the smallest plan's 250,000 calls a day; the rest is left for the customer's other tools. */
export const DAILY_BUDGET = 100_000;
export const LOCK_STALE_MS = 10 * 60_000;
const FULL_RECONCILE_AFTER_MS = 24 * 60 * 60_000;
const ERROR_BACKOFF_MS = 2 * 60_000;
const CRON_MIN_AGE_MS = 4 * 60_000;
const MAX_PARALLEL_CONNECTIONS = 3;
const EMPTY_SELECTION: ObjectSelection = { extra: [], includePii: [] };

export interface SyncDeps {
  store: Store;
  blobs: Blobs;
  clientFor: ClientFactory;
  refreshDashboard: (organizationId: string, dashboardId: string) => Promise<unknown>;
  now?: () => Date;
}

export function decideMode(
  d: { syncCursor: { modifiedSince?: string } | null; lastFullSyncAt: Date | null },
  now: Date,
  allowFullReconcile = true,
): "full" | "incremental" {
  if (!d.syncCursor?.modifiedSince || !d.lastFullSyncAt) return "full";
  if (allowFullReconcile && now.getTime() - d.lastFullSyncAt.getTime() > FULL_RECONCILE_AFTER_MS && now.getUTCHours() >= 2) return "full";
  return "incremental";
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

const PROPERTY_CACHE_MS = 10 * 60_000;
const TAIL_WINDOW_MS = 120_000;
const TAIL_MAX = 2_000;

/** id -> modified time for records within the overlap window of the newest one, so the next
 *  incremental pull can tell "already have it" from "changed again". */
function tailOf(
  records: RawRecord[],
  modifiedProp: string,
  modifiedSince: string,
  previous: Record<string, string> = {},
): Record<string, string> {
  const edge = Date.parse(modifiedSince) - TAIL_WINDOW_MS;
  const tail: Record<string, string> = {};
  for (const [id, at] of Object.entries(previous)) if (Date.parse(at) >= edge) tail[id] = at;
  for (const r of records) {
    const at = r.properties[modifiedProp];
    if (at && Date.parse(at) >= edge) tail[r.id] = at;
  }
  return Object.keys(tail).length > TAIL_MAX ? {} : tail;
}
const today = (now: Date) => now.toISOString().slice(0, 10);

export function createSync(deps: SyncDeps) {
  const { store, blobs } = deps;
  const clock = () => (deps.now ?? (() => new Date()))();

  async function recordUsage(connectionId: string, calls: number, forceFull = false) {
    const fresh = await store.findConnectionById(connectionId);
    if (!fresh) return;
    const day = today(clock());
    const prior = fresh.config.usage?.day === day ? fresh.config.usage.calls : 0;
    await store.updateConnection(connectionId, { config: { ...fresh.config, usage: { day, calls: forceFull ? DAILY_BUDGET : prior + calls } } });
  }

  async function lookupsFor(client: HubSpotClient, spec: ObjectSpec): Promise<Lookups> {
    const lookups: Lookups = { owners: new Map() };
    const soft = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try { return await fn(); } catch (err) { if (err instanceof HubSpotScopeError) return null; throw err; }
    };
    if (spec.ownerProps.length) lookups.owners = (await soft(() => fetchOwners(client))) ?? new Map();
    if (spec.pipelineObject) {
      const s = await soft(() => fetchStages(client, spec.pipelineObject!));
      if (s) { lookups.stages = s.stages; lookups.pipelines = s.pipelines; }
    }
    return lookups;
  }

  /** The property catalogue changes rarely and costs a call; reuse it for a few minutes. */
  const propertyCache = new Map<string, { at: number; props: HsProperty[] }>();
  async function propertiesFor(client: HubSpotClient, connectionId: string, type: string, now: Date): Promise<HsProperty[]> {
    const key = `${connectionId}:${type}`;
    const hit = propertyCache.get(key);
    if (hit && now.getTime() - hit.at < PROPERTY_CACHE_MS) return hit.props;
    const props = await fetchProperties(client, type);
    propertyCache.set(key, { at: now.getTime(), props });
    return props;
  }

  async function resolveSpec(client: HubSpotClient, type: string): Promise<ObjectSpec | null> {
    return OBJECT_SPECS[type] ?? specFor(type, await listSchemas(client));
  }

  async function run(d: DatasetRecord, conn: ConnectionRecord, requested: SyncMode, allowFull: boolean): Promise<SyncOutcome> {
    const client = deps.clientFor(conn);
    const now = clock();
    const spec = await resolveSpec(client, d.sourceObject!);
    if (!spec) return fail(d, `HubSpot object "${d.sourceObject}" is no longer available`);

    const props = await propertiesFor(client, conn.id, spec.type, now);
    const sel = conn.config.objects[spec.type] ?? EMPTY_SELECTION;
    const { columns } = planColumns(spec, props, sel);
    const headers = [...columns.map((c) => c.column), ...spec.derivedColumns];
    const meta = (d.meta as { rawTable?: { headers?: string[]; fileKey?: string } } | null) ?? null;
    const prevKey = meta?.rawTable?.fileKey;
    const sameShape = JSON.stringify(meta?.rawTable?.headers) === JSON.stringify(headers);

    let mode: "full" | "incremental" = requested === "auto" ? decideMode(d, now, allowFull) : requested;
    if (mode === "incremental" && (!prevKey || !sameShape || !d.syncCursor?.modifiedSince)) mode = "full";

    const reqProps = requestProperties(spec, columns);
    let pull: PullResult;
    if (mode === "full") {
      pull = await fullPull(client, spec, reqProps);
    } else {
      const fetched = await incrementalPull(client, spec, reqProps, d.syncCursor!.modifiedSince!);
      // The overlap window re-reads the newest records each time; drop the ones we already hold unchanged.
      const tail = d.syncCursor!.tail ?? {};
      const changed = fetched.records.filter((r) => tail[r.id] !== r.properties[spec.modifiedProp]);
      if (changed.length === 0) {
        // Nothing changed: no lookups, no upload, no dashboard work.
        await store.updateDataset(d.id, { lastSyncedAt: now, syncError: null });
        await recordUsage(conn.id, client.callsMade());
        return { status: "unchanged", rows: d.rowCount ?? undefined };
      }
      pull = { ...fetched, records: changed };
    }

    const lookups = await lookupsFor(client, spec);
    if (spec.derivedColumns.includes("associated_company_id")) {
      lookups.companies = await fetchPrimaryCompanies(client, spec.type, pull.records.map((r) => r.id));
    }
    const built = shapeRecords(spec, columns, pull.records, lookups);
    if (mode === "incremental") {
      const previous = fromCsv(await blobs.get(prevKey!));
      built.rows = mergeSnapshot(previous, built.rows);
    }
    let truncated = pull.truncated;
    if (built.rows.length > spec.rowCap) { built.rows = built.rows.slice(0, spec.rowCap); truncated = true; }
    const csv = toCsvWithin(built, MAX_CSV_BYTES);
    if (csv.truncated) { built.rows = built.rows.slice(0, csv.rowsKept); truncated = true; }

    const hash = sha(csv.buffer);
    const modifiedSince = pull.maxModified ?? d.syncCursor?.modifiedSince ?? now.toISOString();
    const baseUpdate = {
      lastSyncedAt: now, syncError: null,
      syncCursor: { modifiedSince, tail: tailOf(pull.records, spec.modifiedProp, modifiedSince, d.syncCursor?.tail) },
      ...(mode === "full" ? { lastFullSyncAt: now } : {}),
    };
    await recordUsage(conn.id, client.callsMade());

    if (hash === d.contentHash) {
      await store.updateDataset(d.id, baseUpdate);
      return { status: "unchanged", rows: built.rows.length };
    }

    const key = await blobs.put(d.organizationId, csv.buffer);
    const current = await store.findDataset(d.id);
    if (!current || current.connectionId !== conn.id || !(await store.findConnectionById(conn.id))) {
      // Disconnected while we were pulling: store nothing, leave nothing behind.
      await blobs.del(key).catch(() => undefined);
      return { status: "error", message: "The HubSpot connection was removed during the sync" };
    }
    await store.updateDataset(d.id, {
      ...baseUpdate,
      meta: { ...((current.meta as object | null) ?? {}), source: "hubspot", rawTable: toRawTable(built, key) },
      contentHash: hash,
      rowCount: built.rows.length,
      syncNote: truncated ? `Showing the first ${built.rows.length.toLocaleString("en-US")} records; this is the most Rex keeps per object.` : null,
    });
    if (prevKey && prevKey !== key) await blobs.del(prevKey).catch(() => undefined);

    for (const dash of await store.dashboardsUsing(d.id)) {
      await deps.refreshDashboard(dash.organizationId, dash.id).catch((err) => console.error("[rex-hubspot] dashboard refresh", err));
    }
    return { status: "synced", rows: built.rows.length };
  }

  async function fail(d: DatasetRecord, message: string): Promise<SyncOutcome> {
    await store.updateDataset(d.id, { syncError: message });
    return { status: "error", message };
  }

  async function guarded(d: DatasetRecord, conn: ConnectionRecord, mode: SyncMode, allowFull: boolean): Promise<SyncOutcome> {
    try {
      return await run(d, conn, mode, allowFull);
    } catch (err) {
      if (err instanceof HubSpotAuthError) {
        const message = "HubSpot rejected the connection. Reconnect to keep your dashboards live.";
        await store.updateConnection(conn.id, { status: "auth_error", lastError: message });
        return fail(d, message);
      }
      if (err instanceof HubSpotScopeError) {
        return fail(d, `HubSpot says this key can't read ${d.sourceObject}${err.scope ? ` (it needs ${err.scope})` : ""}.`);
      }
      if (err instanceof HubSpotRateLimitError) {
        if (err.daily) {
          await recordUsage(conn.id, 0, true);
          return fail(d, "HubSpot's daily API limit was reached. Updates resume tomorrow.");
        }
        return fail(d, "HubSpot is rate limiting requests. Rex will try again shortly.");
      }
      if (err instanceof HubSpotTransientError) return fail(d, "HubSpot is having trouble right now. Rex will try again shortly.");
      console.error("[rex-hubspot] sync failed", d.id, err instanceof Error ? err.message : err);
      return fail(d, `Sync failed: ${(err instanceof Error ? err.message : "unknown error").slice(0, 200)}`);
    }
  }

  async function syncDataset(
    datasetId: string,
    opts: { mode?: SyncMode; waitMs?: number; allowFullReconcile?: boolean } = {},
  ): Promise<SyncOutcome> {
    const d = await store.findDataset(datasetId);
    if (!d || d.sourceKind !== "hubspot" || !d.sourceObject) return { status: "error", message: "Not a HubSpot dataset" };
    if (!d.syncEnabled || !d.connectionId) return { status: "disabled" };
    const conn = await store.findConnectionById(d.connectionId);
    if (!conn) return { status: "disabled", message: "Disconnected from HubSpot" };
    if (conn.status !== "active") return { status: "error", message: conn.lastError ?? "This HubSpot connection needs attention." };
    const usage = conn.config.usage;
    if (usage?.day === today(clock()) && usage.calls >= DAILY_BUDGET) {
      return { status: "error", message: "Paused until tomorrow to protect your HubSpot API limit." };
    }

    const now = clock();
    if (!(await store.tryLockDataset(d.id, new Date(now.getTime() - LOCK_STALE_MS), now))) return { status: "busy" };

    const work = (async () => {
      try {
        return await guarded(d, conn, opts.mode ?? "auto", opts.allowFullReconcile ?? true);
      } finally {
        await store.unlockDataset(d.id).catch(() => undefined);
      }
    })();
    if (!opts.waitMs) return work;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<SyncOutcome>((resolve) => { timer = setTimeout(() => resolve({ status: "timeout" }), opts.waitMs); });
    const result = await Promise.race([work, timeout]);
    clearTimeout(timer);
    if (result.status === "timeout") void work.catch(() => undefined);
    return result;
  }

  async function syncConnection(organizationId: string, connectionId: string, opts: { mode?: SyncMode; waitMs?: number } = {}) {
    const conn = await store.findConnection(organizationId, connectionId);
    if (!conn) return { results: [] as Array<{ datasetId: string; object: string; status: SyncStatus; message?: string }> };
    const datasets = await store.listDatasets([conn.id]);
    const deadline = opts.waitMs ? Date.now() + opts.waitMs : undefined;
    const results = [];
    for (const d of datasets.filter((x) => x.syncEnabled)) {
      const waitMs = deadline ? Math.max(1_000, deadline - Date.now()) : undefined;
      const r = await syncDataset(d.id, { mode: opts.mode, waitMs });
      results.push({ datasetId: d.id, object: d.sourceObject ?? "", status: r.status, message: r.message });
    }
    return { results };
  }

  /** Called whenever a dashboard is read. Starts a background sync for stale HubSpot datasets; never throws or waits. */
  function ensureFresh(organizationId: string, datasetIds: string[], maxAgeMs: number): void {
    void (async () => {
      for (const id of datasetIds) {
        const d = await store.findDataset(id);
        if (!d || d.organizationId !== organizationId || d.sourceKind !== "hubspot" || !d.syncEnabled || !d.connectionId) continue;
        const nowMs = clock().getTime();
        if (d.syncStartedAt && nowMs - d.syncStartedAt.getTime() < LOCK_STALE_MS) continue;
        if (d.lastSyncedAt && nowMs - d.lastSyncedAt.getTime() < maxAgeMs) continue;
        if (d.syncError && nowMs - d.updatedAt.getTime() < ERROR_BACKOFF_MS) continue;
        void syncDataset(id, { allowFullReconcile: false }).catch((err) => console.error("[rex-hubspot] ensureFresh", err));
      }
    })().catch(() => undefined);
  }

  /** The 5-minute schedule: HubSpot datasets that at least one dashboard reads, grouped per connection. */
  async function syncAllHubspot(): Promise<void> {
    const all = await store.listSyncableDatasets();
    if (!all.length) return;
    const used = await store.usedByDashboards(all.map((d) => d.id));
    const nowMs = clock().getTime();
    const due = all.filter((d) => used.has(d.id) && (!d.lastSyncedAt || nowMs - d.lastSyncedAt.getTime() >= CRON_MIN_AGE_MS));
    const byConnection = new Map<string, DatasetRecord[]>();
    for (const d of due) byConnection.set(d.connectionId!, [...(byConnection.get(d.connectionId!) ?? []), d]);
    const queue = [...byConnection.values()];
    const worker = async () => {
      for (let group = queue.shift(); group; group = queue.shift()) {
        for (const d of group) await syncDataset(d.id).catch((err) => console.error("[rex-hubspot] cron sync", err));
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_CONNECTIONS, queue.length) }, worker));
  }

  return { syncDataset, syncConnection, ensureFresh, syncAllHubspot };
}

export type HubspotSync = ReturnType<typeof createSync>;
