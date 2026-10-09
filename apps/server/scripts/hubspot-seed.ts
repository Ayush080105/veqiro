/**
 * Fills a HubSpot account with varied demo data so Rex dashboards have something to show.
 * Run it yourself; the key never has to be shared with anyone.
 *
 *   # 1. See what it would do (reads only, writes nothing):
 *   HUBSPOT_TOKEN=... npx tsx scripts/hubspot-seed.ts --portal 12345678
 *
 *   # 2. Try a small pilot, then the full set:
 *   HUBSPOT_TOKEN=... npx tsx scripts/hubspot-seed.ts --portal 12345678 --scale 0.05 --yes
 *   HUBSPOT_TOKEN=... npx tsx scripts/hubspot-seed.ts --portal 12345678 --yes
 *
 *   # 3. Remove everything it created:
 *   HUBSPOT_TOKEN=... npx tsx scripts/hubspot-seed.ts --portal 12345678 --cleanup
 *
 * The key needs WRITE scopes (the Rex connection key is read only): crm.objects.contacts.write,
 * crm.objects.companies.write, crm.objects.deals.write, tickets, plus the read scopes. Use a test or
 * developer account, not a real business CRM. --portal must match the account the key belongs to.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createHubSpotClient } from "../src/modules/agents/rex/hubspot/hubspot.client.js";
import { buildPlan, summarize } from "./hubspot-seed/plan.js";
import { cleanup, discover, execute, type Manifest } from "./hubspot-seed/run.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error("Set HUBSPOT_TOKEN to a key that has write scopes.");
  const portal = value("portal");
  if (!portal) throw new Error("Pass --portal <your HubSpot account id> so the tool can confirm it is writing to the right account.");

  const client = createHubSpotClient({ get: async () => token });
  const { found, warnings } = await discover(client);
  if (found.portalId !== portal) throw new Error(`This key belongs to HubSpot account ${found.portalId}, not ${portal}. Nothing was done.`);
  warnings.forEach((w) => console.log(`note: ${w}`));

  const manifestPath = `hubspot-seed-manifest.${found.portalId}.json`;

  if (flag("cleanup")) {
    if (!existsSync(manifestPath)) throw new Error(`No ${manifestPath} here, so there is nothing recorded to remove.`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    if (!flag("yes")) {
      const n = Object.values(manifest.ids).reduce((s, x) => s + x.length, 0);
      console.log(`Would archive ${n} records created on ${manifest.createdAt}. Add --yes to do it.`);
      return;
    }
    await cleanup(client, manifest, console.log);
    console.log("Done. HubSpot keeps archived records for 90 days.");
    return;
  }

  const plan = buildPlan({
    ...found,
    seed: Number(value("seed") ?? 42),
    now: new Date(),
    scale: Number(value("scale") ?? 1),
  });
  console.log(`Account ${found.portalId} confirmed. Owners to spread records across: ${found.ownerIds.length}`);
  console.log(JSON.stringify(summarize(plan), null, 2));

  if (!flag("yes")) {
    console.log("\nDry run: nothing was written. Add --yes to create these records.");
    return;
  }
  const { manifest, notes } = await execute(client, plan, found.portalId, {
    onStep: console.log,
    onManifest: (m) => writeFileSync(manifestPath, JSON.stringify(m, null, 2)),
  });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  notes.forEach((n) => console.log(`note: ${n}`));
  console.log(`\nDone. ${manifestPath} lists what was created; run with --cleanup to remove it.`);
  console.log(`HubSpot calls made: ${client.callsMade()}`);
}

main().catch((err) => { console.error(`\nStopped: ${err instanceof Error ? err.message : String(err)}`); process.exit(1); });
