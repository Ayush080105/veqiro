import { Router } from "express";
import * as controller from "./waitlist.controller.js";

const router = Router();

router.post("/", controller.join);
router.get("/count", controller.count);

export default router;
