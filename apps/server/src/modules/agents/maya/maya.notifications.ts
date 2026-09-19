import { resend } from "../../../lib/resend.js";
import { prisma } from "../../../config/prisma.js";
import { ScheduledPostFailedEmail } from "@repo/transactional/emails/scheduledPostFailed.js";
import * as mayaRepository from "./maya.repository.js";
import { Agent, InsightSeverity } from "../../../../prisma/generated/prisma/client.js";
import { upsertInsight } from "../../workspace/insights.service.js";
import { MAYA_KINDS } from "./maya.workspace.js";

interface FailedScheduledPost {
  id: string;
  organizationId: string;
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

  // Record it as a finding too. An email is a moment; a post that never went
  // out is a standing problem, and the workspace should keep saying so until
  // someone deals with it. Keyed by post id, so it is one card per failure —
  // the post itself is the period, since a given post only fails once.
  //
  // No suggested action: republishing goes through the publish dialog rather
  // than a catalog action, so the honest offer is the post, not a button that
  // would have to be invented.
  await upsertInsight({
    organizationId: post.organizationId,
    agent: Agent.MAYA,
    dedupeKey: `maya.publish-failed:${post.id}:once`,
    kind: "maya.publish-failed",
    title: `Scheduled ${post.platform.toLowerCase()} post didn't publish`,
    body: message.slice(0, 300),
    severity: InsightSeverity.HIGH,
    objectKind: MAYA_KINDS.post,
    objectId: post.id,
  });

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
