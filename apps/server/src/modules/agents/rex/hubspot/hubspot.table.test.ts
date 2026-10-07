import { describe, it, assert } from "vitest";
import { OBJECT_SPECS } from "./hubspot.objects.js";
import { planColumns, type HsProperty } from "./hubspot.fields.js";
import type { RawRecord, StageInfo } from "./hubspot.pull.js";
import {
  shapeRecords, mergeSnapshot, toCsv, fromCsv, toCsvWithin, toRawTable, requestProperties, type Lookups,
} from "./hubspot.table.js";

const p = (name: string, type = "string", extra: Partial<HsProperty> = {}): HsProperty => ({ name, label: name, type, hubspotDefined: true, ...extra });

const PROPS: HsProperty[] = [
  p("dealname"), p("amount", "number"),
  p("dealstage", "enumeration", { options: [{ value: "closedwon", label: "Closed won" }] }),
  p("pipeline", "enumeration"), p("closedate", "datetime"), p("createdate", "datetime"), p("hs_lastmodifieddate", "datetime"),
  p("hubspot_owner_id", "enumeration"), p("dealtype", "enumeration", { options: [{ value: "newbusiness", label: "New business" }] }),
  p("notes", "string", { hubspotDefined: false }), p("is_won", "bool", { hubspotDefined: false }),
];

const STAGES = new Map<string, StageInfo>([
  ["qualified", { pipelineId: "default", pipeline: "Sales Pipeline", stage: "Qualified", probability: 0.2, closed: false, won: false }],
  ["closedwon", { pipelineId: "default", pipeline: "Sales Pipeline", stage: "Closed won", probability: 1, closed: true, won: true }],
  ["closedlost", { pipelineId: "default", pipeline: "Sales Pipeline", stage: "Closed lost", probability: 0, closed: true, won: false }],
]);

const lookups: Lookups = {
  owners: new Map([["77", "Asha Rao"]]),
  stages: STAGES,
  pipelines: new Map([["default", "Sales Pipeline"]]),
  companies: new Map([["1", { id: "900", name: "Acme, Inc." }]]),
};

const rec = (id: string, properties: Record<string, string | null>): RawRecord => ({ id, properties });
const plan = (extra: string[] = []) => planColumns(OBJECT_SPECS.deals!, PROPS, { extra, includePii: [] }).columns;

describe("shapeRecords for deals", () => {
  const t = shapeRecords(OBJECT_SPECS.deals!, plan(), [
    rec("1", { dealname: "Big deal", amount: "1,000.50", dealstage: "qualified", pipeline: "default", closedate: "2026-03-01T10:00:00.000Z", hubspot_owner_id: "77", dealtype: "newbusiness" }),
    rec("2", { dealname: "Won deal", amount: "200", dealstage: "closedwon", pipeline: "default", hubspot_owner_id: null }),
    rec("3", { dealname: null, amount: "", dealstage: "closedlost", pipeline: "default" }),
  ], lookups);

  it("puts id first and names columns the way Rex defines them", () => {
    assert.equal(t.headers[0], "id");
    assert.includeMembers(t.headers, ["deal_name", "amount", "stage", "pipeline", "close_date", "owner_name", "deal_type", "is_open", "is_won", "is_lost", "stage_probability", "weighted_amount", "associated_company_id", "associated_company_name"]);
  });

  it("shows labels instead of internal ids", () => {
    assert.equal(t.rows[0]!.stage, "Qualified");
    assert.equal(t.rows[0]!.pipeline, "Sales Pipeline");
    assert.equal(t.rows[0]!.owner_name, "Asha Rao");
    assert.equal(t.rows[0]!.deal_type, "New business");
  });

  it("cleans numbers, writes dates as plain days and turns missing values into empty cells", () => {
    assert.equal(t.rows[0]!.amount, "1000.50");
    assert.equal(t.rows[0]!.close_date, "2026-03-01");
    assert.equal(t.rows[2]!.amount, "");
    assert.equal(t.rows[2]!.deal_name, "");
    assert.equal(t.rows[1]!.owner_name, "Unassigned");
    assert.equal(shapeRecords(OBJECT_SPECS.deals!, plan(), [rec("9", { hubspot_owner_id: "404" })], lookups).rows[0]!.owner_name, "Former owner");
  });

  it("derives open, won, lost, probability and weighted amount from the stage", () => {
    assert.deepEqual([t.rows[0]!.is_open, t.rows[0]!.is_won, t.rows[0]!.is_lost], ["true", "false", "false"]);
    assert.deepEqual([t.rows[1]!.is_open, t.rows[1]!.is_won, t.rows[1]!.is_lost], ["false", "true", "false"]);
    assert.deepEqual([t.rows[2]!.is_open, t.rows[2]!.is_won, t.rows[2]!.is_lost], ["false", "false", "true"]);
    assert.equal(t.rows[0]!.stage_probability, "0.2");
    assert.equal(t.rows[0]!.weighted_amount, "200.1");
    assert.equal(t.rows[2]!.weighted_amount, "");
  });

  it("joins the primary company", () => {
    assert.equal(t.rows[0]!.associated_company_id, "900");
    assert.equal(t.rows[0]!.associated_company_name, "Acme, Inc.");
    assert.equal(t.rows[1]!.associated_company_id, "");
  });

  it("types every column the AI service will read", () => {
    assert.equal(t.columnTypes.amount, "numeric");
    assert.equal(t.columnTypes.close_date, "date");
    assert.equal(t.columnTypes.stage, "categorical");
    assert.equal(t.columnTypes.is_won, "categorical");
    assert.equal(t.columnTypes.weighted_amount, "numeric");
    assert.equal(t.columnTypes.id, "text");
    assert.deepEqual(Object.keys(t.columnTypes).sort(), [...t.headers].sort());
  });

  it("does not let a customer property named like a derived column overwrite it", () => {
    const withClash = shapeRecords(OBJECT_SPECS.deals!, plan(["is_won", "notes"]), [rec("2", { dealstage: "closedwon", is_won: "false", notes: "x" })], lookups);
    assert.equal(withClash.rows[0]!.is_won, "true");
  });
});

