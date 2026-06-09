import { Router } from "express";
import * as controller from "./feedback.controller.js";

const router = Router();

// Feedback posts
router.get("/", controller.listFeedback);
router.post("/", controller.createFeedback);
router.get("/similar", controller.getSimilarPosts);

// Upcoming agents (must come before /:id to avoid route conflicts)
router.get("/upcoming-agents", controller.listUpcomingAgents);
router.post("/upcoming-agents", controller.createUpcomingAgent);
router.post("/upcoming-agents/:id/vote", controller.toggleUpcomingVote);
router.patch("/upcoming-agents/:id", controller.updateUpcomingAgent);
router.delete("/upcoming-agents/:id", controller.deleteUpcomingAgent);

// Per-post routes
router.get("/:id", controller.getFeedback);
router.post("/:id/vote", controller.toggleVote);
router.post("/:id/comments", controller.addComment);
router.patch("/:id/status", controller.updateStatus);
router.post("/:id/merge", controller.mergePost);

export default router;
