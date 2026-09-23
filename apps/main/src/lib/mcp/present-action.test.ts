import assert from "node:assert/strict"
import test from "node:test"

import { presentPendingAction, stripToolkitPrefix } from "./present-action"

test("strips the toolkit prefix, including multi-word toolkits", () => {
  assert.deepEqual(stripToolkitPrefix("GMAIL_CREATE_EMAIL_DRAFT", "gmail"), ["CREATE", "EMAIL", "DRAFT"])
  assert.deepEqual(stripToolkitPrefix("GOOGLECALENDAR_CREATE_EVENT", "google-calendar"), ["CREATE", "EVENT"])
  assert.deepEqual(stripToolkitPrefix("MICROSOFT_TEAMS_SEND_MESSAGE", "microsoft-teams"), ["SEND", "MESSAGE"])
  // Nothing to strip → leave it alone.
  assert.deepEqual(stripToolkitPrefix("CREATE_THING", "gmail"), ["CREATE", "THING"])
})

test("the case from the screenshot: a Gmail draft reads as a draft, not as a function call", () => {
  const p = presentPendingAction({
    integrationSlug: "gmail",
    toolName: "GMAIL_CREATE_EMAIL_DRAFT",
    arguments: {
      recipient_email: "board@example.com",
      subject: "Runway update: 7.5 mo (amber)",
      body: "Dear Board,\n\nHere is a brief update on our cash position.",
      is_html: false,
      user_id: "me",
    },
  })
  assert.equal(p.title, "Save an email draft")
  assert.equal(p.confirmLabel, "Save draft")
  assert.equal(p.doneLabel, "Draft saved")
  assert.deepEqual(
    p.fields.map((f) => [f.label, f.value]),
    [
      ["To", "board@example.com"],
      ["Subject", "Runway update: 7.5 mo (amber)"],
      ["Message", "Dear Board,\n\nHere is a brief update on our cash position."],
    ],
  )
  assert.ok(!p.fields.some((f) => /user|html/i.test(f.key)), "plumbing must not be shown")
  assert.equal(p.fields.find((f) => f.label === "Message")?.long, true)
})

test("orders by what matters and puts the message last", () => {
  const p = presentPendingAction({
    integrationSlug: "gmail",
    toolName: "GMAIL_SEND_EMAIL",
    arguments: { body: "hi", subject: "s", recipient_email: "a@b.co", cc: ["c@d.co", "e@f.co"] },
  })
  assert.deepEqual(p.fields.map((f) => f.label), ["To", "Cc", "Subject", "Message"])
  assert.equal(p.fields[1].value, "c@d.co, e@f.co")
  assert.equal(p.title, "Send an email")
  assert.equal(p.confirmLabel, "Send email")
})

test("strips HTML from an HTML body", () => {
  const p = presentPendingAction({
    integrationSlug: "gmail",
    toolName: "GMAIL_SEND_EMAIL",
    arguments: { recipient_email: "a@b.co", body: "<p>Hello <b>team</b></p><p>Bye</p>", is_html: true },
  })
  assert.equal(p.fields.find((f) => f.label === "Message")?.value, "Hello team\nBye")
})

test("calendar events: friendly title, dates formatted, ids hidden", () => {
  const p = presentPendingAction({
    integrationSlug: "google-calendar",
    toolName: "GOOGLECALENDAR_CREATE_EVENT",
    arguments: {
      summary: "Sync with Priya",
      start_datetime: "2026-09-29T15:00:00",
      end_datetime: "2026-09-29T15:30:00",
      calendar_id: "primary",
      attendees: [{ email: "priya@example.com" }],
      create_meeting_room: true,
    },
  })
  assert.equal(p.title, "Create a calendar event")
  assert.equal(p.confirmLabel, "Create event")
  const byLabel = Object.fromEntries(p.fields.map((f) => [f.label, f.value]))
  assert.equal(byLabel["Title"], "Sync with Priya")
  assert.equal(byLabel["Guests"], "priya@example.com")
  assert.match(byLabel["Starts"], /Sep 29, 2026/)
  assert.ok(!("Calendar id" in byLabel))
})

test("an unknown tool still reads as a sentence and its arguments as labelled rows", () => {
  const p = presentPendingAction({
    integrationSlug: "hubspot",
    toolName: "HUBSPOT_CREATE_CONTACT",
    arguments: { first_name: "Ada", company_name: "Analytical Engines", contact_id: "123", empty: "", off: false },
  })
  assert.equal(p.title, "Create contact")
  assert.equal(p.confirmLabel, "Create")
  assert.deepEqual(p.fields.map((f) => f.label).sort(), ["Company name", "First name"])
})

test("native actions use their own label", () => {
  const p = presentPendingAction({
    integrationSlug: "native",
    toolName: "maya:publish-post",
    nativeLabel: "Publish to LinkedIn",
    arguments: { text: "Hello world" },
  })
  assert.equal(p.title, "Publish to LinkedIn")
  assert.equal(p.fields[0].label, "Message")
})

test("caps the rows shown and says how many were left out", () => {
  const args = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`field_${i}`, `value ${i}`]))
  const p = presentPendingAction({ integrationSlug: "x", toolName: "X_DO_THING", arguments: args })
  assert.equal(p.fields.length, 6)
  assert.equal(p.hiddenCount, 4)
})

test("garbage arguments do not throw", () => {
  for (const a of [null, undefined, "str", 5, [], [1, 2]]) {
    const p = presentPendingAction({ integrationSlug: "gmail", toolName: "GMAIL_SEND_EMAIL", arguments: a })
    assert.equal(p.fields.length, 0)
  }
})
