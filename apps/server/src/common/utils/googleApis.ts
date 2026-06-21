// Minimal Gmail + Google Calendar client — used to execute Vega's node_actions.

type GmailHeader = { name?: string; value?: string };
type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart & { headers?: GmailHeader[] };
};

const decodeBase64Url = (value: string): string =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

const getHeader = (headers: GmailHeader[] | undefined, name: string): string => {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
};

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const findBodyPart = (
  part: GmailMessagePart | undefined,
  mimeType: "text/plain" | "text/html"
): string | null => {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = findBodyPart(child, mimeType);
    if (found) return found;
  }
  return null;
};

const parseAddress = (value: string): { name: string; email: string } => {
  const match = value.match(/^(?:"?([^"<]*)"?\s)?<([^>]+)>$/);
  if (!match) return { name: value, email: value };
  const email = match[2]?.trim() ?? value;
  return {
    name: (match[1] ?? "").trim() || email,
    email,
  };
};

export interface GmailMessageMetadata {
  id: string;
  threadId: string | null;
  snippet: string;
  receivedAt: string | null;
}

export interface GmailThreadMessage {
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

export interface GmailThreadResponse {
  threadId: string;
  messages: GmailThreadMessage[];
}

const toThreadMessage = (message: GmailMessage): GmailThreadMessage => {
  const headers = message.payload?.headers ?? [];
  const from = parseAddress(getHeader(headers, "From"));
  const htmlBody = findBodyPart(message.payload, "text/html");
  const bodyText =
    findBodyPart(message.payload, "text/plain") ||
    stripHtml(htmlBody ?? "") ||
    message.snippet ||
    "";
  return {
    id: message.id,
    threadId: message.threadId ?? null,
    fromName: from.name,
    fromEmail: from.email,
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc"),
    subject: getHeader(headers, "Subject"),
    receivedAt: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null,
    snippet: message.snippet ?? "",
    bodyText,
    bodyHtml: htmlBody,
  };
};

export const getGmailMessageMetadata = async (
  accessToken: string,
  messageId: string
): Promise<GmailMessageMetadata> => {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=metadata`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail message metadata failed (${res.status}): ${err}`);
  }
  const message = (await res.json()) as GmailMessage;
  return {
    id: message.id,
    threadId: message.threadId ?? null,
    snippet: message.snippet ?? "",
    receivedAt: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null,
  };
};

export const getGmailThread = async (
  accessToken: string,
  messageId: string
): Promise<GmailThreadResponse> => {
  const meta = await getGmailMessageMetadata(accessToken, messageId);
  const threadId = meta.threadId ?? messageId;
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail thread fetch failed (${res.status}): ${err}`);
  }
  const thread = (await res.json()) as { id: string; messages?: GmailMessage[] };
  return {
    threadId: thread.id,
    messages: (thread.messages ?? []).map(toThreadMessage),
  };
};

interface GmailDraftArgs {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string | null;
  replyToThreadId?: string | null;
  fromEmail?: string;
}

const encodeHeader = (val: string): string =>
  // RFC 2047 encode only when non-ASCII
  /[^\x20-\x7E]/.test(val)
    ? `=?UTF-8?B?${Buffer.from(val).toString("base64")}?=`
    : val;

const buildRfc822 = (args: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  inReplyTo?: string | null;
  references?: string | null;
}): string => {
  const lines = [
    `To: ${encodeHeader(args.to)}`,
    args.from ? `From: ${encodeHeader(args.from)}` : undefined,
    `Subject: ${encodeHeader(args.subject)}`,
    args.inReplyTo ? `In-Reply-To: <${args.inReplyTo}>` : undefined,
    args.references ? `References: <${args.references}>` : undefined,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    args.body,
  ].filter(Boolean);
  return lines.join("\r\n");
};

const base64url = (input: string): string =>
  Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const createGmailDraft = async (args: GmailDraftArgs) => {
  const raw = base64url(
    buildRfc822({
      to: args.to,
      subject: args.subject,
      body: args.body,
      from: args.fromEmail,
      inReplyTo: args.replyToMessageId,
      references: args.replyToMessageId,
    })
  );
  const body: Record<string, unknown> = { message: { raw } };
  if (args.replyToThreadId) {
    (body.message as Record<string, unknown>).threadId = args.replyToThreadId;
  }

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail draft create failed (${res.status}): ${err}`);
  }
  return (await res.json()) as { id: string; message: { id: string; threadId: string } };
};

interface LabelMessageArgs {
  accessToken: string;
  messageId: string;
  labelName: string;
  managedLabelNames?: string[];
  labelColor?: string;
}

