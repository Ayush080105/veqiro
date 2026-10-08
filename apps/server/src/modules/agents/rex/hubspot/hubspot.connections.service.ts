/**
 * HubSpot connections: connect, check what a key can read, choose fields, create the datasets that
 * mirror each object, and disconnect. Pure logic over injected dependencies (store, blob storage,
 * HTTP client factories), so it is tested without a database or the network.
 */
import { BadRequestError } from "../../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../../common/errors/notFound.js";
import { secretsConfigured } from "../../../../common/utils/secretBox.js";
import { HubSpotAuthError, HubSpotScopeError, sanitizeToken, type HubSpotClient } from "./hubspot.client.js";
import { packCredential, type Credential } from "./hubspot.credentials.js";
import { classifyProperties, MAX_COLUMNS, type ColumnPlan } from "./hubspot.fields.js";
import { OBJECT_SPECS, specFor, type ObjectSpec } from "./hubspot.objects.js";
import { countRecords, fetchProperties, listSchemas } from "./hubspot.pull.js";
import type { Blobs, ClientFactory, ConnectionRecord, DatasetRecord, ObjectAccess, ObjectSelection, Store } from "./hubspot.types.js";

export const LOCK_STALE_MS = 10 * 60_000;

export interface ConnectionsDeps {
  store: Store;
  blobs: Blobs;
  clientFor: ClientFactory;
  clientForCredential: (cred: Credential) => HubSpotClient;
}

export interface VerifyReport {
  account: string | null;
  objects: Array<{ type: string; label: string; tier: 1 | 2 | 3; ok: boolean; count: number | null; missingScope?: string; message?: string }>;
}

export interface FieldView {
  property: string;
  column: string;
  label: string;
  group: string | null;
  kind: string;
  pii: boolean;
  source: "recommended" | "custom" | "other";
  selected: boolean;
}

export interface DatasetView {
  id: string;
  object: string;
  name: string;
  enabled: boolean;
  rowCount: number | null;
  lastSyncedAt: Date | null;
  syncError: string | null;
  syncNote: string | null;
  syncing: boolean;
  selection: ObjectSelection;
}

export interface ConnectionView {
  id: string;
  provider: string;
  authType: string;
  accountLabel: string | null;
  status: string;
  lastError: string | null;
  createdAt: Date;
  access: ObjectAccess[];
  datasets: DatasetView[];
}

