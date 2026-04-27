import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { createCheckout, getSubscription, syncSubscription, cancelSubscription, getInvoices, handleWebhook } from "./payments.controller.js";

const paymentsRouter = Router();

// GET /api/v1/payments/subscription — fetch current subscription status
paymentsRouter.get("/subscription", authMiddleware, getSubscription);

// GET /api/v1/payments/invoices — list payments for the org's subscription
paymentsRouter.get("/invoices", authMiddleware, getInvoices);

// POST /api/v1/payments/sync — pull latest subscription status from Dodo and write to DB
paymentsRouter.post("/sync", authMiddleware, syncSubscription);

// POST /api/v1/payments/cancel — cancel subscription at next billing date
paymentsRouter.post("/cancel", authMiddleware, cancelSubscription);

// POST /api/v1/payments/checkout — create a hosted Dodo subscription checkout session
paymentsRouter.post("/checkout", authMiddleware, createCheckout);

// POST /api/v1/payments/webhook — receive Dodo lifecycle events (no auth — Dodo calls this)
// Raw body is preserved by express.raw() mounted in app.ts before express.json()
paymentsRouter.post("/webhook", handleWebhook);

export default paymentsRouter;
