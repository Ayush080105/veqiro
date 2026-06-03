import { apiFetch } from "./client";

export interface BriefingSection {
  agent: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface BriefingStats {
  urgentActionsCount: number;
  urgentEmails: number;
  totalUnread: number;
  freeTime: string;
  priorityScore: string;
  focusRecommendation: string;
}

export interface ScheduleItem {
  time: string
  event: string
  location?: string
  prepNeeded?: string
}

export interface AgentSummary {
  slug: string;
  active: boolean;
  messageCount: number;
  summary: string;
  actionsTaken: string[];
  keyOutputs: string[];
  followUps: string[];
}

export interface Briefing {
  id: string;
  date: string;
  overview: string;
  sections: BriefingSection[];
  generatedAt?: string;
  stats: BriefingStats;
  agentSummaries: AgentSummary[];
  scheduleItems: ScheduleItem[];
  labelCounts: Record<string, number>;
}

type RawBriefingCache = {
  id: string;
  date: string;
  type: string;
  content: Record<string, unknown>;
  generatedAt: string;
};

function countUrgentActions(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string" && raw.trim()) return raw.split("\n").filter(Boolean).length;
  return 0;
}

function countEmails(emailSummary: unknown): { urgent: number; total: number } {
  if (typeof emailSummary === "object" && emailSummary !== null) {
    const s = emailSummary as Record<string, number>;
    const urgent = s.urgent ?? 0;
    const total = urgent + (s.high ?? 0) + (s.medium ?? 0) + (s.low ?? 0);
    return { urgent, total };
  }
  return { urgent: 0, total: 0 };
}

function contentToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item, i) => {
        if (typeof item === "string") return `${i + 1}. ${item}`;
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, string>;
          if (obj.action)
            return `${i + 1}. ${obj.action}${obj.deadline ? ` (by ${obj.deadline})` : ""}`;
          if (obj.time && obj.event) return `${obj.time}: ${obj.event}`;
          return `${i + 1}. ${JSON.stringify(item)}`;
        }
        return `${i + 1}. ${String(item)}`;
      })
      .join("\n");
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  }
  return String(value ?? "");
}

function mapContentToBriefing(cache: RawBriefingCache): Briefing {
  const c = cache.content;

  const overviewParts: string[] = [];
  if (c.good_morning) overviewParts.push(c.good_morning as string);
  if (c.priority_score) overviewParts.push(`Priority: ${c.priority_score as string}`);
  if (c.focus_recommendation) overviewParts.push(c.focus_recommendation as string);
  const overview =
    overviewParts.length > 0 ? overviewParts.join(" — ") : "No overview available.";

  const emailCounts = countEmails(c.email_summary);
  const stats: BriefingStats = {
    urgentActionsCount: countUrgentActions(c.urgent_actions),
    urgentEmails: emailCounts.urgent,
    totalUnread: emailCounts.total,
    freeTime: typeof c.free_time_today === "string" ? c.free_time_today : "",
    priorityScore: typeof c.priority_score === "string" ? c.priority_score : "",
    focusRecommendation:
      typeof c.focus_recommendation === "string" ? c.focus_recommendation : "",
  };

  const sectionDefs = [
    { key: "urgent_actions", title: "Urgent Actions" },
    { key: "today_schedule", title: "Today's Schedule" },
    { key: "upcoming_this_week", title: "Upcoming This Week" },
    { key: "email_summary", title: "Email Summary" },
  ] as const;

  const timestamp = (c.generated_at as string | undefined) ?? new Date().toISOString();

  const sections: BriefingSection[] = sectionDefs
    .filter(({ key }) => c[key] !== undefined)
    .map(({ key, title }) => ({
      agent: "vega",
      title,
      content: contentToString(c[key]),
      timestamp,
    }));

  const scheduleItems: ScheduleItem[] = Array.isArray(c.today_schedule)
    ? (c.today_schedule as Array<Record<string, string>>).map((item) => ({
        time: String(item.time ?? ""),
        event: String(item.event ?? ""),
        location: item.location ? String(item.location) : undefined,
        prepNeeded: item.prep_needed ? String(item.prep_needed) : undefined,
      }))
    : [];

  const rawSummaries = (c.agent_summaries ?? {}) as Record<string, Record<string, unknown>>;
  const agentSummaries: AgentSummary[] = Object.entries(rawSummaries)
    .filter(([, v]) => v.active)
    .map(([slug, v]) => ({
      slug,
      active: Boolean(v.active),
      messageCount: Number(v.message_count ?? 0),
      summary: String(v.summary ?? ""),
      actionsTaken: Array.isArray(v.actions_taken) ? (v.actions_taken as string[]) : [],
      keyOutputs: Array.isArray(v.key_outputs) ? (v.key_outputs as string[]) : [],
      followUps: Array.isArray(v.follow_ups) ? (v.follow_ups as string[]) : [],
    }));

  const labelCounts = (c.email_by_label ?? {}) as Record<string, number>;

  return {
    id: cache.id,
    date: cache.date,
    overview,
    sections,
    generatedAt: cache.generatedAt,
    stats,
    agentSummaries,
    scheduleItems,
    labelCounts,
  };
}

/** Fetch today's cached briefing without auto-generating. Returns null if none exists. */
export async function getExistingBriefing(): Promise<Briefing | null> {
  const cache = await apiFetch<RawBriefingCache | null>(
    "/agents/vega/briefing?type=MORNING"
  ).catch(() => null);
  if (cache?.content) return mapContentToBriefing(cache);
  return null;
}

/** Generate (or regenerate) today's briefing on demand. */
export async function generateBriefing(): Promise<Briefing> {
  const fresh = await apiFetch<RawBriefingCache>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type: "MORNING" },
  });
  return mapContentToBriefing(fresh);
}
