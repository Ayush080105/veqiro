import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
import {
  getGoogleAccessToken,
  GoogleNotConnectedError,
} from "../../../common/utils/googleAuth.js";
import {
  createCalendarEvent,
  createGmailDraft,
  labelMessage,
} from "../../../common/utils/googleApis.js";
import * as vegaRepository from "./vega.repository.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  ProcessInboxInput,
  ProcessInboxResponse,
  DraftReplyInput,
  DraftReplyResponse,
  CalendarSummaryInput,
  CalendarSummaryResponse,
  CreateEventInput,
  CreateEventResponse,
  ExecutiveBriefingInput,
  ExecutiveBriefingResponse,
  ComposeEmailInput,
  ComposeEmailResponse,
  NodeAction,
} from "./vega.types.js";

const notConnectedMessage = () =>
  "Google account not connected. Connect Gmail + Calendar in Settings → Integrations first.";

const executeNodeActions = async (
  accessToken: string,
  actions: NodeAction[] | undefined
): Promise<{ executed: number; errors: string[]; artifacts: Record<string, unknown> }> => {
  const errors: string[] = [];
  const artifacts: Record<string, unknown> = {};
  let executed = 0;
  if (!actions?.length) return { executed: 0, errors, artifacts };

  for (const action of actions) {
    try {
      if (action.node_action === "label_messages") {
        for (const m of action.messages) {
          if (!m.email_id) continue;
          await labelMessage({
            accessToken,
            messageId: m.email_id,
            labelName: m.label,
          });
        }
        executed++;
      } else if (action.node_action === "create_gmail_draft") {
        const draft = await createGmailDraft({
          accessToken,
          to: action.to,
          subject: action.subject,
          body: action.body,
          replyToMessageId: action.reply_to_message_id ?? null,
          replyToThreadId: action.reply_to_thread_id ?? null,
        });
        artifacts.draftId = draft.id;
        artifacts.messageId = draft.message?.id;
        artifacts.threadId = draft.message?.threadId;
        executed++;
      } else if (action.node_action === "create_calendar_event") {
        const event = await createCalendarEvent({
          accessToken,
          title: action.title,
          start: action.start,
          end: action.end,
          attendees: action.attendees,
          description: action.description,
          addGoogleMeet: action.add_google_meet,
        });
        artifacts.eventId = event.id;
        artifacts.htmlLink = event.htmlLink;
        artifacts.meetLink =
          event.hangoutLink ??
          event.conferenceData?.entryPoints?.find(
            (e) => e.entryPointType === "video"
          )?.uri;
        executed++;
      }
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  return { executed, errors, artifacts };
};

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const userMessage = await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const history = await vegaRepository.findRecentMessages(
    organizationId,
    SAGE_HISTORY_LIMIT
  );

  let googleAccessToken: string | null = null;
  try {
    googleAccessToken = await getGoogleAccessToken(userId);
  } catch (err) {
    if (!(err instanceof GoogleNotConnectedError)) throw err;
  }

  const { data } = await aiService.post<AssistantMessagePayload>("/ai/vega/chat", {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
    metadata: googleAccessToken ? { google_access_token: googleAccessToken } : {},
  });
  if (!data) throw new BadRequestError("Failed to get response from AI");

  const nodeActions = data.metadata?.node_actions;
  let execResult:
    | { executed: number; errors: string[]; artifacts: Record<string, unknown> }
    | undefined;
  if (nodeActions?.length && googleAccessToken) {
    execResult = await executeNodeActions(googleAccessToken, nodeActions);
  }

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.response,
    imageUrl: data.image?.url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: execResult ? { execResult } : undefined,
  });

  return {
    role: "assistant" as const,
    content: data.response,
    imageUrl: data.image?.url,
    nodeActionsExecuted: execResult?.executed ?? 0,
    nodeActionErrors: execResult?.errors ?? [],
    googleNotConnected: !googleAccessToken,
    createdAt: userMessage.createdAt,
  };
};

export const listMessages = (organizationId: string) =>
  vegaRepository.findAllVegaMessages(organizationId);

const requireGoogleToken = async (userId: string): Promise<string> => {
  try {
    return await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) {
      throw new BadRequestError(notConnectedMessage());
    }
    throw err;
  }
};

export const processInbox = async (
  userId: string,
  organizationId: string,
  input: ProcessInboxInput
): Promise<ProcessInboxResponse & { executed?: number; errors?: string[] }> => {
  const token = await requireGoogleToken(userId);
  await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Process inbox (max ${input.maxEmails} emails)`,
    customInput: { tool: "process-inbox", input },
  });

  const { data } = await aiService.post<ProcessInboxResponse>(
    "/ai/vega/process-inbox",
    {
      user_id: userId,
      max_emails: input.maxEmails,
      auto_label: input.autoLabel,
      draft_replies: input.draftReplies,
      metadata: { google_access_token: token },
    }
  );

  const exec = input.autoLabel
    ? await executeNodeActions(token, data.node_actions)
    : { executed: 0, errors: [], artifacts: {} };

  const stats = {
    ...data.stats,
    labels_applied: exec.executed > 0 ? data.stats.labels_applied : 0,
  };

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Processed ${data.stats.total_processed} emails — ${data.stats.urgent} urgent, ${data.stats.high} high (${exec.executed} node actions executed)`,
    customInput: {
      tool: "process-inbox",
      output: data,
      exec: { executed: exec.executed, errors: exec.errors },
    },
  });

  return { ...data, stats, executed: exec.executed, errors: exec.errors };
};

