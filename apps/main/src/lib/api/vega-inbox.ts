import { apiFetch } from "./client";

export interface TriagedEmail {
  emailId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  priority: string;
  uiCategory: "reply_now" | "action_needed" | "fyi" | "can_ignore";
  label: string;
  summary: string;
  suggestedAction: string;
  hiddenTasks: string[];
  suggestedReply: string | null;
  meetingRequest: { date?: string; time?: string; topic?: string } | null;
  isVIP: boolean;
  receivedAt: string | null;
  threadId: string | null;
  snippet?: string;
}

export interface EmailThreadMessage {
  id: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  to: string;
  cc: string;
  subject: string;
  receivedAt: string | null;
  snippet: string;
  bodyText: string;
  bodyHtml: string | null;
}

export interface EmailThreadResponse {
  threadId: string;
  messages: EmailThreadMessage[];
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

export interface InboxResponse {
  emails: TriagedEmail[];
  stats: InboxStats;
}

export async function fetchInbox(
  maxEmails = 20,
  options?: { force?: boolean }
): Promise<InboxResponse> {
  const params = new URLSearchParams({ maxEmails: String(maxEmails) });
  if (options?.force) params.set("force", "true");
  return apiFetch<InboxResponse>(`/agents/vega/inbox?${params.toString()}`);
}

export async function sendReply(
  emailId: string,
  payload: { to: string; subject: string; body: string; threadId?: string | null }
): Promise<{ messageId: string; threadId: string }> {
  return apiFetch(`/agents/vega/inbox/${emailId}/reply`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchEmailThread(emailId: string): Promise<EmailThreadResponse> {
  return apiFetch<EmailThreadResponse>(
    `/agents/vega/inbox/${encodeURIComponent(emailId)}/thread`
  );
}

export function bulkInboxAction(payload: {
  emailIds: string[]
  action: "ignore" | "snooze"
  snoozeUntil?: string
}): Promise<{ succeeded: number; failed: number }> {
  return apiFetch<{ succeeded: number; failed: number }>("/agents/vega/inbox/bulk", {
    method: "POST",
    body: payload,
  })
}

export async function draftVegaReply(
  emailId: string,
  options?: { instructions?: string; tone?: string }
): Promise<{ body: string }> {
  const res = await apiFetch<{ draft: { body: string } }>("/agents/vega/draft-reply", {
    method: "POST",
    body: {
      emailId,
      replyInstructions:
        options?.instructions ??
        "Draft a professional contextual reply based on the email content",
      tone: options?.tone ?? "professional",
    },
  });
  return { body: res.draft.body };
}

// NOTE: follow-up creation is in vega-followups.ts — do NOT add it here.
