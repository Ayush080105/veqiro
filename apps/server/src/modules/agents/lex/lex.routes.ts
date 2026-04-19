import { Router } from "express";
import {
  msgLex,
  getLexMessages,
  ingestDocument,
  analyzeContract,
  draftDocument,
  explain,
  legalResearch,
  complianceCheck,
} from "./lex.controller.js";

const router = Router();

router.post("/chat", msgLex);
router.get("/chat", getLexMessages);
router.post("/ingest-document", ingestDocument);
router.post("/analyze-contract", analyzeContract);
router.post("/draft-document", draftDocument);
router.post("/explain", explain);
router.post("/legal-research", legalResearch);
router.post("/compliance-check", complianceCheck);

export default router;
