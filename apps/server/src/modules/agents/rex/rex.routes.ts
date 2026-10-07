import { Router } from "express";
import {
  msgRex,
  msgRexStream,
  getRexMessages,
  analyzeMetrics,
  forecast,
  financialAnalysis,
  compileBriefing,
  runway,
  unitEconomics,
  scenario,
  weeklyDigest,
  investorUpdate,
  variance,
  boardDeck,
  getSnapshot,
  listPins,
  createPin,
  deletePin,
  sharePin,
  getSharedPin,
  getSettings,
  patchSettings,
  generateApiKey,
  revokeApiKey,
  ingest,
  listDatasets,
  parseDataset,
  saveDatasets,
  deleteDataset,
  queryDataset,
  analyzeDataset,
  generateDatasetReport,
} from "./rex.controller.js";
import * as dashboards from "./rex.dashboards.controller.js";
import hubspotRouter, { publicRouter as hubspotPublicRouter } from "./hubspot/hubspot.routes.js";

const router = Router();
// Public webhook routes — no auth (validated by API key body field)
export const publicRouter = Router();
publicRouter.post("/agents/rex/ingest", ingest);
publicRouter.get("/agents/rex/pins/public/:token", getSharedPin);
publicRouter.get("/agents/rex/dashboards/public/:token", dashboards.getPublic);
publicRouter.use(hubspotPublicRouter);

router.post("/chat", msgRex);
router.post("/chat/stream", msgRexStream);
router.get("/chat", getRexMessages);
router.post("/analyze-metrics", analyzeMetrics);
router.post("/forecast", forecast);
router.post("/financial-analysis", financialAnalysis);
router.post("/compile-briefing", compileBriefing);
router.post("/runway", runway);
router.post("/unit-economics", unitEconomics);
router.post("/scenario", scenario);
router.post("/weekly-digest", weeklyDigest);
router.post("/investor-update", investorUpdate);
router.post("/variance", variance);
router.post("/board-deck", boardDeck);

// Snapshot (KPI strip)
router.get("/snapshot", getSnapshot);

// Pins (Today panel)
router.get("/pins", listPins);
router.post("/pins", createPin);
router.delete("/pins/:id", deletePin);
router.patch("/pins/:id/share", sharePin);

// Settings (weekly digest opt-in)
router.get("/settings", getSettings);
router.patch("/settings", patchSettings);

// Webhook API key admin
router.post("/api-key/generate", generateApiKey);
router.post("/api-key/revoke", revokeApiKey);

// Dataset CRUD + natural language Q&A
router.get("/datasets", listDatasets);
router.post("/datasets/parse", parseDataset);
router.post("/datasets", saveDatasets);
router.delete("/datasets/:id", deleteDataset);
router.post("/datasets/:id/query", queryDataset);
router.post("/datasets/:id/analyze", analyzeDataset);
router.post("/datasets/:id/report", generateDatasetReport);

// Linked spreadsheets (Google Sheets, OneDrive, Dropbox, direct URLs) kept in sync
router.post("/datasets/link/parse", dashboards.parseLink);
router.post("/datasets/link/sync", dashboards.syncLink);

// Dashboards
router.get("/dashboards", dashboards.list);
router.post("/dashboards", dashboards.create);
router.get("/dashboards/:id", dashboards.get);
router.patch("/dashboards/:id", dashboards.patch);
router.delete("/dashboards/:id", dashboards.remove);
router.post("/dashboards/:id/prompt", dashboards.edit);
router.patch("/dashboards/:id/layout", dashboards.layout);
router.post("/dashboards/:id/refresh", dashboards.refresh);
router.patch("/dashboards/:id/share", dashboards.share);
router.patch("/dashboards/:id/widgets/:wid", dashboards.patchWidget);
router.delete("/dashboards/:id/widgets/:wid", dashboards.removeWidget);
router.post("/dashboards/:id/widgets/:wid/duplicate", dashboards.duplicateWidget);

// Live data connections (HubSpot): connect, choose data, sync
router.use("/connections", hubspotRouter);

export default router;
