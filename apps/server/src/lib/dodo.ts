import DodoPayments from "dodopayments";

export const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_ENV === "live" ? "live_mode" : "test_mode",
});

export const PRODUCT_BY_SLUG = {
  "pro-monthly": process.env.DODO_PRO_MONTHLY_PRODUCT_ID!,
  "pro-annual":  process.env.DODO_PRO_ANNUAL_PRODUCT_ID!,
} as const;

export type PlanSlug = keyof typeof PRODUCT_BY_SLUG;
