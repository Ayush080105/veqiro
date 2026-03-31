import { Router } from "express";
import { msgSage, getSageMessages } from "../../controllers/sage/index.js";

const router = Router();

router.post("/chat", msgSage);
router.get("/chat", getSageMessages);
export default router;