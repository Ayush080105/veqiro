/**
 * Translating a model's tool arguments into an action form's values.
 *
 * The two vocabularies were never the same. `draft_content` takes `platform`,
 * `tone` and `word_count`; the form binds `platforms`, `tone_override` and
 * `word_count_target`. A key that does not match is dropped in silence — the
 * form simply renders empty — which is why a paused step arrived with only its
 * topic filled in and every other choice reset to the default.
 *
 * `_intent` is not a tool argument. It is what the plan asked this step to do,
 * carried alongside so the context field has something real in it; no tool
 * argument maps to that field at all.
 */

type Args = Record<string, unknown>

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined

const arr = (v: unknown): string[] | undefined => {
  if (Array.isArray(v)) {
    const out = v.filter((x): x is string => typeof x === "string" && !!x.trim())
    return out.length ? out : undefined
  }
  const one = str(v)
  return one ? [one] : undefined
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined

const bool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined

/** Drops undefined so the dialog's own defaults survive for anything unset. */
const compact = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const MAPPERS: Record<string, (a: Args, intent?: string) => Record<string, unknown>> = {
  "maya:draft-content": (a, intent) =>
    compact({
      topic: str(a.topic),
      platforms: arr(a.platform ?? a.platforms),
      tone_override: str(a.tone ?? a.tone_override),
      word_count_target: num(a.word_count ?? a.word_count_target),
      use_logo: bool(a.use_logo),
      use_mascot: bool(a.use_mascot),
      additional_context: str(a.additional_context) ?? intent,
    }),
  "maya:generate-ideas": (a, intent) =>
    compact({
      platform: str(a.platform),
      topic_hint: str(a.topic_hint ?? a.topic),
      count: num(a.count),
      additional_context: str(a.additional_context) ?? intent,
    }),
  "maya:generate-variants": (a, intent) =>
    compact({
      original_content: str(a.original_content ?? a.content),
      original_platform: str(a.original_platform ?? a.platform),
      target_platforms: arr(a.target_platforms),
      use_logo: bool(a.use_logo),
      use_mascot: bool(a.use_mascot),
      additional_context: str(a.additional_context) ?? intent,
    }),
  "maya:revise": (a, intent) =>
    compact({
      original_content: str(a.original_content ?? a.content),
      feedback: str(a.feedback ?? a.instructions) ?? intent,
      platform: str(a.platform),
    }),
}

export function toolArgsToPrefill(
  actionId: string | null,
  proposedArgs: unknown,
): Record<string, unknown> | undefined {
  if (!actionId || !proposedArgs || typeof proposedArgs !== "object") return undefined
  const { _intent, ...args } = proposedArgs as Args & { _intent?: unknown }
  const mapper = MAPPERS[actionId]
  // No mapper means no known translation. Passing the raw arguments through
  // would look like it worked while quietly filling nothing, so prefer the
  // form's own defaults and let the user fill it in.
  if (!mapper) return undefined
  return mapper(args, str(_intent))
}
