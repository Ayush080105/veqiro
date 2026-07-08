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
import { seedDefaultTasks } from "../modules/tasks/tasks.service.js";
import { logActivity, ActivityAction } from "../modules/activity/activity.service.js";

const auth = betterAuth({

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  basePath: `/api/${process.env.API_VERSION! || "v1"}/auth`,
  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3001",
    process.env.ADMIN_URL  || "http://localhost:3002",
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production" ? true : false,
    crossSubDomainCookies: {
      enabled: !!process.env.COOKIE_DOMAIN,
      domain: process.env.COOKIE_DOMAIN ,
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    session: {
      create: {
        after: async (session: { userId: string; activeOrganizationId?: string | null }) => {
          await logActivity({
            userId: session.userId,
            organizationId: session.activeOrganizationId ?? null,
            action: ActivityAction.LOGIN,
            summary: "Logged in",
          });
        },
      },
    },
  },
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
      databaseHooks: {
        organization: {
          create: {
            after: async (org: { id: string }) => {
              try {
                await seedDefaultTasks(org.id);
              } catch (err) {
                console.error(`[tasks] Failed to seed default tasks for org ${org.id}:`, err);
              }
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
          webhookKey: (process.env.DODO_PAYMENTS_WEBHOOK_SECRET ?? process.env.DODO_WEBHOOK_SECRET)!,
          onSubscriptionActive: handleSubscriptionActive as any,
          onSubscriptionRenewed: handleSubscriptionRenewed as any,
          onSubscriptionCancelled: handleSubscriptionCancelled as any,
          onSubscriptionExpired: handleSubscriptionExpired as any,
          onSubscriptionFailed: handleSubscriptionFailed as any,
          onPaymentFailed: handlePaymentFailed as any,
        }),
      ],
    }),
  ],
}
);

export default auth
