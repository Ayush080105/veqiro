import { Router } from "express";
import * as controller from "./expenses.controller.js";

const router = Router();

// Groups
router.get("/groups", controller.listGroups);
router.post("/groups", controller.createGroup);
router.get("/groups/:id", controller.getGroup);
router.post("/groups/:id/members", controller.addMember);
router.delete("/groups/:id/members/:name", controller.removeMember);

// Expenses within a group
router.get("/groups/:id/expenses", controller.listExpenses);
router.post("/groups/:id/expenses", controller.createExpense);

// Individual expense operations
router.put("/expenses/:id", controller.updateExpense);
router.delete("/expenses/:id", controller.deleteExpense);

// Balances, settlements, activity, stats
router.get("/groups/:id/balances", controller.getBalances);
router.post("/groups/:id/settle", controller.createSettlement);
router.get("/groups/:id/activity", controller.getActivity);
router.get("/groups/:id/stats", controller.getStats);
router.get("/groups/:id/export", controller.exportData);
router.post("/groups/:id/rex", controller.askRex);

export default router;
