/**
 * Registry-coverage audit for the MCP integrations catalog (Phase 0 of the
 * MCP-via-Smithery plan). For each of the 94 catalog rows, searches
 * Smithery's live registry and reports the best candidate qualifiedName —
 * this is a REPORT ONLY script, it does not write to catalog.ts. Results
 * need a human pass before being applied: a wrong auto-picked qualifiedName
 * fails silently at connect time.
 *
 *   cd apps/server && npx tsx scripts/audit-mcp-registry.mts > /tmp/audit.json
 *
 * Reads SMITHERY_API_KEY from .env. Uses raw GET requests (not the SDK's
 * async-iterator .list() helper, which hung indefinitely against this
 * account in manual testing — root cause not diagnosed, low urgency to
 * chase since the raw REST call works fine).
 */
import "dotenv/config";
import { Smithery } from "@smithery/api";
import { INTEGRATIONS_CATALOG } from "@repo/integrations-catalog";

const client = new Smithery({ apiKey: process.env.SMITHERY_API_KEY!, timeout: 10000, maxRetries: 1 });

interface RawServer {
  qualifiedName: string;
  displayName: string;
  isDeployed: boolean;
  verified: boolean;
  score: number | null;
}

async function searchOne(query: string): Promise<RawServer[]> {
  const raw = (await client.get(`/servers`, {
    query: { q: query, isDeployed: "true", pageSize: 5 },
  } as any)) as { servers: RawServer[] };
  return raw.servers ?? [];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const rows: Array<{
    slug: string;
    name: string;
    candidates: RawServer[];
    suggested: string | null;
    confidence: "high" | "low" | "none";
  }> = [];

  for (const entry of INTEGRATIONS_CATALOG) {
    let candidates: RawServer[] = [];
    try {
      candidates = await searchOne(entry.name);
    } catch (err) {
      console.error(`[audit] search failed for ${entry.slug}:`, err instanceof Error ? err.message : err);
    }

    const normName = normalize(entry.name);
    const exact = candidates.find(
      (c) => normalize(c.displayName) === normName || normalize(c.qualifiedName.split("/").pop() ?? "") === normName
    );
    const verifiedTop = candidates.find((c) => c.verified);
    const best = exact ?? verifiedTop ?? candidates[0] ?? null;

    let confidence: "high" | "low" | "none" = "none";
    if (exact) confidence = "high";
    else if (best) confidence = "low";

    rows.push({
      slug: entry.slug,
      name: entry.name,
      candidates,
      suggested: best?.qualifiedName ?? null,
      confidence,
    });

    console.error(`[${rows.length}/${INTEGRATIONS_CATALOG.length}] ${entry.slug} -> ${best?.qualifiedName ?? "NO MATCH"} (${confidence})`);
    await new Promise((r) => setTimeout(r, 120));
  }

  const highConfidence = rows.filter((r) => r.confidence === "high");
  const lowConfidence = rows.filter((r) => r.confidence === "low");
  const noMatch = rows.filter((r) => r.confidence === "none");

  console.error(`\n=== SUMMARY: ${highConfidence.length} high-confidence, ${lowConfidence.length} low-confidence, ${noMatch.length} no match (of ${rows.length}) ===\n`);

  console.log(JSON.stringify(rows, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
