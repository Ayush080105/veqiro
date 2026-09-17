import { Router } from "express";
import {
  msgLex,
  msgLexStream,
  getLexMessages,
  finalizeSource,
  listSources,
  deleteSource,
  analyzeContract,
  draftDocument,
  exportDocument,
  stampLetterhead,
  explain,
  legalResearch,
  complianceCheck,
  queryDocument,
  draftReply,
  getSource,
  versionCandidates,
  compareVersion,
  addReminders,
  updateObligation,
  getWatch,
  getBrief,
  getPreferences,
  putPreferences,
  getSettings,
  putSettings,
  recordActivity,
} from "./lex.controller.js";

const router = Router();

router.post("/chat", msgLex);
router.post("/chat/stream", msgLexStream);
router.get("/chat", getLexMessages);
// Client uploads the PDF directly to R2 via a presigned URL (POST /uploads/presign),
// then calls this endpoint with { key, url, documentName, documentType } to verify
// and trigger ingestion.
router.post("/sources/finalize", finalizeSource);
router.get("/sources", listSources);
router.get("/sources/version-candidates", versionCandidates);
router.get("/sources/:id", getSource);
router.post("/sources/:id/compare", compareVersion);
router.post("/sources/:id/reminders", addReminders);
router.patch("/obligations/:id", updateObligation);
router.get("/watch", getWatch);
router.get("/brief", getBrief);
router.get("/preferences", getPreferences);
router.patch("/preferences", putPreferences);
router.get("/settings", getSettings);
router.patch("/settings", putSettings);
router.post("/activity", recordActivity);
router.delete("/sources/:id", deleteSource);
router.post("/analyze-contract", analyzeContract);
router.post("/query-document", queryDocument);
router.post("/draft-document", draftDocument);
router.post("/draft-reply", draftReply);
router.post("/export-document", exportDocument);
router.post("/stamp-letterhead", stampLetterhead);
router.post("/explain", explain);
router.post("/legal-research", legalResearch);
router.post("/compliance-check", complianceCheck);

export default router;
