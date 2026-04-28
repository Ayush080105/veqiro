import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import {
  getGoogleAccessToken,
  GoogleNotConnectedError,
} from "../../../common/utils/googleAuth.js";
import { sendGmailReply } from "../../../common/utils/googleApis.js";
import { prisma } from "../../../config/prisma.js";
import type {
  ProcessInboxResponse,
  WorkspaceInboxResponse,
  TriagedEmail,
  UICategory,
  SendReplyInput,
  VegaFollowUpRecord,
  BriefingCacheEntry,
  ExecutiveBriefingResponse,
} from "./vega.types.js";
import type {
  getInboxSchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
} from "./vega.workspace.schema.js";
import type { z } from "zod";

const requireGoogleToken = async (userId: string): Promise<string> => {
  try {
    return await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) {
      throw new BadRequestError(
        "Google account not connected. Connect Gmail + Calendar in Settings → Integrations first."
      );
    }
    throw err;
  }
};

const mapPriorityToCategory = (
  priority: string,
  suggestedAction: string
): UICategory => {
  if (priority === "urgent") return "reply_now";
  if (priority === "high") return "reply_now";
  if (suggestedAction === "schedule") return "reply_now";
  if (priority === "medium") return "action_needed";
  if (suggestedAction === "fyi") return "fyi";
  if (suggestedAction === "ignore" || priority === "low") return "can_ignore";
  return "fyi";
};

export const getInbox = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getInboxSchema>
): Promise<WorkspaceInboxResponse> => {
  const token = await requireGoogleToken(userId);

  // Fetch VIP emails for this org to mark emails
  const vipContacts = await prisma.vIPContact.findMany({
    where: { organizationId },
    select: { email: true },
  });
  const vipEmails = new Set(vipContacts.map((v) => v.email.toLowerCase()));

  const { data } = await aiService.post<ProcessInboxResponse>(
    "/ai/vega/process-inbox",
    {
      user_id: userId,
      organization_id: organizationId,
      max_emails: input.maxEmails,
      auto_label: false,
      draft_replies: false,
      metadata: { google_access_token: token },
    }
  );

  const emails: TriagedEmail[] = (data.processed ?? []).map((e) => ({
    emailId: e.email_id,
    subject: e.subject,
    fromName: e.from_name,
    fromEmail: e.from_email ?? "",
    priority: e.priority,
    uiCategory: mapPriorityToCategory(e.priority, e.suggested_action),
    summary: e.summary,
    suggestedAction: e.suggested_action,
    hiddenTasks: e.hidden_tasks ?? [],
    suggestedReply: e.suggested_reply ?? null,
    meetingRequest: e.meeting_request ?? null,
    isVIP: vipEmails.has((e.from_email ?? "").toLowerCase()),
    receivedAt: null,
    threadId: null,
  }));

  // Sort: reply_now first, then action_needed, fyi, can_ignore; VIPs to top of each group
  const categoryOrder: UICategory[] = ["reply_now", "action_needed", "fyi", "can_ignore"];
  emails.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.uiCategory) - categoryOrder.indexOf(b.uiCategory);
    if (catDiff !== 0) return catDiff;
    return a.isVIP === b.isVIP ? 0 : a.isVIP ? -1 : 1;
  });

  return { emails, stats: data.stats };
};

export const sendReply = async (
  userId: string,
  _organizationId: string,
  emailId: string,
  input: SendReplyInput
): Promise<{ messageId: string; threadId: string }> => {
  const token = await requireGoogleToken(userId);
  const sent = await sendGmailReply({
    accessToken: token,
    to: input.to,
    subject: input.subject,
    body: input.body,
    replyToMessageId: emailId,
    replyToThreadId: input.threadId ?? null,
  });
  return { messageId: sent.id, threadId: sent.threadId };
};

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export const getFollowUps = async (
  organizationId: string
): Promise<VegaFollowUpRecord[]> => {
  const records = await prisma.vegaFollowUp.findMany({
    where: { organizationId },
    orderBy: { dueAt: "asc" },
  });
  return records.map((r) => ({
    id: r.id,
    emailId: r.emailId,
    emailSubject: r.emailSubject,
    senderEmail: r.senderEmail,
    dueAt: r.dueAt.toISOString(),
    draftText: r.draftText,
    status: r.status as VegaFollowUpRecord["status"],
    createdAt: r.createdAt.toISOString(),
  }));
};

