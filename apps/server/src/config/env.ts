// TODO: add Zod validation and fail-fast on missing vars
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT) || 5000,
  API_VERSION: process.env.API_VERSION ?? "v1",
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:3001",
  ADMIN_URL: process.env.ADMIN_URL ?? "http://localhost:3002",
  DATABASE_URL: process.env.DATABASE_URL,
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
  AI_SERVICE_URL: process.env.AI_SERVICE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_USER: process.env.EMAIL_USER,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
} as const;