// Cache label ids per access token + name to avoid re-listing for every message
const labelIdCache = new Map<string, string>();
// All known managed label IDs per token prefix, including legacy Vega/* labels.
const managedLabelIds = new Map<string, Set<string>>();

// Gmail only accepts colors from its predefined palette
const LABEL_COLOR_MAP: Record<string, { backgroundColor: string; textColor: string }> = {
  finance:     { backgroundColor: "#149e60", textColor: "#ffffff" },
  financial:   { backgroundColor: "#149e60", textColor: "#ffffff" },
  newsletter:  { backgroundColor: "#8e63ce", textColor: "#ffffff" },
  newsletters: { backgroundColor: "#8e63ce", textColor: "#ffffff" },
  snoozed:     { backgroundColor: "#4a86e8", textColor: "#ffffff" },
  urgent:      { backgroundColor: "#cc3a21", textColor: "#ffffff" },
  important:   { backgroundColor: "#fb4c2f", textColor: "#ffffff" },
  work:        { backgroundColor: "#3c78d8", textColor: "#ffffff" },
  personal:    { backgroundColor: "#16a766", textColor: "#ffffff" },
  social:      { backgroundColor: "#e07798", textColor: "#ffffff" },
  promotions:  { backgroundColor: "#eaa041", textColor: "#ffffff" },
  updates:     { backgroundColor: "#6d9eeb", textColor: "#ffffff" },
  other:       { backgroundColor: "#666666", textColor: "#ffffff" },
};

const COLOR_PALETTE = [
  { backgroundColor: "#4a86e8", textColor: "#ffffff" },
  { backgroundColor: "#16a766", textColor: "#ffffff" },
  { backgroundColor: "#a479e2", textColor: "#ffffff" },
  { backgroundColor: "#fb4c2f", textColor: "#ffffff" },
  { backgroundColor: "#eaa041", textColor: "#ffffff" },
  { backgroundColor: "#43d692", textColor: "#222222" },
  { backgroundColor: "#e07798", textColor: "#ffffff" },
  { backgroundColor: "#3c78d8", textColor: "#ffffff" },
];

