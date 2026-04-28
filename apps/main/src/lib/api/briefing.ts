import { apiFetch } from "./client";

export interface BriefingSection {
  agent: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface Briefing {
  id: string;
  date: string;
  overview: string;
  sections: BriefingSection[];
  generatedAt?: string;
}

export async function getBriefing(_organizationId: string): Promise<Briefing> {
  // Try to get cached morning briefing
  const cache = await apiFetch<{
    id: string;
    date: string;
    type: string;
    content: Record<string, unknown>;
    generatedAt: string;
  } | null>("/agents/vega/briefing?type=MORNING").catch(() => null);

  if (cache?.content) {
    const c = cache.content;
    return {
      id: cache.id,
      date: cache.date,
      overview: (c.overview as string) ?? "No overview available.",
      sections: (c.sections as BriefingSection[]) ?? [],
      generatedAt: cache.generatedAt,
    };
  }

  // No cache — generate fresh
  const fresh = await apiFetch<{
    id: string;
    date: string;
    type: string;
    content: Record<string, unknown>;
    generatedAt: string;
  }>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type: "MORNING" },
  });

  const c = fresh.content;
  return {
    id: fresh.id,
    date: fresh.date,
    overview: (c.overview as string) ?? "Briefing generated.",
    sections: (c.sections as BriefingSection[]) ?? [],
    generatedAt: fresh.generatedAt,
  };
}

export async function generateBriefing(type: "MORNING" | "EVENING" | "WEEKLY" = "MORNING"): Promise<Briefing> {
  const fresh = await apiFetch<{
    id: string;
    date: string;
    type: string;
    content: Record<string, unknown>;
    generatedAt: string;
  }>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type },
  });
  const c = fresh.content;
  return {
    id: fresh.id,
    date: fresh.date,
    overview: (c.overview as string) ?? "",
    sections: (c.sections as BriefingSection[]) ?? [],
    generatedAt: fresh.generatedAt,
  };
}
