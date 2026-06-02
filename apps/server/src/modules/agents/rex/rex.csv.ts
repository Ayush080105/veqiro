import Papa from "papaparse";
import * as XLSX from "xlsx";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

interface DataRow {
  date: string;
  value: number;
}

export interface ColumnMapping {
  dateColumn: string;
  valueColumns: Array<{ column: string; metricKey: string }>;
}

export interface SheetTable {
  headers: string[];
  rows: Record<string, string>[];
  columnTypes: Record<string, "date" | "numeric" | "categorical" | "text">;
}

export interface RawTable extends SheetTable {
  /** Present when the source file had multiple non-empty sheets. */
  sheets?: Record<string, SheetTable>;
}

export interface ParseResult {
  candidate_mapping: ColumnMapping;
  sample_rows: Record<string, string>[];
  headers: string[];
  datasets: Array<{ metricKey: string; points: DataRow[] }>;
  warnings: string[];
  saved_mapping?: ColumnMapping | null;
  rawTable: RawTable;
}

const METRIC_KEY_PATTERNS: Array<{ pattern: RegExp; metricKey: string }> = [
  { pattern: /\b(mrr|monthly[\s_-]*recurring[\s_-]*revenue)\b/i, metricKey: "mrr" },
  { pattern: /\b(arr|annual[\s_-]*recurring[\s_-]*revenue)\b/i, metricKey: "arr" },
  { pattern: /\b(net[\s_-]*revenue|revenue|sales|income|gross[\s_-]*sales)\b/i, metricKey: "revenue" },
  { pattern: /\b(opex|operating[\s_-]*expense|expense|cost|spend|spending)\b/i, metricKey: "expenses" },
  { pattern: /\b(net[\s_-]*burn|burn[\s_-]*rate|burn)\b/i, metricKey: "burn" },
  { pattern: /\b(cash[\s_-]*on[\s_-]*hand|cash[\s_-]*balance|cash|bank[\s_-]*balance|bank)\b/i, metricKey: "cash" },
  { pattern: /\b(active[\s_-]*subscribers?|subscribers?|subscription[\s_-]*count)\b/i, metricKey: "subscribers" },
  { pattern: /\b(new[\s_-]*customers?|new[\s_-]*signups?|new[\s_-]*users?|signups?|customer[\s_-]*adds?)\b/i, metricKey: "new_customers" },
  { pattern: /\b(churn[\s_-]*rate|churn[\s_-]*pct|churn|attrition)\b/i, metricKey: "churn_rate" },
  { pattern: /\b(growth[\s_-]*rate|growth[\s_-]*pct|growth|mom[\s_-]*growth)\b/i, metricKey: "growth_rate" },
  { pattern: /\b(marketing[\s_-]*spend|ad[\s_-]*spend|acquisition[\s_-]*cost|paid[\s_-]*spend|marketing[\s_-]*cost)\b/i, metricKey: "marketing_spend" },
  { pattern: /\b(cac|customer[\s_-]*acquisition[\s_-]*cost)\b/i, metricKey: "cac" },
  { pattern: /\b(ltv|lifetime[\s_-]*value|customer[\s_-]*lifetime[\s_-]*value)\b/i, metricKey: "ltv" },
  { pattern: /\b(nrr|net[\s_-]*revenue[\s_-]*retention)\b/i, metricKey: "nrr" },
  { pattern: /\b(grr|gross[\s_-]*revenue[\s_-]*retention)\b/i, metricKey: "grr" },
  { pattern: /\b(mau|monthly[\s_-]*active[\s_-]*users?)\b/i, metricKey: "mau" },
  { pattern: /\b(dau|daily[\s_-]*active[\s_-]*users?)\b/i, metricKey: "dau" },
  { pattern: /\b(arpu|average[\s_-]*revenue[\s_-]*per[\s_-]*user)\b/i, metricKey: "arpu" },
  { pattern: /\b(arpa|average[\s_-]*revenue[\s_-]*per[\s_-]*account)\b/i, metricKey: "arpa" },
  { pattern: /\b(payroll|salary|salaries|wages)\b/i, metricKey: "payroll" },
  { pattern: /\b(headcount|employees|fte)\b/i, metricKey: "headcount" },
];

