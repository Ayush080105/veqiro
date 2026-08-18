/**
 * Turns an arbitrary provider response into one displayable number.
 *
 * Dashboard tiles started out only able to count lists, which covered almost
 * nothing a founder actually wants on a dashboard: Search Console clicks and
 * average position, Razorpay revenue, GA sessions and bounce rate are all
 * *fields* — sometimes summed across rows, sometimes read straight off the
 * response — not list lengths.
 *
 * So a metric is (field path + aggregation + formatting), and the field path is
 * discovered by inspecting a real response rather than hardcoded per provider.
 * That's what lets this work across all 51 integrations without a per-provider
 * adapter for each.
 */

export const AGGREGATIONS = ["count", "sum", "avg", "min", "max", "value", "latest"] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export interface MetricField {
  /** Dot path with `[]` marking array traversal, e.g. "data.rows[].clicks". */
  path: string;
  kind: "number" | "string" | "boolean";
  /** A real value from the response, so the picker shows what this field is. */
  sample: string;
  /** True when the path crosses an array — sum/avg/min/max/count apply. */
  repeated: boolean;
  /** Aggregations that make sense here, for the picker to offer. */
  aggregations: Aggregation[];
}

export interface MetricDefinition {
  aggregation: Aggregation;
  fieldPath: string | null;
  scale?: number;
  decimals?: number;
  prefix?: string | null;
  suffix?: string | null;
}

// Guards against pathological payloads: a deeply nested or very wide response
// would otherwise produce thousands of unusable picker rows.
const MAX_DEPTH = 6;
const MAX_FIELDS = 120;
// Only the first array element is walked for structure. Rows in a provider's
// list are homogeneous, so element 2..n add no new paths — just cost.
const SAMPLE_ARRAY_ELEMENTS = 1;

// Provider-envelope keys. These describe the *call*, not the customer's
// business, so offering them as metrics is pure noise in the picker.
const ENVELOPE_PATHS = new Set(["logId", "successful", "error", "sessionInfo"]);

// Longest digit-string still treated as a number. Page tokens and snowflake ids
// are long digit strings; without this cap `nextPageToken` renders as
// "17,317,580,359,092,425,000" and looks like a legitimate metric.
const MAX_NUMERIC_STRING_LENGTH = 12;

const ID_LIKE = /(^|[._])(id|ids|token|key|secret|hash|etag|uid|guid)(\[\])?$/i;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const summarize = (value: unknown): string => {
  if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  return String(value);
};

const aggregationsFor = (kind: MetricField["kind"], repeated: boolean): Aggregation[] => {
  if (kind === "number") {
    return repeated ? ["sum", "avg", "max", "min", "count", "latest"] : ["value"];
  }
  // Non-numerics can still be counted (how many rows have this) or shown as-is.
  return repeated ? ["count", "latest"] : ["value"];
};

/**
 * Walks a response and lists the fields a metric could be built from.
 *
 * Deliberately returns leaves only — an intermediate object is never a metric,
 * and offering it would just be noise in the picker.
 */
export const discoverFields = (root: unknown): MetricField[] => {
  const fields: MetricField[] = [];
  const seen = new Set<string>();

  const walk = (value: unknown, path: string, repeated: boolean, depth: number): void => {
    if (fields.length >= MAX_FIELDS || depth > MAX_DEPTH) return;
    if (ENVELOPE_PATHS.has(path)) return;

    if (Array.isArray(value)) {
      // The array itself is countable even when its elements are scalars or
      // when we never descend into them.
      const arrayPath = `${path}[]`;
      if (!seen.has(arrayPath) && path) {
        seen.add(arrayPath);
        fields.push({
          path: arrayPath,
          kind: "number",
          sample: `${value.length} rows`,
          repeated: true,
          aggregations: ["count"],
        });
      }
      for (const element of value.slice(0, SAMPLE_ARRAY_ELEMENTS)) {
        walk(element, arrayPath, true, depth + 1);
      }
      return;
    }

    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(child, path ? `${path}.${key}` : key, repeated, depth + 1);
      }
      return;
    }

    if (value === null || value === undefined) return;

    const kind: MetricField["kind"] | null =
      typeof value === "number" ? "number"
        : typeof value === "string" ? "string"
          : typeof value === "boolean" ? "boolean"
            : null;
    if (!kind || !path || seen.has(path)) return;

    // A numeric-looking string is a number for metric purposes — providers
    // routinely return "1234" or "0.045" (Search Console ratios, GA metric
    // values), and excluding them would hide the most useful fields. Long
    // digit strings and id-shaped names are excluded: they are identifiers,
    // and summing or averaging them is never meaningful.
    const numericString =
      kind === "string" &&
      value !== "" &&
      (value as string).length <= MAX_NUMERIC_STRING_LENGTH &&
      !Number.isNaN(Number(value)) &&
      !ID_LIKE.test(path);
    const effectiveKind: MetricField["kind"] = numericString ? "number" : kind;

    seen.add(path);
    fields.push({
      path,
      kind: effectiveKind,
      sample: summarize(value),
      repeated,
      aggregations: aggregationsFor(effectiveKind, repeated),
    });
  };

  walk(root, "", false, 0);

  // Numbers first, then repeated fields: the things a dashboard tile is
  // actually made of should not be buried under id strings.
  return fields.sort(
    (a, b) =>
      Number(b.kind === "number") - Number(a.kind === "number") ||
      Number(b.repeated) - Number(a.repeated) ||
      a.path.localeCompare(b.path),
  );
};

