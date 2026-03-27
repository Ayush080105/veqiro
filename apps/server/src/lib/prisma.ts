import { PrismaClient } from "../../prisma/generated/prisma/client.js";
import { PrismaPostgresAdapter } from "@prisma/adapter-ppg";

const prisma = new PrismaClient({
  adapter: new PrismaPostgresAdapter({
    connectionString: process.env.DATABASE_URL!,
  }),
});

export { prisma };