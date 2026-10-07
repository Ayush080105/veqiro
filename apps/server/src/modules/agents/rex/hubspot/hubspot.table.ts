/**
 * HubSpot records -> one flat, typed table per object, ready for the dashboard engine.
 *
 * Everything the AI service and DuckDB will see is decided here: enumerations show their labels,
 * owners and stages are resolved to names, numbers and dates are normalised, missing values are empty
 * cells, and a handful of derived columns (is_won, weighted_amount, associated_company_*) make the
 * common questions one-liners. The table is stored as CSV on R2 with a 500-row `rawTable` preview.
 */
import Papa from "papaparse";
import type { RawTable } from "../rex.csv.js";
import type { ColumnKind, ColumnPlan } from "./hubspot.fields.js";
import type { ObjectSpec } from "./hubspot.objects.js";
import type { RawRecord, StageInfo } from "./hubspot.pull.js";

export const MAX_CSV_BYTES = 40 * 1024 * 1024;
export const PREVIEW_ROWS = 500;

export interface Lookups {
  owners: Map<string, string>;
  stages?: Map<string, StageInfo>;
  pipelines?: Map<string, string>;
  companies?: Map<string, { id: string; name: string | null }>;
}

export interface BuiltTable {
  headers: string[];
  columnTypes: Record<string, ColumnKind>;
  rows: Array<Record<string, string>>;
}

type Row = Record<string, string>;

// ── Value shaping ───────────────────────────────────────────────────────────