describe("shapeRecords for other objects", () => {
  it("handles tickets and companies without deal-only columns", () => {
    const tickets = shapeRecords(OBJECT_SPECS.tickets!, planColumns(OBJECT_SPECS.tickets!, [p("subject"), p("hs_pipeline_stage", "enumeration"), p("hs_pipeline", "enumeration")], { extra: [], includePii: [] }).columns,
      [rec("5", { subject: "Help", hs_pipeline_stage: "1", hs_pipeline: "p" })],
      { owners: new Map(), stages: new Map([["1", { pipelineId: "p", pipeline: "Support", stage: "New", probability: null, closed: false, won: false }]]), pipelines: new Map([["p", "Support"]]) });
    assert.equal(tickets.rows[0]!.stage, "New");
    assert.equal(tickets.rows[0]!.is_open, "true");
    assert.notInclude(tickets.headers, "is_won");
    const companies = shapeRecords(OBJECT_SPECS.companies!, planColumns(OBJECT_SPECS.companies!, [p("name"), p("numberofemployees", "number")], { extra: [], includePii: [] }).columns,
      [rec("9", { name: "Acme", numberofemployees: "50" })], { owners: new Map() });
    assert.deepEqual(companies.headers, ["id", "name", "employees"]);
  });

  it("splits multi-select values and maps each to its label", () => {
    const cols = planColumns(OBJECT_SPECS.companies!, [p("name"), p("tags", "enumeration", { hubspotDefined: false, options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }] })], { extra: ["tags"], includePii: [] }).columns;
    const t = shapeRecords(OBJECT_SPECS.companies!, cols, [rec("1", { name: "x", tags: "a;b" })], { owners: new Map() });
    assert.equal(t.rows[0]!.tags, "Alpha;Beta");
  });

  it("writes booleans as true/false and epoch dates as ISO", () => {
    const cols = planColumns(OBJECT_SPECS.companies!, [p("name"), p("is_customer", "bool", { hubspotDefined: false }), p("renewal", "date", { hubspotDefined: false })], { extra: ["is_customer", "renewal"], includePii: [] }).columns;
    const t = shapeRecords(OBJECT_SPECS.companies!, cols, [rec("1", { name: "x", is_customer: "TRUE", renewal: "1772323200000" })], { owners: new Map() });
    assert.equal(t.rows[0]!.is_customer, "true");
    assert.equal(t.rows[0]!.renewal, "2026-03-01");
  });
});

describe("requestProperties", () => {
  it("asks HubSpot for what the derived columns need as well as the chosen columns", () => {
    const props = requestProperties(OBJECT_SPECS.deals!, plan().filter((c) => c.property !== "amount"));
    assert.includeMembers(props, ["dealname", "dealstage", "pipeline", "amount", "hs_lastmodifieddate"]);
    assert.notInclude(props, "hs_object_id");
  });
});

describe("csv", () => {
  const rows = [
    { id: "1", note: 'He said "hi", then left\nsecond line', n: "5" },
    { id: "2", note: "", n: "" },
  ];
  it("round-trips commas, quotes and newlines", () => {
    const back = fromCsv(toCsv({ headers: ["id", "note", "n"], rows }));
    assert.deepEqual(back, rows);
  });

  it("keeps a row whose fields are all empty apart from the id", () => {
    const back = fromCsv(toCsv({ headers: ["id", "a", "b"], rows: [{ id: "7", a: "", b: "" }] }));
    assert.equal(back.length, 1);
  });

  it("trims the snapshot to fit the size limit and says so", () => {
    const big = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), note: "x".repeat(100) }));
    const out = toCsvWithin({ headers: ["id", "note"], rows: big }, 50_000);
    assert.isAtMost(out.buffer.length, 50_000);
    assert.isTrue(out.truncated);
    assert.isBelow(out.rowsKept, 2000);
    assert.equal(fromCsv(out.buffer).length, out.rowsKept);
  });
});

describe("mergeSnapshot", () => {
  it("replaces changed records by id, keeps the rest and appends new ones", () => {
    const merged = mergeSnapshot(
      [{ id: "1", v: "a" }, { id: "2", v: "b" }],
      [{ id: "2", v: "B" }, { id: "3", v: "c" }],
    );
    assert.deepEqual(merged, [{ id: "1", v: "a" }, { id: "2", v: "B" }, { id: "3", v: "c" }]);
  });
});

describe("toRawTable", () => {
  it("keeps a 500 row preview and points at the stored file", () => {
    const rows = Array.from({ length: 800 }, (_, i) => ({ id: String(i), name: `n${i}` }));
    const raw = toRawTable({ headers: ["id", "name"], columnTypes: { id: "text", name: "text" }, rows }, "documents/org-1-x.csv");
    assert.equal(raw.rows.length, 500);
    assert.equal(raw.fileKey, "documents/org-1-x.csv");
    assert.deepEqual(raw.headers, ["id", "name"]);
  });
});
