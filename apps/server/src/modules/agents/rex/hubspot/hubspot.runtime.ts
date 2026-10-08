/**
 * The real wiring of the HubSpot connector: Prisma for storage, R2 for snapshot files, the live
 * HubSpot API. Controllers and cron import from here; tests import the factories directly.
 */
import { deleteObject, uploadBuffer } from "../../../../common/utils/r2.js";
import { fetchR2Buffer } from "../rex.csv.js";
import { createClientFactory, createStaticClient } from "./hubspot.credentials.js";
import { createConnectionsService } from "./hubspot.connections.service.js";
import { createPrismaStore } from "./hubspot.store.js";
import { createSync } from "./hubspot.sync.js";
import type { Blobs } from "./hubspot.types.js";

const store = createPrismaStore();

const blobs: Blobs = {
  put: async (organizationId, csv) =>
    (await uploadBuffer({ organizationId, name: "rex-dataset", buffer: csv, extension: "csv", contentType: "text/csv" })).key,
  get: fetchR2Buffer,
  del: deleteObject,
};

const clientFor = createClientFactory(store);

export const hubspotConnections = createConnectionsService({
  store, blobs, clientFor, clientForCredential: (cred) => createStaticClient(cred),
});

export const hubspotSync = createSync({
  store, blobs, clientFor,
  // Loaded on demand: the dashboards service also imports this module.
  refreshDashboard: async (organizationId, dashboardId) =>
    (await import("../rex.dashboards.service.js")).refreshDashboard(organizationId, dashboardId),
});

export const syncAllHubspot = () => hubspotSync.syncAllHubspot();
