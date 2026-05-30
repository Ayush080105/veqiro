import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import * as XLSX from "xlsx";
import {
  parseDateCell,
  parseNumeric,
  parseRows,
  parseBuffer,
} from "../../modules/agents/rex/rex.csv.js";

// ── parseDateCell ──────────────────────────────────────────────────────────
describe("parseDateCell", () => {
  test("ISO date", () => {
    assert.equal(parseDateCell("2025-01-15"), "2025-01-15");
  });
  test("US slash date (MM/DD/YYYY)", () => {
    assert.equal(parseDateCell("01/15/2025"), "2025-01-15");
  });
  test("EU slash date disambiguated by day > 12", () => {
    assert.equal(parseDateCell("15/01/2025"), "2025-01-15");
  });
  test("month name + year", () => {
    assert.equal(parseDateCell("Jan 2025"), "2025-01-01");
    assert.equal(parseDateCell("January 2025"), "2025-01-01");
  });
  test("quarter labels", () => {
    assert.equal(parseDateCell("Q1 2025"), "2025-01-01");
    assert.equal(parseDateCell("2025-Q2"), "2025-04-01");
  });
  test("year-month", () => {
    assert.equal(parseDateCell("2025-03"), "2025-03-01");
  });
  test("Excel serial number", () => {
    assert.equal(parseDateCell(45658), "2025-01-01");
  });
  test("non-date returns null", () => {
    assert.equal(parseDateCell("hello"), null);
    assert.equal(parseDateCell(""), null);
    assert.equal(parseDateCell(null), null);
  });
});

// ── parseNumeric ───────────────────────────────────────────────────────────
describe("parseNumeric", () => {
  test("plain integer and float", () => {
    assert.equal(parseNumeric("100"), 100);
    assert.equal(parseNumeric("3.14"), 3.14);
  });
  test("currency symbols stripped", () => {
    assert.equal(parseNumeric("$1,234.56"), 1234.56);
    assert.equal(parseNumeric("£1000"), 1000);
    assert.equal(parseNumeric("€2,500"), 2500);
  });
  test("percent stripped", () => {
    assert.equal(parseNumeric("2.1%"), 2.1);
  });
  test("K/M/B suffixes", () => {
    assert.equal(parseNumeric("1.5K"), 1500);
    assert.equal(parseNumeric("2M"), 2_000_000);
    assert.equal(parseNumeric("3B"), 3_000_000_000);
  });
  test("parentheses as negative", () => {
    assert.equal(parseNumeric("(500)"), -500);
  });
  test("EU decimal format", () => {
    assert.equal(parseNumeric("1.234,56"), 1234.56);
  });
  test("non-numeric returns NaN", () => {
    assert.ok(Number.isNaN(parseNumeric("N/A")));
    assert.ok(Number.isNaN(parseNumeric("")));
  });
});

// ── parseRows: wide format ─────────────────────────────────────────────────
describe("parseRows wide-format", () => {
  test("date + metric columns become datasets", () => {
    const rows = [
      { Date: "2025-01-01", MRR: "1000", Churn: "2.1%" },
      { Date: "2025-02-01", MRR: "1200", Churn: "1.9%" },
      { Date: "2025-03-01", MRR: "1500", Churn: "2.0%" },
    ];
    const { result } = parseRows(rows);
    assert.equal(result.candidate_mapping.dateColumn, "Date");
    const keys = result.datasets.map((d) => d.metricKey).sort();
    assert.deepEqual(keys, ["churn_rate", "mrr"]);
    const mrr = result.datasets.find((d) => d.metricKey === "mrr")!;
    assert.equal(mrr.points.length, 3);
    assert.deepEqual(mrr.points[0], { date: "2025-01-01", value: 1000 });
  });
});

// ── parseRows: long format ─────────────────────────────────────────────────
describe("parseRows long-format", () => {
  test("metric/period/value pivots into per-metric datasets", () => {
    const rows = [
      { metric: "MRR", period: "2025-01-01", value: "1000" },
      { metric: "MRR", period: "2025-02-01", value: "1200" },
      { metric: "Churn", period: "2025-01-01", value: "2.1" },
      { metric: "Churn", period: "2025-02-01", value: "1.9" },
    ];
    const { result } = parseRows(rows);
    const keys = result.datasets.map((d) => d.metricKey).sort();
    assert.deepEqual(keys, ["churn_rate", "mrr"]);
  });
});

// ── Bug B: null-tokens (N/A) interspersed should not hide a numeric column ──
describe("parseRows type detection — interspersed N/A", () => {
  test("numeric column with ~50% N/A is still detected", () => {
    const rows = [
      { Month: "2025-01-01", Revenue: "100" },
      { Month: "2025-02-01", Revenue: "N/A" },
      { Month: "2025-03-01", Revenue: "200" },
      { Month: "2025-04-01", Revenue: "N/A" },
      { Month: "2025-05-01", Revenue: "300" },
      { Month: "2025-06-01", Revenue: "N/A" },
      { Month: "2025-07-01", Revenue: "400" },
      { Month: "2025-08-01", Revenue: "N/A" },
      { Month: "2025-09-01", Revenue: "500" },
      { Month: "2025-10-01", Revenue: "N/A" },
    ];
    const { result } = parseRows(rows);
    const rev = result.datasets.find((d) => d.metricKey === "revenue");
    assert.ok(rev, "Revenue column should be detected as numeric despite N/A cells");
    assert.equal(rev!.points.length, 5);
  });
});

