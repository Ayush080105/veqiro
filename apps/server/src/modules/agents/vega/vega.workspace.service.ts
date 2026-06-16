import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { randomUUID } from "crypto";
import {
  getGoogleAccessToken,
  GoogleNotConnectedError,
} from "../../../common/utils/googleAuth.js";
import { findMessagesInWindow } from "../../dashboard/dashboard.repository.js";
import {
  sendGmailReply,
  createCalendarEvent as createGoogleCalendarEvent,
  updateCalendarEvent as updateGoogleCalendarEvent,
  listCalendarEvents,
  labelMessage,
  modifyMessageLabels,
  getGmailMessageMetadata,
  getGmailThread,
  isDisplayableCalendarEvent,
  type GoogleCalendarEvent,
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
  EmailThreadResponse,
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
    const cached = await prisma.vegaInboxSnapshot.findUnique({
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
  const labelDefinitions = getLabelDefinitions(orgLabels);

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
      label_definitions: labelDefinitions,
      metadata: { google_access_token: token },
    }
  );

  const metadataEntries = await Promise.all(
    (data.processed ?? []).map(async (email) => {
      try {
        const metadata = await getGmailMessageMetadata(token, email.email_id);
        return [email.email_id, metadata] as const;
      } catch {
        return null;
      }
    })
  );
  const metadataById = new Map(
    metadataEntries.filter(
      (entry): entry is Exclude<(typeof metadataEntries)[number], null> => Boolean(entry)
    )
  );

  const emails: TriagedEmail[] = (data.processed ?? []).map((e) => {
    const metadata = metadataById.get(e.email_id);
    return {
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
      receivedAt: metadata?.receivedAt ?? null,
      threadId: metadata?.threadId ?? null,
      snippet: metadata?.snippet ?? "",
    };
  });

  // Sort: reply_now first, then action_needed, fyi, can_ignore; VIPs to top of each group
  const categoryOrder: UICategory[] = ["reply_now", "action_needed", "fyi", "can_ignore"];
  emails.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.uiCategory) - categoryOrder.indexOf(b.uiCategory);
    if (catDiff !== 0) return catDiff;
    return a.isVIP === b.isVIP ? 0 : a.isVIP ? -1 : 1;
  });

  const result: WorkspaceInboxResponse = { emails, stats: data.stats };

  // Upsert cache
  await prisma.vegaInboxSnapshot.upsert({
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

export const getEmailThread = async (
  userId: string,
  _organizationId: string,
  emailId: string
): Promise<EmailThreadResponse> => {
  const token = await requireGoogleToken(userId);
  return getGmailThread(token, emailId);
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

const AGENT_SLUG: Record<string, string> = {
  MAYA: "maya", REX: "rex", SCOUT: "scout", SAGE: "sage", LEX: "lex", VEGA: "vega",
};

export const generateAndCacheBriefing = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof generateBriefingSchema>
): Promise<BriefingCacheEntry> => {
  const date = today();
  const token = await requireGoogleToken(userId);
  const labels = await getLabels(organizationId);

  // Run executive briefing and today's agent messages in parallel
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data }, messages] = await Promise.all([
    aiService.post<ExecutiveBriefingResponse>("/ai/vega/executive-briefing", {
      user_id: userId,
      organization_id: organizationId,
      include_email: input.includeEmail,
      include_calendar: input.includeCalendar,
      label_definitions: getLabelDefinitions(labels),
      metadata: { google_access_token: token },
    }),
    findMessagesInWindow(organizationId, todayStart, new Date()),
  ]);

  // Group messages by agent slug
  const conversations: Record<string, Array<{ role: string; content: string }>> = {};
  for (const msg of messages) {
    const slug = AGENT_SLUG[msg.agent] ?? msg.agent.toLowerCase();
    if (!conversations[slug]) conversations[slug] = [];
    conversations[slug].push({ role: msg.role, content: msg.content });
  }

  // Get per-agent activity summaries if any agent was used today
  let agentSummaries: Record<string, unknown> = {};
  if (Object.values(conversations).some((c) => c.length > 0)) {
    try {
      const { data: daily } = await aiService.post<{
        agents_breakdown: Record<string, unknown>;
      }>("/ai/briefing", { user_id: userId, date, conversations });
      agentSummaries = daily.agents_breakdown ?? {};
    } catch (err) {
      console.error("[briefing] agent summary failed:", err);
    }
  }

  const combinedContent = { ...data.briefing, agent_summaries: agentSummaries };

  const record = await prisma.vegaBriefingCache.upsert({
    where: {
      date_type_organizationId: {
        date,
        type: input.type,
        organizationId,
      },
    },
    update: { content: combinedContent as object, generatedAt: new Date() },
    create: {
      date,
      type: input.type,
      content: combinedContent as object,
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
  allDay?: boolean;
  attendees: string[];
  location: string;
  meetLink?: string;
  htmlLink?: string;
  status: string;
  recurring?: boolean;
  organizer?: string;
  colorId?: string;
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

const calendarCache = new Map<string, { data: CalendarResponse; cachedAt: number }>();
const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

const invalidateCalendarCache = (organizationId: string, userId?: string) => {
  const prefix = userId ? `${organizationId}:${userId}:` : `${organizationId}:`;
  for (const key of calendarCache.keys()) {
    if (key.startsWith(prefix)) calendarCache.delete(key);
  }
};

const getCalendarRange = (input: z.infer<typeof getCalendarSchema>) => {
  if (input.timeMin && input.timeMax) {
    return { timeMin: input.timeMin, timeMax: input.timeMax };
  }
  const now = new Date();
  const max = new Date(now);
  max.setDate(max.getDate() + (input.daysAhead ?? 7));
  return { timeMin: now.toISOString(), timeMax: max.toISOString() };
};

const getMeetLink = (event: GoogleCalendarEvent): string | undefined =>
  event.hangoutLink ??
  event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")
    ?.uri;

const normalizeCalendarEvent = (event: GoogleCalendarEvent): CalendarEvent | null => {
  const start = event.start?.dateTime ?? event.start?.date ?? "";
  const end = event.end?.dateTime ?? event.end?.date ?? "";
  if (!event.id || !start || !end) return null;
  return {
    id: event.id,
    title: event.summary?.trim() || "(No title)",
    description: event.description ?? "",
    start,
    end,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    attendees: (event.attendees ?? [])
      .map((attendee) => attendee.email)
      .filter((email): email is string => Boolean(email)),
    location: event.location ?? "",
    meetLink: getMeetLink(event),
    htmlLink: event.htmlLink,
    status: event.status ?? "confirmed",
    recurring: Boolean(event.recurringEventId || event.recurrence?.length),
    organizer: event.organizer?.email,
    colorId: event.colorId,
  };
};

export const getCalendar = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getCalendarSchema>
): Promise<CalendarResponse> => {
  const range = getCalendarRange(input);
  const cacheKey = `${organizationId}:${userId}:${range.timeMin}:${range.timeMax}:${input.timeZone ?? ""}`;
  const cached = calendarCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CALENDAR_CACHE_TTL_MS) {
    return cached.data;
  }

  const token = await requireGoogleToken(userId);
  const rawEvents = await listCalendarEvents({
    accessToken: token,
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    timeZone: input.timeZone,
  });

  const events = rawEvents
    .filter(isDisplayableCalendarEvent)
    .map(normalizeCalendarEvent)
    .filter((event): event is CalendarEvent => Boolean(event));
  const result = { events, slots: [] };
  calendarCache.set(cacheKey, { data: result, cachedAt: Date.now() });
  return result;
};

export const createCalendarEventWorkspace = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof createCalendarEventSchema>
): Promise<CalendarEvent> => {
  // Invalidate calendar cache so the new event appears immediately
  invalidateCalendarCache(organizationId, userId);
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
  organizationId: string,
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
  invalidateCalendarCache(organizationId, userId);
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
        // snooze: add a managed "Snoozed" label so it's visually distinguishable
        await labelMessage({
          accessToken: token,
          messageId: emailId,
          labelName: "Snoozed",
          managedLabelNames: ["Snoozed"],
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

const DEFAULT_LABELS: Array<{ name: string; color: string; rationale: string }> = [
  {
    name: "Investors",
    color: "#8A8AF0",
    rationale:
      "Investor, fundraising, diligence, metrics, deck, term sheet, VC, angel, shareholder, or board-related communication.",
  },
  {
    name: "Sales Leads",
    color: "#1DBC87",
    rationale:
      "Prospects, demos, pricing, trials, purchasing intent, inbound leads, customer evaluation, or sales follow-up.",
  },
  {
    name: "Newsletters",
    color: "#6FCDE8",
    rationale:
      "Subscriptions, digests, marketing newsletters, product updates, event roundups, or automated broadcasts with no direct action required.",
  },
  {
    name: "Team",
    color: "#F5C518",
    rationale:
      "Internal teammates, collaborators, hiring, operations, project coordination, status updates, or work planning.",
  },
  {
    name: "Legal",
    color: "#B3B3F7",
    rationale:
      "Contracts, compliance, terms, privacy, legal notices, signatures, policies, or regulatory matters.",
  },
  {
    name: "Finance",
    color: "#149E60",
    rationale:
      "Invoices, receipts, payments, accounting, payroll, banking, expenses, taxes, or financial operations.",
  },
  {
    name: "Other",
    color: "#999999",
    rationale: "Use only when the email does not clearly match another configured label.",
  },
];

type VegaLabelRow = {
  id: string;
  name: string;
  color: string;
  rationale: string;
  autoReply: boolean;
  organizationId: string;
  createdAt: Date;
};

const toLabelRecord = (row: VegaLabelRow): VegaLabelRecord => ({
  id: row.id,
  name: row.name,
  color: row.color,
  rationale: row.rationale,
  autoReply: row.autoReply,
  organizationId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
});

const invalidateInboxSnapshot = (organizationId: string) =>
  prisma.vegaInboxSnapshot.delete({ where: { organizationId } }).catch(() => {});

export const getLabelDefinitions = (labels: VegaLabelRecord[]) =>
  labels.map((label) => ({
    name: label.name,
    rationale: label.rationale || "No rationale provided.",
  }));

export const getLabels = async (organizationId: string): Promise<VegaLabelRecord[]> => {
  const count = await prisma.vegaLabel.count({ where: { organizationId } });
  if (count === 0) {
    for (const label of DEFAULT_LABELS) {
      await prisma.$executeRaw`
        INSERT INTO "vega_label" ("id", "name", "color", "rationale", "organizationId")
        VALUES (${randomUUID()}, ${label.name}, ${label.color}, ${label.rationale}, ${organizationId})
        ON CONFLICT ("name", "organizationId") DO NOTHING
      `;
    }
  } else {
    for (const label of DEFAULT_LABELS) {
      await prisma.$executeRaw`
        UPDATE "vega_label"
        SET
          "color" = CASE WHEN "color" = '#999999' THEN ${label.color} ELSE "color" END,
          "rationale" = CASE WHEN "rationale" = '' THEN ${label.rationale} ELSE "rationale" END
        WHERE "organizationId" = ${organizationId} AND "name" = ${label.name}
      `;
    }
  }
  const rows = await prisma.$queryRaw<VegaLabelRow[]>`
    SELECT "id", "name", "color", "rationale", "autoReply", "organizationId", "createdAt"
    FROM "vega_label"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" ASC
  `;
  return rows.map(toLabelRecord);
};

export const createLabel = async (
  organizationId: string,
  input: z.infer<typeof createLabelSchema>
): Promise<VegaLabelRecord> => {
  const existing = await prisma.vegaLabel.findFirst({
    where: { name: input.name, organizationId },
  });
  if (existing) throw new BadRequestError("A label with this name already exists");
  const rows = await prisma.$queryRaw<VegaLabelRow[]>`
    INSERT INTO "vega_label" ("id", "name", "color", "rationale", "organizationId")
    VALUES (${randomUUID()}, ${input.name}, ${input.color ?? "#999999"}, ${input.rationale ?? ""}, ${organizationId})
    RETURNING "id", "name", "color", "rationale", "autoReply", "organizationId", "createdAt"
  `;
  await invalidateInboxSnapshot(organizationId);
  return toLabelRecord(rows[0]!);
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
  await invalidateInboxSnapshot(organizationId);
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
  const autoReply = input.autoReply ?? null;
  const color = input.color ?? null;
  const rationale = input.rationale ?? null;
  const rows = await prisma.$queryRaw<VegaLabelRow[]>`
    UPDATE "vega_label"
    SET
      "autoReply" = COALESCE(${autoReply}, "autoReply"),
      "color" = COALESCE(${color}, "color"),
      "rationale" = COALESCE(${rationale}, "rationale")
    WHERE "id" = ${labelId} AND "organizationId" = ${organizationId}
    RETURNING "id", "name", "color", "rationale", "autoReply", "organizationId", "createdAt"
  `;
  await invalidateInboxSnapshot(organizationId);
  return toLabelRecord(rows[0]!);
};
