import { Agent } from "../../../prisma/generated/prisma/client.js";

/**
 * Plays: named, repeatable jobs that run on a schedule and end by proposing
 * something. The unit customers actually think in — nobody wants "an agent with
 * Gmail and Calendar access", they want their Monday morning handled.
 *
 * Definitions live here rather than in the database on purpose. A play's prompt
 * and the integrations it leans on are product decisions that get revised as we
 * learn what works; keeping them in code means revising one means editing this
 * file, not migrating every org's rows. The database holds only what is genuinely
 * per-org: whether it runs, when, and whose identity it runs under.
 *
 * `requires` is a hard gate, not a hint. A play whose integrations aren't all
 * connected is shown as unavailable rather than run half-blind — a briefing that
 * silently omits the calendar because Calendar wasn't connected is worse than no
 * briefing, because the customer cannot tell it is incomplete.
 */
export interface PlayDefinition {
  /** Stable id, stored on the org's row. */
  id: string;
  /** What the customer calls it. */
  name: string;
  /** One line on what they get, in outcome terms. */
  description: string;
  /** Agent that runs it. */
  agent: Agent;
  /** Catalog slugs that must all be connected for this to be available. */
  requires: string[];
  /** Default cron expression, copied to the org's row when they switch it on. */
  schedule: string;
  /** Plain-language rendering of `schedule`, for the UI. */
  scheduleLabel: string;
  /** The instruction handed to the agent on each run. */
  prompt: string;
}

export const PLAY_DEFINITIONS: PlayDefinition[] = [
  {
    id: "monday-briefing",
    name: "Monday briefing",
    description:
      "A single note every Monday: what's on this week, what's still unanswered, what needs deciding.",
    agent: Agent.VEGA,
    requires: ["gmail", "google-calendar"],
    schedule: "0 8 * * 1",
    scheduleLabel: "Mondays at 8am",
    prompt:
      "Write this week's briefing. Cover: what is on the calendar this week and " +
      "which of it needs preparation; emails from the last seven days that are " +
      "still unanswered; and anything that looks like it needs a decision. Be " +
      "specific and short — this is read before coffee. Do not send anything.",
  },
  {
    id: "inbox-triage",
    name: "Daily inbox triage",
    description:
      "Every morning, the overnight email sorted into what needs you and what doesn't.",
    agent: Agent.VEGA,
    requires: ["gmail"],
    schedule: "0 9 * * 1-5",
    scheduleLabel: "Weekday mornings at 9am",
    prompt:
      "Go through the email that arrived since yesterday morning. Sort it into " +
      "what genuinely needs the owner, what can be answered with a short reply, " +
      "and what is noise. For the middle group, draft the replies and propose " +
      "them. Do not send anything without approval.",
  },
  {
    id: "week-in-review",
    name: "Friday wrap-up",
    description:
      "What actually happened this week across your tools, and what slipped.",
    agent: Agent.VEGA,
    requires: ["gmail", "google-calendar"],
    schedule: "0 16 * * 5",
    scheduleLabel: "Fridays at 4pm",
    prompt:
      "Summarise the week: meetings that happened, commitments made in email, " +
      "and anything promised that has not been delivered. End with what is " +
      "carrying into next week. Do not send anything.",
  },
  {
    id: "search-performance",
    name: "Weekly search check",
    description:
      "Which pages moved in Google this week, and which ones quietly dropped.",
    agent: Agent.SAGE,
    requires: ["google-search-console"],
    schedule: "0 10 * * 1",
    scheduleLabel: "Mondays at 10am",
    prompt:
      "Compare this week's search performance with the previous week. Call out " +
      "pages that gained or lost meaningfully, and say what you would do about " +
      "the losses. Ignore noise — only report changes that matter.",
  },
  {
    id: "content-plan",
    name: "Weekly content plan",
    description: "Next week's posts drafted and ready for you to approve.",
    agent: Agent.MAYA,
    requires: ["instagram"],
    schedule: "0 11 * * 5",
    scheduleLabel: "Fridays at 11am",
    prompt:
      "Plan next week's social content. Propose specific posts with captions, " +
      "informed by what performed well recently. Do not publish anything — " +
      "these are for review.",
  },
];

export const findPlayDefinition = (id: string): PlayDefinition | undefined =>
  PLAY_DEFINITIONS.find((p) => p.id === id);
