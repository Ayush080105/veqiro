import { prisma } from "../../config/prisma.js";
import { resend } from "../../lib/resend.js";
import { WaitlistConfirmEmail } from "@repo/transactional/emails/waitlistConfirmEmail.js";
import env from "../../config/env.js";

export async function addToWaitlist(email: string): Promise<{ alreadyJoined: boolean }> {
  const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
  if (existing) {
    return { alreadyJoined: true };
  }

  await prisma.waitlistEntry.create({ data: { email } });

  try {
    await resend.emails.send({
      from: env.EMAIL_USER!,
      to: email,
      subject: "You are on the Veqiro waitlist - 30% off month one is locked.",
      react: WaitlistConfirmEmail({}),
    });
  } catch (err) {
    console.error("[waitlist] Failed to send confirmation email:", err);
  }

  return { alreadyJoined: false };
}

export async function getCount(): Promise<number> {
  return prisma.waitlistEntry.count();
}
