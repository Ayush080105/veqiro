/**
 * Weekly Legal Brief: a short Monday email for organisations that turned it on, built from
 * Legal Watch data that is already stored — no model calls.
 */
import { prisma } from "../../../config/prisma.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import { resend } from "../../../lib/resend.js";
import { buildBrief } from "./lex.memory.js";
import { renderBriefEmail } from "./lex.brief-email.js";
import env from "../../../config/env.js";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export const runWeeklyLegalBrief = async (now = new Date()) => {
  const settings = await prisma.lexSettings.findMany({ where: { weeklyBrief: true } });
  const appUrl = env.CLIENT_URL;
  let sent = 0;
  for (const s of settings) {
    // Several server instances may fire the same cron; the timestamp claim makes it once a week.
    if (s.lastBriefAt && now.getTime() - s.lastBriefAt.getTime() < SIX_DAYS_MS) continue;
    const claimed = await prisma.lexSettings.updateMany({
      where: { organizationId: s.organizationId, OR: [{ lastBriefAt: null }, { lastBriefAt: s.lastBriefAt }] },
      data: { lastBriefAt: now },
    });
    if (!claimed.count) continue;

    const owners = await prisma.lexSource.findMany({
      where: { organizationId: s.organizationId, agent: Agent.LEX },
      distinct: ["userId"],
      select: { userId: true },
    });
    for (const { userId } of owners) {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user?.email) continue;
        const brief = await buildBrief(userId, s.organizationId, now);
        await resend.emails.send({
          from: process.env.EMAIL_USER!,
          to: user.email,
          subject: brief.clear
            ? "Lex's Legal Brief — nothing urgent this week"
            : `Lex's Legal Brief — ${brief.attentionCount} ${brief.attentionCount === 1 ? "item needs" : "items need"} attention`,
          html: renderBriefEmail(brief, appUrl),
        });
        sent++;
      } catch (err) {
        console.error("[lex-brief] failed for user", userId, err);
      }
    }
  }
  return { sent };
};
