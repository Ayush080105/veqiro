import { Router } from "express";
import {
  msgSage,
  getSageMessages,
  keywordResearch,
  generateBlog,
  analyzeContent,
  contentBrief,
  generateBlogIdeas,
  serpAnalysis,
  topicalMap,
  metaOptimizer,
  pageSeoAudit,
  discoverPages,
  siteAudit,
  getSavedKeywords,
  addSavedKeyword,
  removeSavedKeyword,
} from "./sage.controller.js";

const router = Router();

router.post("/chat", msgSage);
router.get("/chat", getSageMessages);
router.post("/keyword-research", keywordResearch);
router.post("/generate-blog", generateBlog);
router.post("/analyze-content", analyzeContent);
router.post("/content-brief", contentBrief);
router.post("/generate-blog-ideas", generateBlogIdeas);
router.post("/serp-analysis", serpAnalysis);
router.post("/topical-map", topicalMap);
router.post("/meta-optimizer", metaOptimizer);
router.post("/page-audit", pageSeoAudit);
router.post("/discover-pages", discoverPages);
router.post("/site-audit", siteAudit);
router.get("/keywords/saved", getSavedKeywords);
router.post("/keywords/saved", addSavedKeyword);
router.delete("/keywords/saved/:id", removeSavedKeyword);

export default router;
