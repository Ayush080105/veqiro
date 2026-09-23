/**
 * Turns a staged tool call into something a person can approve.
 *
 * An approval card exists so someone can look at what is about to happen and
 * say yes. Showing them `recipient_email='board@…', is_html='False',
 * user_id='me'` asks them to read our plumbing. This maps the tool call onto
 * the things they actually care about — who, what, when — and drops the rest.
 *
 * Pure and dependency-free: the card supplies the integration's display name
 * and logo, and this decides everything about wording.
 */

export interface PresentedField {
  key: string
  label: string
  value: string
  /** Long text is clamped in the card and expandable. */
  long: boolean
}

export interface PresentedAction {
  /** "Save an email draft" */
  title: string
  /** The button that approves it: "Save draft". */
  confirmLabel: string
  /** What to say once it has happened: "Draft saved". */
  doneLabel: string
  fields: PresentedField[]
  /** Details that exist but were not shown, so the card can say so. */
  hiddenCount: number
}

const MAX_FIELDS = 6
const LONG_AT = 90

/** Recognised argument names → how a person would say them, and where they sort. */
const KNOWN: Record<string, { label: string; order: number; long?: boolean }> = {
  recipient_email: { label: "To", order: 0 },
  recipient: { label: "To", order: 0 },
  recipients: { label: "To", order: 0 },
  to: { label: "To", order: 0 },
  to_email: { label: "To", order: 0 },
  cc: { label: "Cc", order: 1 },
  bcc: { label: "Bcc", order: 2 },
  channel: { label: "Channel", order: 1 },
  channel_name: { label: "Channel", order: 1 },
  subject: { label: "Subject", order: 3 },
  summary: { label: "Title", order: 3 },
  title: { label: "Title", order: 3 },
  name: { label: "Name", order: 3 },
  start_datetime: { label: "Starts", order: 4 },
  start_time: { label: "Starts", order: 4 },
  start: { label: "Starts", order: 4 },
  end_datetime: { label: "Ends", order: 5 },
  end_time: { label: "Ends", order: 5 },
  end: { label: "Ends", order: 5 },
  timezone: { label: "Time zone", order: 6 },
  attendees: { label: "Guests", order: 7 },
  location: { label: "Where", order: 8 },
  body: { label: "Message", order: 20, long: true },
  message_body: { label: "Message", order: 20, long: true },
  message: { label: "Message", order: 20, long: true },
  text: { label: "Message", order: 20, long: true },
  content: { label: "Message", order: 20, long: true },
  description: { label: "Details", order: 21, long: true },
}

/** Plumbing: real arguments, but nothing a person decides anything from. */
const HIDDEN = new Set([
  "user_id",
  "is_html",
  "thread_id",
  "message_id",
  "draft_id",
  "calendar_id",
  "send_updates",
  "conference_data_version",
  "supports_attachments",
  "sendupdates",
  "id",
])

const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const words = (snake: string) => snake.replace(/[_-]+/g, " ").trim().toLowerCase()

/** "GOOGLECALENDAR_CREATE_EVENT" for slug "google-calendar" → ["CREATE","EVENT"]. */
export function stripToolkitPrefix(toolName: string, integrationSlug: string): string[] {
  const tokens = toolName.split("_").filter(Boolean)
  const slug = integrationSlug.toLowerCase().replace(/[^a-z0-9]/g, "")
  let acc = ""
  let i = 0
  while (i < tokens.length && slug.startsWith(acc + tokens[i].toLowerCase())) {
    acc += tokens[i].toLowerCase()
    i++
    if (acc === slug) break
  }
  // Keep at least the verb: a tool called just "GMAIL" is not worth stripping.
  return i > 0 && i < tokens.length ? tokens.slice(i) : tokens
}

