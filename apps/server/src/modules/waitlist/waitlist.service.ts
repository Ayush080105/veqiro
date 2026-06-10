import { prisma } from "../../config/prisma.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

export async function addToWaitlist(email: string): Promise<{ alreadyJoined: boolean }> {
  const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
  if (existing) return { alreadyJoined: true };

  await prisma.waitlistEntry.create({ data: { email } });
  return { alreadyJoined: false };
}

export async function getCount(): Promise<number> {
  return prisma.waitlistEntry.count();
}
