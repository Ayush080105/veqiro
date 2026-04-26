import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../common/utils/mailer.js";
import { admin, organization, customSession } from "better-auth/plugins";

const options = {
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  basePath: `/api/${process.env.API_VERSION! || "v1"}/auth`,
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3001"],
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
  ],
  // On every fresh session (login, sign-up, OAuth callback) default the
  // session's active organization to the user's first membership. Without
  // this, the session row is created with activeOrganizationId=null and the
  // onboarded check on the dashboard always fails — even for users whose
  // org has onboarded=true — so they get bounced back to /onboarding.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const membership = await prisma.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "asc" },
            select: { organizationId: true },
          });
          return {
            data: {
              ...session,
              activeOrganizationId:
                session.activeOrganizationId ?? membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
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
      return { user, session, activeOrganization };
    }, options),
  ],
});