export const draftReply = async (
  userId: string,
  organizationId: string,
  input: DraftReplyInput
): Promise<DraftReplyResponse & { draft_id?: string; errors?: string[] }> => {
  const token = await requireGoogleToken(userId);
  await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Draft reply to ${input.emailId}`,
    customInput: { tool: "draft-reply", input },
  });

  const { data } = await aiService.post<DraftReplyResponse>("/ai/vega/draft-reply", {
    user_id: userId,
    email_id: input.emailId,
    reply_instructions: input.replyInstructions,
    tone: input.tone,
    save_as_draft: input.saveAsDraft,
    metadata: { google_access_token: token },
  });

  let draftId: string | undefined;
  let errors: string[] = [];
  if (input.saveAsDraft && data.node_actions?.length) {
    const exec = await executeNodeActions(token, data.node_actions);
    draftId = exec.artifacts.draftId as string | undefined;
    errors = exec.errors;
  }

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: draftId
      ? `Gmail draft created (id: ${draftId})`
      : `Reply drafted (not saved)`,
    customInput: {
      tool: "draft-reply",
      output: { ...data, draft_id: draftId },
      errors,
    },
  });

  return {
    ...data,
    draft: { ...data.draft, draft_id: draftId, saved: Boolean(draftId) },
    draft_id: draftId,
    errors,
  };
};

export const calendarSummary = async (
  userId: string,
  organizationId: string,
  input: CalendarSummaryInput
): Promise<CalendarSummaryResponse> => {
  const token = await requireGoogleToken(userId);
  await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Calendar summary (${input.daysAhead} days ahead)`,
    customInput: { tool: "calendar-summary", input },
  });

  const { data } = await aiService.post<CalendarSummaryResponse>(
    "/ai/vega/calendar-summary",
    {
      user_id: userId,
      days_ahead: input.daysAhead,
      metadata: { google_access_token: token },
    }
  );

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.events.length} events, ${data.conflicts.length} conflicts, ${data.free_slots.length} free slots`,
    customInput: { tool: "calendar-summary", output: data },
  });

  return data;
};

export const createEvent = async (
  userId: string,
  organizationId: string,
  input: CreateEventInput
): Promise<CreateEventResponse & { google_event_id?: string; errors?: string[] }> => {
  const token = await requireGoogleToken(userId);
  await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Create event: ${input.description.slice(0, 120)}`,
    customInput: { tool: "create-event", input },
  });

  const { data } = await aiService.post<CreateEventResponse>("/ai/vega/create-event", {
    user_id: userId,
    description: input.description,
    check_conflicts: input.checkConflicts,
    metadata: { google_access_token: token },
  });

  let googleEventId: string | undefined;
  let meetLink: string | undefined;
  let htmlLink: string | undefined;
  let errors: string[] = [];

  if (data.node_actions?.length) {
    const exec = await executeNodeActions(token, data.node_actions);
    googleEventId = exec.artifacts.eventId as string | undefined;
    meetLink = exec.artifacts.meetLink as string | undefined;
    htmlLink = exec.artifacts.htmlLink as string | undefined;
    errors = exec.errors;
  }

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: googleEventId
      ? `Event created (${googleEventId})${meetLink ? ` — ${meetLink}` : ""}`
      : `Event parsed (not created)`,
    customInput: {
      tool: "create-event",
      output: data,
      artifacts: { googleEventId, meetLink, htmlLink },
      errors,
    },
  });

  return {
    ...data,
    google_event_id: googleEventId ?? data.google_event_id,
    event: {
      ...data.event,
      google_event_id: googleEventId,
      meet_link: meetLink,
      html_link: htmlLink,
    },
    errors,
  };
};

export const executiveBriefing = async (
  userId: string,
  organizationId: string,
  input: ExecutiveBriefingInput
): Promise<ExecutiveBriefingResponse> => {
  const token = await requireGoogleToken(userId);
  await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: "Executive briefing",
    customInput: { tool: "executive-briefing", input },
  });

  const { data } = await aiService.post<ExecutiveBriefingResponse>(
    "/ai/vega/executive-briefing",
    {
      user_id: userId,
      include_email: input.includeEmail,
      include_calendar: input.includeCalendar,
      metadata: { google_access_token: token },
    }
  );

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Briefing generated",
    customInput: { tool: "executive-briefing", output: data },
  });

  return data;
};

export const composeEmail = async (
  userId: string,
  organizationId: string,
  input: ComposeEmailInput
): Promise<ComposeEmailResponse & { draft_id?: string; errors?: string[] }> => {
  const token = await requireGoogleToken(userId);
  await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Compose email to ${input.to}: ${input.subject}`,
    customInput: { tool: "compose-email", input },
  });

  const { data } = await aiService.post<ComposeEmailResponse>("/ai/vega/compose-email", {
    user_id: userId,
    to: input.to,
    subject: input.subject,
    instructions: input.instructions,
    tone: input.tone,
    include_cta: input.includeCta,
    metadata: { google_access_token: token },
  });

  let draftId: string | undefined;
  let errors: string[] = [];
  if (data.node_actions?.length) {
    const exec = await executeNodeActions(token, data.node_actions);
    draftId = exec.artifacts.draftId as string | undefined;
    errors = exec.errors;
  }

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: draftId
      ? `Gmail draft created (id: ${draftId})`
      : `Email drafted (not saved)`,
    customInput: { tool: "compose-email", output: { ...data, draft_id: draftId }, errors },
  });

  return {
    ...data,
    draft: { ...data.draft, draft_id: draftId },
    draft_id: draftId,
    errors,
  };
};