const TITLES: [RegExp, string, string, string][] = [
  // [matches the rest of the tool name, title, confirm, done]
  [/DRAFT/, "Save an email draft", "Save draft", "Draft saved"],
  [/^SEND_(EMAIL|MAIL)/, "Send an email", "Send email", "Email sent"],
  [/^(REPLY|FORWARD)/, "Reply to an email", "Send reply", "Reply sent"],
  [/^SEND_(MESSAGE|DIRECT|DM)|^POST_MESSAGE|^SEND_A_MESSAGE/, "Post a message", "Post it", "Posted"],
  [/^CREATE_.*EVENT|^INSERT_EVENT|^QUICK_ADD/, "Create a calendar event", "Create event", "Event created"],
  [/^(DELETE|REMOVE|CANCEL).*EVENT/, "Delete a calendar event", "Delete event", "Event deleted"],
  [/^(UPDATE|PATCH|EDIT).*EVENT/, "Change a calendar event", "Update event", "Event updated"],
]

function describeTool(tokens: string[]): Pick<PresentedAction, "title" | "confirmLabel" | "doneLabel"> {
  const rest = tokens.join("_").toUpperCase()
  for (const [re, title, confirmLabel, doneLabel] of TITLES) {
    if (re.test(rest)) return { title, confirmLabel, doneLabel }
  }
  const verb = tokens[0]?.toUpperCase() ?? ""
  const phrase = titleCase(words(tokens.join("_")) || "Run this action")
  if (/^(CREATE|ADD|NEW|INSERT)/.test(verb)) return { title: phrase, confirmLabel: "Create", doneLabel: "Created" }
  if (/^(DELETE|REMOVE|ARCHIVE)/.test(verb)) return { title: phrase, confirmLabel: "Delete", doneLabel: "Deleted" }
  if (/^(UPDATE|EDIT|PATCH|MODIFY|SET)/.test(verb)) return { title: phrase, confirmLabel: "Update", doneLabel: "Updated" }
  if (/^SEND|^POST|^PUBLISH/.test(verb)) return { title: phrase, confirmLabel: "Send", doneLabel: "Sent" }
  return { title: phrase, confirmLabel: "Approve", doneLabel: "Done" }
}

const stripHtml = (s: string) =>
  s
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

function formatValue(value: unknown, opts: { html: boolean }): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value ? "Yes" : null
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    const t = opts.html ? stripHtml(value) : value.trim()
    if (!t) return null
    if (ISO.test(t)) {
      const d = new Date(t)
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          ...(t.length > 10 ? { timeStyle: "short" as const } : {}),
        }).format(d)
      }
    }
    return t
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => {
        if (typeof v === "string") return v.trim()
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>
          return String(o.email ?? o.name ?? o.address ?? "").trim()
        }
        return ""
      })
      .filter(Boolean)
    return parts.length ? parts.join(", ") : null
  }
  return null // nested objects: nothing a person can read at a glance
}

export function presentPendingAction(input: {
  integrationSlug: string
  toolName: string
  arguments: unknown
  /** Native (non-MCP) actions carry their own label instead of a tool name. */
  nativeLabel?: string
}): PresentedAction {
  const described = input.nativeLabel
    ? { title: input.nativeLabel, confirmLabel: "Approve", doneLabel: "Done" }
    : describeTool(stripToolkitPrefix(input.toolName, input.integrationSlug))

  const args =
    input.arguments && typeof input.arguments === "object" && !Array.isArray(input.arguments)
      ? (input.arguments as Record<string, unknown>)
      : {}
  const html = args.is_html === true || args.is_html === "True" || args.is_html === "true"

  const candidates: (PresentedField & { order: number })[] = []
  let hidden = 0
  for (const [key, raw] of Object.entries(args)) {
    const k = key.toLowerCase()
    if (HIDDEN.has(k)) continue
    const known = KNOWN[k]
    // Bare ids are plumbing too, unless we know how to say them.
    if (!known && /(^|_)ids?$/.test(k)) continue
    const value = formatValue(raw, { html })
    if (value === null) continue
    const long = known?.long ?? value.length > LONG_AT
    candidates.push({
      key,
      label: known?.label ?? titleCase(words(key)),
      value,
      long,
      order: known?.order ?? 10,
    })
  }
  candidates.sort((a, b) => a.order - b.order)

  const shown = candidates.slice(0, MAX_FIELDS)
  hidden += candidates.length - shown.length
  return {
    ...described,
    fields: shown.map((f) => ({ key: f.key, label: f.label, value: f.value, long: f.long })),
    hiddenCount: hidden,
  }
}
