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
    description:
      "Next week's posts and reels planned out, each with the reason it's there.",
    agent: Agent.MAYA,
    requires: ["instagram"],
    schedule: "0 11 * * 5",
    scheduleLabel: "Fridays at 11am",
    // A plan, not the content. Generating a week of images and video up front
    // would burn real money on work that gets edited or dropped at review — and
    // the useful output of planning is the reasoning, which is what makes the
    // plan arguable instead of a list of guesses.
    //
    // The reasoning is also the easy thing to fake: asked for a rationale, a
    // model will write "this is trending" having checked nothing. Hence the
    // explicit instruction to name the source and to admit when there isn't
    // one — an honest "no signal, this is a gap-filler" is more useful than a
    // confident invention, because the owner can tell the two apart.
    prompt: [
      "Plan next week's social content. This is a plan, not the content — do not",
      "generate images or video, and do not publish anything.",
      "",
      "Propose roughly 5-7 items across the week. Mix the formats: static posts",
      "and short video/reels both, and say why each item is that format rather",
      "than the other.",
      "",
      "Every item must carry a reason, and the reason must come from something",
      "you actually checked this run. Good reasons look like: a specific recent",
      "post of ours that outperformed and what it had in common; a real trend or",
      "conversation you found; a date or event next week worth posting around.",
      "Name the source — which post, which trend, which date.",
      "",
      "If you cannot find a real signal for an item, say so plainly: call it a",
      "gap-filler and explain what it is for. Never invent traction, trends or",
      "news to justify a slot. An honest 'no strong signal here' is more useful",
      "than a confident guess, because it tells the owner where to weigh in.",
      "",
      "For each item give: the format, the hook or angle, roughly what the",
      "caption should say, the day to post it, and the reason.",
    ].join("\n"),
  },
];

export const findPlayDefinition = (id: string): PlayDefinition | undefined =>
  PLAY_DEFINITIONS.find((p) => p.id === id);
