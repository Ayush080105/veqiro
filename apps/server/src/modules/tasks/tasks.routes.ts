import { Router } from "express";
import * as controller from "./tasks.controller.js";

const router = Router();

router.get("/", controller.listTasks);
router.post("/", controller.createTask);
router.patch("/:id", controller.updateTask);
router.delete("/:id", controller.deleteTask);
router.post("/:id/run", controller.runTask);

export default router;
