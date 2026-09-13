import { Router } from "express";
import { msgVega, msgVegaStream, getVegaMessages } from "./vega.controller.js";

const router = Router();

router.post("/chat", msgVega);
router.post("/chat/stream", msgVegaStream);
router.get("/chat", getVegaMessages);

export default router;
