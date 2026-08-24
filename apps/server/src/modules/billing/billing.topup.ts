import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { mayaTopupUnitProductId } from "./billing.catalog.js";
import { ensureBillingCustomerForOrg, withCustomerRecovery } from "./billing.service.js";
import { getMayaEntitlement } from "./entitlement.service.js";
import { creditsForTopUpDollars, isAllowedTopupDollars, TOPUP_DOLLAR_UNIT } from "../agents/maya/maya.quotas.js";

/**
 * Starts a one-time (non-subscription) Dodo checkout for a Maya credit
 * top-up. Unlike every other checkout in this module, this buys a one-time
 * product, not a subscription — Dodo's "one subscription product per
 * checkout" constraint doesn't apply here since there's no subscription
 * product in the cart at all.
 *
 * Gated on an active/trialing/past-due Maya entitlement via
 * getMayaEntitlement — the same check the credit-grant path
 * (checkAndDeductCredits) uses — rather than the coarser "org subscription
 * status" the frontend stub originally checked. This is deliberately
 * stricter in the right direction: it correctly allows a trialing or
 * grace-period (PAST_DUE) Maya customer to top up, and correctly blocks an
 * org with no Maya entitlement at all (bought other agents only, or a
 * lapsed trial) — the same "no-subscription" error string the usage
 * endpoints already throw, so the frontend's existing error handling
 * applies unchanged.
 */
export async function createMayaTopupCheckout(organizationId: string, dollarsInput: unknown) {
  const dollars = Number(dollarsInput);
  // Closed allowlist, not just "any positive multiple of $3": this route is
  // reachable directly (not only through the dialog's 5 preset buttons), so
  // without this a caller could request an amount that was never intended
  // to be offered (e.g. $300). creditsForTopUpDollars's own multiple-of-3
  // check still runs as defense in depth.
  if (!isAllowedTopupDollars(dollars)) throw new BadRequestError("invalid-topup-amount");
  const credits = creditsForTopUpDollars(dollars);

  const mayaEntitlement = await getMayaEntitlement(organizationId);
  if (!mayaEntitlement) throw new BadRequestError("no-subscription");

  const sub = await ensureBillingCustomerForOrg(organizationId);
  const units = dollars / TOPUP_DOLLAR_UNIT;

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  // See withCustomerRecovery's doc comment in billing.service.ts: an org that
  // topped up before a test->live cutover has a stale dodoCustomerId here too.
  const session = await withCustomerRecovery(organizationId, sub.dodoCustomerId, (customerId) =>
    dodoClient.checkoutSessions.create({
      product_cart: [{ product_id: mayaTopupUnitProductId(), quantity: units }],
      customer: { customer_id: customerId } as never,
      show_saved_payment_methods: true,
      return_url: `${baseUrl}/assistants/maya?topup=success`,
      cancel_url: `${baseUrl}/assistants/maya?topup=cancelled`,
      // Our catalog is USD-only — lock the checkout page's displayed currency
      // to USD instead of letting Dodo auto-convert to the buyer's local
      // currency, so the number shown always matches what the app quoted.
      billing_currency: "USD",
      feature_flags: { allow_currency_selection: false },
      metadata: { organizationId, kind: "MAYA_TOPUP", credits: String(credits) },
    }),
  );

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");
  await prisma.pendingCheckout.create({
    data: {
      organizationId,
      sessionId: session.session_id,
      kind: "MAYA_TOPUP",
      // No cadence applies to a one-time purchase — MONTHLY is meaningless
      // filler here, same convention already used for individual-agent
      // checkouts (see createCheckoutForOrg in billing.service.ts).
      plan: "MONTHLY",
      credits,
    },
  });

  return { url: session.checkout_url, credits, dollars };
}
