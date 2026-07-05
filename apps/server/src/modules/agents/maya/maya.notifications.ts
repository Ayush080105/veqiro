import { resend } from "../../../lib/resend.js";
import { prisma } from "../../../config/prisma.js";
import { ScheduledPostFailedEmail } from "@repo/transactional/emails/scheduledPostFailed.js";
import * as mayaRepository from "./maya.repository.js";

interface FailedScheduledPost {
  id: string;
  userId: string;
  platform: string;
  caption: string;
  failureNotifiedAt: Date | null;
}

// Emails the user that their scheduled post failed to fire. Idempotent via
// failureNotifiedAt — the cron may retry/re-encounter the same row, but this
// only ever sends once per post.
export async function notifyScheduledPostFailure(
  post: FailedScheduledPost,
  err: unknown
): Promise<void> {
  if (post.failureNotifiedAt) return;
  const message = err instanceof Error ? err.message : String(err);

  const recipient = await mayaRepository.findRecipientEmail(post.userId);
  if (recipient?.email) {
    const calendarUrl = `${process.env.FRONTEND_URL ?? "https://console.veqiro.com"}/assistants/maya`;
    await resend.emails.send({
      from: process.env.EMAIL_USER!,
      to: recipient.email,
      subject: `Scheduled ${post.platform.toLowerCase()} post failed to publish`,
      react: ScheduledPostFailedEmail({
        platform: post.platform,
        caption: post.caption,
        error: message,
        userName: recipient.name,
        calendarUrl,
      }),
    });
  }

  await prisma.publishedPost.update({
    where: { id: post.id },
    data: { failureNotifiedAt: new Date() },
  });
}
