import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import {
  getGoogleAccessToken,
  GoogleNotConnectedError,
} from "../../../common/utils/googleAuth.js";
import {
  sendGmailReply,
  createCalendarEvent as createGoogleCalendarEvent,
  updateCalendarEvent as updateGoogleCalendarEvent,
  labelMessage,
  modifyMessageLabels,
} from "../../../common/utils/googleApis.js";
import { prisma } from "../../../config/prisma.js";
import type {
  ProcessInboxResponse,
  WorkspaceInboxResponse,
  TriagedEmail,
  UICategory,
  SendReplyInput,
  VegaFollowUpRecord,
  VegaLabelRecord,
  BriefingCacheEntry,
  ExecutiveBriefingResponse,
} from "./vega.types.js";
import type {
  getInboxSchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
  getCalendarSchema,
  createCalendarEventSchema,
  getMeetingPrepSchema,
  postMeetingFollowUpSchema,
  sendFollowUpEmailSchema,
  updateCalendarEventSchema,
  rescheduleDraftSchema,
  bulkInboxActionSchema,
  createLabelSchema,
  updateLabelSchema,
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

export const mapPriorityToCategory = (
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

const INBOX_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const getInbox = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getInboxSchema>,
  force = false
): Promise<WorkspaceInboxResponse> => {
  // Serve from server-side cache if fresh (unless force=true)
  if (!force) {
    const cached = await prisma.vegaInboxCache.findUnique({
      where: { organizationId },
    });
    if (cached && Date.now() - cached.cachedAt.getTime() < INBOX_CACHE_TTL_MS) {
      return cached.snapshot as unknown as WorkspaceInboxResponse;
    }
  }

  const token = await requireGoogleToken(userId);

  // Fetch org labels (seeds defaults if none exist yet) for dynamic label list
  const orgLabels = await getLabels(organizationId);
  const customLabelNames = orgLabels.map((l) => l.name);

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
      custom_labels: customLabelNames,
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
    label: e.label_applied ?? "Other",
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

  const result: WorkspaceInboxResponse = { emails, stats: data.stats };

  // Upsert cache
  await prisma.vegaInboxCache.upsert({
    where: { organizationId },
    update: { snapshot: result as object, cachedAt: new Date() },
    create: { organizationId, snapshot: result as object },
  });

  return result;
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
  const date = today();
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
        date,
        type: input.type,
        organizationId,
      },
    },
    update: { content: data.briefing as object, generatedAt: new Date() },
    create: {
      date,
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

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  meetLink?: string;
  status: string;
  recurring?: boolean;
}

export interface CalendarSlot {
  date: string;
  start: string;
  end: string;
  durationHours: number;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  slots: CalendarSlot[];
}

export interface MeetingPrepResult {
  summary: string;
  keyPoints: string[];
  attendeeContext: string;
  suggestedAgenda: string[];
}

export const getCalendar = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getCalendarSchema>
): Promise<CalendarResponse> => {
  const token = await requireGoogleToken(userId);
  const { data } = await aiService.post<{
    events: Array<Record<string, unknown>>;
    free_slots: Array<Record<string, unknown>>;
  }>("/ai/vega/calendar-summary", {
    user_id: userId,
    organization_id: organizationId,
    days_ahead: input.daysAhead,
    metadata: { google_access_token: token },
  });

  const events: CalendarEvent[] = (data.events ?? []).map((e) => ({
    id: String(e.id ?? ""),
    title: String(e.title ?? ""),
    description: String(e.description ?? ""),
    start: String(e.start ?? ""),
    end: String(e.end ?? ""),
    attendees: Array.isArray(e.attendees) ? e.attendees.map(String) : [],
    location: String(e.location ?? ""),
    meetLink: e.meet_link ? String(e.meet_link) : undefined,
    status: String(e.status ?? ""),
    recurring: e.recurring != null ? Boolean(e.recurring) : undefined,
  }));

  const slots: CalendarSlot[] = (data.free_slots ?? []).map((s) => ({
    date: String(s.date ?? ""),
    start: String(s.start ?? ""),
    end: String(s.end ?? ""),
    durationHours: Number(s.duration_hours ?? 0),
  }));

  return { events, slots };
};

