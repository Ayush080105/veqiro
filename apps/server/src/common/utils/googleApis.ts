// Minimal Gmail + Google Calendar client — used to execute Vega's node_actions.

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
}

// Cache label ids per access token + name to avoid re-listing for every message
const labelIdCache = new Map<string, string>();

const getOrCreateLabel = async (
  accessToken: string,
  labelName: string
): Promise<string> => {
  const key = `${accessToken.slice(0, 12)}:${labelName}`;
  const cached = labelIdCache.get(key);
  if (cached) return cached;

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.ok) {
    const data = (await listRes.json()) as {
      labels?: Array<{ id: string; name: string }>;
    };
    const found = data.labels?.find(
      (l) => l.name.toLowerCase() === labelName.toLowerCase()
    );
    if (found) {
      labelIdCache.set(key, found.id);
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
      }),
    }
  );
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Gmail label create failed (${createRes.status}): ${err}`);
  }
  const label = (await createRes.json()) as { id: string };
  labelIdCache.set(key, label.id);
  return label.id;
};

export const labelMessage = async ({
  accessToken,
  messageId,
  labelName,
}: LabelMessageArgs) => {
  if (!messageId) return;
  const labelId = await getOrCreateLabel(accessToken, labelName);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds: [labelId] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail label-message failed (${res.status}): ${err}`);
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
