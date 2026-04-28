import { z } from "zod";
import {
  sendMessageSchema,
  processInboxSchema,
  draftReplySchema,
  calendarSummarySchema,
  createEventSchema,
  executiveBriefingSchema,
  composeEmailSchema,
} from "./vega.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ProcessInboxInput = z.infer<typeof processInboxSchema>;
export type DraftReplyInput = z.infer<typeof draftReplySchema>;
export type CalendarSummaryInput = z.infer<typeof calendarSummarySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type ExecutiveBriefingInput = z.infer<typeof executiveBriefingSchema>;
export type ComposeEmailInput = z.infer<typeof composeEmailSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url: string };
  tokens_used?: number;
  model_used?: string;
  metadata?: Record<string, unknown> & { node_actions?: NodeAction[] };
}

export type NodeAction =
  | {
      node_action: "label_messages";
      messages: Array<{ email_id: string; label: string }>;
    }
  | {
      node_action: "create_gmail_draft";
      to: string;
      subject: string;
      body: string;
      reply_to_message_id?: string | null;
      reply_to_thread_id?: string | null;
    }
  | {
      node_action: "create_calendar_event";
      title: string;
      start: string;
      end: string;
      attendees?: string[];
      description?: string;
      add_google_meet?: boolean;
    };

export interface ProcessedEmail {
  email_id: string;
  subject: string;
  from_name: string;
  from_email?: string;
  priority: string;
  summary: string;
  suggested_action: string;
  label_applied?: string | null;
  draft_created?: boolean;
  draft_id?: string | null;
  hidden_tasks?: string[];
  suggested_reply?: string | null;
  meeting_request?: Record<string, string> | null;
}

export interface InboxStats {
  total_processed: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
  drafts_created: number;
  labels_applied: number;
}

export interface ProcessInboxResponse {
  processed: ProcessedEmail[];
  stats: InboxStats;
  node_actions?: NodeAction[];
}

export interface DraftReplyResponse {
  draft: {
    to: string;
    subject: string;
    body: string;
    draft_id?: string;
    saved?: boolean;
  };
  suggested_follow_up: string;
  node_actions?: NodeAction[];
}

export interface CalendarSummaryResponse {
  events: Array<Record<string, unknown>>;
  conflicts: Array<Record<string, unknown>>;
  free_slots: Array<Record<string, unknown>>;
  daily_summary: Record<string, unknown>;
}

export interface CreateEventResponse {
  event: Record<string, unknown>;
  conflicts: Array<Record<string, unknown>>;
  google_event_id?: string;
  created: boolean;
  node_actions?: NodeAction[];
}

export interface ExecutiveBriefingResponse {
  briefing: Record<string, unknown>;
}

export interface ComposeEmailResponse {
  draft: { to: string; subject: string; body: string; draft_id?: string };
  node_actions?: NodeAction[];
}

export type UICategory = "reply_now" | "action_needed" | "fyi" | "can_ignore";

export interface TriagedEmail {
  emailId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  priority: string;
  uiCategory: UICategory;
  summary: string;
  suggestedAction: string;
  hiddenTasks: string[];
  suggestedReply: string | null;
  meetingRequest: { date?: string; time?: string; topic?: string } | null;
  isVIP: boolean;
  receivedAt?: string | null;
  threadId?: string | null;
}

export interface WorkspaceInboxResponse {
  emails: TriagedEmail[];
  stats: InboxStats;
}

export interface SendReplyInput {
  threadId?: string | null;
  to: string;
  subject: string;
  body: string;
}

export interface VegaFollowUpRecord {
  id: string;
  emailId: string;
  emailSubject: string;
  senderEmail: string;
  dueAt: string;
  draftText: string;
  status: "PENDING" | "SENT" | "CANCELLED" | "OVERDUE";
  createdAt: string;
}

export interface BriefingCacheEntry {
  id: string;
  date: string;
  type: "MORNING" | "EVENING" | "WEEKLY";
  content: Record<string, unknown>;
  generatedAt: string;
}
