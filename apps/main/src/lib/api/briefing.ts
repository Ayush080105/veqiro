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

type RawBriefingCache = {
  id: string;
  date: string;
  type: string;
  content: Record<string, unknown>;
  generatedAt: string;
};

function mapContentToBriefing(cache: RawBriefingCache): Briefing {
  const c = cache.content;

  // Build overview from the real AI keys returned by the executive-briefing endpoint
  const overviewParts: string[] = [];
  if (c.good_morning) overviewParts.push(c.good_morning as string);
  if (c.priority_score) overviewParts.push(`Priority: ${c.priority_score as string}`);
  if (c.financial_status) overviewParts.push(c.financial_status as string);
  if (c.free_time_today) overviewParts.push(`Free time: ${c.free_time_today as string}`);
  if (c.focus_recommendation) overviewParts.push(c.focus_recommendation as string);
  const overview =
    overviewParts.length > 0 ? overviewParts.join(" — ") : "No overview available.";

  // Convert each real AI key into a BriefingSection
  const sectionKeys = [
    "urgent_actions",
    "today_schedule",
    "upcoming_this_week",
    "email_summary",
  ] as const;

  const timestamp = (c.generated_at as string | undefined) ?? new Date().toISOString();

  const sections: BriefingSection[] = sectionKeys
    .filter((key) => c[key] !== undefined)
    .map((key) => ({
      agent: "vega",
      title: key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      content:
        typeof c[key] === "string"
          ? (c[key] as string)
          : JSON.stringify(c[key], null, 2),
      timestamp,
    }));

  return {
    id: cache.id,
    date: cache.date,
    overview,
    sections,
    generatedAt: cache.generatedAt,
  };
}

export async function getBriefing(_organizationId: string): Promise<Briefing> {
  // Try to get cached morning briefing
  const cache = await apiFetch<RawBriefingCache | null>(
    "/agents/vega/briefing?type=MORNING"
  ).catch(() => null);

  if (cache?.content) {
    return mapContentToBriefing(cache);
  }

  // No cache — generate fresh
  const fresh = await apiFetch<RawBriefingCache>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type: "MORNING" },
  });

  return mapContentToBriefing(fresh);
}

export async function generateBriefing(
  type: "MORNING" | "EVENING" | "WEEKLY" = "MORNING"
): Promise<Briefing> {
  const fresh = await apiFetch<RawBriefingCache>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type },
  });
  return mapContentToBriefing(fresh);
}
