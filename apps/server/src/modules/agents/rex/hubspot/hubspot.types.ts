/**
 * Plain shapes shared by the HubSpot connector modules. They deliberately do not import Prisma so
 * the logic that uses them can be tested against an in-memory store.
 */
import type { HubSpotClient } from "./hubspot.client.js";

export interface ObjectSelection {
  /** Properties added on top of the recommended set. */
  extra: string[];
  /** Personal-data properties the customer chose to include. */
  includePii: string[];
}

export interface ObjectAccess {
  type: string;
  ok: boolean;
  missingScope?: string;
}

export interface ConnectionConfig {
  objects: Record<string, ObjectSelection>;
  /** HubSpot calls made today, for the daily budget guard. */
  usage?: { day: string; calls: number };
}

export type ConnectionStatus = "active" | "auth_error" | "paused";

export interface ConnectionRecord {
  id: string;
  organizationId: string;
  userId: string;
  provider: string;
  authType: "token" | "oauth";
  credentialEnc: string;
  accountLabel: string | null;
  scopes: ObjectAccess[];
  config: ConnectionConfig;
  status: ConnectionStatus;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetRecord {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  sourceKind: string;
  connectionId: string | null;
  sourceObject: string | null;
  meta: unknown;
  syncCursor: { modifiedSince?: string; tail?: Record<string, string> } | null;
  lastFullSyncAt: Date | null;
  syncStartedAt: Date | null;
  lastSyncedAt: Date | null;
  syncError: string | null;
  syncEnabled: boolean;
  contentHash: string | null;
  rowCount: number | null;
  syncNote: string | null;
  updatedAt: Date;
}

export type ConnectionPatch = Partial<Omit<ConnectionRecord, "id" | "organizationId" | "createdAt" | "updatedAt">>;
export type DatasetPatch = Partial<Omit<DatasetRecord, "id" | "organizationId" | "updatedAt">>;

/** Everything the connector needs from the database. Implemented over Prisma and in memory for tests. */
export interface Store {
  findConnection(organizationId: string, id: string): Promise<ConnectionRecord | null>;
  findConnectionById(id: string): Promise<ConnectionRecord | null>;
  findConnectionByAccount(organizationId: string, provider: string, accountLabel: string): Promise<ConnectionRecord | null>;
  listConnections(organizationId: string): Promise<ConnectionRecord[]>;
  createConnection(input: Omit<ConnectionRecord, "id" | "createdAt" | "updatedAt">): Promise<ConnectionRecord>;
  updateConnection(id: string, patch: ConnectionPatch): Promise<void>;
  deleteConnection(id: string): Promise<void>;

  listDatasets(connectionIds: string[]): Promise<DatasetRecord[]>;
  findDataset(id: string): Promise<DatasetRecord | null>;
  findConnectorDataset(connectionId: string, sourceObject: string): Promise<DatasetRecord | null>;
  createConnectorDataset(input: { organizationId: string; userId: string; connectionId: string; sourceObject: string; name: string; metricKey: string }): Promise<DatasetRecord>;
  updateDataset(id: string, patch: DatasetPatch): Promise<void>;
  /** Sets syncStartedAt only if nobody holds a fresh lock. */
  tryLockDataset(id: string, staleBefore: Date, now: Date): Promise<boolean>;
  unlockDataset(id: string): Promise<void>;
  deleteDatasets(organizationId: string, ids: string[]): Promise<void>;

  /** Connector datasets that are enabled and attached to a connection. */
  listSyncableDatasets(): Promise<DatasetRecord[]>;
  /** Of these dataset ids, the ones at least one dashboard reads. */
  usedByDashboards(datasetIds: string[]): Promise<Set<string>>;
  dashboardsUsing(datasetId: string): Promise<Array<{ id: string; organizationId: string }>>;
}

export interface Blobs {
  put(organizationId: string, csv: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
  del(key: string): Promise<void>;
}

export type ClientFactory = (conn: ConnectionRecord) => HubSpotClient;
