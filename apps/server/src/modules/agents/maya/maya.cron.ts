import cron from "node-cron";
import { prisma } from "../../../config/prisma.js";
import { sendMessage, firePublishedPost, firePublishedCarousel } from "./maya.service.js";
import * as mayaRepository from "./maya.repository.js";
import { notifyScheduledPostFailure } from "./maya.notifications.js";

export async function runContentIdeasForOrg(organizationId: string) {
  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    select: { userId: true },
  });
  if (!owner) return;

  await sendMessage(owner.userId, organizationId, {
    content:
      "Generate 5 fresh content ideas for today. Vary the formats (short-form, long-form, visual). Use our brand voice and recent content themes.",
  });
}

async function fireDueScheduledPosts() {
  const due = await mayaRepository.claimDueScheduledPosts();

  for (const post of due) {
    const isCarousel = post.imageUrls.length > 0;
    try {
      if (isCarousel) {
        await firePublishedCarousel({
          id: post.id,
          organizationId: post.organizationId,
          userId: post.userId,
          socialAccountId: post.socialAccountId,
          caption: post.caption,
          imageUrls: post.imageUrls,
        });
      } else {
        await firePublishedPost({
          id: post.id,
          organizationId: post.organizationId,
          userId: post.userId,
          socialAccountId: post.socialAccountId,
          caption: post.caption,
          imageUrl: post.imageUrl,
          videoUrl: post.videoUrl,
          postType: post.postType,
        });
      }
    } catch (err) {
      // firePublishedPost/Carousel already persisted status="failed" — this
      // catch exists purely to keep the failure visible (unlike vega/rex's
      // cron, which swallows per-org errors silently) and to notify the user.
      console.error(`[maya-cron] Scheduled post ${post.id} failed to publish:`, err);
      try {
        await notifyScheduledPostFailure(post, err);
      } catch (notifyErr) {
        console.error(`[maya-cron] Failure notification failed for post ${post.id}:`, notifyErr);
      }
    }
  }

  if (due.length > 0) {
    console.log(`[maya-cron] Fired ${due.length} scheduled post(s)`);
  }
}

export function startMayaScheduledPostsCron() {
  cron.schedule("* * * * *", () => void fireDueScheduledPosts());
  console.log("[maya-cron] Scheduled-post publisher started — polling every minute");
}
