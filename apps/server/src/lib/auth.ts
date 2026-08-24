import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../common/utils/mailer.js";
import { admin, organization, customSession } from "better-auth/plugins";
import { dodopayments, webhooks } from "@dodopayments/better-auth";
import { dodoClient } from "./dodo.js";
import {
  handleSubscriptionActive,
  handleSubscriptionRenewed,
  handleSubscriptionCancelled,
  handleSubscriptionExpired,
  handleSubscriptionFailed,
  handlePaymentFailed,
  handleMayaTopupPaymentSucceeded,
} from "../modules/billing/billing.webhooks.js";
import { logActivity, ActivityAction } from "../modules/activity/activity.service.js";

// DODO_WEBHOOK_SECRET is a deprecated fallback name kept for existing
// deployments — DODO_PAYMENTS_WEBHOOK_SECRET is canonical. Failing loudly at
// boot if NEITHER is set beats the alternative: passing `undefined` into the
// plugin and having every real webhook silently fail signature verification
// in production with no startup error to point at.
const dodoWebhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET ?? process.env.DODO_WEBHOOK_SECRET;
if (!dodoWebhookSecret) {
  throw new Error(
    "Missing DODO_PAYMENTS_WEBHOOK_SECRET — set it before starting the server. " +
    "(DODO_WEBHOOK_SECRET is accepted as a deprecated fallback name.)",
  );
}

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
      // Basic login only — Gmail/Calendar access is no longer bundled into
      // sign-in. Google connects the same way as every other integration:
      // opt-in via its Composio-backed MCP catalog card in Settings.
      scope: ["openid", "email", "profile"],
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
            },
          },
        },
      },
    }),
    dodopayments({
      client: dodoClient,
      use: [
        webhooks({
          webhookKey: dodoWebhookSecret,
          onSubscriptionActive: handleSubscriptionActive as any,
          onSubscriptionRenewed: handleSubscriptionRenewed as any,
          onSubscriptionCancelled: handleSubscriptionCancelled as any,
          onSubscriptionExpired: handleSubscriptionExpired as any,
          onSubscriptionFailed: handleSubscriptionFailed as any,
          onPaymentFailed: handlePaymentFailed as any,
          onPaymentSucceeded: handleMayaTopupPaymentSucceeded as any,
        }),
      ],
    }),
  ],
}
);

export default auth
