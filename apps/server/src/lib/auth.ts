import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../utils/mailer.js";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins"
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
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
    },
  },
  plugins: [admin(), organization()],
});


