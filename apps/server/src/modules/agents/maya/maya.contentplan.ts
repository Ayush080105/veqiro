import { Agent, Prisma } from "../../../../prisma/generated/prisma/client.js";
import { prisma } from "../../../config/prisma.js";
import { callAgentWithContext, agentRoles } from "../../../common/utils/contextService.js";

/**
 * Maya's weekly content plan.
 *
 * A plan is an artifact, not a chat message: you come back to it, work through
 * it across a week, and act on individual items. So it is generated as
 * structured data, stored, and rendered in its own tab.
 *
 * The reasoning attached to each item is the point of the whole thing — and the
 * easy thing for a model to fake. Asked to justify a slot it will write "this is
 * trending" having checked nothing, which is worse than no reason because it
 * looks like evidence. Hence the explicit permission to return a gap-filler with
 * no signal: a real run against a live account produced exactly that honesty,
 * reporting "4 likes vs 3" and adding that reach data was unavailable so the
 * numbers were directional only.
 */

export type ContentFormat = "post" | "reel";

export interface ContentPlanItem {
  /** ISO date for the day this should go out. */
  date: string;
  /** Day name, as the model phrased it. */
  day: string;
  format: ContentFormat;
  /** The angle in one line. */
  hook: string;
  /** What the caption should convey — direction, not a finished caption. */
  captionDirection: string;
  /** Why this slot exists, naming what it was based on. */
  reason: string;
  /** True when the model found no real signal and said so. */
  isGapFiller: boolean;
  /** Why this format rather than the other. */
  formatReason?: string;
}

export type SignalKind = "own_post" | "event" | "trend" | "editorial";

/**
 * One thing the plan was based on, in a shape a chart can use. The prose `note`
 * holds the same findings as a paragraph nobody can scan; this is that
 * paragraph taken apart. Numbers are only ever ones the model read from a tool
 * result this run — null otherwise — so a bar on the chart is always a real
 * measurement.
 */
export interface PlanSignal {
  kind: SignalKind;
  /** Short title, e.g. "Dadar exhibition Reel". */
  label: string;
  /** One sentence on what it shows. */
  detail: string;
  /** For own_post signals: which format the post was. */
  format: ContentFormat | null;
  likes: number | null;
  comments: number | null;
  /** Where it was read, e.g. "Instagram insights". */
  source: string | null;
}

export interface ContentPlan {
  id: string;
  weekStart: string;
  note: string | null;
  items: ContentPlanItem[] | null;
  /** The week's strategy in one sentence. Null on plans made before this existed. */
  headline: string | null;
  /** Null on plans made before this existed; the UI falls back to `note`. */
  signals: PlanSignal[] | null;
  /** Plain limits on the data, one per entry. */
  limits: string[] | null;
  rawText: string;
  createdAt: string;
}

/** Monday of the week following `from`. */
const nextMonday = (from: Date): Date => {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  // getUTCDay: 0 = Sunday. Days until the next Monday, never 0 — a plan
  // generated on a Monday is for the week ahead, not the one underway.
  const daysAhead = ((8 - d.getUTCDay()) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d;
};

const buildPrompt = (weekStart: Date): string => {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return [
    `Plan social content for the week of ${fmt(weekStart)} to ${fmt(weekEnd)}.`,
    "",
    "This is a plan, not the content. Do not generate images or video, and do",
    "not publish anything.",
    "",
    "Propose 5-7 items across the week, mixing static posts and short video",
    "reels. Every item must carry a reason drawn from something you actually",
    "checked this run: a specific recent post of ours that outperformed and what",
    "it had in common, a real trend or conversation you found, or a date or event",
    "that week worth posting around. Name the source.",
    "",
    "If you cannot find a real signal for an item, set isGapFiller to true and",
    "say plainly in the reason what the slot is for. Never invent traction,",
    "trends or news to justify a slot — an honest gap tells the owner where to",
    "weigh in, an invented trend quietly misleads them.",
    "",
    "Also break down the evidence so it can be charted. Every entry in `signals`",
    "must be something you actually read this run. Give likes and comments ONLY",
    "when you read those exact numbers from a tool result; otherwise use null.",
    "Never estimate or round a number into existence. Use at most 8 signals and 4",
    "limits.",
    "",
    "Reply with ONLY a JSON object, no prose around it, in this exact shape:",
    "{",
    '  "headline": "the week\'s strategy in one sentence, 140 characters at most",',
    '  "note": "what signal you found, including any limits on the data",',
    '  "signals": [',
    "    {",
    '      "kind": "own_post" | "event" | "trend" | "editorial",',
    '      "label": "short title",',
    '      "detail": "one sentence on what it shows",',
    '      "format": "post" | "reel" | null,',
    '      "likes": 83 | null,',
    '      "comments": 6 | null,',
    '      "source": "where you read it"',
    "    }",
    "  ],",
    '  "limits": ["one plain limit on the data, e.g. reach was not available"],',
    '  "items": [',
    "    {",
    '      "date": "YYYY-MM-DD",',
    '      "day": "Monday",',
    '      "format": "post" | "reel",',
    '      "hook": "the angle in one line",',
    '      "captionDirection": "what the caption should convey",',
    '      "formatReason": "why this format rather than the other",',
    '      "reason": "why this slot exists, naming the source",',
    '      "isGapFiller": false',
    "    }",
    "  ]",
    "}",
  ].join("\n");
};

/**
 * Pulls the JSON object out of a model response. Models wrap JSON in prose or
 * fences no matter how firmly asked not to, and losing an entire week's plan to
 * a stray "Here you go:" would be absurd.
 */
const extractJson = (text: string): unknown | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // Try the next candidate rather than giving up on the whole plan.
    }
  }
  return null;
};