function inferMetricKey(header: string): string | null {
  const h = header.trim();
  for (const { pattern, metricKey } of METRIC_KEY_PATTERNS) {
    if (pattern.test(h)) return metricKey;
  }
  return null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a date cell, returning ISO YYYY-MM-DD or null.
 * Handles: ISO, US (MM/DD/YYYY), EU (DD/MM/YYYY), "Jan 2025", "2025-01", "Q1 2025",
 * "2025-Q1", Excel serial numbers, "Jan-25", "January 1, 2025".
 */
export function parseDateCell(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;

  // Excel serial number → JS date (Excel epoch = 1899-12-30)
  if (typeof raw === "number" && raw > 1 && raw < 600000) {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo!.padStart(2, "0")}-${(d ?? "01").padStart(2, "0")}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY (heuristic: first segment > 12 → DD/MM)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let a = parseInt(m[1]!, 10);
    let b = parseInt(m[2]!, 10);
    let y = parseInt(m[3]!, 10);
    if (y < 100) y += 2000;
    let mo: number, d: number;
    if (a > 12 && b <= 12) { d = a; mo = b; }
    else { mo = a; d = b; } // default US
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // "Jan 2025", "January 2025", "Jan-25"
  m = s.match(/^([A-Za-z]{3,9})[-\s/]?(\d{2,4})$/);
  if (m) {
    const monIdx = MONTH_NAMES[m[1]!.toLowerCase()];
    if (monIdx != null) {
      let y = parseInt(m[2]!, 10);
      if (y < 100) y += 2000;
      return `${y}-${String(monIdx + 1).padStart(2, "0")}-01`;
    }
  }

  // "2025-01" (year-month)
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-01`;
  }

  // "Q1 2025" or "2025 Q1" or "2025-Q1"
  m = s.match(/^Q([1-4])[-\s/]?(\d{4})$/i) || s.match(/^(\d{4})[-\s/]?Q([1-4])$/i);
  if (m) {
    const q = parseInt(/^Q/i.test(s) ? m[1]! : m[2]!, 10);
    const y = /^Q/i.test(s) ? m[2]! : m[1]!;
    const mo = (q - 1) * 3 + 1;
    return `${y}-${String(mo).padStart(2, "0")}-01`;
  }

  // "Jan 1, 2025" / "January 1 2025"
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const monIdx = MONTH_NAMES[m[1]!.toLowerCase()];
    if (monIdx != null) {
      let y = parseInt(m[3]!, 10);
      if (y < 100) y += 2000;
      const d = parseInt(m[2]!, 10);
      return `${y}-${String(monIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // Bare numeric strings ("1000", "2.1", "45000") are values, not dates.
  // Allow only a plausible 4-digit year; otherwise don't let Date.parse coerce
  // a number into a bogus date — that would corrupt column-type detection
  // (e.g. a numeric "value" column being misread as a date column).
  if (/^[+-]?[\d.,]+$/.test(s)) {
    if (/^(19|20)\d{2}$/.test(s)) return `${s}-01-01`;
    return null;
  }

  // Last resort: native Date.parse
  const t = Date.parse(s);
  if (!isNaN(t)) {
    return new Date(t).toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Parse a numeric cell. Handles: $, €, £, ¥, ₹, %, commas, parentheses-as-negative,
 * "K"/"M"/"B" suffixes, EU "1.234,56".
 * Returns NaN if not parseable.
 */
export function parseNumeric(raw: string | number | null | undefined): number {
  if (raw == null) return NaN;
  if (typeof raw === "number") return isFinite(raw) ? raw : NaN;
  let s = String(raw).trim();
  if (!s) return NaN;

  // Parentheses → negative
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);

  // Strip currency symbols, percent, whitespace
  s = s.replace(/[$€£¥₹%\s]/g, "");

  // Detect K/M/B suffix
  let mult = 1;
  const tail = s.slice(-1).toLowerCase();
  if (tail === "k") { mult = 1_000; s = s.slice(0, -1); }
  else if (tail === "m") { mult = 1_000_000; s = s.slice(0, -1); }
  else if (tail === "b") { mult = 1_000_000_000; s = s.slice(0, -1); }

  // Decide between US "1,234.56" and EU "1.234,56":
  // - if has both "," and ".", whichever appears last is the decimal
  // - if only "," and there is exactly one with 1-2 digits after → decimal
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // EU: "1.234,56"
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: "1,234.56"
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const after = s.split(",").pop()!;
    if (after.length === 1 || after.length === 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = parseFloat(s);
  if (!isFinite(n)) return NaN;
  return (neg ? -n : n) * mult;
}

type CellLike = string | number | null | undefined;

// Common spreadsheet "missing value" tokens — excluded from type detection so a
// valid date/number column isn't misclassified by interspersed blanks/N/As.
const NULL_TOKENS = new Set([
  "n/a", "na", "n.a.", "-", "--", "null", "none", "nan", "#n/a", "#n/a!",
  "#value!", "#ref!", "#div/0!", "tbd", ".", "—",
]);

function isNullToken(v: CellLike): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || NULL_TOKENS.has(s.toLowerCase());
}

// Scan the FULL column (not just the first 30 rows) with missing-value tokens
// removed, so type detection sees the real data distribution.
function cleanValues(values: CellLike[]): (string | number)[] {
  return values.filter((v): v is string | number => !isNullToken(v));
}

function isMostlyDates(values: CellLike[]): boolean {
  const sample = cleanValues(values);
  if (sample.length === 0) return false;
  const ok = sample.filter((v) => parseDateCell(v) != null).length;
  return ok >= Math.max(3, Math.floor(sample.length * 0.7));
}

function isMostlyNumeric(values: CellLike[]): boolean {
  const sample = cleanValues(values);
  if (sample.length < 2) return false;
  const ok = sample.filter((v) => !isNaN(parseNumeric(v))).length;
  return ok >= Math.max(2, Math.floor(sample.length * 0.7));
}

function isCategoricalString(values: CellLike[]): boolean {
  // Looks like discrete categories (e.g. metric names): non-empty strings,
  // limited unique values, none parse as numeric or date.
  const sample = cleanValues(values).map((v) => String(v).trim());
  if (sample.length < 3) return false;
  const numericFrac = sample.filter((v) => !isNaN(parseNumeric(v))).length / sample.length;
  const dateFrac = sample.filter((v) => parseDateCell(v) != null).length / sample.length;
  if (numericFrac > 0.3 || dateFrac > 0.3) return false;
  const uniq = new Set(sample.map((v) => v.toLowerCase()));
  return uniq.size >= 2 && uniq.size <= Math.max(20, sample.length / 2);
}

// A slash/dash date like "05/06/2025" is ambiguous when both leading parts are
// <= 12 (could be MM/DD or DD/MM). We default to US MM/DD but want to flag it
// rather than silently guess.
function isAmbiguousSlashDate(s: string): boolean {
  const m = s.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return false;
  const a = parseInt(m[1]!, 10);
  const b = parseInt(m[2]!, 10);
  return a <= 12 && b <= 12 && a !== b;
}

function hasAmbiguousDates(rows: Record<string, unknown>[], dateCol: string): boolean {
  return rows.some((r) => {
    const v = r[dateCol];
    return v != null && isAmbiguousSlashDate(String(v));
  });
}

function dedupeKey(used: Set<string>, key: string): string {
  if (!used.has(key)) {
    used.add(key);
    return key;
  }
  let i = 2;
  while (used.has(`${key}_${i}`)) i++;
  const out = `${key}_${i}`;
  used.add(out);
  return out;
}

function rowsToDataset(
  rows: Record<string, unknown>[],
  dateCol: string,
  valueCol: string
): DataRow[] {
  const out: DataRow[] = [];
  const seenDates = new Set<string>();
  for (const r of rows) {
    const d = parseDateCell(r[dateCol] as string | number | null | undefined);
    if (!d) continue;
    const v = parseNumeric(r[valueCol] as string | number | null | undefined);
    if (!isFinite(v) || isNaN(v)) continue;
    if (seenDates.has(d)) {
      // Aggregate duplicates by sum (common in transactional CSVs)
      const idx = out.findIndex((p) => p.date === d);
      if (idx >= 0) out[idx]!.value += v;
      continue;
    }
    seenDates.add(d);
    out.push({ date: d, value: v });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Convert long-format rows (metric_col + date_col + value_col) to per-metric datasets.
 */
function pivotLongFormat(
  rows: Record<string, unknown>[],
  dateCol: string,
  metricCol: string,
  valueCol: string
): Array<{ metricKey: string; points: DataRow[] }> {
  const buckets = new Map<string, DataRow[]>();
  for (const r of rows) {
    const d = parseDateCell(r[dateCol] as string | number | null | undefined);
    if (!d) continue;
    const v = parseNumeric(r[valueCol] as string | number | null | undefined);
    if (!isFinite(v) || isNaN(v)) continue;
    const rawKey = String(r[metricCol] ?? "").trim();
    if (!rawKey) continue;
    const inferred = inferMetricKey(rawKey) ?? rawKey.toLowerCase().replace(/\s+/g, "_");
    if (!buckets.has(inferred)) buckets.set(inferred, []);
    const list = buckets.get(inferred)!;
    const existing = list.findIndex((p) => p.date === d);
    if (existing >= 0) list[existing]!.value += v;
    else list.push({ date: d, value: v });
  }
  return Array.from(buckets.entries())
    .map(([metricKey, pts]) => ({
      metricKey,
      points: pts.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter((d) => d.points.length > 0);
}

export function parseRows(rows: Record<string, unknown>[]): {
  result: ParseResult;
} {
  const warnings: string[] = [];

  if (rows.length === 0) {
    return {
      result: {
        candidate_mapping: { dateColumn: "", valueColumns: [] },
        sample_rows: [],
        headers: [],
        datasets: [],
        rawTable: { headers: [], rows: [], columnTypes: {} },
        warnings: ["No rows found in upload"],
      },
    };
  }

  // Drop fully-empty header keys (xlsx exports often add __EMPTY columns)
  const allHeaders = Object.keys(rows[0]!);
  const headers = allHeaders.filter((h) => {
    if (!h || /^__EMPTY/.test(h)) return false;
    const vals = rows.map((r) => r[h]);
    const nonEmpty = vals.filter((v) => v != null && String(v).trim() !== "").length;
    return nonEmpty > 0;
  });
  if (headers.length < 2) {
    warnings.push("CSV has fewer than 2 usable columns — limited analysis available");
  }

  // Per-column profile
  const profile = headers.map((h) => {
    const vals = rows.map((r) => r[h] as string | number | null | undefined);
    return {
      header: h,
      vals,
      isDate: isMostlyDates(vals),
      isNumeric: isMostlyNumeric(vals),
      isCategorical: isCategoricalString(vals),
    };
  });

  // Build rawTable — always populated, used for natural language Q&A on any CSV
  const columnTypes: Record<string, "date" | "numeric" | "categorical" | "text"> = {};
  for (const p of profile) {
    if (p.isDate) columnTypes[p.header] = "date";
    else if (p.isNumeric) columnTypes[p.header] = "numeric";
    else if (p.isCategorical) columnTypes[p.header] = "categorical";
    else columnTypes[p.header] = "text";
  }
  const rawTable: RawTable = {
    headers,
    rows: rows.slice(0, 500) as Record<string, string>[],
    columnTypes,
  };

  // ── Long-format detection: date col + categorical metric col + numeric value col
  const dateCols = profile.filter((p) => p.isDate);
  const numericCols = profile.filter((p) => p.isNumeric && !p.isDate);
  const catCols = profile.filter((p) => p.isCategorical && !p.isDate && !p.isNumeric);

  if (dateCols.length >= 1 && catCols.length >= 1 && numericCols.length === 1) {
    const dateCol = dateCols[0]!.header;
    const metricCol = catCols[0]!.header;
    const valueCol = numericCols[0]!.header;
    const datasets = pivotLongFormat(
      rows as Record<string, unknown>[],
      dateCol,
      metricCol,
      valueCol
    );
    if (datasets.length > 0) {
      warnings.push(`Detected long-format CSV: pivoted '${metricCol}' × '${valueCol}' into ${datasets.length} metric${datasets.length > 1 ? "s" : ""}`);
      if (hasAmbiguousDates(rows as Record<string, unknown>[], dateCol)) {
        warnings.push(`Ambiguous date format in '${dateCol}' (DD/MM vs MM/DD) — assuming US MM/DD. Use YYYY-MM-DD to be certain.`);
      }
      return {
        result: {
          candidate_mapping: {
            dateColumn: dateCol,
            valueColumns: datasets.map((d) => ({ column: valueCol, metricKey: d.metricKey })),
          },
          sample_rows: rows.slice(0, 5) as Record<string, string>[],
          headers,
          datasets,
          rawTable,
          warnings,
        },
      };
    }
  }

  // ── Wide-format default
  const dateCol = dateCols[0]?.header ?? headers[0]!;
  if (!dateCols[0]) {
    warnings.push(`No clear date column detected — falling back to '${dateCol}'`);
  }
  if (hasAmbiguousDates(rows as Record<string, unknown>[], dateCol)) {
    warnings.push(`Ambiguous date format in '${dateCol}' (DD/MM vs MM/DD) — assuming US MM/DD. Use YYYY-MM-DD to be certain.`);
  }

  const usedKeys = new Set<string>();
  const valueCols = profile
    .filter((p) => p.header !== dateCol && p.isNumeric)
    .map((p) => {
      const baseKey = inferMetricKey(p.header) ?? p.header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const metricKey = dedupeKey(usedKeys, baseKey || "metric");
      return { column: p.header, metricKey };
    });

  if (valueCols.length === 0) {
    warnings.push("No numeric value columns detected — dataset saved for text Q&A analysis");
  }

  // Note skipped non-numeric columns
  const skipped = profile
    .filter((p) => p.header !== dateCol && !p.isNumeric)
    .map((p) => p.header);
  if (skipped.length > 0) {
    warnings.push(`Skipped non-numeric column${skipped.length > 1 ? "s" : ""}: ${skipped.join(", ")}`);
  }

  // When there are many numeric columns the file is a general table, not a set of
  // separate tracked metrics. Collapse to one Q&A dataset to avoid showing N cards.
  const TABLE_MODE_THRESHOLD = 4;
  const isTableMode = valueCols.length > TABLE_MODE_THRESHOLD;

  let datasets: ParseResult["datasets"];

  if (isTableMode) {
    datasets = [{ metricKey: "table", points: [] }];
    warnings.push(
      `${valueCols.length} numeric columns detected — saving as a unified table for Ask REX Q&A, analysis, and report generation`
    );
  } else {
    datasets = valueCols
      .map(({ column, metricKey }) => ({
        metricKey,
        points: rowsToDataset(rows as Record<string, unknown>[], dateCol, column),
      }))
      .filter((d) => d.points.length > 0);

    if (datasets.length < valueCols.length) {
      warnings.push(`${valueCols.length - datasets.length} column${valueCols.length - datasets.length > 1 ? "s" : ""} produced no usable data points (date or value parsing failed)`);
    }

    // Fallback: always produce at least one dataset so any CSV can be uploaded for Q&A.
    if (datasets.length === 0) {
      datasets.push({ metricKey: "table", points: [] });
      if (valueCols.length > 0) {
        warnings.push(`No time-series data extracted (${valueCols.length} numeric column${valueCols.length > 1 ? "s" : ""} found) — dataset available for Ask REX Q&A`);
      }
    }
  }

  return {
    result: {
      candidate_mapping: { dateColumn: dateCol, valueColumns: valueCols },
      sample_rows: rows.slice(0, 5) as Record<string, string>[],
      headers,
      datasets,
      rawTable,
      warnings,
    },
  };
}

async function fetchR2Buffer(r2Key: string): Promise<Buffer> {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const res = await client.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: r2Key })
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function parseBuffer(buffer: Buffer, ext: string): ParseResult {
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    let text = buffer.toString("utf-8");
    // If UTF-8 decoding produced replacement characters, the file is likely
    // ISO-8859-1 / Windows-1252 (common from Excel "Save as CSV" on Windows).
    // Re-decode as latin-1 so headers and currency values aren't garbled.
    if (text.includes("�")) {
      text = buffer.toString("latin1");
    }
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h: string) => h.trim(),
      dynamicTyping: false,
    });
    if (result.errors.length > 0) {
      const first = result.errors[0]!;
      return {
        candidate_mapping: { dateColumn: "", valueColumns: [] },
        sample_rows: [],
        headers: [],
        datasets: [],
        rawTable: { headers: [], rows: [], columnTypes: {} },
        warnings: [`CSV parse error on row ${first.row}: ${first.message}`],
      };
    }
    return parseRows(result.data).result;
  }

  // xlsx / xls — parse every sheet, merge datasets, collect per-sheet rawTables
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const allDatasets: ParseResult["datasets"] = [];
  const allWarnings: string[] = [];
  const allSheets: Record<string, SheetTable> = {};
  let firstResult: ParseResult | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
      raw: false,
      blankrows: false,
    });
    if (rows.length === 0) continue;
    const { result } = parseRows(rows);
    if (!firstResult) firstResult = result;
    // Store this sheet's rawTable so Q&A / analysis / reports can use it
    allSheets[sheetName] = result.rawTable;
    if (result.warnings.length > 0) {
      allWarnings.push(...result.warnings.map((w) => `[${sheetName}] ${w}`));
    }
    const prefix = workbook.SheetNames.length > 1
      ? `${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_`
      : "";
    const seen = new Set(allDatasets.map((d) => d.metricKey));
    for (const ds of result.datasets) {
      const key = prefix && !ds.metricKey.startsWith(prefix) ? `${prefix}${ds.metricKey}` : ds.metricKey;
      if (!seen.has(key)) {
        allDatasets.push({ metricKey: key, points: ds.points });
        seen.add(key);
      }
    }
  }

  if (!firstResult) {
    return {
      candidate_mapping: { dateColumn: "", valueColumns: [] },
      sample_rows: [],
      headers: [],
      datasets: [],
      rawTable: { headers: [], rows: [], columnTypes: {} },
      warnings: ["No usable sheets in workbook"],
    };
  }

  const multiSheet = Object.keys(allSheets).length > 1;
  const rawTable: RawTable = {
    ...firstResult.rawTable,
    ...(multiSheet ? { sheets: allSheets } : {}),
  };

  // Multi-sheet workbooks are always treated as a unified table — one dataset entry,
  // all sheets accessible via rawTable.sheets for Q&A, analysis, and reports.
  const finalDatasets = multiSheet
    ? [{ metricKey: "table", points: [] }]
    : allDatasets;

  const sheetNames = Object.keys(allSheets);
  const multiSheetWarning = multiSheet
    ? [`Multi-sheet workbook (${sheetNames.join(", ")}) — saved as a unified table for Ask REX Q&A, analysis, and reports`]
    : [];

  return {
    ...firstResult,
    datasets: finalDatasets,
    rawTable,
    warnings: [...multiSheetWarning, ...(allWarnings.length ? allWarnings : firstResult.warnings)],
  };
}

export async function parseUploaded(r2Key: string): Promise<ParseResult> {
  const ext = r2Key.split(".").pop()?.toLowerCase() ?? "";
  const buffer = await fetchR2Buffer(r2Key);
  return parseBuffer(buffer, ext);
}
