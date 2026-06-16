import { apiFetch } from "./client";

export interface VegaLabel {
  id: string;
  name: string;
  color: string;
  rationale: string;
  autoReply: boolean;
  organizationId: string;
  createdAt: string;
}

export function fetchLabels(): Promise<VegaLabel[]> {
  return apiFetch<VegaLabel[]>("/agents/vega/labels");
}

export function createLabel(data: {
  name: string;
  color?: string;
  rationale?: string;
}): Promise<VegaLabel> {
  return apiFetch<VegaLabel>("/agents/vega/labels", {
    method: "POST",
    body: data,
  });
}

export function deleteLabel(labelId: string): Promise<void> {
  return apiFetch(`/agents/vega/labels/${labelId}`, { method: "DELETE" });
}

export function updateLabel(
  labelId: string,
  data: { autoReply?: boolean; color?: string; rationale?: string }
): Promise<VegaLabel> {
  return apiFetch<VegaLabel>(`/agents/vega/labels/${labelId}`, {
    method: "PATCH",
    body: data,
  });
}