export const createCalendarEventWorkspace = async (
  userId: string,
  _organizationId: string,
  input: z.infer<typeof createCalendarEventSchema>
): Promise<CalendarEvent> => {
  const token = await requireGoogleToken(userId);
  const result = await createGoogleCalendarEvent({
    accessToken: token,
    title: input.title,
    start: input.start,
    end: input.end,
    attendees: input.attendees,
    description: input.description,
    addGoogleMeet: input.addGoogleMeet,
  });

  const meetLink =
    result.hangoutLink ??
    result.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

  return {
    id: result.id ?? "",
    title: input.title,
    description: input.description ?? "",
    start: input.start,
    end: input.end,
    attendees: input.attendees ?? [],
    location: meetLink ? "Google Meet" : "",
    meetLink,
    status: "confirmed",
  };
};

export const getMeetingPrepWorkspace = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getMeetingPrepSchema>
): Promise<MeetingPrepResult> => {
  let token = "";
  try {
    token = await requireGoogleToken(userId);
  } catch {
    // token is optional for meeting prep — AI service degrades gracefully without it
  }
  const { data } = await aiService.post<{ prep: Record<string, unknown> }>(
    "/ai/vega/meeting-prep",
    {
      user_id: userId,
      organization_id: organizationId,
      event_title: input.eventTitle,
      attendee_emails: input.attendeeEmails,
      description: input.description,
      metadata: { google_access_token: token },
    }
  );

  const prep = data.prep ?? {};
  return {
    summary: String(prep.summary ?? ""),
    keyPoints: Array.isArray(prep.key_points) ? prep.key_points.map(String) : [],
    attendeeContext: String(prep.attendee_context ?? ""),
    suggestedAgenda: Array.isArray(prep.suggested_agenda)
      ? prep.suggested_agenda.map(String)
      : [],
  };
};

// ─── Post-meeting follow-up ────────────────────────────────────────────────────

export interface PostMeetingFollowUp {
  followUp: { to: string; subject: string; body: string };
  actionItems: string[];
}

export const getPostMeetingFollowUp = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof postMeetingFollowUpSchema>
): Promise<PostMeetingFollowUp> => {
  let token = "";
  try {
    token = await requireGoogleToken(userId);
  } catch {
    // token is optional for follow-up generation
  }
  const { data } = await aiService.post<{
    follow_up: Record<string, unknown>;
    action_items: string[];
  }>("/ai/vega/post-meeting-followup", {
    user_id: userId,
    organization_id: organizationId,
    event_title: input.eventTitle,
    attendee_emails: input.attendeeEmails,
    description: input.description,
    notes: input.notes,
    metadata: { google_access_token: token },
  });

  const fu = data.follow_up ?? {};
  return {
    followUp: {
      to: String(fu.to ?? ""),
      subject: String(fu.subject ?? ""),
      body: String(fu.body ?? ""),
    },
    actionItems: Array.isArray(data.action_items)
      ? data.action_items.map(String)
      : [],
  };
};

export const sendFollowUpEmail = async (
  userId: string,
  input: z.infer<typeof sendFollowUpEmailSchema>
): Promise<{ messageId: string }> => {
  const token = await requireGoogleToken(userId);
  // Fresh email (not a reply to an existing thread)
  const sent = await sendGmailReply({
    accessToken: token,
    to: input.to,
    subject: input.subject,
    body: input.body,
    replyToMessageId: null,
    replyToThreadId: null,
  });
  return { messageId: sent.id };
};

// ─── Auto-reschedule ──────────────────────────────────────────────────────────

export const updateCalendarEventWorkspace = async (
  userId: string,
  _organizationId: string,
  eventId: string,
  input: z.infer<typeof updateCalendarEventSchema>
): Promise<{ id: string }> => {
  const token = await requireGoogleToken(userId);
  const result = await updateGoogleCalendarEvent({
    accessToken: token,
    eventId,
    start: input.start,
    end: input.end,
  });
  return { id: result.id };
};

export interface RescheduleDraft {
  email: { to: string; subject: string; body: string };
}

