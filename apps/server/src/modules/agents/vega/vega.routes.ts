import { Router } from "express";
import { msgVega, getVegaMessages } from "./vega.controller.js";

const router = Router();

router.post("/chat", msgVega);
router.get("/chat", getVegaMessages);

export default router;
