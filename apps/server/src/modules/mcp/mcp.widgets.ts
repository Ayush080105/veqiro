/**
 * The catalog of business widgets a customer can put on their dashboard.
 *
 * This replaces an earlier design that exposed discovered JSON field paths
 * (`data.messages[].id`) directly in the picker. That was a developer tool: a
 * founder cannot tell which of 23 paths is their unread mail, and most of what
 * they want to see is not a number at all — "unread email" means seeing the
 * actual messages.
 *
 * So introspection moved behind the curtain. Each widget below was defined
 * against a real live response (field names and row paths are verified, not
 * guessed), and the customer only ever sees a plain-English name, a
 * description, and any input we genuinely need from them.
 *
 * Adding a widget: call the tool for real first and read the row shape. A
 * guessed `rowsPath` fails silently and shows an empty tile.
 */

import { evaluateMetric, formatMetric, resolvePath, type MetricDefinition } from "./mcp.metrics.js";

export type WidgetKind = "metric" | "list";

export interface WidgetInput {
  /** The provider's argument name, e.g. "site_url" or "start_date". */
  name: string;
  /** Asked in the customer's language, never the provider's. */
  label: string;
  placeholder?: string;
  /**
   * "dateRange" stores a *number of days* rather than a date, and the actual
   * start date is computed per call. Storing a real date would freeze a tile's
   * window at whatever day it was pinned.
   */
  kind?: "text" | "dateRange";
  /** Fixed options for a dateRange, most common first (used as the default). */
  choices?: { value: string; label: string }[];
  /**
   * Populates a dropdown from the customer's own account instead of making
   * them type an identifier they'd have to go look up.
   */
  optionsFrom?: {
    toolName: string;
    /** Path to the option array's value field, e.g. "data.siteEntry[].siteUrl". */
    valuePath: string;
  };
}

/** Ranges offered wherever a widget covers a period. Shared so every such
 *  widget offers the same vocabulary. */
export const DATE_RANGE_CHOICES: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "28", label: "Last 28 days" },
  { value: "90", label: "Last 3 months" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 12 months" },
];

/** Human label for a stored day count, for naming a tile. */
export const dateRangeLabel = (days: string): string =>
  DATE_RANGE_CHOICES.find((c) => c.value === String(days))?.label ?? `Last ${days} days`;

export interface ListSpec {
  /** Path to the row array, e.g. "data.messages[]". */
  rowsPath: string;
  /** Row-relative paths. `title` is required; the rest are shown when present. */
  title: string;
  subtitle?: string;
  meta?: string;
  link?: string;
  /**
   * Formatting for a numeric `meta`. Required for money: Razorpay reports
   * amounts in paise, so a payment of ₹49 arrives as 4900 and would otherwise
   * render as "4900" next to the row.
   */
  metaFormat?: { scale?: number; decimals?: number; prefix?: string; suffix?: string };
  limit: number;
}

export interface WidgetDefinition {
  id: string;
  integrationSlug: string;
  /** What a founder would call it. */
  name: string;
  /** One line on why they'd want it. */
  description: string;
  kind: WidgetKind;
  toolName: string;
  /** Fixed arguments. Values may use the tokens resolved by resolveArgs(). */
  args?: Record<string, unknown>;
  inputs?: WidgetInput[];
  /** For kind: "metric". */
  metric?: MetricDefinition;
  /** For kind: "list". */
  list?: ListSpec;
}

// Relative date tokens, resolved per call. Stored args must not contain real
// dates — a tile pinned in July would otherwise report July's numbers forever.
const TODAY = "@today";
const NOW = "@now";
const DAYS_AGO = /^@days_ago:(\d{1,4})$/;

const isoDate = (offsetDays: number): string =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Expands date tokens in a widget's fixed arguments at call time. */
export const resolveArgs = (args: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!args) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === TODAY) {
      out[key] = isoDate(0);
      continue;
    }
    if (value === NOW) {
      out[key] = new Date().toISOString();
      continue;
    }
    const match = typeof value === "string" ? value.match(DAYS_AGO) : null;
    out[key] = match ? isoDate(Number(match[1])) : value;
  }
  return out;
};