/** Collects every value a path resolves to (more than one when it crosses `[]`). */
export const resolvePath = (root: unknown, path: string): unknown[] => {
  let current: unknown[] = [root];
  for (const rawSegment of path.split(".")) {
    if (!rawSegment) continue;
    const isArray = rawSegment.endsWith("[]");
    const key = isArray ? rawSegment.slice(0, -2) : rawSegment;
    const next: unknown[] = [];
    for (const node of current) {
      const value = key ? (isPlainObject(node) ? node[key] : undefined) : node;
      if (value === undefined || value === null) continue;
      if (isArray) {
        if (Array.isArray(value)) next.push(...value);
      } else {
        next.push(value);
      }
    }
    current = next;
    if (current.length === 0) return [];
  }
  return current;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return null;
};

/** The first list we can find, for `count` with no explicit field path — this
 *  is what the original list-counting tiles did, kept working. */
const FALLBACK_LIST_KEYS = [
  "items", "messages", "events", "channels", "files", "records", "results",
  "pages", "issues", "customers", "charges", "bases", "tasks", "rows", "data",
];

const findFallbackList = (value: unknown, depth = 0): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (depth >= 4 || !isPlainObject(value)) return null;
  for (const key of FALLBACK_LIST_KEYS) {
    const found = findFallbackList(value[key], depth + 1);
    if (found) return found;
  }
  return null;
};

export interface EvaluatedMetric {
  /** Null when the metric could not be computed from this response. */
  value: number | null;
  /** Set for text metrics ("value"/"latest" on a non-numeric field). */
  text?: string;
}

export const evaluateMetric = (root: unknown, definition: MetricDefinition): EvaluatedMetric => {
  const { aggregation, fieldPath } = definition;

  if (!fieldPath) {
    const list = findFallbackList(root);
    return { value: list ? list.length : null };
  }

  const resolved = resolvePath(root, fieldPath);
  if (resolved.length === 0) return { value: null };

  if (aggregation === "count") return { value: resolved.length };

  if (aggregation === "value" || aggregation === "latest") {
    const picked = aggregation === "value" ? resolved[0] : resolved[resolved.length - 1];
    const numeric = toNumber(picked);
    // Non-numeric single values are still worth showing — "next meeting" is a
    // legitimate dashboard tile even though it can't be scaled or averaged.
    return numeric === null ? { value: null, text: summarize(picked) } : { value: numeric };
  }

  const numbers = resolved.map(toNumber).filter((n): n is number => n !== null);
  if (numbers.length === 0) return { value: null };

  switch (aggregation) {
    case "sum": return { value: numbers.reduce((a, b) => a + b, 0) };
    case "avg": return { value: numbers.reduce((a, b) => a + b, 0) / numbers.length };
    case "min": return { value: Math.min(...numbers) };
    case "max": return { value: Math.max(...numbers) };
    default: return { value: null };
  }
};

/** Applies scale, decimals, and affixes. Formatting lives server-side so the
 *  dashboard, the picker preview, and any future digest email agree exactly. */
export const formatMetric = (
  evaluated: EvaluatedMetric,
  definition: MetricDefinition,
): string | null => {
  if (evaluated.value === null) return evaluated.text ?? null;
  const scale = definition.scale && definition.scale !== 0 ? definition.scale : 1;
  const decimals = Math.min(Math.max(definition.decimals ?? 0, 0), 4);
  const scaled = evaluated.value / scale;
  const body = scaled.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${definition.prefix ?? ""}${body}${definition.suffix ?? ""}`;
};
