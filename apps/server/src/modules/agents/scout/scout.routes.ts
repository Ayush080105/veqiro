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

const router = Router();

router.post("/chat", msgScout);
router.get("/chat", getScoutMessages);
router.post("/research-topic", researchTopic);
router.post("/research-company", researchCompany);
router.post("/trending-topics", trendingTopics);
router.get("/competitors", getCompetitors);
router.post("/competitors", addCompetitor);
router.delete("/competitors/:id", removeCompetitor);
router.post("/discover-competitors", discoverCompetitors);

export default router;
