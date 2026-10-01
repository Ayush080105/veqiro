/**
 * Actions that are a well-formed request to an agent's chat, not an endpoint.
 *
 * Vega's Gmail and Calendar access is Composio MCP tools inside her chat loop,
 * with writes staged for approval. A form that collected the same inputs and
 * posted them to a bespoke endpoint would be a second, unapproved path to the
 * same inbox. So these forms only assemble the sentence; the chat does the work
 * and every send/create is still confirmed by a person.
 */
export interface PromptField {
  name: string
  label: string
  kind: "text" | "textarea" | "select"
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  defaultValue?: string
}

export interface PromptActionSpec {
  fields: PromptField[]
  submitLabel: string
  build: (values: Record<string, string>) => string
}

/** The composer caps a message at this many characters. */
export const PROMPT_MAX_LENGTH = 1000

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Short and direct" },
  { value: "formal", label: "Formal" },
]

const clean = (s: string | undefined) => (s ?? "").trim()

export type PromptActionId =
  | "vega:compose-email"
  | "vega:draft-reply"
  | "vega:process-inbox"
  | "vega:calendar-summary"
  | "vega:create-event"

export const PROMPT_ACTIONS: Record<PromptActionId, PromptActionSpec> = {
  "vega:compose-email": {
    submitLabel: "Draft the email",
    fields: [
      { name: "to", label: "To", kind: "text", placeholder: "name or email address", required: true },
      { name: "subject", label: "Subject", kind: "text", placeholder: "optional" },
      {
        name: "instructions",
        label: "What should it say?",
        kind: "textarea",
        placeholder: "The point of the email, and anything it must include",
        required: true,
      },
      { name: "tone", label: "Tone", kind: "select", options: TONES, defaultValue: "professional" },
    ],
    build: (v) =>
      [
        `Compose a new email to ${clean(v.to)}.`,
        clean(v.subject) && `Subject: ${clean(v.subject)}.`,
        `What it should say: ${clean(v.instructions)}`,
        `Tone: ${v.tone || "professional"}.`,
        "Save it as a Gmail draft and show me the full text. Do not send it.",
      ]
        .filter(Boolean)
        .join("\n"),
  },

  "vega:draft-reply": {
    submitLabel: "Draft the reply",
    fields: [
      {
        name: "email",
        label: "Which email?",
        kind: "text",
        placeholder: "sender, subject, or a phrase from it",
        required: true,
      },
      {
        name: "instructions",
        label: "What should the reply say?",
        kind: "textarea",
        placeholder: "Leave blank and Vega will suggest a reply",
      },
      { name: "tone", label: "Tone", kind: "select", options: TONES, defaultValue: "professional" },
    ],
    build: (v) =>
      [
        `Find the email matching "${clean(v.email)}" in my inbox and draft a reply in my voice.`,
        clean(v.instructions) && `What to say: ${clean(v.instructions)}`,
        `Tone: ${v.tone || "professional"}.`,
        "Save it as a Gmail draft and show me the full text. Do not send it.",
      ]
        .filter(Boolean)
        .join("\n"),
  },

  "vega:process-inbox": {
    submitLabel: "Triage my inbox",
    fields: [
      {
        name: "window",
        label: "How far back?",
        kind: "select",
        defaultValue: "the last 24 hours",
        options: [
          { value: "the last 24 hours", label: "Last 24 hours" },
          { value: "the last 3 days", label: "Last 3 days" },
          { value: "the last 7 days", label: "Last 7 days" },
        ],
      },
      {
        name: "focus",
        label: "Anything to watch for?",
        kind: "text",
        placeholder: "e.g. investors, customer complaints (optional)",
      },
    ],
    build: (v) =>
      [
        `Triage my unread email from ${v.window || "the last 24 hours"}.`,
        "Group it as urgent, high, medium and low. For each email give sender, subject, a one-line summary and what you suggest I do.",
        clean(v.focus) && `Pay particular attention to: ${clean(v.focus)}.`,
        "Only read; don't label, archive, reply or send anything.",
      ]
        .filter(Boolean)
        .join("\n"),
  },

  "vega:calendar-summary": {
    submitLabel: "Summarise my calendar",
    fields: [
      {
        name: "range",
        label: "Which period?",
        kind: "select",
        defaultValue: "today",
        options: [
          { value: "today", label: "Today" },
          { value: "tomorrow", label: "Tomorrow" },
          { value: "the next 7 days", label: "Next 7 days" },
          { value: "next week", label: "Next week" },
        ],
      },
    ],
    build: (v) =>
      `Summarise my calendar for ${v.range || "today"}: list the events in order, flag any conflicts or back-to-back meetings, and point out the free slots worth protecting. Only read; don't change anything.`,
  },

  "vega:create-event": {
    submitLabel: "Schedule it",
    fields: [
      {
        name: "description",
        label: "What's the event?",
        kind: "textarea",
        placeholder: "e.g. 30 min sync with Priya next Tuesday afternoon, add a Meet link",
        required: true,
      },
    ],
    build: (v) =>
      `Create this calendar event: ${clean(v.description)}\nCheck my calendar for conflicts first and tell me if there are any. Create it only after I confirm.`,
  },
}

export function isPromptAction(id: string | null | undefined): id is PromptActionId {
  return !!id && id in PROMPT_ACTIONS
}

/** First problem with the assembled request, or null if it can be sent. */
export function validatePromptAction(
  spec: PromptActionSpec,
  values: Record<string, string>,
): string | null {
  for (const f of spec.fields) {
    if (f.required && !clean(values[f.name])) return `${f.label} is required.`
  }
  if (spec.build(values).length > PROMPT_MAX_LENGTH) {
    return "That's too long to send — shorten the details a little."
  }
  return null
}
