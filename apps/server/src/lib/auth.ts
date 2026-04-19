import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../common/utils/mailer.js";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins"
export const auth = betterAuth({
  basePath: `/api/${process.env.API_VERSION! || "v1"}/auth`,
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],
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
    async sendResetPassword({ user, url, }) {
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
  plugins: [admin(), organization()],
});