function cleanNumber(raw: string): string {
  const s = raw.replace(/[,\s$€£₹%]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? String(n) : "";
}

/** Calendar date (UTC) as YYYY-MM-DD. Dashboards bucket by day, and one uniform format keeps the
 *  AI service's strict date parsing from ever meeting date-only and timezone-stamped values in a column. */
function cleanDate(raw: string): string {
  if (/^\d{10,}$/.test(raw)) {
    const d = new Date(Number(raw));
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

function shapeValue(plan: ColumnPlan, raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "";
  switch (plan.kind) {
    case "numeric": return cleanNumber(raw);
    case "date": return cleanDate(raw);
    case "categorical": {
      if (!plan.options) return raw.toLowerCase() === "true" || raw.toLowerCase() === "false" ? raw.toLowerCase() : raw;
      return raw.split(";").map((v) => plan.options!.get(v) ?? v).join(";");
    }
    default: return raw;
  }
}

function shapeCell(spec: ObjectSpec, plan: ColumnPlan, record: RawRecord, lookups: Lookups): string {
  if (plan.special === "id") return record.id;
  const raw = record.properties[plan.property];
  // An owner column reads better as a category than as a blank bar.
  if (plan.special === "owner") return raw ? (lookups.owners.get(raw) ?? "Former owner") : "Unassigned";
  if (raw === null || raw === undefined || raw === "") return "";
  if (plan.special === "stage") return lookups.stages?.get(raw)?.stage ?? plan.options?.get(raw) ?? raw;
  if (plan.special === "pipeline") return lookups.pipelines?.get(raw) ?? plan.options?.get(raw) ?? raw;
  return shapeValue(plan, raw);
}

const DERIVED_KINDS: Record<string, ColumnKind> = {
  is_open: "categorical", is_won: "categorical", is_lost: "categorical",
  stage_probability: "numeric", weighted_amount: "numeric",
  associated_company_id: "text", associated_company_name: "text",
};

function derive(spec: ObjectSpec, record: RawRecord, lookups: Lookups): Row {
  const out: Row = {};
  const info = spec.stageProp ? lookups.stages?.get(record.properties[spec.stageProp] ?? "") : undefined;
  const bool = (v: boolean) => (v ? "true" : "false");
  for (const name of spec.derivedColumns) {
    switch (name) {
      case "is_open": out[name] = info ? bool(!info.closed) : ""; break;
      case "is_won": out[name] = info ? bool(info.won) : ""; break;
      case "is_lost": out[name] = info ? bool(info.closed && !info.won) : ""; break;
      case "stage_probability": out[name] = info?.probability != null ? String(info.probability) : ""; break;
      case "weighted_amount": {
        const amount = Number(cleanNumber(record.properties.amount ?? ""));
        out[name] = info?.probability != null && Number.isFinite(amount) && record.properties.amount
          ? String(Math.round(amount * info.probability * 100) / 100) : "";
        break;
      }
      case "associated_company_id": out[name] = lookups.companies?.get(record.id)?.id ?? ""; break;
      case "associated_company_name": out[name] = lookups.companies?.get(record.id)?.name ?? ""; break;
      default: out[name] = "";
    }
  }
  return out;
}

export function shapeRecords(spec: ObjectSpec, columns: ColumnPlan[], records: RawRecord[], lookups: Lookups): BuiltTable {
  const headers = [...columns.map((c) => c.column), ...spec.derivedColumns];
  const columnTypes: Record<string, ColumnKind> = {};
  for (const c of columns) columnTypes[c.column] = c.kind;
  for (const d of spec.derivedColumns) columnTypes[d] = DERIVED_KINDS[d] ?? "text";
  const rows = records.map((record) => {
    const row: Row = {};
    for (const c of columns) row[c.column] = shapeCell(spec, c, record, lookups);
    return { ...row, ...derive(spec, record, lookups) };
  });
  return { headers, columnTypes, rows };
}

/** Every HubSpot property a sync must request: the chosen columns plus what the derived ones read. */
export function requestProperties(spec: ObjectSpec, columns: ColumnPlan[]): string[] {
  const props = new Set(columns.filter((c) => c.special !== "id").map((c) => c.property));
  if (spec.stageProp) props.add(spec.stageProp);
  if (spec.pipelineProp) props.add(spec.pipelineProp);
  if (spec.derivedColumns.includes("weighted_amount")) props.add("amount");
  props.add(spec.modifiedProp);
  return [...props];
}

// ── Snapshot ────────────────────────────────────────────────────────────────

export function mergeSnapshot(prev: Row[], delta: Row[]): Row[] {
  const index = new Map<string, number>();
  const out = prev.slice();
  out.forEach((r, i) => index.set(r.id!, i));
  for (const row of delta) {
    const at = index.get(row.id!);
    if (at === undefined) { index.set(row.id!, out.length); out.push(row); }
    else out[at] = row;
  }
  return out;
}

export function toCsv(table: { headers: string[]; rows: Row[] }): Buffer {
  const csv = Papa.unparse({ fields: table.headers, data: table.rows.map((r) => table.headers.map((h) => r[h] ?? "")) }, { newline: "\n" });
  return Buffer.from(csv, "utf8");
}

export function fromCsv(buf: Buffer): Row[] {
  const text = buf.toString("utf8").replace(/^﻿/, "");
  return (Papa.parse<Row>(text, { header: true, skipEmptyLines: true }).data ?? []).map((r) => ({ ...r }));
}

/** The CSV, trimmed (newest rows dropped last) until it fits `maxBytes`. */
export function toCsvWithin(table: { headers: string[]; rows: Row[] }, maxBytes = MAX_CSV_BYTES) {
  let rows = table.rows;
  let buffer = toCsv({ headers: table.headers, rows });
  while (buffer.length > maxBytes && rows.length > 0) {
    const keep = Math.min(rows.length - 1, Math.max(0, Math.floor(rows.length * (maxBytes / buffer.length) * 0.95)));
    rows = rows.slice(0, keep);
    buffer = toCsv({ headers: table.headers, rows });
  }
  return { buffer, rowsKept: rows.length, truncated: rows.length < table.rows.length };
}

export function toRawTable(t: BuiltTable, fileKey: string, previewRows = PREVIEW_ROWS): RawTable {
  return {
    headers: t.headers,
    rows: t.rows.slice(0, previewRows),
    columnTypes: t.columnTypes,
    fileKey,
  };
}
