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
  getPublishedPosts,
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
router.get("/published-posts", getPublishedPosts);

export default router;
