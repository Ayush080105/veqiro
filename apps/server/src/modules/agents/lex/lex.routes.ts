import { Router } from "express";
import {
  msgLex,
  getLexMessages,
  finalizeSource,
  listSources,
  deleteSource,
  analyzeContract,
  draftDocument,
  explain,
  legalResearch,
  complianceCheck,
  queryDocument,
} from "./lex.controller.js";

const router = Router();

router.post("/chat", msgLex);
router.get("/chat", getLexMessages);
// Client uploads the PDF directly to R2 via a presigned URL (POST /uploads/presign),
// then calls this endpoint with { key, url, documentName, documentType } to verify
// and trigger ingestion.
router.post("/sources/finalize", finalizeSource);
router.get("/sources", listSources);
router.delete("/sources/:id", deleteSource);
router.post("/analyze-contract", analyzeContract);
router.post("/query-document", queryDocument);
router.post("/draft-document", draftDocument);
router.post("/explain", explain);
router.post("/legal-research", legalResearch);
router.post("/compliance-check", complianceCheck);

export default router;
