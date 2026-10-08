/** The connector's database access, over Prisma. Everything above this file works on plain records. */
import { prisma } from "../../../../config/prisma.js";
import { Prisma } from "../../../../../prisma/generated/prisma/client.js";
import * as rexRepository from "../rex.repository.js";
import type {
  ConnectionConfig, ConnectionPatch, ConnectionRecord, DatasetPatch, DatasetRecord, ObjectAccess, Store,
} from "./hubspot.types.js";

type ConnectionRow = Prisma.RexDataConnectionGetPayload<object>;
type DatasetRow = Prisma.RexDatasetGetPayload<object>;

const toConnection = (r: ConnectionRow): ConnectionRecord => ({
  id: r.id, organizationId: r.organizationId, userId: r.userId, provider: r.provider,
  authType: r.authType as ConnectionRecord["authType"], credentialEnc: r.credentialEnc, accountLabel: r.accountLabel,
  scopes: (r.scopes as unknown as ObjectAccess[]) ?? [],
  config: (r.config as unknown as ConnectionConfig | null)?.objects ? (r.config as unknown as ConnectionConfig) : { ...((r.config as unknown as ConnectionConfig | null) ?? {}), objects: {} },
  status: r.status as ConnectionRecord["status"], lastError: r.lastError, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const toDataset = (r: DatasetRow): DatasetRecord => ({
  id: r.id, organizationId: r.organizationId, userId: r.userId, name: r.name, sourceKind: r.sourceKind,
  connectionId: r.connectionId, sourceObject: r.sourceObject, meta: r.meta,
  syncCursor: (r.syncCursor as DatasetRecord["syncCursor"]) ?? null, lastFullSyncAt: r.lastFullSyncAt,
  syncStartedAt: r.syncStartedAt, lastSyncedAt: r.lastSyncedAt, syncError: r.syncError, syncEnabled: r.syncEnabled,
  contentHash: r.contentHash, rowCount: r.rowCount, syncNote: r.syncNote, containsPii: r.containsPii, updatedAt: r.updatedAt,
});

const json = (v: unknown) => v as Prisma.InputJsonValue;

function connectionData(patch: ConnectionPatch): Prisma.RexDataConnectionUpdateInput {
  const { scopes, config, ...rest } = patch;
  return { ...rest, ...(scopes !== undefined ? { scopes: json(scopes) } : {}), ...(config !== undefined ? { config: json(config) } : {}) };
}

function datasetData(patch: DatasetPatch): Prisma.RexDatasetUpdateInput {
  const { meta, syncCursor, connectionId, ...rest } = patch;
  return {
    ...rest,
    ...(meta !== undefined ? { meta: json(meta) } : {}),
    ...(syncCursor !== undefined ? { syncCursor: syncCursor === null ? Prisma.JsonNull : json(syncCursor) } : {}),
    ...(connectionId !== undefined ? { connectionId } : {}),
  };
}

export function createPrismaStore(): Store {
  return {
    async findConnection(organizationId, id) {
      const r = await prisma.rexDataConnection.findFirst({ where: { id, organizationId } });
      return r ? toConnection(r) : null;
    },
    async findConnectionById(id) {
      const r = await prisma.rexDataConnection.findUnique({ where: { id } });
      return r ? toConnection(r) : null;
    },
    async findConnectionByAccount(organizationId, provider, accountLabel) {
      const r = await prisma.rexDataConnection.findFirst({ where: { organizationId, provider, accountLabel } });
      return r ? toConnection(r) : null;
    },
    async listConnections(organizationId) {
      return (await prisma.rexDataConnection.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } })).map(toConnection);
    },
    async createConnection(input) {
      const r = await prisma.rexDataConnection.create({
        data: { ...input, scopes: json(input.scopes), config: json(input.config) },
      });
      return toConnection(r);
    },
    async updateConnection(id, patch) {
      await prisma.rexDataConnection.updateMany({ where: { id }, data: connectionData(patch) as Prisma.RexDataConnectionUpdateManyMutationInput });
    },
    async deleteConnection(id) {
      await prisma.rexDataConnection.deleteMany({ where: { id } });
    },

    async listDatasets(connectionIds) {
      return (await prisma.rexDataset.findMany({ where: { connectionId: { in: connectionIds } }, orderBy: { createdAt: "asc" } })).map(toDataset);
    },
    async findDataset(id) {
      const r = await prisma.rexDataset.findUnique({ where: { id } });
      return r ? toDataset(r) : null;
    },
    async findConnectorDataset(connectionId, sourceObject) {
      const r = await prisma.rexDataset.findFirst({ where: { connectionId, sourceObject } });
      return r ? toDataset(r) : null;
    },
    async createConnectorDataset(input) {
      const created = await rexRepository.createDataset({
        organizationId: input.organizationId, userId: input.userId, name: input.name, metricKey: input.metricKey,
        period: "snapshot", points: [], purpose: "actual", sourceKind: "hubspot", meta: { source: "hubspot" },
      });
      const r = await prisma.rexDataset.update({
        where: { id: created.id }, data: { connectionId: input.connectionId, sourceObject: input.sourceObject },
      });
      return toDataset(r);
    },
    async updateDataset(id, patch) {
      await prisma.rexDataset.updateMany({ where: { id }, data: datasetData(patch) as Prisma.RexDatasetUpdateManyMutationInput });
    },
    async tryLockDataset(id, staleBefore, now) {
      const r = await prisma.rexDataset.updateMany({
        where: { id, OR: [{ syncStartedAt: null }, { syncStartedAt: { lt: staleBefore } }] },
        data: { syncStartedAt: now },
      });
      return r.count > 0;
    },
    async unlockDataset(id) {
      await prisma.rexDataset.updateMany({ where: { id }, data: { syncStartedAt: null } });
    },
    async deleteDatasets(organizationId, ids) {
      for (const id of ids) await rexRepository.deleteDataset(id, organizationId);
    },

    async listSyncableDatasets() {
      return (await prisma.rexDataset.findMany({
        where: { sourceKind: "hubspot", syncEnabled: true, connectionId: { not: null } },
      })).map(toDataset);
    },
    async usedByDashboards(datasetIds) {
      if (!datasetIds.length) return new Set<string>();
      const rows = await prisma.rexDashboard.findMany({ where: { datasetIds: { hasSome: datasetIds } }, select: { datasetIds: true } });
      const wanted = new Set(datasetIds);
      return new Set(rows.flatMap((r) => r.datasetIds).filter((id) => wanted.has(id)));
    },
    async dashboardsUsing(datasetId) {
      return prisma.rexDashboard.findMany({ where: { datasetIds: { has: datasetId } }, select: { id: true, organizationId: true, lastRefreshedAt: true } });
    },
  };
}
