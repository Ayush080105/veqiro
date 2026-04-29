import { apiFetch } from "./client";

export interface TriagedEmail {
  emailId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  priority: string;
  uiCategory: "reply_now" | "action_needed" | "fyi" | "can_ignore";
  summary: string;
  suggestedAction: string;
  hiddenTasks: string[];
  suggestedReply: string | null;
  meetingRequest: { date?: string; time?: string; topic?: string } | null;
  isVIP: boolean;
  receivedAt: string | null;
  threadId: string | null;
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

export async function fetchInbox(maxEmails = 20): Promise<InboxResponse> {
  return apiFetch<InboxResponse>(`/agents/vega/inbox?maxEmails=${maxEmails}`);
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

// NOTE: follow-up creation is in vega-followups.ts — do NOT add it here.