const asFormat = (value: unknown): ContentFormat =>
  String(value).toLowerCase().includes("reel") ? "reel" : "post";

const parseItems = (parsed: unknown): { note: string | null; items: ContentPlanItem[] | null } => {
  if (!parsed || typeof parsed !== "object") return { note: null, items: null };
  const obj = parsed as Record<string, unknown>;
  const rawItems = obj.items;
  if (!Array.isArray(rawItems)) return { note: null, items: null };

  const items = rawItems
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      date: String(r.date ?? ""),
      day: String(r.day ?? ""),
      format: asFormat(r.format),
      hook: String(r.hook ?? ""),
      captionDirection: String(r.captionDirection ?? ""),
      reason: String(r.reason ?? ""),
      // Fail toward honesty: an item whose flag is missing or malformed is
      // shown as a normal item only if it actually claims a reason.
      isGapFiller: r.isGapFiller === true || !String(r.reason ?? "").trim(),
      formatReason: r.formatReason ? String(r.formatReason) : undefined,
    }));

  return {
    note: typeof obj.note === "string" ? obj.note : null,
    items: items.length > 0 ? items : null,
  };
};

const SIGNAL_KINDS: SignalKind[] = ["own_post", "event", "trend", "editorial"];

const cleanText = (value: unknown, max: number): string | null => {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** A count the model read, or null. Anything that is not a plain non-negative number is dropped. */
const cleanCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

/**
 * The structured evidence, read back out of the stored model response. Lenient
 * by design: a malformed entry is skipped rather than costing the plan its
 * calendar, and a plan made before signals existed simply yields nulls.
 */
export const parseExtras = (
  parsed: unknown,
): { headline: string | null; signals: PlanSignal[] | null; limits: string[] | null } => {
  if (!parsed || typeof parsed !== "object") return { headline: null, signals: null, limits: null };
  const obj = parsed as Record<string, unknown>;

  const signals = Array.isArray(obj.signals)
    ? obj.signals
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
        .flatMap((r): PlanSignal[] => {
          const label = cleanText(r.label, 90);
          if (!label) return [];
          const kind = SIGNAL_KINDS.includes(r.kind as SignalKind) ? (r.kind as SignalKind) : "trend";
          return [
            {
              kind,
              label,
              detail: cleanText(r.detail, 280) ?? "",
              format: r.format == null ? null : asFormat(r.format),
              likes: cleanCount(r.likes),
              comments: cleanCount(r.comments),
              source: cleanText(r.source, 80),
            },
          ];
        })
        .slice(0, 8)
    : [];

  const limits = Array.isArray(obj.limits)
    ? obj.limits.flatMap((l) => cleanText(l, 200) ?? []).slice(0, 4)
    : [];

  return {
    headline: cleanText(obj.headline, 160),
    signals: signals.length > 0 ? signals : null,
    limits: limits.length > 0 ? limits : null,
  };
};

const toContentPlan = (row: {
  id: string;
  weekStart: Date;
  note: string | null;
  items: unknown;
  rawText: string;
  createdAt: Date;
}): ContentPlan => ({
  id: row.id,
  weekStart: row.weekStart.toISOString(),
  note: row.note,
  items: (row.items as ContentPlanItem[] | null) ?? null,
  ...parseExtras(extractJson(row.rawText)),
  rawText: row.rawText,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Generates and stores a plan. Shared by the "Generate" button and the weekly
 * play, so both produce the same artifact rather than the schedule quietly
 * doing something different from the button.
 */
export const generateContentPlan = async (
  organizationId: string,
  userId: string,
  opts: { skipIfExists?: boolean } = {},
): Promise<ContentPlan> => {
  const weekStart = nextMonday(new Date());

  // The scheduled run passes this: if someone already planned the week by
  // hand, Friday should leave it alone rather than spend credits producing a
  // second plan for days that are already accounted for. The manual path never
  // sets it, so an explicit regeneration stays possible.
  if (opts.skipIfExists) {
    const existing = await prisma.mayaContentPlan.findFirst({
      where: { organizationId, weekStart },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return toContentPlan(existing);
  }

  const response = await callAgentWithContext<{ response: string }>({
    agentApiPath: "/ai/maya/chat",
    agentEnum: Agent.MAYA,
    agentRole: agentRoles[Agent.MAYA],
    userId,
    organizationId,
    conversationId: `content-plan-${weekStart.toISOString().slice(0, 10)}`,
    userMessage: buildPrompt(weekStart),
    rawHistory: [],
    // Not a conversation — a week of planning JSON in long-term memory would
    // crowd out what the owner actually said to Maya.
    skipMemory: true,
    // Maya generates an image automatically whenever the model calls
    // draft_content / generate_variants / generate_ideas — it is post-
    // processing, not a tool choice, so the prompt's "do not generate images"
    // could not stop it. Planning calls generate_ideas, so every plan was
    // quietly producing an image and charging credits for it.
    extraPayload: { _skip_auto_image: true },
  });

  const rawText = response.response ?? "";
  const { note, items } = parseItems(extractJson(rawText));

  const row = await prisma.mayaContentPlan.create({
    data: {
      organizationId,
      userId,
      weekStart,
      note,
      items: (items ?? undefined) as Prisma.InputJsonValue | undefined,
      rawText,
    },
  });
  return toContentPlan(row);
};

/** Most recent plans, newest first. */
export const listContentPlans = async (
  organizationId: string,
  limit = 5,
): Promise<ContentPlan[]> => {
  const rows = await prisma.mayaContentPlan.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toContentPlan);
};
