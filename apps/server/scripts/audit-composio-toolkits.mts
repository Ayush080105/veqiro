/**
 * Toolkit-coverage audit for the MCP integrations catalog (Composio version
 * of the former Smithery registry audit). For each of the 51 catalog rows,
 * probes Composio's toolkit catalog for a matching slug and reports the auth
 * scheme it needs — this is a REPORT ONLY script, it does not write to
 * catalog.ts. Results need a human pass before being applied: a wrong
 * auto-picked toolkitSlug fails silently at connect time.
 *
 *   cd apps/server && npx tsx scripts/audit-composio-toolkits.mts > /tmp/audit.json
 *
 * Reads COMPOSIO_API_KEY from .env.
 *
 * Unlike Smithery's crowd-sourced registry (many competing third-party
 * publishers per integration, disambiguated by a `verified`/`score` search),
 * Composio's toolkit catalog is first-party/canonical — one slug per
 * integration, no fuzzy search endpoint on `toolkits.get()` at all (only
 * `category`/`managedBy`/`sortBy`/`cursor`/`limit` filters, confirmed against
 * the installed @composio/core SDK's types). So instead of a text search,
 * this probes a handful of plausible canonical-slug candidates per row
 * directly via `toolkits.get(slug)` (which 404s cleanly via
 * ComposioToolNotFoundError when a slug doesn't exist) and takes the first
 * hit — direct-slug probing resolves the large majority of rows since
 * Composio's slugs are short, predictable strings (gmail, github, slack,
 * notion, stripe, posthog all confirmed to match this catalog's existing
 * `slug`/old-Smithery-qualifiedName values 1:1 in manual spot checks).
 */
import "dotenv/config";
import { Composio } from "@composio/core";
import { INTEGRATIONS_CATALOG } from "@repo/integrations-catalog";

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Old Smithery qualifiedName values live only in git history now — this
 * script no longer has that field to read from the catalog, so candidates
 * are derived purely from the row's own `slug`/`name`. */
function candidateSlugs(entrySlug: string, entryName: string): string[] {
  const candidates = new Set<string>();
  candidates.add(entrySlug); // e.g. "google-calendar"
  candidates.add(entrySlug.replace(/-/g, "")); // e.g. "googlecalendar"
  candidates.add(normalize(entryName)); // e.g. "googlecalendar" from "Google Calendar"
  // Common "X / Y" or "X (Y)" entries (e.g. "Outlook / Microsoft 365 Mail",
  // "X (Twitter)") — try just the first token too.
  const firstWord = entryName.split(/[\s/(]/)[0];
  if (firstWord) candidates.add(normalize(firstWord));
  return Array.from(candidates).filter(Boolean);
}

interface AuditRow {
  slug: string;
  name: string;
  matchedToolkitSlug: string | null;
  triedCandidates: string[];
  confidence: "high" | "low" | "none";
  authScheme:
    | "composio-managed"
    | "custom-auth"
    | "custom-oauth-byo-app"
    | "no-auth"
    | "unknown"
    | null;
  composioManagedAuthSchemes: string[] | null;
}

async function probeOne(entrySlug: string, entryName: string): Promise<AuditRow> {
  const candidates = candidateSlugs(entrySlug, entryName);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const toolkit = await composio.toolkits.get(candidate);
      const hasManagedAuth = (toolkit.composioManagedAuthSchemes?.length ?? 0) > 0;
      const hasNoAuth = toolkit.authConfigDetails?.some((a) => a.mode === "NO_AUTH") ?? false;
      const nonManaged = toolkit.authConfigDetails?.find(
        (a) => !toolkit.composioManagedAuthSchemes?.includes(a.mode)
      );
      // A non-managed scheme whose mode is itself OAuth-family (OAUTH2,
      // OAUTH1, S2S_OAUTH2, DCR_OAUTH) needs a real OAuth app registered with
      // the provider (client_id/secret from e.g. the Twitter/PayPal dev
      // console) — that can't be auto-provisioned, it's a one-time manual
      // step in the Composio dashboard using real credentials we don't have.
      // A non-managed scheme with a credential-shaped mode (API_KEY, BASIC,
      // BEARER_TOKEN, ...) is safe to auto-provision with empty credentials
      // — mcp.service.ts creates an empty-credentials auth config and lets
      // each connecting org fill in their own value at connect time.
      const isByoOAuthApp =
        !!nonManaged && ["OAUTH2", "OAUTH1", "S2S_OAUTH2", "DCR_OAUTH"].includes(nonManaged.mode);
      return {
        slug: entrySlug,
        name: entryName,
        matchedToolkitSlug: toolkit.slug,
        triedCandidates: candidates.slice(0, i + 1),
        // Exact slug match on the first try = high confidence; a match only
        // via a later, looser candidate = low confidence (needs eyeballing —
        // e.g. a normalized-name guess could collide with an unrelated toolkit).
        confidence: i === 0 ? "high" : "low",
        authScheme: hasNoAuth
          ? "no-auth"
          : hasManagedAuth
            ? "composio-managed"
            : isByoOAuthApp
              ? "custom-oauth-byo-app"
              : "custom-auth",
        composioManagedAuthSchemes: toolkit.composioManagedAuthSchemes ?? [],
      };
    } catch {
      // not found under this candidate — try the next one
    }
  }
  return {
    slug: entrySlug,
    name: entryName,
    matchedToolkitSlug: null,
    triedCandidates: candidates,
    confidence: "none",
    authScheme: null,
    composioManagedAuthSchemes: null,
  };
}

async function main() {
  const rows: AuditRow[] = [];
  for (const entry of INTEGRATIONS_CATALOG) {
    const row = await probeOne(entry.slug, entry.name);
    rows.push(row);
    console.error(
      `[${rows.length}/${INTEGRATIONS_CATALOG.length}] ${entry.slug} -> ${row.matchedToolkitSlug ?? "NO MATCH"} (${row.confidence}${row.authScheme ? `, ${row.authScheme}` : ""})`
    );
  }

  const highConfidence = rows.filter((r) => r.confidence === "high");
  const lowConfidence = rows.filter((r) => r.confidence === "low");
  const noMatch = rows.filter((r) => r.confidence === "none");
  const autoSeedable = rows.filter((r) => r.authScheme === "custom-auth");
  const needsManualOAuthApp = rows.filter((r) => r.authScheme === "custom-oauth-byo-app");

  console.error(
    `\n=== SUMMARY: ${highConfidence.length} high-confidence, ${lowConfidence.length} low-confidence, ${noMatch.length} no match (of ${rows.length}) ===`
  );
  console.error(
    `=== ${autoSeedable.length} rows have no Composio-managed OAuth scheme — mcp.service.ts lazily creates their auth config on first connect ===`
  );
  if (needsManualOAuthApp.length > 0) {
    console.error(
      `=== ${needsManualOAuthApp.length} rows need a real OAuth app registered manually in the Composio dashboard (can't be auto-provisioned): ${needsManualOAuthApp.map((r) => r.slug).join(", ")} — leave these "coming-soon" until that's done ===\n`
    );
  }

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
