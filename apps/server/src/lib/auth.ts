import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../common/utils/mailer.js";
import { admin, organization, customSession } from "better-auth/plugins";
import { dodopayments, checkout, webhooks } from "@dodopayments/better-auth";
import { dodoClient } from "./dodo.js";
import {
  handleSubscriptionActive,
  handleSubscriptionRenewed,
  handleSubscriptionCancelled,
  handleSubscriptionExpired,
  handleSubscriptionFailed,
  handlePaymentFailed,
} from "../modules/billing/billing.webhooks.js";

const options = {
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  basePath: `/api/${process.env.API_VERSION! || "v1"}/auth`,
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3001"],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ hash, password }) => {
        return await bcrypt.compare(password, hash);
      },
    },
    async sendResetPassword({ user, url }) {
      await sendEmail("resetPassword", user.email, url, user.name);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail("verifyEmail", user.email, url, user.name);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Request Gmail + Calendar scopes so Vega can read inbox, label, draft, and
      // manage events. accessType=offline + prompt=consent forces a refresh_token.
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar",
      ],
      accessType: "offline",
      prompt: "consent",
    },
  },
  plugins: [
    admin(),
    organization({
      schema: {
        organization: {
          additionalFields: {
            onboarded: {
              type: "boolean",
              input: false,
              defaultValue: false,
            },
          },
        },
      },
    }),
    dodopayments({
      client: dodoClient,
      use: [
        checkout({
          products: [
            { productId: process.env.DODO_PRO_MONTHLY_PRODUCT_ID!, slug: "pro-monthly" },
            { productId: process.env.DODO_PRO_ANNUAL_PRODUCT_ID!, slug: "pro-annual" },
          ],
          successUrl: "/settings/billing?status=success",
          authenticatedUsersOnly: true,
        }),
        webhooks({
          webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET!,
          onSubscriptionActive: handleSubscriptionActive as any,
          onSubscriptionRenewed: handleSubscriptionRenewed as any,
          onSubscriptionCancelled: handleSubscriptionCancelled as any,
          onSubscriptionExpired: handleSubscriptionExpired as any,
          onSubscriptionFailed: handleSubscriptionFailed as any,
          onPaymentFailed: handlePaymentFailed  as any,
        }),
      ],
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  plugins: [
    ...options.plugins,
    customSession(async ({ user, session }) => {
      const activeOrganization = session.activeOrganizationId
        ? await prisma.organization.findUnique({
            where: { id: session.activeOrganizationId },
            select: { id: true, name: true, slug: true, onboarded: true },
          })
        : null;

      const memberRows = await prisma.member.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "asc" },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, onboarded: true },
          },
        },
      });

      const memberships = memberRows.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        onboarded: m.organization.onboarded,
        role: m.role,
      }));

      const sub = activeOrganization
        ? await prisma.subscription.findUnique({ where: { organizationId: activeOrganization.id } })
        : null;

      const now = new Date();
      const subscription = sub
        ? {
            status: sub.status,
            plan: sub.plan,
            dodoCustomerId: sub.dodoCustomerId,
            trialEndsAt: sub.trialEndsAt,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            daysRemaining: sub.trialEndsAt
              ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86400000))
              : null,
            isEntitled:
              sub.status === "ACTIVE" ||
              (sub.status === "TRIALING" && !!sub.trialEndsAt && sub.trialEndsAt > now) ||
              (sub.status === "CANCELLED" && !!sub.currentPeriodEnd && sub.currentPeriodEnd > now),
          }
        : null;

      return { user, session, activeOrganization, memberships, subscription };
    }, options),
  ],
});
