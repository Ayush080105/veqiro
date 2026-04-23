import { Router } from "express";
import { getLastMessages } from "./messages.controller.js";

const router = Router();

router.get("/last-messages", getLastMessages);

export default router;
