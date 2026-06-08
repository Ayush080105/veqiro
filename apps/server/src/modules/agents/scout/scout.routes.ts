import { Router } from "express";
import {
  msgScout,
  getScoutMessages,
  researchTopic,
  researchCompany,
  trendingTopics,
  getCompetitors,
  addCompetitor,
  removeCompetitor,
  discoverCompetitors,
} from "./scout.controller.js";
import { validate } from "../../../middlewares/validation.middleware.js";
import { sendMessageSchema } from "./scout.schema.js";

const router = Router();

router.post("/chat",validate(sendMessageSchema), msgScout);
router.get("/chat", getScoutMessages);
router.post("/research-topic", researchTopic);
router.post("/research-company", researchCompany);
router.post("/trending-topics", trendingTopics);
router.get("/competitors", getCompetitors);
router.post("/competitors", addCompetitor);
router.delete("/competitors/:id", removeCompetitor);
router.post("/discover-competitors", discoverCompetitors);

export default router;
