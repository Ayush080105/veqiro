import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

// ── Credentials ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL    = "admin@veqiro.com";
const ADMIN_NAME     = "Veqiro Admin";
const ADMIN_PASSWORD = "Admin@Veqiro2026";
// ─────────────────────────────────────────────────────────────────────────────

const connectionString = `${process.env.DATABASE_URL}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set. Make sure apps/server/.env exists.");
    process.exit(1);
  }

  console.log("Setting up admin user…\n");

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    // User exists — just promote to admin and make sure email is verified
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: "admin", emailVerified: true },
    });

    // Ensure a credential account exists (in case they signed up via Google etc.)
    const credAccount = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: "credential" },
    });
    if (!credAccount) {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: existing.id,
          providerId: "credential",
          userId: existing.id,
          password: hashed,
        },
      });
      console.log("  ✓ Credential account attached to existing user");
    }

    console.log(`  ✓ ${ADMIN_EMAIL} → role set to admin`);
    console.log("\nNOTE: password below is only valid if the account was just created.");
    console.log("If you already had a password, use your existing one.\n");
  } else {
    // Brand-new admin user
    const userId  = randomUUID();
    const hashed  = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await prisma.user.create({
      data: {
        id:            userId,
        name:          ADMIN_NAME,
        email:         ADMIN_EMAIL,
        emailVerified: true,
        role:          "admin",
      },
    });

    // Better Auth credential account: providerId="credential", accountId=userId
    await prisma.account.create({
      data: {
        id:         randomUUID(),
        accountId:  userId,
        providerId: "credential",
        userId,
        password:   hashed,
      },
    });

    console.log("  ✓ Admin user created\n");
  }

  const line = "─".repeat(41);
  console.log(`┌${line}┐`);
  console.log(`│          Admin Login Credentials          │`);
  console.log(`├${line}┤`);
  console.log(`│  URL:      http://localhost:3002/login    │`);
  console.log(`│  Email:    ${ADMIN_EMAIL.padEnd(29)}│`);
  console.log(`│  Password: ${ADMIN_PASSWORD.padEnd(29)}│`);
  console.log(`└${line}┘`);
  console.log("\n⚠  Change this password after your first login.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
