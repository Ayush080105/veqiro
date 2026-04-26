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
  getSnapshot,
  listPins,
  createPin,
  deletePin,
  getSettings,
  patchSettings,
  listDatasets,
  parseDataset,
  saveDatasets,
  deleteDataset,
} from "./rex.controller.js";

const router = Router();

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

// Snapshot (KPI strip)
router.get("/snapshot", getSnapshot);

// Pins (Today panel)
router.get("/pins", listPins);
router.post("/pins", createPin);
router.delete("/pins/:id", deletePin);

// Settings (weekly digest opt-in)
router.get("/settings", getSettings);
router.patch("/settings", patchSettings);

// Dataset CRUD
router.get("/datasets", listDatasets);
router.post("/datasets/parse", parseDataset);
router.post("/datasets", saveDatasets);
router.delete("/datasets/:id", deleteDataset);

export default router;
