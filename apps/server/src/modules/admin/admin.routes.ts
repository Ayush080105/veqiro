import { Router } from "express";
import { overview, listOrgs, getOrg, extendTrial } from "./admin.controller.js";

const router = Router();

router.get("/overview", overview);
router.get("/organizations", listOrgs);
router.get("/organizations/:id", getOrg);
router.patch("/organizations/:id/extend-trial", extendTrial);

export default router;
