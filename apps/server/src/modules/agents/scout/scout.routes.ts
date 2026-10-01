import { Router } from "express";
import {
  msgScout,
  msgScoutStream,
  getScoutMessages,
  researchTopic,
  researchCompany,
  trendingTopics,
  discoverCompetitors,
} from "./scout.controller.js";
import {
  getResearchProject,
  listResearchProjects,
  patchResearchProject,
} from "./scout.projects.js";
import { validate } from "../../../middlewares/validation.middleware.js";
import { discoverCompetitorsSchema, researchCompanySchema, researchTopicSchema, sendMessageSchema, trendingTopicsSchema } from "./scout.schema.js";

const router = Router();

router.post("/chat",validate(sendMessageSchema), msgScout);
router.post("/chat/stream", validate(sendMessageSchema), msgScoutStream);
router.get("/chat", getScoutMessages);
router.post("/research-topic",validate(researchTopicSchema), researchTopic);
router.post("/research-company", validate(researchCompanySchema), researchCompany);
router.post("/trending-topics", validate(trendingTopicsSchema), trendingTopics);
router.post("/discover-competitors", validate(discoverCompetitorsSchema), discoverCompetitors);

router.get("/projects", listResearchProjects);
router.get("/projects/:id", getResearchProject);
router.patch("/projects/:id", patchResearchProject);

export default router;
