import { Router } from "express";
import {
  overview,
  listOrgs,
  getOrg,
  extendTrial,
  getUsage,
  setSubscriptionStatus,
  bulkExtendTrial,
  getIntegrations,
  getAgents,
  exportOrgs,
  exportUsers,
  verifyUserEmail,
  revokeUserSessions,
  deleteUser,
  listUsers,
  listWaitlistEntries,
  listFeedbackAdmin,
  getFeedbackStats,
  getFeedbackComments,
} from "./admin.controller.js";

const router = Router();

router.get("/overview", overview);
router.get("/usage", getUsage);
router.get("/integrations", getIntegrations);
router.get("/agents", getAgents);
router.get("/waitlist", listWaitlistEntries);

// Static org routes before :id param routes
router.get("/organizations/export", exportOrgs);
router.post("/organizations/bulk-extend-trial", bulkExtendTrial);
router.get("/organizations", listOrgs);
router.get("/organizations/:id", getOrg);
router.patch("/organizations/:id/extend-trial", extendTrial);
router.patch("/organizations/:id/subscription-status", setSubscriptionStatus);
router.post("/organizations/:id/subscription-sync", setSubscriptionStatus);

// User routes
router.get("/users/export", exportUsers);
router.get("/users", listUsers);
router.post("/users/:id/verify-email", verifyUserEmail);
router.delete("/users/:id/sessions", revokeUserSessions);
router.delete("/users/:id", deleteUser);

// Feedback routes (static before param routes)
router.get("/feedback/stats", getFeedbackStats);
router.get("/feedback", listFeedbackAdmin);
router.get("/feedback/:id/comments", getFeedbackComments);

export default router;