export const getRescheduleDraft = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof rescheduleDraftSchema>
): Promise<RescheduleDraft> => {
  let token = "";
  try {
    token = await requireGoogleToken(userId);
  } catch {
    // token is optional
  }
  const { data } = await aiService.post<{ email: Record<string, unknown> }>(
    "/ai/vega/reschedule-draft",
    {
      user_id: userId,
      organization_id: organizationId,
      event_title: input.eventTitle,
      attendee_emails: input.attendeeEmails,
      original_start: input.originalStart,
      new_start: input.newStart,
      new_end: input.newEnd,
      metadata: { google_access_token: token },
    }
  );
  const em = data.email ?? {};
  return {
    email: {
      to: String(em.to ?? ""),
      subject: String(em.subject ?? ""),
      body: String(em.body ?? ""),
    },
  };
};

// ─── Bulk Inbox Actions ────────────────────────────────────────────────────────

export const bulkInboxAction = async (
  userId: string,
  input: z.infer<typeof bulkInboxActionSchema>
): Promise<{ succeeded: number; failed: number }> => {
  const token = await requireGoogleToken(userId);

  const results = await Promise.allSettled(
    input.emailIds.map(async (emailId) => {
      if (input.action === "ignore") {
        // Mark as read (remove UNREAD) and archive (remove INBOX)
        await modifyMessageLabels({
          accessToken: token,
          messageId: emailId,
          removeLabelIds: ["INBOX", "UNREAD"],
        });
      } else {
        // snooze: add a "Vega/Snoozed" label so it's visually distinguishable
        await labelMessage({
          accessToken: token,
          messageId: emailId,
          labelName: "Vega/Snoozed",
        });
        // Also remove from INBOX so it disappears from the inbox view
        await modifyMessageLabels({
          accessToken: token,
          messageId: emailId,
          removeLabelIds: ["INBOX"],
        });
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { succeeded, failed };
};

// ─── Labels ───────────────────────────────────────────────────────────────────

const DEFAULT_LABEL_NAMES = [
  "Investors",
  "Sales Leads",
  "Newsletters",
  "Team",
  "Legal",
  "Finance",
  "Other",
];

export const getLabels = async (organizationId: string): Promise<VegaLabelRecord[]> => {
  const count = await prisma.vegaLabel.count({ where: { organizationId } });
  if (count === 0) {
    await prisma.vegaLabel.createMany({
      data: DEFAULT_LABEL_NAMES.map((name) => ({ name, organizationId })),
      skipDuplicates: true,
    });
  }
  const rows = await prisma.vegaLabel.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    autoReply: r.autoReply,
    organizationId: r.organizationId,
    createdAt: r.createdAt.toISOString(),
  }));
};

export const createLabel = async (
  organizationId: string,
  input: z.infer<typeof createLabelSchema>
): Promise<VegaLabelRecord> => {
  const existing = await prisma.vegaLabel.findFirst({
    where: { name: input.name, organizationId },
  });
  if (existing) throw new BadRequestError("A label with this name already exists");
  const row = await prisma.vegaLabel.create({
    data: { name: input.name, color: input.color ?? "#999999", organizationId },
  });
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    autoReply: row.autoReply,
    organizationId: row.organizationId,
    createdAt: row.createdAt.toISOString(),
  };
};

export const deleteLabel = async (
  organizationId: string,
  labelId: string
): Promise<void> => {
  const existing = await prisma.vegaLabel.findFirst({
    where: { id: labelId, organizationId },
  });
  if (!existing) throw new BadRequestError("Label not found");
  await prisma.vegaLabel.delete({ where: { id: labelId } });
};

export const updateLabel = async (
  organizationId: string,
  labelId: string,
  input: z.infer<typeof updateLabelSchema>
): Promise<VegaLabelRecord> => {
  const existing = await prisma.vegaLabel.findFirst({
    where: { id: labelId, organizationId },
  });
  if (!existing) throw new BadRequestError("Label not found");
  const row = await prisma.vegaLabel.update({
    where: { id: labelId },
    data: {
      ...(input.autoReply !== undefined ? { autoReply: input.autoReply } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  });
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    autoReply: row.autoReply,
    organizationId: row.organizationId,
    createdAt: row.createdAt.toISOString(),
  };
};
