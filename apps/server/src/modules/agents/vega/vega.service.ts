import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
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
  const history = await vegaRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await vegaRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });

  let googleAccessToken: string | null = null;
  try {
    googleAccessToken = await getGoogleAccessToken(userId);
  } catch (err) {
    if (!(err instanceof GoogleNotConnectedError)) throw err;
  }

  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/vega/chat",
    agentEnum: Agent.VEGA,
    agentRole: "Vega: Executive assistant for email and calendar management",
    userId,
    organizationId,
    conversationId: input.conversationId ?? userMessage.id,
    userMessage: input.content,
    rawHistory: history,
    ...(googleAccessToken ? { extraPayload: { google_access_token: googleAccessToken } } : {}),
  }) as AssistantMessagePayload;
  if (!responseData) throw new BadRequestError("Failed to get response from AI");

  const nodeActions = responseData.metadata?.node_actions;
  let execResult:
    | { executed: number; errors: string[]; artifacts: Record<string, unknown> }
    | undefined;
  if (nodeActions?.length && googleAccessToken) {
    execResult = await executeNodeActions(googleAccessToken, nodeActions);
  }

  const richInput =
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result }
      : undefined;
  const customInput = richInput ?? (execResult ? { execResult } : undefined);

  const assistantMessage = await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  return {
    ...assistantMessage,
    nodeActionsExecuted: execResult?.executed ?? 0,
    nodeActionErrors: execResult?.errors ?? [],
    googleNotConnected: !googleAccessToken,
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
    customInput: { actionId: "vega:process-inbox", input },
  });

  const { data } = await aiService.post<ProcessInboxResponse>(
    "/ai/vega/process-inbox",
    {
      user_id: userId,
      organization_id: organizationId,
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

  const result = { ...data, stats, executed: exec.executed, errors: exec.errors };

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Processed ${data.stats.total_processed} emails — ${data.stats.urgent} urgent, ${data.stats.high} high (${exec.executed} node actions executed)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "vega:process-inbox", input, result },
  });

  return result;
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
    customInput: { actionId: "vega:draft-reply", input },
  });

  const { data } = await aiService.post<DraftReplyResponse>("/ai/vega/draft-reply", {
    user_id: userId,
    organization_id: organizationId,
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

  const result = {
    ...data,
    draft: { ...data.draft, draft_id: draftId, saved: Boolean(draftId) },
    draft_id: draftId,
    errors,
  };

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: draftId
      ? `Gmail draft created (id: ${draftId})`
      : `Reply drafted (not saved)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "vega:draft-reply", input, result },
  });

  return result;
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
    customInput: { actionId: "vega:calendar-summary", input },
  });

  const { data } = await aiService.post<CalendarSummaryResponse>(
    "/ai/vega/calendar-summary",
    {
      user_id: userId,
      organization_id: organizationId,
      days_ahead: input.daysAhead,
      metadata: { google_access_token: token },
    }
  );

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.events.length} events, ${data.conflicts.length} conflicts, ${data.free_slots.length} free slots`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "vega:calendar-summary", input, result: data },
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
    customInput: { actionId: "vega:create-event", input },
  });

  const { data } = await aiService.post<CreateEventResponse>("/ai/vega/create-event", {
    user_id: userId,
    organization_id: organizationId,
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

  const result = {
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

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: googleEventId
      ? `Event created (${googleEventId})${meetLink ? ` — ${meetLink}` : ""}`
      : `Event parsed (not created)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "vega:create-event", input, result },
  });

  return result;
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
    customInput: { actionId: "vega:executive-briefing", input },
  });

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

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Briefing generated",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "vega:executive-briefing", input, result: data },
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
    customInput: { actionId: "vega:compose-email", input },
  });

  const { data } = await aiService.post<ComposeEmailResponse>("/ai/vega/compose-email", {
    user_id: userId,
    organization_id: organizationId,
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

  const result = {
    ...data,
    draft: { ...data.draft, draft_id: draftId },
    draft_id: draftId,
    errors,
  };

  await vegaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: draftId
      ? `Gmail draft created (id: ${draftId})`
      : `Email drafted (not saved)`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "vega:compose-email", input, result },
  });

  return result;
};