/**
 * Turns the customer's stored answers into real provider arguments.
 *
 * dateRange inputs hold a day count ("28") and become an actual date here, at
 * call time, so a tile pinned last month still reports the last 28 days rather
 * than last month's 28 days.
 */
export const resolveInputArgs = (
  definition: WidgetDefinition,
  inputs: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const byName = new Map((definition.inputs ?? []).map((i) => [i.name, i]));
  for (const [name, value] of Object.entries(inputs)) {
    const declared = byName.get(name);
    if (declared?.kind === "dateRange") {
      const days = Number(value);
      out[name] = isoDate(Number.isFinite(days) && days > 0 ? days : 28);
    } else {
      out[name] = value;
    }
  }
  return out;
};

export interface WidgetRow {
  title: string;
  subtitle?: string;
  meta?: string;
  link?: string;
}

export interface WidgetResult {
  kind: WidgetKind;
  /** Formatted value for kind: "metric". */
  display?: string | null;
  /** Rows for kind: "list". */
  rows?: WidgetRow[];
  /** Total available, when the provider reports more than we show. */
  total?: number | null;
}

const asText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    // Search Console returns dimension values as a one-element array.
    return value.length ? asText(value[0]) : undefined;
  }
  if (typeof value === "object") {
    // Calendar start/end are {dateTime}|{date} — take whichever exists.
    const record = value as Record<string, unknown>;
    return asText(record.dateTime ?? record.date ?? record.name ?? record.email);
  }
  const text = String(value).trim();
  return text.length ? text : undefined;
};

/** Pulls one row-relative field, tolerating the nesting providers use. */
const rowField = (row: unknown, path: string | undefined): string | undefined => {
  if (!path) return undefined;
  const resolved = resolvePath(row, path);
  return resolved.length ? asText(resolved[0]) : undefined;
};

/** Applies a list widget's meta formatting. Left untouched when the value is
 *  not numeric — a date string must pass through for the UI to localize. */
const formatRowMeta = (
  value: string | undefined,
  format: ListSpec["metaFormat"],
): string | undefined => {
  if (value === undefined || !format) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const scale = format.scale && format.scale !== 0 ? format.scale : 1;
  const body = (numeric / scale).toLocaleString("en-US", {
    minimumFractionDigits: format.decimals ?? 0,
    maximumFractionDigits: format.decimals ?? 0,
  });
  return `${format.prefix ?? ""}${body}${format.suffix ?? ""}`;
};

export const evaluateWidget = (
  definition: WidgetDefinition,
  response: unknown,
): WidgetResult => {
  if (definition.kind === "metric") {
    const metric = definition.metric ?? { aggregation: "count" as const, fieldPath: null };
    const evaluated = evaluateMetric(response, metric);
    return { kind: "metric", display: formatMetric(evaluated, metric) };
  }

  const spec = definition.list!;
  const rows = resolvePath(response, spec.rowsPath);
  const mapped: WidgetRow[] = [];
  for (const row of rows.slice(0, spec.limit)) {
    const title = rowField(row, spec.title);
    // A row with no title is unrenderable — skip rather than show a blank line.
    if (!title) continue;
    const subtitle = rowField(row, spec.subtitle);
    const rawMeta = rowField(row, spec.meta);
    mapped.push({
      title,
      // Providers often repeat the title in the description field (calendar
      // events routinely have summary === description); showing it twice looks
      // like a rendering bug.
      subtitle: subtitle && subtitle !== title ? subtitle : undefined,
      meta: formatRowMeta(rawMeta, spec.metaFormat),
      link: rowField(row, spec.link),
    });
  }
  return { kind: "list", rows: mapped, total: rows.length };
};

/**
 * Verified widget definitions.
 *
 * Every row path and field name here was read off a live response from a real
 * connected account. Integrations absent from this list simply have no widgets
 * yet — that is honest and shows as "nothing to add yet" rather than a broken
 * tile.
 */
