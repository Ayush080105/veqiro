export type AgentSlug = "vega" | "maya" | "sage" | "scout" | "rex" | "lex";

/**
 * All 94 integrations connect through the identical Settings-page card +
 * ConnectIntegrationModal + /mcp/connections/:slug/connect flow — there is
 * no separate UI or mechanism per row. `status` only controls whether the
 * card is connectable yet:
 *  - "smithery": a confirmed Smithery registry server exists for this row
 *    (qualifiedName is set) and it's connectable today.
 *  - "coming-soon": no confirmed Smithery server yet (or not audited yet) —
 *    the card renders disabled with a "coming soon" badge.
 */
export type IntegrationStatus = "smithery" | "coming-soon";

export interface IntegrationCatalogEntry {
  /** Stable id, e.g. "notion", "gmail", "hubspot-marketing". */
  slug: string;
  name: string;
  description: string;
  /** Our own taxonomy — Smithery's registry API has no category field. */
  category: string;
  /** Whose "Onboard me" page owns the connect CTA. */
  primaryAgent: AgentSlug;
  /** Superset of primaryAgent — e.g. ad platforms serve both Maya and Rex. */
  agents: AgentSlug[];
  status: IntegrationStatus;
  /** Set once status is "smithery" — the registry-coverage audit fills this in. */
  smithery?: { qualifiedName: string };
  logoUrl?: string;
}
