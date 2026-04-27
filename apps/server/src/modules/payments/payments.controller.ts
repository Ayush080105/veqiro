import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import * as paymentsService from "./payments.service.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { env } from "../../config/env.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const checkoutSchema = z.object({
  productId: z.string().min(1).optional(),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  couponCode: z.string().optional(),
});

export const createCheckout = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { productId: bodyProductId, customerEmail, customerName, couponCode } = checkoutSchema.parse(req.body);

  const productId = bodyProductId ?? env.DODO_PRODUCT_ID;
  if (!productId) throw new BadRequestError("product_id is required");

  const checkoutUrl = await paymentsService.createCheckoutSession(
    userId,
    organizationId,
    productId,
    customerEmail,
    customerName,
    couponCode
  );

  res.status(StatusCodes.OK).json({ checkout_url: checkoutUrl });
};

export const getSubscription = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const subscription = await paymentsService.getSubscription(organizationId);
  res.status(StatusCodes.OK).json(subscription);
};

export const cancelSubscription = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  await paymentsService.cancelSubscription(organizationId);
  res.status(StatusCodes.OK).json({ canceled: true });
};

export const syncSubscription = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await paymentsService.syncSubscription(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const getInvoices = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const invoices = await paymentsService.getInvoices(organizationId);
  res.status(StatusCodes.OK).json(invoices);
};

export const handleWebhook = async (req: Request, res: Response) => {
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    throw new BadRequestError("Webhook must be sent with Content-Type: application/json as raw body");
  }

  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, String(v)])
  );

  let event;
  try {
    event = paymentsService.verifyAndParseWebhook(rawBody.toString("utf8"), headers);
  } catch {
    res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid webhook signature" });
    return;
  }

  await paymentsService.processWebhookEvent(event);

  res.status(StatusCodes.OK).json({ received: true });
};
