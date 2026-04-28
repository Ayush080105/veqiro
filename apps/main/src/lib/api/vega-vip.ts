import { apiFetch } from "./client";

export interface VIPContact {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export async function fetchVIPContacts(): Promise<VIPContact[]> {
  return apiFetch<VIPContact[]>("/agents/vega/vip-contacts");
}

export async function addVIPContact(payload: {
  email: string;
  name?: string;
}): Promise<VIPContact> {
  return apiFetch<VIPContact>("/agents/vega/vip-contacts", {
    method: "POST",
    body: payload,
  });
}

export async function removeVIPContact(contactId: string): Promise<void> {
  return apiFetch(`/agents/vega/vip-contacts/${contactId}`, { method: "DELETE" });
}
