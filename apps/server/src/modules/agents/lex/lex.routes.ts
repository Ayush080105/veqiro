import { Router } from "express";
import {
  msgLex,
  getLexMessages,
  uploadSource,
  listSources,
  deleteSource,
  analyzeContract,
  draftDocument,
  explain,
  legalResearch,
  complianceCheck,
  queryDocument,
} from "./lex.controller.js";
import { uploadPdf } from "../../../middlewares/uploadPdf.middleware.js";

const router = Router();

router.post("/chat", msgLex);
router.get("/chat", getLexMessages);
router.post("/sources/upload", uploadPdf.single("file"), uploadSource);
router.get("/sources", listSources);
router.delete("/sources/:id", deleteSource);
router.post("/analyze-contract", analyzeContract);
router.post("/query-document", queryDocument);
router.post("/draft-document", draftDocument);
router.post("/explain", explain);
router.post("/legal-research", legalResearch);
router.post("/compliance-check", complianceCheck);

export default router;
