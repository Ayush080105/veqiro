import { Router } from "express";
import {
  msgSage,
  getSageMessages,
  keywordResearch,
  generateBlog,
  analyzeContent,
  contentBrief,
} from "./sage.controller.js";

const router = Router();

router.post("/chat", msgSage);
router.get("/chat", getSageMessages);
router.post("/keyword-research", keywordResearch);
router.post("/generate-blog", generateBlog);
router.post("/analyze-content", analyzeContent);
router.post("/content-brief", contentBrief);

export default router;
