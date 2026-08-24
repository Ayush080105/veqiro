import {
  INTEGRATIONS_CATALOG,
  getIntegrationsByAgent,
  type AgentSlug,
  type IntegrationCatalogEntry,
} from '@repo/integrations-catalog';

type NativeTool = Pick<
  IntegrationCatalogEntry,
  'slug' | 'name' | 'logoUrl' | 'agents' | 'category' | 'primaryAgent'
>;

/**
 * Tools that connect through a native provider (not Composio/MCP), so they
 * live outside @repo/integrations-catalog — mirrors LEGACY_INTEGRATIONS in
 * apps/main's settings/integrations page. Currently empty: Instagram used to
 * be listed here (native Meta Graph API), but it moved to Composio for both
 * analytics and publishing — see the `instagram` entry in
 * @repo/integrations-catalog's catalog.ts and apps/main's LEGACY_INTEGRATIONS
 * comment. Twitter/X and LinkedIn are also already Composio-backed catalog
 * entries. Kept as a live (if empty) list, not deleted, so a future
 * genuinely-native-only tool has an obvious place to go without reintroducing
 * this file's plumbing from scratch.
 */
export const NATIVE_TOOLS: NativeTool[] = [];

/** Full tool set: the shared Composio/MCP catalog plus native-provider tools. */
export function getAllTools(): NativeTool[] {
  return [...INTEGRATIONS_CATALOG, ...NATIVE_TOOLS];
}

/** Tools available to one agent, across both the shared catalog and native tools. */
export function getAllToolsByAgent(agent: AgentSlug): NativeTool[] {
  return [...getIntegrationsByAgent(agent), ...NATIVE_TOOLS.filter(t => t.agents.includes(agent))];
}
