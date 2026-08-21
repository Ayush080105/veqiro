import { describe, it, assert } from "vitest";

import {
  TRIGGER_DEFINITIONS,
  findTriggerDefinition,
  findTriggerDefinitionBySlug,
} from "./mcp.triggers.js";

/**
 * Trigger slugs read from Composio's live triggers.listTypes() for each
 * connected toolkit. A wrong slug fails only at subscribe time, against a
 * customer's account, so it is pinned here rather than trusted to review.
 *
 * The toolkits with an empty list are recorded deliberately: several
 * integrations this product already connects expose no triggers at all, and
 * without that written down the natural assumption on seeing no Instagram
 * trigger is that someone forgot to add one.
 */
const LIVE_TRIGGER_SLUGS: Record<string, string[]> = {
  gmail: ["GMAIL_NEW_GMAIL_MESSAGE", "GMAIL_EMAIL_SENT_TRIGGER"],
  googlecalendar: [
    "GOOGLECALENDAR_ATTENDEE_RESPONSE_CHANGED_TRIGGER",
    "GOOGLECALENDAR_EVENT_CANCELED_DELETED_TRIGGER",
    "GOOGLECALENDAR_EVENT_STARTING_SOON_TRIGGER",
    "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_CHANGE_TRIGGER",
    "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_CREATED_TRIGGER",
    "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_SYNC_TRIGGER",
    "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_UPDATED_TRIGGER",
  ],
  slack: [
    "SLACK_CHANNEL_CREATED",
    "SLACK_CHANNEL_MESSAGE_RECEIVED",
    "SLACK_DIRECT_MESSAGE_RECEIVED",
    "SLACK_MESSAGE_REACTION_ADDED",
    "SLACK_MESSAGE_REACTION_REMOVED",
    "SLACK_REACTION_ADDED",
    "SLACK_REACTION_REMOVED",
    "SLACK_RECEIVE_BOT_MESSAGE",
    "SLACK_RECEIVE_MESSAGE",
  ],
  zoom: [
    "ZOOM_DAILY_USAGE_REPORT_CHANGED_TRIGGER",
    "ZOOM_MEETING_DETAILS_CHANGED_TRIGGER",
    "ZOOM_MEETING_RECORDING_CHANGED_TRIGGER",
    "ZOOM_MEETING_SUMMARY_UPDATED_TRIGGER",
    "ZOOM_NEW_CLOUD_RECORDING_TRIGGER",
    "ZOOM_NEW_MEETING_CREATED_TRIGGER",
    "ZOOM_NEW_MEETING_PARTICIPANT_TRIGGER",
    "ZOOM_NEW_WEBINAR_CREATED_TRIGGER",
    "ZOOM_NEW_WEBINAR_PARTICIPANT_TRIGGER",
    "ZOOM_USER_INFORMATION_CHANGED_TRIGGER",
    "ZOOM_WEBINAR_DETAILS_CHANGED_TRIGGER",
  ],
  googlesheets: ["GOOGLESHEETS_NEW_ROWS_TRIGGER"],
  // Verified live as having no triggers whatsoever.
  instagram: [],
  google_analytics: [],
  google_search_console: [],
  tavily: [],
  razorpay: [],
  calendly: [],
  reddit: [],
  googlemeet: [],
};

/** Catalog slug -> Composio toolkit slug, where the two differ. */
const TOOLKIT_BY_INTEGRATION: Record<string, string> = {
  "google-calendar": "googlecalendar",
  "google-sheets": "googlesheets",
  "google-docs": "googledocs",
  "google-analytics-4": "google_analytics",
  "google-search-console": "google_search_console",
  "google-meet": "googlemeet",
};

describe("trigger catalog", () => {
  it("every definition uses a trigger slug Composio actually exposes", () => {
    for (const def of TRIGGER_DEFINITIONS) {
      const toolkit = TOOLKIT_BY_INTEGRATION[def.integrationSlug] ?? def.integrationSlug;
      const known = LIVE_TRIGGER_SLUGS[toolkit];
      assert.isDefined(known, `no recorded live slugs for toolkit "${toolkit}"`);
      assert.include(
        known!,
        def.triggerSlug,
        `${def.id} points at ${def.triggerSlug}, which ${toolkit} does not expose`,
      );
    }
  });

  it("has no definitions for toolkits that expose no triggers", () => {
    const empty = Object.entries(LIVE_TRIGGER_SLUGS)
      .filter(([, slugs]) => slugs.length === 0)
      .map(([toolkit]) => toolkit);
    for (const def of TRIGGER_DEFINITIONS) {
      const toolkit = TOOLKIT_BY_INTEGRATION[def.integrationSlug] ?? def.integrationSlug;
      assert.notInclude(empty, toolkit, `${def.id} targets ${toolkit}, which has no triggers`);
    }
  });

  it("ids and trigger slugs are unique", () => {
    const ids = TRIGGER_DEFINITIONS.map((d) => d.id);
    const slugs = TRIGGER_DEFINITIONS.map((d) => d.triggerSlug);
    assert.equal(new Set(ids).size, ids.length, "duplicate trigger id");
    // The subscription table is unique on (organizationId, triggerSlug), so two
    // definitions sharing a slug would make the second unsubscribable.
    assert.equal(new Set(slugs).size, slugs.length, "duplicate trigger slug");
  });

  it("every definition carries an instruction and a plain-language label", () => {
    for (const def of TRIGGER_DEFINITIONS) {
      assert.isNotEmpty(def.prompt, `${def.id} has no prompt`);
      assert.isNotEmpty(def.label, `${def.id} has no label`);
      assert.isNotEmpty(def.description, `${def.id} has no description`);
      // The label is what the customer reads on a toggle; a raw provider slug
      // leaking into it is the failure this guards.
      assert.notMatch(def.label, /_|[A-Z]{3,}/, `${def.id} label reads like a slug`);
    }
  });

  it("looks definitions up by id and by provider slug", () => {
    const first = TRIGGER_DEFINITIONS[0]!;
    assert.equal(findTriggerDefinition(first.id)?.id, first.id);
    assert.equal(findTriggerDefinitionBySlug(first.triggerSlug)?.id, first.id);
    assert.isUndefined(findTriggerDefinition("nope"));
    assert.isUndefined(findTriggerDefinitionBySlug("NOPE_TRIGGER"));
  });
});
