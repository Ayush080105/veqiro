import { PROMPT_MAX_LENGTH } from "./prompt-actions"

/**
 * What another employee's result hands to Vega's "Compose an email".
 *
 * The compose form assembles a request of at most PROMPT_MAX_LENGTH characters
 * and adds roughly this much of its own (recipient, subject, tone, "save as a
 * draft, do not send"). What is handed over has to leave room for that, so the
 * customer never lands on a form that refuses to send before they have typed a
 * word.
 */
const FORM_OVERHEAD = 340
const BUDGET = PROMPT_MAX_LENGTH - FORM_OVERHEAD

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

/** Cut at a word boundary, marking the cut — never mid-word, never silently. */
export function clip(text: string, max: number): string {
  const t = clean(text)
  if (t.length <= max) return t
  const cut = t.slice(0, Math.max(0, max - 1))
  const at = cut.lastIndexOf(" ")
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, "")}…`
}

/**
 * Join sections in priority order, dropping whole trailing sections before
 * shortening the first. What matters most survives intact; what is lost is lost
 * as a unit, not as half a sentence.
 */
export function fitSections(sections: string[], budget = BUDGET): string {
  const parts = sections.map(clean).filter(Boolean)
  const kept: string[] = []
  let used = 0
  for (const p of parts) {
    const cost = p.length + (kept.length ? 1 : 0)
    if (used + cost <= budget) {
      kept.push(p)
      used += cost
    } else if (kept.length === 0) {
      kept.push(clip(p, budget))
      break
    }
  }
  return kept.join(" ")
}

const list = (label: string, items: string[] | undefined, take: number) => {
  const picked = (items ?? []).map(clean).filter(Boolean).slice(0, take)
  return picked.length ? `${label}: ${picked.join("; ")}.` : ""
}

// A type alias, not an interface: the follow-up callback takes a
// Record<string, unknown>, which an interface is not assignable to.
export type EmailPrefill = { subject: string; instructions: string }

/** Rex → Vega: send the drafted investor update. The recipient is left to the customer. */
export function investorUpdateEmail(u: {
  subject_line: string
  executive_summary: string
  highlights_section?: string[]
  challenges_section?: string[]
  asks_section?: string[]
}): EmailPrefill {
  return {
    subject: clean(u.subject_line),
    instructions: fitSections([
      `Send my investors this update.`,
      clean(u.executive_summary),
      list("Highlights", u.highlights_section, 3),
      list("Challenges", u.challenges_section, 2),
      list("Where they can help", u.asks_section, 2),
    ]),
  }
}

/** Rex → Vega: tell the board where cash stands. */
export function runwayBoardEmail(r: {
  runwayLabel: string
  verdict: string
  cash: string
  burn: string
  revenue: string
  zeroDate?: string | null
  recommendation?: string | null
}): EmailPrefill {
  return {
    subject: `Runway update: ${r.runwayLabel} (${r.verdict})`,
    instructions: fitSections([
      `Update the board on our cash position.`,
      `Runway is ${r.runwayLabel}, with ${r.cash} in the bank, burning ${r.burn} a month against ${r.revenue} of revenue.`,
      r.zeroDate && r.zeroDate !== "profitable" ? `Projected zero date: ${r.zeroDate}.` : "",
      r.recommendation ?? "",
    ]),
  }
}

/** Lex → Vega: tell the team about the serious problems in a contract. */
export function contractRiskEmail(c: {
  documentName: string
  headline: string
  critical: number
  high: number
  issues: { title: string; what_it_means?: string }[]
}): EmailPrefill {
  const counts = [c.critical && `${c.critical} critical`, c.high && `${c.high} high`]
    .filter(Boolean)
    .join(", ")
  const top = c.issues
    .slice(0, 4)
    .map((i, n) => `${n + 1}) ${clean(i.title)}${i.what_it_means ? ` — ${clip(i.what_it_means, 90)}` : ""}`)
    .join(" ")
  return {
    subject: `Contract review: ${clean(c.documentName)} — ${clean(c.headline)}`,
    instructions: fitSections([
      `Let the team know what the review of ${clean(c.documentName)} found: ${clean(c.headline)}`,
      counts ? `${counts} risk items.` : "",
      top ? `Top issues: ${top}` : "",
      "Ask who needs to weigh in before we sign.",
    ]),
  }
}
