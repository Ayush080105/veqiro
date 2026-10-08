/**
 * Builds a HubSpot-shaped snapshot with the real table builder and writes it as `<out>.csv` plus
 * `<out>.table.json` (the rawTable preview), so the AI service's own loader can be pointed at it:
 *
 *   npx tsx scripts/hubspot-contract-check.ts /tmp/hs
 *   python -I scripts/hubspot-contract-check.py /tmp/hs
 *
 * No network, no database, no token.
 */
import { writeFileSync } from "fs";
import { planColumns } from "../src/modules/agents/rex/hubspot/hubspot.fields.js";
import { OBJECT_SPECS } from "../src/modules/agents/rex/hubspot/hubspot.objects.js";
import { shapeRecords, toCsv, toRawTable } from "../src/modules/agents/rex/hubspot/hubspot.table.js";
import type { HsProperty } from "../src/modules/agents/rex/hubspot/hubspot.fields.js";

const out = process.argv[2];
if (!out) throw new Error("usage: hubspot-contract-check.ts <output path prefix>");

const spec = OBJECT_SPECS.deals!;
const p = (name: string, type: string, extra: Partial<HsProperty> = {}): HsProperty => ({ name, label: name, type, hubspotDefined: true, ...extra });
const props: HsProperty[] = [
  p("dealname", "string"), p("amount", "number"), p("dealstage", "enumeration"), p("pipeline", "enumeration"),
  p("closedate", "datetime"), p("createdate", "datetime"), p("hs_lastmodifieddate", "datetime"),
  p("hubspot_owner_id", "enumeration"), p("contract_tier", "enumeration", { hubspotDefined: false }),
];
const { columns } = planColumns(spec, props, { extra: ["contract_tier"], includePii: [] });

const stages = new Map([
  ["open", { pipelineId: "default", pipeline: "Sales", stage: "Qualified", probability: 0.4, closed: false, won: false }],
  ["won", { pipelineId: "default", pipeline: "Sales", stage: "Closed won", probability: 1, closed: true, won: true }],
  ["lost", { pipelineId: "default", pipeline: "Sales", stage: "Closed lost", probability: 0, closed: true, won: false }],
]);
const owners = new Map([["1", "Asha Rao"], ["2", "Ravi, Jr. \"RJ\" Shah"]]);

const records = Array.from({ length: 1200 }, (_, i) => ({
  id: String(1000 + i),
  properties: {
    dealname: i % 50 === 0 ? `Deal, with "quotes"\nand a newline ${i}` : `Deal ${i}`,
    amount: i % 7 === 0 ? "" : String(1000 + i * 13.5),
    dealstage: ["open", "won", "lost"][i % 3]!,
    pipeline: "default",
    closedate: i % 4 === 0 ? null : new Date(Date.UTC(2026, i % 12, 1 + (i % 27), 10, 30)).toISOString(),
    createdate: new Date(Date.UTC(2025, i % 12, 1 + (i % 27), 8, 0)).toISOString(),
    hs_lastmodifieddate: new Date(Date.UTC(2026, 5, 1 + (i % 27), 9, 0)).toISOString(),
    hubspot_owner_id: i % 5 === 0 ? null : String((i % 2) + 1),
    contract_tier: i % 3 === 0 ? "gold" : "silver",
  } as Record<string, string | null>,
}));

const table = shapeRecords(spec, columns, records, { owners, stages, pipelines: new Map([["default", "Sales"]]) });
writeFileSync(`${out}.csv`, toCsv(table));
writeFileSync(`${out}.table.json`, JSON.stringify(toRawTable(table, "documents/org-1-contract.csv")));
console.log(`wrote ${table.rows.length} rows, ${table.headers.length} columns: ${table.headers.join(", ")}`);
