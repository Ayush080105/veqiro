/**
 * Checks the HubSpot connector against a REAL account. Needs a Service Key or private app token with
 * the read scopes listed in the Connect HubSpot wizard. Read only; it never writes to HubSpot.
 *
 *   HUBSPOT_TOKEN=pat-... npx tsx scripts/hubspot-smoke.ts
 *   HUBSPOT_TOKEN=pat-... npx tsx scripts/hubspot-smoke.ts --deep   # also pages the list endpoint past 10,000 records
 *
 * It answers the questions the docs could not: does the list endpoint really page past 10,000,
 * does each object's modified-date filter work, and what are the real property and stage shapes.
 * The token is never printed.
 */
import { createHubSpotClient, HubSpotScopeError } from "../src/modules/agents/rex/hubspot/hubspot.client.js";
import { classifyProperties, planColumns } from "../src/modules/agents/rex/hubspot/hubspot.fields.js";
import { OBJECT_SPECS } from "../src/modules/agents/rex/hubspot/hubspot.objects.js";
import {
  countRecords, fetchOwners, fetchProperties, fetchStages, fullPull, incrementalPull, listSchemas,
} from "../src/modules/agents/rex/hubspot/hubspot.pull.js";
import { requestProperties, shapeRecords } from "../src/modules/agents/rex/hubspot/hubspot.table.js";

const token = process.env.HUBSPOT_TOKEN;
if (!token) throw new Error("Set HUBSPOT_TOKEN to a Service Key or private app token.");
const deep = process.argv.includes("--deep");

const client = createHubSpotClient({ get: async () => token });
const line = (s = "") => console.log(s);

async function main() {
  const owners = await fetchOwners(client).catch(() => new Map<string, string>());
  line(`owners: ${owners.size}`);
  const schemas = await listSchemas(client);
  line(`custom objects: ${schemas.map((s) => s.name).join(", ") || "none"}`);

  for (const spec of Object.values(OBJECT_SPECS).filter((s) => s.tier === 1)) {
    line(`\n== ${spec.label} ==`);
    try {
      const total = await countRecords(client, spec);
      const props = await fetchProperties(client, spec.type);
      const { recommended, custom, other } = classifyProperties(spec, props);
      const { columns } = planColumns(spec, props, { extra: [], includePii: [] });
      line(`records: ${total}; properties: ${props.length} (recommended ${recommended.length}, custom ${custom.length}, other ${other.length}); columns: ${columns.length}`);

      const missing = Object.keys(spec.defaults).filter((p) => !props.some((x) => x.name === p));
      if (missing.length) line(`default properties this portal does not have: ${missing.join(", ")}`);

      const reqProps = requestProperties(spec, columns);
      const pulled = await fullPull(client, spec, reqProps, { cap: 300 });
      line(`full pull (cap 300): ${pulled.records.length} records in ${pulled.calls} calls, newest change ${pulled.maxModified}`);

      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const changed = await incrementalPull(client, spec, reqProps, since, { cap: 1000 });
      line(`incremental (modified in the last 7 days, filter on ${spec.modifiedProp}): ${changed.records.length} records in ${changed.calls} calls`);

      const stages = spec.pipelineObject ? await fetchStages(client, spec.pipelineObject) : null;
      const table = shapeRecords(spec, columns, pulled.records.slice(0, 3), { owners, stages: stages?.stages, pipelines: stages?.pipelines });
      line(`columns: ${table.headers.join(", ")}`);
      console.table(table.rows);

      if (deep && total > 10_000) {
        line(`deep: paging the list endpoint past 10,000 ...`);
        const big = await fullPull(client, spec, [spec.modifiedProp], { cap: 10_500 });
        line(`deep: got ${big.records.length} records (${big.records.length > 10_000 ? "the list endpoint pages past 10,000" : "STOPPED EARLY: the list endpoint is capped"})`);
      }
    } catch (err) {
      if (err instanceof HubSpotScopeError) line(`skipped: this key cannot read ${spec.label} (needs ${err.scope ?? "a scope"})`);
      else line(`failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  line(`\nHubSpot calls made: ${client.callsMade()}`);
}

void main();
