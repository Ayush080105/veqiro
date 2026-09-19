import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { prisma } from "../../../config/prisma.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import { callAgentWithContext, agentRoles } from "../../../common/utils/contextService.js";
import {
  ActorKind,
  Agent,
  BriefingType,
} from "../../../../prisma/generated/prisma/client.js";
import { recordActivityEvent } from "../../activity/activity-event.service.js";
import { getCompanyPulse } from "../../workspace/workspace.service.js";

/**
 * Vega's executive briefing.
 *
 * Built on the workspace tables rather than on chat transcripts. A briefing
 * assembled by re-reading conversations can only describe what was talked
 * about; one assembled from ActivityEvent, Insight and WorkObjectIndex
 * describes what actually happened and what is actually outstanding — which is
 * the difference between a summary and a status report.
 *
 * (apps/ai has a /ai/briefing endpoint that takes conversations. It predates
 * these tables and nothing in Node ever called it. This goes through the
 * ordinary Vega chat path instead, the same way plays do, so there is one
 * agent-calling convention rather than two.)
 */

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const briefingBodySchema = z.object({
  type: z.nativeEnum(BriefingType).default(BriefingType.MORNING),
  /** Regenerate even when today's is already cached. */
  refresh: z.boolean().default(false),
});

export interface BriefingPayload {
  headline: string;
  body: string;
  needsYou: number;
  generatedAt: string;
}

const todayKey = (): string => new Date().toISOString().slice(0, 10);

/** The facts Vega narrates, laid out so the model summarises rather than invents. */
function composePrompt(
  pulse: Awaited<ReturnType<typeof getCompanyPulse>>,
  type: BriefingType,
): string {
  const roster = pulse.agents
    .filter((a) => a.agent !== Agent.VEGA)
    .map(
      (a) =>
        `- ${a.agent}: ${a.openInsights} open finding(s) (${a.criticalInsights} serious), ` +
        `${a.pendingApprovals} awaiting approval, ${a.needsReview} needing review`,
    )
    .join("\n");

  const findings = pulse.topInsights
    .map((i) => `- [${i.severity}] ${i.title}${i.body ? ` — ${i.body}` : ""}`)
    .join("\n");

  const activity = pulse.recentActivity
    .slice(0, 12)
    .map((e) => `- ${e.summary}`)
    .join("\n");

  return [
    `Write a short ${type.toLowerCase()} briefing for the owner of this business.`,
    "",
    "Your AI colleagues and what they are sitting on:",
    roster || "- nothing recorded yet",
    "",
    "The findings that matter most right now:",
    findings || "- none",
    "",
    "What happened recently:",
    activity || "- nothing recorded yet",
    "",
    `${pulse.handoffsInFlight} piece(s) of work are currently handed between colleagues.`,
    "",
    "Rules: lead with what needs a decision today. Be specific and quote the numbers",
    "above. Do not invent anything that is not listed. If nothing needs attention,",
    "say so plainly in one line rather than padding. Keep it under 200 words.",
  ].join("\n");
}

export const generateBriefing = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuth(req);
  const { type, refresh } = briefingBodySchema.parse(req.body ?? {});
  const date = todayKey();

  // A briefing is a snapshot of a morning, so re-asking for the same one
  // should return the same answer rather than a differently-worded rewrite.
  if (!refresh) {
    const cached = await prisma.vegaBriefingCache.findUnique({
      where: { date_type_organizationId: { date, type, organizationId } },
    });
    if (cached) {
      res.status(StatusCodes.OK).json(cached.content as unknown as BriefingPayload);
      return;
    }
  }

  const pulse = await getCompanyPulse(organizationId);
  const needsYou =
    pulse.totals.pendingApprovals + pulse.totals.openInsights + pulse.totals.needsReview;

  const response = await callAgentWithContext<{ response: string }>({
    agentApiPath: "/ai/vega/chat",
    agentEnum: Agent.VEGA,
    agentRole: agentRoles[Agent.VEGA],
    userId,
    organizationId,
    conversationId: `briefing-${type}-${date}`,
    userMessage: composePrompt(pulse, type),
    rawHistory: [],
    // Not a conversation the customer had — it must not colour later turns.
    skipMemory: true,
  });

  const payload: BriefingPayload = {
    headline:
      needsYou === 0
        ? "Nothing needs you right now."
        : `${needsYou} ${needsYou === 1 ? "thing needs" : "things need"} your attention.`,
    body: response.response,
    needsYou,
    generatedAt: new Date().toISOString(),
  };

  await prisma.vegaBriefingCache.upsert({
    where: { date_type_organizationId: { date, type, organizationId } },
    create: { date, type, organizationId, content: payload as never },
    update: { content: payload as never, generatedAt: new Date() },
  });

  await recordActivityEvent({
    organizationId,
    agent: Agent.VEGA,
    actorKind: ActorKind.AGENT,
    actorUserId: userId,
    verb: "vega.briefing.generated",
    summary: `Wrote the ${type.toLowerCase()} briefing`,
  });

  res.status(StatusCodes.OK).json(payload);
};

/** Today's briefing if one exists, without generating a new one. */
export const getBriefing = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const type = (req.query.type as BriefingType) ?? BriefingType.MORNING;

  const cached = await prisma.vegaBriefingCache.findUnique({
    where: { date_type_organizationId: { date: todayKey(), type, organizationId } },
  });

  res.status(StatusCodes.OK).json(cached ? (cached.content as unknown) : null);
};