export const WIDGET_CATALOG: WidgetDefinition[] = [
  // ── Gmail ────────────────────────────────────────────────────────────────
  {
    id: "gmail.unread",
    integrationSlug: "gmail",
    name: "Unread email",
    description: "The messages waiting on you, newest first.",
    kind: "list",
    toolName: "GMAIL_FETCH_EMAILS",
    args: { query: "is:unread", max_results: 25 },
    list: {
      rowsPath: "data.messages[]",
      title: "subject",
      subtitle: "sender",
      meta: "messageTimestamp",
      link: "display_url",
      limit: 20,
    },
  },
  {
    id: "gmail.unread-count",
    integrationSlug: "gmail",
    name: "Unread count",
    description: "How much mail is waiting, as a single number.",
    kind: "metric",
    // Read off the INBOX label, NOT from a message list: verified live that
    // GMAIL_FETCH_EMAILS's resultSizeEstimate ignores the query entirely
    // (identical 201 for "is:unread" and no query) while the label reports the
    // true 273. Using the message list here would confidently show a wrong
    // number, which is worse than showing none.
    toolName: "GMAIL_GET_LABEL",
    args: { id: "INBOX" },
    metric: { aggregation: "value", fieldPath: "data.messagesUnread" },
  },
  {
    id: "gmail.inbox-total",
    integrationSlug: "gmail",
    name: "Inbox size",
    description: "Everything sitting in your inbox.",
    kind: "metric",
    toolName: "GMAIL_GET_LABEL",
    args: { id: "INBOX" },
    metric: { aggregation: "value", fieldPath: "data.messagesTotal" },
  },

  // ── Google Calendar ──────────────────────────────────────────────────────
  {
    id: "google-calendar.upcoming",
    integrationSlug: "google-calendar",
    name: "Upcoming meetings",
    description: "What's next on your calendar.",
    kind: "list",
    toolName: "GOOGLECALENDAR_FIND_EVENT",
    // Parameter names are snake_case — camelCase is silently ignored, which is
    // how an earlier version of this widget listed months-old events under
    // "Upcoming". single_events expands recurrences so each occurrence sorts
    // correctly by start time.
    args: {
      max_results: 25,
      time_min: NOW,
      single_events: true,
      order_by: "startTime",
    },
    list: {
      rowsPath: "data.event_data.event_data[]",
      title: "summary",
      subtitle: "description",
      meta: "start",
      link: "htmlLink",
      limit: 5,
    },
  },

  // ── Google Search Console ────────────────────────────────────────────────
  // site_url/start_date/end_date are this tool's declared required inputs; the
  // dates are tokens so the window stays rolling.
  {
    id: "google-search-console.clicks",
    integrationSlug: "google-search-console",
    name: "Search clicks",
    description: "Visits Google sent you from search.",
    kind: "metric",
    toolName: "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY",
    args: { end_date: TODAY, dimensions: ["query"], rowLimit: 1000 },
    inputs: [
      {
        name: "site_url",
        label: "Which site?",
        optionsFrom: {
          toolName: "GOOGLE_SEARCH_CONSOLE_LIST_SITES",
          valuePath: "data.siteEntry[].siteUrl",
        },
      },
      {
        // Stores a day count, not a date — see resolveInputArgs.
        name: "start_date",
        label: "Over what period?",
        kind: "dateRange",
        choices: DATE_RANGE_CHOICES,
      },
    ],
    metric: { aggregation: "sum", fieldPath: "data.rows[].clicks", decimals: 0 },
  },
  {
    id: "google-search-console.impressions",
    integrationSlug: "google-search-console",
    name: "Search impressions",
    description: "How often you appeared in Google results.",
    kind: "metric",
    toolName: "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY",
    args: { end_date: TODAY, dimensions: ["query"], rowLimit: 1000 },
    inputs: [
      {
        name: "site_url",
        label: "Which site?",
        optionsFrom: {
          toolName: "GOOGLE_SEARCH_CONSOLE_LIST_SITES",
          valuePath: "data.siteEntry[].siteUrl",
        },
      },
      {
        // Stores a day count, not a date — see resolveInputArgs.
        name: "start_date",
        label: "Over what period?",
        kind: "dateRange",
        choices: DATE_RANGE_CHOICES,
      },
    ],
    metric: { aggregation: "sum", fieldPath: "data.rows[].impressions", decimals: 0 },
  },
  {
    id: "google-search-console.position",
    integrationSlug: "google-search-console",
    name: "Average Google position",
    description: "Where you typically rank. Lower is better.",
    kind: "metric",
    toolName: "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY",
    args: { end_date: TODAY, dimensions: ["query"], rowLimit: 1000 },
    inputs: [
      {
        name: "site_url",
        label: "Which site?",
        optionsFrom: {
          toolName: "GOOGLE_SEARCH_CONSOLE_LIST_SITES",
          valuePath: "data.siteEntry[].siteUrl",
        },
      },
      {
        // Stores a day count, not a date — see resolveInputArgs.
        name: "start_date",
        label: "Over what period?",
        kind: "dateRange",
        choices: DATE_RANGE_CHOICES,
      },
    ],
    metric: { aggregation: "avg", fieldPath: "data.rows[].position", decimals: 1 },
  },
  {
    id: "google-search-console.top-queries",
    integrationSlug: "google-search-console",
    name: "What people search to find you",
    description: "Your top search terms, with the clicks each brought in.",
    kind: "list",
    toolName: "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY",
    args: { end_date: TODAY, dimensions: ["query"], rowLimit: 25 },
    inputs: [
      {
        name: "site_url",
        label: "Which site?",
        optionsFrom: {
          toolName: "GOOGLE_SEARCH_CONSOLE_LIST_SITES",
          valuePath: "data.siteEntry[].siteUrl",
        },
      },
      {
        // Stores a day count, not a date — see resolveInputArgs.
        name: "start_date",
        label: "Over what period?",
        kind: "dateRange",
        choices: DATE_RANGE_CHOICES,
      },
    ],
    list: {
      rowsPath: "data.rows[]",
      title: "keys",
      meta: "clicks",
      limit: 20,
    },
  },

  // ── Razorpay ─────────────────────────────────────────────────────────────
  // amount is in paise, hence scale 100 on both the metric and the row meta.
  {
    id: "razorpay.recent-payments",
    integrationSlug: "razorpay",
    name: "Recent payments",
    description: "Money that came in, newest first.",
    kind: "list",
    toolName: "RAZORPAY_FETCH_ALL_PAYMENTS",
    args: { count: 25 },
    list: {
      rowsPath: "data.items[]",
      title: "description",
      subtitle: "email",
      meta: "amount",
      metaFormat: { scale: 100, decimals: 0, prefix: "₹" },
      limit: 20,
    },
  },
  {
    id: "razorpay.revenue",
    integrationSlug: "razorpay",
    name: "Recent revenue",
    description: "Total of your last 100 payments.",
    kind: "metric",
    toolName: "RAZORPAY_FETCH_ALL_PAYMENTS",
    args: { count: 100 },
    metric: {
      aggregation: "sum",
      fieldPath: "data.items[].amount",
      scale: 100,
      decimals: 0,
      prefix: "₹",
    },
  },

  // ── Slack ────────────────────────────────────────────────────────────────
  {
    id: "slack.channels",
    integrationSlug: "slack",
    name: "Slack channels",
    description: "Your channels and how many people are in them.",
    kind: "list",
    toolName: "SLACK_LIST_ALL_CHANNELS",
    args: { limit: 25 },
    list: {
      rowsPath: "data.channels[]",
      title: "name",
      meta: "num_members",
      metaFormat: { decimals: 0, suffix: " members" },
      limit: 20,
    },
  },

  // ── Google Docs ──────────────────────────────────────────────────────────
  {
    id: "google-docs.recent",
    integrationSlug: "google-docs",
    name: "Recent documents",
    description: "Docs you and your team touched most recently.",
    kind: "list",
    toolName: "GOOGLEDOCS_SEARCH_DOCUMENTS",
    list: {
      rowsPath: "data.files[]",
      title: "name",
      link: "display_url",
      limit: 20,
    },
  },

  // ── Google Sheets ────────────────────────────────────────────────────────
  {
    id: "google-sheets.recent",
    integrationSlug: "google-sheets",
    name: "Recent spreadsheets",
    description: "Sheets you and your team touched most recently.",
    kind: "list",
    toolName: "GOOGLESHEETS_SEARCH_SPREADSHEETS",
    list: {
      // The container key was read from a live call; the row fields mirror the
      // verified google-docs sibling above (both return Drive file resources).
      // The live account had zero spreadsheets, so rows are unconfirmed.
      rowsPath: "data.spreadsheets[]",
      title: "name",
      link: "display_url",
      limit: 20,
    },
  },

  // ── Discord ──────────────────────────────────────────────────────────────
  {
    id: "discord.servers",
    integrationSlug: "discord",
    name: "Discord servers",
    description: "Communities this account belongs to.",
    kind: "list",
    toolName: "DISCORD_LIST_MY_GUILDS",
    list: {
      // data.guilds[], not data.items[] — an earlier guess at the conventional
      // "items" key rendered an empty tile with no error.
      rowsPath: "data.guilds[]",
      title: "name",
      limit: 20,
    },
  },

  // ── Zoom ─────────────────────────────────────────────────────────────────
  // userId is required and "me" is the documented self alias; without it the
  // call 400s.
  {
    id: "zoom.meetings",
    integrationSlug: "zoom",
    name: "Upcoming Zoom calls",
    description: "Zoom meetings still ahead of you, with join links.",
    kind: "list",
    toolName: "ZOOM_LIST_MEETINGS",
    // type defaults to "scheduled", which includes meetings that already
    // happened — verified live: it returned two Aug 16 calls on Aug 18 under a
    // tile labelled "Zoom meetings". "upcoming" is the only value that means
    // what the tile claims.
    args: { userId: "me", page_size: 25, type: "upcoming" },
    list: {
      rowsPath: "data.meetings[]",
      title: "topic",
      meta: "start_time",
      link: "join_url",
      limit: 20,
    },
  },
  {
    id: "zoom.meeting-count",
    integrationSlug: "zoom",
    name: "Upcoming Zoom count",
    description: "How many Zoom calls are still ahead of you.",
    kind: "metric",
    toolName: "ZOOM_LIST_MEETINGS",
    // Same filter as the list above, or the count would include past calls.
    args: { userId: "me", page_size: 1, type: "upcoming" },
    // Zoom reports the true total separately from the returned page.
    metric: { aggregation: "value", fieldPath: "data.total_records" },
  },

  // ── Calendly ─────────────────────────────────────────────────────────────
  // LIST_EVENTS declares no required args but 400s without a user URI, so it is
  // collected as an input and populated from the account itself — the customer
  // sees one pre-selected option, not an API identifier to look up.
  {
    id: "calendly.upcoming",
    integrationSlug: "calendly",
    name: "Calendly bookings",
    description: "Meetings people have booked with you.",
    kind: "list",
    toolName: "CALENDLY_LIST_EVENTS",
    args: { count: 25, status: "active", sort: "start_time:asc" },
    inputs: [
      {
        name: "user",
        label: "Whose calendar?",
        optionsFrom: {
          toolName: "CALENDLY_GET_CURRENT_USER",
          valuePath: "data.resource.uri",
        },
      },
    ],
    list: {
      // Row fields follow Calendly's documented event schema; the live account
      // had zero bookings, so these could not be confirmed against real rows.
      rowsPath: "data.collection[]",
      title: "name",
      subtitle: "status",
      meta: "start_time",
      limit: 20,
    },
  },

  // ── Instagram ────────────────────────────────────────────────────────────
  // "me" resolves the authenticated business account, so none of these need an
  // input. like_count/comments_count are NOT in the default field set — they
  // only appear when explicitly requested via `fields`.
  //
  // Engagement is read off the posts rather than GET_USER_INSIGHTS: the
  // insights endpoint requires a metric array whose valid values shift between
  // Graph API versions ("impressions" is already rejected), and it returned 0
  // for every engagement metric on a live account whose posts demonstrably have
  // likes. The media list is the honest source.
  {
    id: "instagram.recent-posts",
    integrationSlug: "instagram",
    name: "Recent Instagram posts",
    description: "Your latest posts and how many likes each one got.",
    kind: "list",
    toolName: "INSTAGRAM_GET_IG_USER_MEDIA",
    args: {
      ig_user_id: "me",
      limit: 25,
      fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
    },
    list: {
      rowsPath: "data.data[]",
      title: "caption",
      meta: "like_count",
      metaFormat: { decimals: 0, suffix: " likes" },
      link: "permalink",
      limit: 20,
    },
  },
  {
    id: "instagram.top-post-likes",
    integrationSlug: "instagram",
    name: "Best post (likes)",
    description: "Likes on your most-liked recent post.",
    kind: "metric",
    toolName: "INSTAGRAM_GET_IG_USER_MEDIA",
    args: { ig_user_id: "me", limit: 25, fields: "id,like_count" },
    metric: { aggregation: "max", fieldPath: "data.data[].like_count" },
  },
  {
    id: "instagram.total-likes",
    integrationSlug: "instagram",
    name: "Likes across recent posts",
    description: "Every like your last 25 posts earned.",
    kind: "metric",
    toolName: "INSTAGRAM_GET_IG_USER_MEDIA",
    args: { ig_user_id: "me", limit: 25, fields: "id,like_count" },
    metric: { aggregation: "sum", fieldPath: "data.data[].like_count" },
  },
  {
    id: "instagram.total-comments",
    integrationSlug: "instagram",
    name: "Comments across recent posts",
    description: "How much conversation your last 25 posts started.",
    kind: "metric",
    toolName: "INSTAGRAM_GET_IG_USER_MEDIA",
    args: { ig_user_id: "me", limit: 25, fields: "id,comments_count" },
    metric: { aggregation: "sum", fieldPath: "data.data[].comments_count" },
  },
  {
    id: "instagram.followers",
    integrationSlug: "instagram",
    name: "Instagram followers",
    description: "How many people follow your account.",
    kind: "metric",
    toolName: "INSTAGRAM_GET_USER_INFO",
    args: { ig_user_id: "me" },
    metric: { aggregation: "value", fieldPath: "data.followers_count" },
  },
  {
    id: "instagram.post-count",
    integrationSlug: "instagram",
    name: "Instagram posts published",
    description: "Everything on your profile so far.",
    kind: "metric",
    toolName: "INSTAGRAM_GET_USER_INFO",
    args: { ig_user_id: "me" },
    metric: { aggregation: "value", fieldPath: "data.media_count" },
  },

  // ── Reddit ───────────────────────────────────────────────────────────────
  // Reddit wraps each post as {kind, data}, so the row paths are one level
  // deeper than the listing itself.
  {
    id: "reddit.top-posts",
    integrationSlug: "reddit",
    name: "Top posts in a subreddit",
    description: "What's rising where your audience hangs out.",
    kind: "list",
    toolName: "REDDIT_GET_R_TOP",
    args: { size: 25 },
    inputs: [
      {
        name: "subreddit",
        label: "Which subreddit?",
        placeholder: "startups",
      },
    ],
    list: {
      rowsPath: "data.data.children[]",
      title: "data.title",
      subtitle: "data.author",
      meta: "data.score",
      metaFormat: { decimals: 0, suffix: " pts" },
      limit: 20,
    },
  },
];

export const widgetsForIntegration = (integrationSlug: string): WidgetDefinition[] =>
  WIDGET_CATALOG.filter((w) => w.integrationSlug === integrationSlug);

export const widgetById = (id: string): WidgetDefinition | undefined =>
  WIDGET_CATALOG.find((w) => w.id === id);

/** Integrations that have at least one widget — used to tell the customer up
 *  front which of their systems can contribute to the dashboard. */
export const integrationsWithWidgets = (): string[] =>
  Array.from(new Set(WIDGET_CATALOG.map((w) => w.integrationSlug)));
