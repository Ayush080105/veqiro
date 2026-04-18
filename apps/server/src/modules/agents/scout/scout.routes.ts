import { Router } from "express";
import {
  msgScout,
  getScoutMessages,
  researchTopic,
  researchCompany,
  scanCompetitors,
  trendingTopics,
} from "./scout.controller.js";

const router = Router();

router.post("/chat", msgScout);
router.get("/chat", getScoutMessages);
router.post("/research-topic", researchTopic);
router.post("/research-company", researchCompany);
router.post("/scan-competitors", scanCompetitors);
router.post("/trending-topics", trendingTopics);

export default router;
