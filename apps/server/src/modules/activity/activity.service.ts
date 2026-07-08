import { prisma } from "../../config/prisma.js";
import { ActivityAction, Prisma } from "../../../prisma/generated/prisma/client.js";

type LogActivityInput = {
  userId: string;
  organizationId?: string | null;
  action: ActivityAction;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

// Fire-and-forget: activity logging must never break the caller's real
// action (a publish, a login, a video generation), so failures are only
// logged, never thrown.
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId ?? null,
        action: input.action,
        summary: input.summary,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log activity", input.action, err);
  }
}

export { ActivityAction };