const EMPTY_SELECTION: ObjectSelection = { extra: [], includePii: [] };
const norm = (s: ObjectSelection) => JSON.stringify({ extra: [...s.extra].sort(), includePii: [...s.includePii].sort() });
const metricKeyFor = (type: string) => `hubspot_${type.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;

export function createConnectionsService(deps: ConnectionsDeps) {
  const { store, blobs } = deps;

  async function owned(organizationId: string, id: string): Promise<ConnectionRecord> {
    const conn = await store.findConnection(organizationId, id);
    if (!conn) throw new NotFoundError("That HubSpot connection was not found");
    return conn;
  }

  /** Every object a key might be able to read, with a live record count where it can. */
  async function probe(client: HubSpotClient, token?: string): Promise<VerifyReport> {
    const schemas = await listSchemas(client);
    const specs: ObjectSpec[] = [
      ...Object.values(OBJECT_SPECS),
      ...schemas.map((s) => specFor(s.objectTypeId, [s])!),
    ];
    const objects: VerifyReport["objects"] = [];
    for (const spec of specs) {
      try {
        objects.push({ type: spec.type, label: spec.label, tier: spec.tier, ok: true, count: await countRecords(client, spec) });
      } catch (err) {
        if (err instanceof HubSpotAuthError) throw err;
        if (err instanceof HubSpotScopeError) {
          objects.push({ type: spec.type, label: spec.label, tier: spec.tier, ok: false, count: null, missingScope: err.scope });
        } else {
          objects.push({ type: spec.type, label: spec.label, tier: spec.tier, ok: false, count: null, message: "HubSpot could not be read for this object right now" });
        }
      }
    }
    return { account: await accountLabel(client, token), objects };
  }

  /** "HubSpot account 1234", from whichever endpoint this kind of key is allowed to read. */
  async function accountLabel(client: HubSpotClient, token?: string): Promise<string | null> {
    const tries: Array<() => Promise<number | undefined>> = [
      async () => (await client.request<{ portalId?: number }>("GET", "/account-info/v3/details")).portalId,
      async () => (await client.request<{ portalId?: number }>("GET", "/integrations/v1/me")).portalId,
    ];
    if (token) {
      tries.push(async () => (await client.request<{ hub_id?: number }>("GET", `/oauth/v1/access-tokens/${encodeURIComponent(token)}`)).hub_id);
    }
    for (const attempt of tries) {
      try {
        const id = await attempt();
        if (id) return `HubSpot account ${id}`;
      } catch {
        // The name is a nicety; never block connecting on it.
      }
    }
    return null;
  }

  const access = (report: VerifyReport): ObjectAccess[] =>
    report.objects.map((o) => ({ type: o.type, ok: o.ok, ...(o.missingScope ? { missingScope: o.missingScope } : {}) }));

  async function persist(a: { organizationId: string; userId: string; cred: Credential; report: VerifyReport; replaceConnectionId?: string }) {
    const credentialEnc = packCredential(a.cred);
    const authType = a.cred.type;
    if (a.replaceConnectionId) {
      const target = await owned(a.organizationId, a.replaceConnectionId);
      if (target.accountLabel && a.report.account && target.accountLabel !== a.report.account) {
        throw new BadRequestError(`That key belongs to ${a.report.account}, but this connection is for ${target.accountLabel}. Use a key from the same HubSpot account.`);
      }
      await store.updateConnection(target.id, { credentialEnc, authType, status: "active", lastError: null, scopes: access(a.report) });
      // The old errors described the old key; the next sync will report the truth.
      for (const d of await store.listDatasets([target.id])) {
        if (d.syncError) await store.updateDataset(d.id, { syncError: null });
      }
      return target.id;
    }
    const existing = a.report.account ? await store.findConnectionByAccount(a.organizationId, "hubspot", a.report.account) : null;
    if (existing) {
      await store.updateConnection(existing.id, {
        credentialEnc, authType, status: "active", lastError: null, scopes: access(a.report),
      });
      return existing.id;
    }
    const created = await store.createConnection({
      organizationId: a.organizationId, userId: a.userId, provider: "hubspot", authType, credentialEnc,
      accountLabel: a.report.account, scopes: access(a.report), config: { objects: {} }, status: "active", lastError: null,
    });
    return created.id;
  }

  function requireEncryption() {
    if (!secretsConfigured()) {
      throw new BadRequestError("Connecting accounts isn't set up on this server yet. Ask an admin to configure INTEGRATION_SECRET_KEY.");
    }
  }

  async function connect(a: { organizationId: string; userId: string; cred: Credential; rejected: string; replaceConnectionId?: string }) {
    requireEncryption();
    if (a.replaceConnectionId) await owned(a.organizationId, a.replaceConnectionId);
    let report: VerifyReport;
    try {
      report = await probe(deps.clientForCredential(a.cred), a.cred.type === "oauth" ? a.cred.accessToken : undefined);
    } catch (err) {
      if (err instanceof HubSpotAuthError) throw new BadRequestError(a.rejected);
      throw err;
    }
    const connectionId = await persist({
      organizationId: a.organizationId, userId: a.userId, cred: a.cred, report, replaceConnectionId: a.replaceConnectionId,
    });
    return { connectionId, verify: report };
  }

  const view = (conn: ConnectionRecord, datasets: DatasetRecord[], now = Date.now()): ConnectionView => ({
    id: conn.id, provider: conn.provider, authType: conn.authType, accountLabel: conn.accountLabel, status: conn.status,
    lastError: conn.lastError, createdAt: conn.createdAt, access: conn.scopes,
    datasets: datasets.filter((d) => d.connectionId === conn.id).map((d) => ({
      id: d.id, object: d.sourceObject ?? "", name: d.name, enabled: d.syncEnabled, rowCount: d.rowCount,
      lastSyncedAt: d.lastSyncedAt, syncError: d.syncError, syncNote: d.syncNote,
      syncing: Boolean(d.syncStartedAt && now - d.syncStartedAt.getTime() < LOCK_STALE_MS),
      selection: conn.config.objects[d.sourceObject ?? ""] ?? EMPTY_SELECTION,
    })),
  });

  return {
    async connectWithToken(a: { organizationId: string; userId: string; token: string; replaceConnectionId?: string }) {
      const token = sanitizeToken(a.token ?? "");
      if (token.length < 12 || /\s/.test(token)) {
        throw new BadRequestError("That doesn't look like a HubSpot token. Paste the whole Service Key or private app token.");
      }
      return connect({
        organizationId: a.organizationId, userId: a.userId, cred: { type: "token", token }, replaceConnectionId: a.replaceConnectionId,
        rejected: "HubSpot rejected that key. Check that you copied the whole token and that it has not been revoked.",
      });
    },

    connectWithOAuthTokens(a: { organizationId: string; userId: string; tokens: { accessToken: string; refreshToken: string; expiresAt: number }; replaceConnectionId?: string }) {
      return connect({
        organizationId: a.organizationId, userId: a.userId, cred: { type: "oauth", ...a.tokens }, replaceConnectionId: a.replaceConnectionId,
        rejected: "HubSpot did not accept the authorization. Try connecting again.",
      });
    },

    async verifyConnection(organizationId: string, id: string): Promise<VerifyReport> {
      const conn = await owned(organizationId, id);
      let report: VerifyReport;
      try {
        report = await probe(deps.clientFor(conn));
      } catch (err) {
        if (err instanceof HubSpotAuthError) {
          await store.updateConnection(id, { status: "auth_error", lastError: "HubSpot rejected the key. Reconnect to keep your data up to date." });
          throw new BadRequestError("HubSpot rejected the saved key. Reconnect HubSpot.");
        }
        throw err;
      }
      await store.updateConnection(id, { scopes: access(report), status: "active", lastError: null });
      return report;
    },

    async listConnections(organizationId: string): Promise<ConnectionView[]> {
      const conns = await store.listConnections(organizationId);
      const datasets = conns.length ? await store.listDatasets(conns.map((c) => c.id)) : [];
      return conns.map((c) => view(c, datasets));
    },

    async discoverFields(organizationId: string, id: string, type: string) {
      const conn = await owned(organizationId, id);
      const client = deps.clientFor(conn);
      const spec = await resolveSpec(client, type);
      const props = await fetchProperties(client, spec.type);
      const { recommended, custom, other } = classifyProperties(spec, props);
      const sel = conn.config.objects[type] ?? EMPTY_SELECTION;
      const toView = (c: ColumnPlan): FieldView => ({
        property: c.property, column: c.column, label: c.label, group: c.group ?? null, kind: c.kind, pii: c.pii, source: c.source,
        selected: (c.source === "recommended" && !c.pii) || sel.extra.includes(c.property) || sel.includePii.includes(c.property),
      });
      return {
        object: { type: spec.type, label: spec.label },
        recommended: recommended.map(toView), custom: custom.map(toView), other: other.map(toView),
        cap: MAX_COLUMNS - spec.derivedColumns.length,
        selection: sel,
      };
    },

    async saveSelection(a: {
      organizationId: string; userId: string; connectionId: string;
      objects: Array<{ type: string; extra: string[]; includePii: string[] }>;
    }) {
      const conn = await owned(a.organizationId, a.connectionId);
      const client = deps.clientFor(conn);
      const config = { ...conn.config, objects: { ...conn.config.objects } };
      const out: Array<{ id: string; sourceObject: string }> = [];

      for (const o of a.objects) {
        const spec = await resolveSpec(client, o.type);
        const granted = conn.scopes.find((s) => s.type === spec.type);
        if (!granted?.ok) {
          throw new BadRequestError(`HubSpot hasn't given this key access to ${spec.label}. Add the scope in HubSpot and re-check.`);
        }
        const next: ObjectSelection = { extra: [...new Set(o.extra)], includePii: [...new Set(o.includePii)] };
        const changed = norm(next) !== norm(config.objects[spec.type] ?? EMPTY_SELECTION);
        config.objects[spec.type] = next;

        let dataset = await store.findConnectorDataset(conn.id, spec.type);
        if (!dataset) {
          dataset = await store.createConnectorDataset({
            organizationId: a.organizationId, userId: a.userId, connectionId: conn.id, sourceObject: spec.type,
            name: `HubSpot · ${spec.label}`, metricKey: metricKeyFor(spec.type),
          });
        } else if (changed) {
          // A different set of columns cannot be merged into the old snapshot; start from scratch.
          await store.updateDataset(dataset.id, { syncCursor: null, lastFullSyncAt: null, syncEnabled: true });
        }
        out.push({ id: dataset.id, sourceObject: spec.type });
      }
      await store.updateConnection(conn.id, { config });
      return { datasets: out };
    },

    async disconnect(organizationId: string, id: string, mode: "keep" | "delete") {
      const conn = await owned(organizationId, id);
      const datasets = await store.listDatasets([conn.id]);
      if (mode === "delete") {
        for (const d of datasets) {
          const key = (d.meta as { rawTable?: { fileKey?: string } } | null)?.rawTable?.fileKey;
          if (key) await blobs.del(key).catch(() => undefined);
        }
        await store.deleteDatasets(organizationId, datasets.map((d) => d.id));
      } else {
        for (const d of datasets) {
          await store.updateDataset(d.id, { connectionId: null, syncEnabled: false, syncError: "Disconnected from HubSpot", syncStartedAt: null });
        }
      }
      await store.deleteConnection(conn.id);
    },
  };

  async function resolveSpec(client: HubSpotClient, type: string): Promise<ObjectSpec> {
    if (OBJECT_SPECS[type]) return OBJECT_SPECS[type]!;
    const spec = specFor(type, await listSchemas(client));
    if (!spec) throw new BadRequestError(`"${type}" isn't an object Rex can read from HubSpot.`);
    return spec;
  }
}

export type ConnectionsService = ReturnType<typeof createConnectionsService>;
