import { apiFetch } from "./client";

export interface FollowUp {
  id: string;
  emailId: string;
  emailSubject: string;
  senderEmail: string;
  dueAt: string;
  draftText: string;
  status: "PENDING" | "SENT" | "CANCELLED" | "OVERDUE";
  createdAt: string;
}

export async function fetchFollowUps(): Promise<FollowUp[]> {
  return apiFetch<FollowUp[]>("/agents/vega/follow-ups");
}

export async function createFollowUp(payload: {
  emailId: string;
  emailSubject: string;
  senderEmail: string;
  dueAt: string;
  draftText: string;
}): Promise<FollowUp> {
  return apiFetch<FollowUp>("/agents/vega/follow-ups", {
    method: "POST",
    body: payload,
  });
}

export async function cancelFollowUp(followUpId: string): Promise<void> {
  return apiFetch(`/agents/vega/follow-ups/${followUpId}`, { method: "DELETE" });
}