// ── Bug C: valid values only after the first 30 rows ───────────────────────
describe("parseRows type detection — values beyond first 30 rows", () => {
  test("numeric column detected when numbers start at row 31", () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push({ Month: `2025-${String((i % 12) + 1).padStart(2, "0")}-01`, Revenue: "N/A" });
    }
    for (let i = 0; i < 10; i++) {
      rows.push({ Month: `2026-${String((i % 12) + 1).padStart(2, "0")}-01`, Revenue: String(100 + i) });
    }
    const { result } = parseRows(rows);
    const rev = result.datasets.find((d) => d.metricKey === "revenue");
    assert.ok(rev, "Revenue column should be detected even though numbers appear only after row 30");
    assert.equal(rev!.points.length, 10);
  });
});

// ── Bug A: non-UTF-8 (ISO-8859-1) files must not garble values ─────────────
describe("parseBuffer encoding", () => {
  test("latin-1 (ISO-8859-1) currency values parse correctly", () => {
    const csv = "Month,Revenue\nJan 2025,£1000\nFeb 2025,£1200\nMar 2025,£1500\n";
    const buffer = Buffer.from(csv, "latin1");
    const result = parseBuffer(buffer, "csv");
    const rev = result.datasets.find((d) => d.metricKey === "revenue");
    assert.ok(rev, "Revenue column should be detected from a latin-1 encoded file");
    assert.equal(rev!.points.length, 3);
    assert.equal(rev!.points[0]!.value, 1000);
  });
});

// ── Bug D: delimiter detection (tab / semicolon) ───────────────────────────
describe("parseBuffer delimiter", () => {
  test("tab-delimited file named .csv is parsed by content", () => {
    const tsv = "Month\tMRR\n2025-01-01\t1000\n2025-02-01\t1200\n2025-03-01\t1500\n";
    const result = parseBuffer(Buffer.from(tsv, "utf-8"), "csv");
    assert.ok(result.headers.includes("Month"));
    assert.ok(result.headers.includes("MRR"));
    const mrr = result.datasets.find((d) => d.metricKey === "mrr");
    assert.ok(mrr, "MRR should be parsed from a tab-delimited file");
    assert.equal(mrr!.points.length, 3);
  });
  test("semicolon-delimited file is parsed by content", () => {
    const csv = "Month;MRR\n2025-01-01;1000\n2025-02-01;1200\n2025-03-01;1500\n";
    const result = parseBuffer(Buffer.from(csv, "utf-8"), "csv");
    const mrr = result.datasets.find((d) => d.metricKey === "mrr");
    assert.ok(mrr, "MRR should be parsed from a semicolon-delimited file");
    assert.equal(mrr!.points.length, 3);
  });
});

// ── Bug E: ambiguous dates should warn, not silently assume US ─────────────
describe("parseRows ambiguous dates", () => {
  test("ambiguous DD/MM vs MM/DD dates produce a warning", () => {
    const rows = [
      { Date: "05/06/2025", MRR: "1000" },
      { Date: "07/08/2025", MRR: "1200" },
      { Date: "09/10/2025", MRR: "1500" },
    ];
    const { result } = parseRows(rows);
    assert.ok(
      result.warnings.some((w) => /ambig/i.test(w)),
      `expected an ambiguity warning, got: ${JSON.stringify(result.warnings)}`,
    );
  });
});

// ── parseBuffer: xlsx, empty, malformed ────────────────────────────────────
describe("parseBuffer xlsx / empty", () => {
  test("single-sheet xlsx parses", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Month", "MRR"],
      ["2025-01-01", 1000],
      ["2025-02-01", 1200],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = parseBuffer(buf, "xlsx");
    const mrr = result.datasets.find((d) => d.metricKey === "mrr");
    assert.ok(mrr, "MRR should parse from xlsx");
    assert.equal(mrr!.points.length, 2);
  });
  test("empty CSV reports a warning and no datasets", () => {
    const result = parseBuffer(Buffer.from("", "utf-8"), "csv");
    assert.equal(result.datasets.length, 0);
    assert.ok(result.warnings.length > 0);
  });
});

// ── Large file: full-column scan must stay correct & performant ────────────
describe("parseBuffer large file", () => {
  test("~20k rows parse to the correct dataset", () => {
    const lines = ["Date,MRR"];
    const start = new Date("2020-01-01").getTime();
    for (let i = 0; i < 20000; i++) {
      const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
      lines.push(`${d},${1000 + i}`);
    }
    const result = parseBuffer(Buffer.from(lines.join("\n"), "utf-8"), "csv");
    const mrr = result.datasets.find((d) => d.metricKey === "mrr");
    assert.ok(mrr, "MRR should be detected in a 20k-row file");
    assert.equal(mrr!.points.length, 20000);
    assert.equal(mrr!.points[0]!.value, 1000);
  });
});