export const createFollowUp = async (
  organizationId: string,
  input: z.infer<typeof createFollowUpSchema>
): Promise<VegaFollowUpRecord> => {
  const record = await prisma.vegaFollowUp.create({
    data: {
      emailId: input.emailId,
      emailSubject: input.emailSubject,
      senderEmail: input.senderEmail,
      dueAt: new Date(input.dueAt),
      draftText: input.draftText,
      organizationId,
    },
  });
  return {
    id: record.id,
    emailId: record.emailId,
    emailSubject: record.emailSubject,
    senderEmail: record.senderEmail,
    dueAt: record.dueAt.toISOString(),
    draftText: record.draftText,
    status: record.status as VegaFollowUpRecord["status"],
    createdAt: record.createdAt.toISOString(),
  };
};

export const cancelFollowUp = async (
  organizationId: string,
  followUpId: string
): Promise<void> => {
  const existing = await prisma.vegaFollowUp.findFirst({
    where: { id: followUpId, organizationId },
  });
  if (!existing) throw new BadRequestError("Follow-up not found");
  await prisma.vegaFollowUp.update({
    where: { id: followUpId },
    data: { status: "CANCELLED" },
  });
};

// ─── VIP Contacts ─────────────────────────────────────────────────────────────

export const getVIPContacts = async (organizationId: string) => {
  return prisma.vIPContact.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
};

export const addVIPContact = async (
  organizationId: string,
  input: z.infer<typeof addVIPContactSchema>
) => {
  return prisma.vIPContact.upsert({
    where: { email_organizationId: { email: input.email, organizationId } },
    update: { name: input.name ?? undefined },
    create: { email: input.email, name: input.name, organizationId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
};

export const removeVIPContact = async (
  organizationId: string,
  contactId: string
): Promise<void> => {
  const existing = await prisma.vIPContact.findFirst({
    where: { id: contactId, organizationId },
  });
  if (!existing) throw new BadRequestError("VIP contact not found");
  await prisma.vIPContact.delete({ where: { id: contactId } });
};

// ─── Briefing Cache ───────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

export const getBriefingCache = async (
  organizationId: string,
  type: "MORNING" | "EVENING" | "WEEKLY" = "MORNING"
): Promise<BriefingCacheEntry | null> => {
  const record = await prisma.vegaBriefingCache.findUnique({
    where: { date_type_organizationId: { date: today(), type, organizationId } },
  });
  if (!record) return null;
  return {
    id: record.id,
    date: record.date,
    type: record.type as BriefingCacheEntry["type"],
    content: record.content as Record<string, unknown>,
    generatedAt: record.generatedAt.toISOString(),
  };
};

export const generateAndCacheBriefing = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof generateBriefingSchema>
): Promise<BriefingCacheEntry> => {
  const token = await requireGoogleToken(userId);
  const { data } = await aiService.post<ExecutiveBriefingResponse>(
    "/ai/vega/executive-briefing",
    {
      user_id: userId,
      organization_id: organizationId,
      include_email: input.includeEmail,
      include_calendar: input.includeCalendar,
      metadata: { google_access_token: token },
    }
  );

  const record = await prisma.vegaBriefingCache.upsert({
    where: {
      date_type_organizationId: {
        date: today(),
        type: input.type,
        organizationId,
      },
    },
    update: { content: data.briefing as object, generatedAt: new Date() },
    create: {
      date: today(),
      type: input.type,
      content: data.briefing as object,
      organizationId,
    },
  });

  return {
    id: record.id,
    date: record.date,
    type: record.type as BriefingCacheEntry["type"],
    content: record.content as Record<string, unknown>,
    generatedAt: record.generatedAt.toISOString(),
  };
};