function getLabelColor(labelName: string, preferredColor?: string) {
  if (preferredColor) {
    const normalized = preferredColor.toLowerCase();
    const accepted = [...Object.values(LABEL_COLOR_MAP), ...COLOR_PALETTE].find(
      (color) => color.backgroundColor === normalized
    );
    if (accepted) return accepted;
  }
  const lower = labelName.toLowerCase().replace(/^vega\//, "");
  for (const [key, color] of Object.entries(LABEL_COLOR_MAP)) {
    if (lower.includes(key)) return color;
  }
  let hash = 0;
  for (const char of lower) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

const getOrCreateLabel = async (
  accessToken: string,
  labelName: string,
  opts: { managedLabelNames?: string[]; labelColor?: string } = {}
): Promise<string> => {
  const tokenPrefix = accessToken.slice(0, 12);
  const key = `${tokenPrefix}:${labelName}`;
  const cached = labelIdCache.get(key);
  if (cached && (!opts.managedLabelNames?.length || managedLabelIds.has(tokenPrefix))) {
    return cached;
  }
  const managedNames = new Set(
    (opts.managedLabelNames?.length ? opts.managedLabelNames : [labelName]).map((name) =>
      name.toLowerCase()
    )
  );

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.ok) {
    const data = (await listRes.json()) as {
      labels?: Array<{ id: string; name: string; color?: { backgroundColor?: string } }>;
    };
    if (!managedLabelIds.has(tokenPrefix)) managedLabelIds.set(tokenPrefix, new Set());
    for (const l of data.labels ?? []) {
      const lowerName = l.name.toLowerCase();
      const legacyName = lowerName.startsWith("vega/") ? lowerName.slice(5) : "";
      if (managedNames.has(lowerName) || (legacyName && managedNames.has(legacyName))) {
        managedLabelIds.get(tokenPrefix)!.add(l.id);
      }
    }

    const found = data.labels?.find(
      (l) => l.name.toLowerCase() === labelName.toLowerCase()
    );
    if (found) {
      labelIdCache.set(key, found.id);
      // Patch color if the label has no color set yet
      if (!found.color?.backgroundColor) {
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${found.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ color: getLabelColor(labelName, opts.labelColor) }),
        }).catch(() => {});
      }
      return found.id;
    }
  }

  const createRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color: getLabelColor(labelName, opts.labelColor),
      }),
    }
  );
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Gmail label create failed (${createRes.status}): ${err}`);
  }
  const label = (await createRes.json()) as { id: string };
  labelIdCache.set(key, label.id);
  if (!managedLabelIds.has(tokenPrefix)) managedLabelIds.set(tokenPrefix, new Set());
  managedLabelIds.get(tokenPrefix)!.add(label.id);
  return label.id;
};

export const labelMessage = async ({
  accessToken,
  messageId,
  labelName,
  managedLabelNames,
  labelColor,
}: LabelMessageArgs) => {
  if (!messageId) return;

  const attempt = async () => {
    const labelId = await getOrCreateLabel(accessToken, labelName, {
      managedLabelNames,
      labelColor,
    });
    // Remove other managed labels so each email has one current Vega classification.
    const tokenPrefix = accessToken.slice(0, 12);
    const removeLabelIds = [...(managedLabelIds.get(tokenPrefix) ?? [])].filter(
      (id) => id !== labelId
    );
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addLabelIds: [labelId], removeLabelIds }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      // Stale cached label ID — clear cache so next attempt re-fetches/re-creates
      if (res.status === 400 && errText.includes("labelId not found")) {
        const tokenPrefix = accessToken.slice(0, 12);
        labelIdCache.delete(`${tokenPrefix}:${labelName}`);
        managedLabelIds.delete(tokenPrefix);
        throw Object.assign(new Error("stale-label-id"), { stale: true });
      }
      throw new Error(`Gmail label-message failed (${res.status}): ${errText}`);
    }
  };

  try {
    await attempt();
  } catch (err) {
    // Retry once after clearing the stale cache entry
    if (err instanceof Error && (err as Error & { stale?: boolean }).stale) {
      await attempt();
    } else {
      throw err;
    }
  }
};

interface CalendarEventArgs {
  accessToken: string;
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  addGoogleMeet?: boolean;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  eventType?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  location?: string;
  status?: string;
  recurringEventId?: string;
  recurrence?: string[];
  htmlLink?: string;
  hangoutLink?: string;
  colorId?: string;
  conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
  workingLocationProperties?: unknown;
}

const DISPLAY_CALENDAR_EVENT_TYPES = ["default", "birthday", "fromGmail"] as const;

export const isDisplayableCalendarEvent = (event: GoogleCalendarEvent): boolean =>
  event.eventType !== "workingLocation";

export const listCalendarEvents = async (args: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}): Promise<GoogleCalendarEvent[]> => {
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  );
  url.searchParams.set("timeMin", args.timeMin);
  url.searchParams.set("timeMax", args.timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", "2500");
  for (const eventType of DISPLAY_CALENDAR_EVENT_TYPES) {
    url.searchParams.append("eventTypes", eventType);
  }
  if (args.timeZone) url.searchParams.set("timeZone", args.timeZone);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar event list failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { items?: GoogleCalendarEvent[] };
  return data.items ?? [];
};

export const createCalendarEvent = async (args: CalendarEventArgs) => {
  const body: Record<string, unknown> = {
    summary: args.title,
    description: args.description,
    start: { dateTime: args.start },
    end: { dateTime: args.end },
    attendees: (args.attendees ?? []).map((email) => ({ email })),
  };
  if (args.addGoogleMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  );
  if (args.addGoogleMeet) url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar event create failed (${res.status}): ${err}`);
  }
  return (await res.json()) as {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ uri: string; entryPointType: string }> };
  };
};

interface SendGmailReplyArgs {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string | null;
  replyToThreadId?: string | null;
}

export const sendGmailReply = async (args: SendGmailReplyArgs) => {
  const raw = base64url(
    buildRfc822({
      to: args.to,
      subject: args.subject.startsWith("Re:") ? args.subject : `Re: ${args.subject}`,
      body: args.body,
      inReplyTo: args.replyToMessageId,
      references: args.replyToMessageId,
    })
  );
  const payload: Record<string, unknown> = { raw };
  if (args.replyToThreadId) {
    (payload as Record<string, unknown>).threadId = args.replyToThreadId;
  }

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${err}`);
  }
  return (await res.json()) as { id: string; threadId: string; labelIds: string[] };
};

interface UpdateCalendarEventArgs {
  accessToken: string;
  eventId: string;
  start: string;
  end: string;
}

interface ModifyMessageLabelsArgs {
  accessToken: string;
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export const modifyMessageLabels = async ({
  accessToken,
  messageId,
  addLabelIds = [],
  removeLabelIds = [],
}: ModifyMessageLabelsArgs): Promise<void> => {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail modify-message failed (${res.status}): ${err}`);
  }
};

export const updateCalendarEvent = async (args: UpdateCalendarEventArgs) => {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(args.eventId)}`
  );
  url.searchParams.set("sendUpdates", "all");

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: { dateTime: args.start },
      end: { dateTime: args.end },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar event update failed (${res.status}): ${err}`);
  }
  return (await res.json()) as { id: string; htmlLink?: string };
};
