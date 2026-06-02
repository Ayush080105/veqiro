import { Router } from "express";
import {
  msgRex,
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

const router = Router();
// Public webhook routes — no auth (validated by API key body field)
export const publicRouter = Router();
publicRouter.post("/agents/rex/ingest", ingest);
publicRouter.get("/agents/rex/pins/public/:token", getSharedPin);

router.post("/chat", msgRex);
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

export default router;
