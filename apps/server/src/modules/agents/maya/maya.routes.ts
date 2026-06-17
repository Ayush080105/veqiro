import { Router } from "express";
import {
  msgMaya,
  getMayaMessages,
  generateIdeas,
  draftContent,
  draftCarousel,
  generateVariants,
  revise,
  regenerateImage,
  regenerateContent,
  publish,
  publishCarousel,
  getPublishedPosts,
  createCampaign,
  expandBrief,
  getAnalytics,
  refreshAnalytics,
} from "./maya.controller.js";

const router = Router();

router.post("/chat", msgMaya);
router.get("/chat", getMayaMessages);
router.post("/generate-ideas", generateIdeas);
router.post("/draft-content", draftContent);
router.post("/draft-carousel", draftCarousel);
router.post("/generate-variants", generateVariants);
router.post("/revise", revise);
router.post("/regenerate-image", regenerateImage);
router.post("/regenerate-content", regenerateContent);
router.post("/publish", publish);
router.post("/publish-carousel", publishCarousel);
router.get("/published-posts", getPublishedPosts);
router.post("/campaign", createCampaign);
router.post("/expand-brief", expandBrief);
router.get("/analytics", getAnalytics);
router.post("/analytics/refresh", refreshAnalytics);

export default router;
