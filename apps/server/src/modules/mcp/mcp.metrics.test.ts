import { describe, it, assert } from "vitest";

import { discoverFields, resolvePath, evaluateMetric, formatMetric } from "./mcp.metrics.js";

// Shapes modelled on real Composio responses — the point of these tests is
// that a metric can be built from each without provider-specific code.
const searchConsole = {
  data: {
    rows: [
      { keys: ["veqiro"], clicks: 120, impressions: 3400, ctr: 0.0353, position: 8.2 },
      { keys: ["ai agents"], clicks: 80, impressions: 2600, ctr: 0.0308, position: 12.5 },
    ],
  },
  successful: true,
};

const gmail = {
  data: { messages: [{ id: "a" }, { id: "b" }, { id: "c" }], resultSizeEstimate: 2113 },
};

const razorpay = {
  data: { items: [{ id: "c1", amount: 250000 }, { id: "c2", amount: 125000 }], count: 2 },
};

describe("discoverFields", () => {
  it("finds repeated numeric fields inside a row array", () => {
    const fields = discoverFields(searchConsole);
    const clicks = fields.find((f) => f.path === "data.rows[].clicks");
    assert.ok(clicks, "expected clicks to be discoverable");
    assert.equal(clicks!.kind, "number");
    assert.equal(clicks!.repeated, true);
    assert.include(clicks!.aggregations, "sum");
    assert.include(clicks!.aggregations, "avg");
  });

  it("offers only `value` for a non-repeated scalar", () => {
    const estimate = discoverFields(gmail).find((f) => f.path === "data.resultSizeEstimate");
    assert.ok(estimate);
    assert.equal(estimate!.repeated, false);
    assert.deepEqual(estimate!.aggregations, ["value"]);
  });

  it("exposes the array itself as countable", () => {
    const rows = discoverFields(gmail).find((f) => f.path === "data.messages[]");
    assert.ok(rows);
    assert.deepEqual(rows!.aggregations, ["count"]);
  });

  it("treats numeric strings as numbers, since providers return them", () => {
    const fields = discoverFields({ data: { rows: [{ value: "0.045" }] } });
    const field = fields.find((f) => f.path === "data.rows[].value");
    assert.equal(field?.kind, "number");
  });

  it("sorts numeric fields ahead of identifier strings", () => {
    const fields = discoverFields(razorpay);
    const amountIndex = fields.findIndex((f) => f.path === "data.items[].amount");
    const idIndex = fields.findIndex((f) => f.path === "data.items[].id");
    assert.ok(amountIndex < idIndex, "numeric fields should sort first");
  });

  it("ignores nulls rather than offering unusable fields", () => {
    const fields = discoverFields({ data: { a: null, b: 1 } });
    assert.deepEqual(fields.map((f) => f.path), ["data.b"]);
  });
});

describe("resolvePath", () => {
  it("collects every value across an array traversal", () => {
    assert.deepEqual(resolvePath(searchConsole, "data.rows[].clicks"), [120, 80]);
  });

  it("returns empty for a path that does not exist", () => {
    assert.deepEqual(resolvePath(searchConsole, "data.rows[].nope"), []);
  });
});

describe("evaluateMetric", () => {
  it("sums a field across rows", () => {
    const result = evaluateMetric(searchConsole, { aggregation: "sum", fieldPath: "data.rows[].clicks" });
    assert.equal(result.value, 200);
  });

  it("averages a rate field", () => {
    const result = evaluateMetric(searchConsole, { aggregation: "avg", fieldPath: "data.rows[].position" });
    assert.closeTo(result.value!, 10.35, 0.001);
  });

  it("reads a single scalar with `value`", () => {
    const result = evaluateMetric(gmail, { aggregation: "value", fieldPath: "data.resultSizeEstimate" });
    assert.equal(result.value, 2113);
  });

  it("counts rows via an array path", () => {
    const result = evaluateMetric(gmail, { aggregation: "count", fieldPath: "data.messages[]" });
    assert.equal(result.value, 3);
  });

  it("falls back to the first list when no field path is set", () => {
    // Preserves the behaviour of tiles created before the metric builder.
    const result = evaluateMetric(gmail, { aggregation: "count", fieldPath: null });
    assert.equal(result.value, 3);
  });

  it("returns text for a non-numeric single value", () => {
    const result = evaluateMetric(
      { data: { summary: "Standup with Priya" } },
      { aggregation: "value", fieldPath: "data.summary" },
    );
    assert.equal(result.value, null);
    assert.equal(result.text, "Standup with Priya");
  });

  it("returns null when the path resolves to nothing", () => {
    const result = evaluateMetric(gmail, { aggregation: "sum", fieldPath: "data.missing[].x" });
    assert.equal(result.value, null);
  });

  it("ignores non-numeric entries when aggregating numerically", () => {
    const result = evaluateMetric(
      { rows: [{ v: 5 }, { v: "oops" }, { v: 7 }] },
      { aggregation: "sum", fieldPath: "rows[].v" },
    );
    assert.equal(result.value, 12);
  });
});

describe("formatMetric", () => {
  it("scales minor units into currency", () => {
    // Razorpay reports paise; a founder wants rupees.
    const evaluated = evaluateMetric(razorpay, { aggregation: "sum", fieldPath: "data.items[].amount" });
    const formatted = formatMetric(evaluated, {
      aggregation: "sum", fieldPath: "data.items[].amount", scale: 100, decimals: 0, prefix: "₹",
    });
    assert.equal(formatted, "₹3,750");
  });

  it("renders a rate as a percentage with decimals", () => {
    const evaluated = evaluateMetric(searchConsole, { aggregation: "avg", fieldPath: "data.rows[].ctr" });
    const formatted = formatMetric(evaluated, {
      aggregation: "avg", fieldPath: "data.rows[].ctr", scale: 0.01, decimals: 1, suffix: "%",
    });
    assert.equal(formatted, "3.3%");
  });

  it("groups thousands by default", () => {
    assert.equal(formatMetric({ value: 2113 }, { aggregation: "value", fieldPath: "x" }), "2,113");
  });

  it("passes text metrics through unchanged", () => {
    const formatted = formatMetric(
      { value: null, text: "Standup with Priya" },
      { aggregation: "value", fieldPath: "data.summary" },
    );
    assert.equal(formatted, "Standup with Priya");
  });

  it("returns null when there is nothing to show", () => {
    assert.equal(formatMetric({ value: null }, { aggregation: "sum", fieldPath: "x" }), null);
  });

  it("survives a zero scale rather than dividing by zero", () => {
    assert.equal(formatMetric({ value: 10 }, { aggregation: "value", fieldPath: "x", scale: 0 }), "10");
  });
});
