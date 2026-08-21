import { Agent } from "../../../prisma/generated/prisma/client.js";

/**
 * Curated inbound triggers. Composio exposes dozens per toolkit in its own
 * vocabulary
 * (GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_SYNC_TRIGGER), and almost none of them
 * are things a business owner would ask for. This is the short list of events
 * that are worth waking an agent for, named the way the customer would say it.
 *
 * Every `triggerSlug` here was read from Composio's live triggers.listTypes()
 * for the toolkit, not guessed — the slugs are inconsistent between toolkits
 * (GMAIL_NEW_GMAIL_MESSAGE has no _TRIGGER suffix; SLACK_RECEIVE_MESSAGE and
 * SLACK_CHANNEL_MESSAGE_RECEIVED are separate events) and a wrong slug fails
 * only at subscribe time, against the customer's account.
 *
 * Toolkits with no triggers at all, verified live: instagram, google_analytics,
 * google_search_console, tavily, razorpay, calendly, reddit, googlemeet. Do not
 * add entries for them expecting silence to mean "not yet configured".
 */
export interface TriggerDefinition {
  /** Stable id used in the API and stored on the subscription row. */
  id: string;
  /** Catalog slug of the integration that must be connected. */
  integrationSlug: string;
  /** Composio's own trigger type slug. */
  triggerSlug: string;
  /** What the customer sees: the event, phrased as it happens to them. */
  label: string;
  /** What the agent will do about it, in one line. */
  description: string;
  /** Agent that handles the event. */
  agent: Agent;
  /**
   * The instruction handed to the agent when this fires. Written as a task,
   * not a persona — the agent already knows who it is.
   */
  prompt: string;
  /**
   * Config Composio requires to create the subscription. Empty for most;
   * Slack channel triggers need a channel id, which the customer picks.
   */
  config?: Record<string, unknown>;
}

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  {
    id: "gmail-new-email",
    integrationSlug: "gmail",
    triggerSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    label: "A new email arrives",
    description: "Vega reads it and drafts a reply for your approval.",
    agent: Agent.VEGA,
    prompt:
      "A new email just arrived. Read it and decide whether it needs a reply. " +
      "If it does, draft one and propose sending it. If it is automated, " +
      "promotional, or needs no response, do nothing and say why.",
  },
  {
    id: "gmail-email-sent",
    integrationSlug: "gmail",
    triggerSlug: "GMAIL_EMAIL_SENT_TRIGGER",
    label: "You send an email",
    description: "Vega checks whether it implies a task or a follow-up date.",
    agent: Agent.VEGA,
    prompt:
      "An email was just sent from this account. If it promises something by a " +
      "date, or implies a follow-up, propose a calendar event or reminder. " +
      "Otherwise do nothing.",
  },
  {
    id: "calendar-event-starting-soon",
    integrationSlug: "google-calendar",
    triggerSlug: "GOOGLECALENDAR_EVENT_STARTING_SOON_TRIGGER",
    label: "A meeting is about to start",
    description: "Vega gathers the context you'll need for it.",
    agent: Agent.VEGA,
    prompt:
      "A meeting starts shortly. Summarise what it is, who is attending, and " +
      "any recent email from the attendees that bears on it. Do not send " +
      "anything — this is a briefing.",
  },
  {
    id: "calendar-event-created",
    integrationSlug: "google-calendar",
    triggerSlug: "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_CREATED_TRIGGER",
    label: "Someone books time with you",
    description: "Vega checks it for conflicts and missing details.",
    agent: Agent.VEGA,
    prompt:
      "A new event was added to the calendar. Check it against the rest of the " +
      "day for conflicts, travel time, and whether it is missing a location or " +
      "agenda. Propose a fix only if something is actually wrong.",
  },
  {
    id: "slack-direct-message",
    integrationSlug: "slack",
    triggerSlug: "SLACK_DIRECT_MESSAGE_RECEIVED",
    label: "Someone DMs you on Slack",
    description: "Vega drafts a reply for your approval.",
    agent: Agent.VEGA,
    prompt:
      "A direct message arrived on Slack. If it asks something you can answer " +
      "from the connected tools, draft a reply and propose sending it. If it " +
      "needs the owner personally, do nothing.",
  },
  {
    id: "zoom-recording-ready",
    integrationSlug: "zoom",
    triggerSlug: "ZOOM_NEW_CLOUD_RECORDING_TRIGGER",
    label: "A call recording is ready",
    description: "Scout summarises the call and pulls out the action items.",
    agent: Agent.SCOUT,
    prompt:
      "A Zoom recording just finished processing. Summarise the call and list " +
      "the action items and who owns each. Do not send the summary anywhere " +
      "unless there is an obvious recipient — propose it for review.",
  },
  {
    id: "sheets-new-rows",
    integrationSlug: "google-sheets",
    triggerSlug: "GOOGLESHEETS_NEW_ROWS_TRIGGER",
    label: "New rows land in a sheet",
    description: "Rex checks them for anything that looks wrong.",
    agent: Agent.REX,
    prompt:
      "New rows were added to a tracked spreadsheet. Check them for obvious " +
      "problems — missing fields, impossible values, duplicates of existing " +
      "rows. Report only what is actually wrong.",
  },
];

export const findTriggerDefinition = (id: string): TriggerDefinition | undefined =>
  TRIGGER_DEFINITIONS.find((t) => t.id === id);

/**
 * Turns a provider's own trigger name into something readable.
 * "New Gmail Message Received Trigger" -> "New Gmail message received".
 * Composio's names are close to presentable already; this trims the noise they
 * all share rather than trying to rewrite them.
 */
export const humanizeTriggerName = (name: string, slug: string): string => {
  const base = (name || slug.replace(/_/g, " ")).trim();
  const trimmed = base.replace(/\s*trigger$/i, "").trim();
  if (!trimmed) return base;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * The instruction for a trigger with no curated entry.
 *
 * Deliberately conservative. A curated prompt knows what the event means and
 * what a good response looks like; this one knows neither, so it asks the agent
 * to judge whether anything is warranted and to do nothing when it isn't.
 * Erring toward silence is right for a run nobody is watching — the cost of a
 * missed nicety is far below the cost of an unwanted action proposed at 3am.
 */
export const genericTriggerPrompt = (label: string, integrationSlug: string): string =>
  [
    `An event just happened in ${integrationSlug}: ${label}.`,
    "",
    "Look at what changed and decide whether it genuinely needs anything from",
    "you. If it does, do the useful thing and propose any action for approval.",
    "If it is routine, automated, or needs no response, do nothing and say in",
    "one line why not.",
    "",
    "Do not send, post or change anything without approval.",
  ].join("\n");

export const findTriggerDefinitionBySlug = (
  triggerSlug: string,
): TriggerDefinition | undefined =>
  TRIGGER_DEFINITIONS.find((t) => t.triggerSlug === triggerSlug);
