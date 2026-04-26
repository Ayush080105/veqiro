import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getPublicUrl } from "../../../common/utils/r2.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

interface DataRow {
  date: string;
  value: number;
}

export interface ColumnMapping {
  dateColumn: string;
  valueColumns: Array<{ column: string; metricKey: string }>;
}

export interface ParseResult {
  candidate_mapping: ColumnMapping;
  sample_rows: Record<string, string>[];
  headers: string[];
  datasets: Array<{ metricKey: string; points: DataRow[] }>;
}

const METRIC_KEY_PATTERNS: Array<{ pattern: RegExp; metricKey: string }> = [
  { pattern: /mrr|monthly.?recurring/i, metricKey: "mrr" },
  { pattern: /arr|annual.?recurring/i, metricKey: "arr" },
  { pattern: /revenue|sales|income/i, metricKey: "revenue" },
  { pattern: /expense|cost|spend|spending/i, metricKey: "expenses" },
  { pattern: /burn/i, metricKey: "burn" },
  { pattern: /cash|balance|bank/i, metricKey: "cash" },
  { pattern: /subscriber|subscription/i, metricKey: "subscribers" },
  { pattern: /customer|client|user/i, metricKey: "new_customers" },
  { pattern: /churn/i, metricKey: "churn_rate" },
  { pattern: /growth/i, metricKey: "growth_rate" },
  { pattern: /marketing|acquisition|ad.?spend/i, metricKey: "marketing_spend" },
  { pattern: /cac/i, metricKey: "cac" },
  { pattern: /ltv|lifetime/i, metricKey: "ltv" },
];

function inferMetricKey(header: string): string | null {
  const h = header.trim();
  for (const { pattern, metricKey } of METRIC_KEY_PATTERNS) {
    if (pattern.test(h)) return metricKey;
  }
  return null;
}

function isDateColumn(header: string, values: string[]): boolean {
  const dateHeaders = /date|period|month|week|day|time|quarter|year/i;
  if (dateHeaders.test(header)) return true;
  const sample = values.slice(0, 5).filter(Boolean);
  return (
    sample.length > 0 &&
    sample.filter((v) => !isNaN(Date.parse(v))).length >= sample.length * 0.7
  );
}

function isNumericColumn(values: string[]): boolean {
  const sample = values.slice(0, 10).filter(Boolean);
  if (sample.length === 0) return false;
  return (
    sample.filter((v) => !isNaN(parseFloat(v.replace(/[$,%]/g, "")))).length >=
    sample.length * 0.7
  );
}

function parseNumeric(v: string): number {
  return parseFloat(v.replace(/[$,%,\s]/g, "")) || 0;
}

function rowsToDataset(
  rows: Record<string, string>[],
  dateCol: string,
  valueCol: string
): DataRow[] {
  return rows
    .filter((r) => r[dateCol] && r[valueCol])
    .map((r) => ({
      date: new Date(r[dateCol]).toISOString().slice(0, 10),
      value: parseNumeric(r[valueCol]),
    }))
    .filter((d) => !isNaN(new Date(d.date).getTime()))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseRows(rows: Record<string, string>[]): ParseResult {
  if (rows.length === 0) {
    return {
      candidate_mapping: { dateColumn: "", valueColumns: [] },
      sample_rows: [],
      headers: [],
      datasets: [],
    };
  }

  const headers = Object.keys(rows[0]);
  const dateCol =
    headers.find((h) => isDateColumn(h, rows.map((r) => r[h]))) ?? headers[0];
  const valueCols = headers
    .filter((h) => h !== dateCol && isNumericColumn(rows.map((r) => r[h])))
    .map((column) => ({
      column,
      metricKey: inferMetricKey(column) ?? column.toLowerCase().replace(/\s+/g, "_"),
    }));

  const datasets = valueCols.map(({ column, metricKey }) => ({
    metricKey,
    points: rowsToDataset(rows, dateCol, column),
  }));

  return {
    candidate_mapping: { dateColumn: dateCol, valueColumns: valueCols },
    sample_rows: rows.slice(0, 5),
    headers,
    datasets,
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

export async function parseUploaded(r2Key: string): Promise<ParseResult> {
  const ext = r2Key.split(".").pop()?.toLowerCase() ?? "";
  const buffer = await fetchR2Buffer(r2Key);

  if (ext === "csv") {
    const text = buffer.toString("utf-8");
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });
    return parseRows(result.data);
  }

  // xlsx / xls — read first sheet only (v1)
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  return parseRows(rows);
}
