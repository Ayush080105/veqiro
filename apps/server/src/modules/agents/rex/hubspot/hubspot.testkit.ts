/** In-memory stand-ins for the database and blob storage, used only by the HubSpot connector tests. */
import type { Blobs, ConnectionPatch, ConnectionRecord, DatasetPatch, DatasetRecord, Store } from "./hubspot.types.js";

let counter = 0;
const nextId = (p: string) => `${p}${++counter}`;

export class FakeStore implements Store {
  connections = new Map<string, ConnectionRecord>();
  datasets = new Map<string, DatasetRecord>();
  dashboards: Array<{ id: string; organizationId: string; datasetIds: string[] }> = [];

  async findConnection(organizationId: string, id: string) {
    const c = this.connections.get(id);
    return c && c.organizationId === organizationId ? { ...c } : null;
  }
  async findConnectionById(id: string) {
    const c = this.connections.get(id);
    return c ? { ...c } : null;
  }
  async findConnectionByAccount(organizationId: string, provider: string, accountLabel: string) {
    return [...this.connections.values()].find((c) => c.organizationId === organizationId && c.provider === provider && c.accountLabel === accountLabel) ?? null;
  }
  async listConnections(organizationId: string) {
    return [...this.connections.values()].filter((c) => c.organizationId === organizationId);
  }
  async createConnection(input: Omit<ConnectionRecord, "id" | "createdAt" | "updatedAt">) {
    const row: ConnectionRecord = { ...input, id: nextId("conn"), createdAt: new Date(), updatedAt: new Date() };
    this.connections.set(row.id, row);
    return { ...row };
  }
  async updateConnection(id: string, patch: ConnectionPatch) {
    const c = this.connections.get(id);
    if (c) this.connections.set(id, { ...c, ...patch, updatedAt: new Date() });
  }
  async deleteConnection(id: string) {
    this.connections.delete(id);
  }

  async listDatasets(connectionIds: string[]) {
    return [...this.datasets.values()].filter((d) => d.connectionId && connectionIds.includes(d.connectionId)).map((d) => ({ ...d }));
  }
  async findDataset(id: string) {
    const d = this.datasets.get(id);
    return d ? { ...d } : null;
  }
  async findConnectorDataset(connectionId: string, sourceObject: string) {
    return [...this.datasets.values()].find((d) => d.connectionId === connectionId && d.sourceObject === sourceObject) ?? null;
  }
  async createConnectorDataset(input: { organizationId: string; userId: string; connectionId: string; sourceObject: string; name: string; metricKey: string }) {
    const row: DatasetRecord = {
      id: nextId("ds"), organizationId: input.organizationId, userId: input.userId, name: input.name, sourceKind: "hubspot",
      connectionId: input.connectionId, sourceObject: input.sourceObject, meta: null, syncCursor: null, lastFullSyncAt: null,
      syncStartedAt: null, lastSyncedAt: null, syncError: null, syncEnabled: true, contentHash: null, rowCount: null, syncNote: null, updatedAt: new Date(),
    };
    this.datasets.set(row.id, row);
    return { ...row };
  }
  async updateDataset(id: string, patch: DatasetPatch) {
    const d = this.datasets.get(id);
    if (d) this.datasets.set(id, { ...d, ...patch, updatedAt: new Date() });
  }
  async tryLockDataset(id: string, staleBefore: Date, now: Date) {
    const d = this.datasets.get(id);
    if (!d) return false;
    if (d.syncStartedAt && d.syncStartedAt > staleBefore) return false;
    this.datasets.set(id, { ...d, syncStartedAt: now });
    return true;
  }
  async unlockDataset(id: string) {
    const d = this.datasets.get(id);
    if (d) this.datasets.set(id, { ...d, syncStartedAt: null });
  }
  async deleteDatasets(organizationId: string, ids: string[]) {
    for (const id of ids) if (this.datasets.get(id)?.organizationId === organizationId) this.datasets.delete(id);
  }

  async listSyncableDatasets() {
    return [...this.datasets.values()].filter((d) => d.sourceKind === "hubspot" && d.syncEnabled && d.connectionId).map((d) => ({ ...d }));
  }
  async usedByDashboards(ids: string[]) {
    return new Set(ids.filter((id) => this.dashboards.some((d) => d.datasetIds.includes(id))));
  }
  async dashboardsUsing(datasetId: string) {
    return this.dashboards.filter((d) => d.datasetIds.includes(datasetId)).map(({ id, organizationId }) => ({ id, organizationId }));
  }
}

export class FakeBlobs implements Blobs {
  files = new Map<string, Buffer>();
  deleted: string[] = [];
  private n = 0;
  async put(organizationId: string, csv: Buffer) {
    const key = `documents/${organizationId}-rex-${++this.n}.csv`;
    this.files.set(key, csv);
    return key;
  }
  async get(key: string) {
    const f = this.files.get(key);
    if (!f) throw new Error(`no blob ${key}`);
    return f;
  }
  async del(key: string) {
    this.deleted.push(key);
    this.files.delete(key);
  }
}
