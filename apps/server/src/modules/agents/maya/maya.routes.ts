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
  schedulePost,
  scheduleCarousel,
  cancelScheduledPost,
  getPublishedPosts,
  createCampaign,
  expandBrief,
  generateVideo,
  createCampaignVideo,
  createCampaignVideoPlan,
  createCampaignVideoStoryboard,
  getMayaUsage,
  getLogoAnimationStyles,
  createLogoAnimation,
  listContentPlans,
  generateContentPlan,
} from "./maya.controller.js";

const router = Router();

router.get("/usage", getMayaUsage);
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
router.post("/schedule", schedulePost);
router.post("/schedule-carousel", scheduleCarousel);
router.post("/scheduled-posts/:id/cancel", cancelScheduledPost);
router.get("/published-posts", getPublishedPosts);
router.post("/campaign", createCampaign);
router.post("/expand-brief", expandBrief);
router.post("/generate-video", generateVideo);
router.post("/campaign-video", createCampaignVideo);
router.post("/campaign-video/plan", createCampaignVideoPlan);
router.post("/campaign-video/storyboard", createCampaignVideoStoryboard);
router.get("/logo-animation/styles", getLogoAnimationStyles);
router.post("/logo-animation", createLogoAnimation);
router.get("/content-plan", listContentPlans);
router.post("/content-plan/generate", generateContentPlan);

export default router;
