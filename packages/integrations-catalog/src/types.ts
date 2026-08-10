export type AgentSlug = "vega" | "maya" | "sage" | "scout" | "rex" | "lex";

/**
 * All 94 integrations connect through the identical Settings-page card +
 * ConnectIntegrationModal + /mcp/connections/:slug/connect flow — there is
 * no separate UI or mechanism per row. `status` only controls whether the
 * card is connectable yet:
 *  - "composio": a confirmed Composio toolkit exists for this row
 *    (toolkitSlug is set) and it's connectable today.
 *  - "coming-soon": no confirmed toolkit yet (or not audited yet) —
 *    the card renders disabled with a "coming soon" badge.
 */
export type IntegrationStatus = "composio" | "coming-soon";

export interface IntegrationCatalogEntry {
  /** Stable id, e.g. "notion", "gmail", "hubspot-marketing". */
  slug: string;
  name: string;
  description: string;
  /** Our own taxonomy — Composio's toolkit API has no category field we use. */
  category: string;
  /** Whose "Onboard me" page owns the connect CTA. */
  primaryAgent: AgentSlug;
  /** Superset of primaryAgent — e.g. ad platforms serve both Maya and Rex. */
  agents: AgentSlug[];
  status: IntegrationStatus;
  /** Set once status is "composio" — the toolkit-coverage audit fills this
   * in. mcp.service.ts resolves (and lazily creates, if missing) the right
   * Composio auth config for this toolkit at connect time — no separate
   * seed step or id stored here. */
  composio?: { toolkitSlug: string };
  logoUrl?: string;
}
