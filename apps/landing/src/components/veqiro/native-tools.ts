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
 * apps/main's settings/integrations page. Instagram publishes via the native
 * Meta Graph API provider; Twitter/X and LinkedIn are already Composio-backed
 * catalog entries, so only Instagram needs to be added here.
 */
export const NATIVE_TOOLS: NativeTool[] = [
  {
    slug: 'instagram',
    name: 'Instagram',
    logoUrl: 'https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/instagram.svg',
    agents: ['maya'],
    category: 'Social Media',
    primaryAgent: 'maya',
  },
];

/** Full tool set: the shared Composio/MCP catalog plus native-provider tools. */
export function getAllTools(): NativeTool[] {
  return [...INTEGRATIONS_CATALOG, ...NATIVE_TOOLS];
}

/** Tools available to one agent, across both the shared catalog and native tools. */
export function getAllToolsByAgent(agent: AgentSlug): NativeTool[] {
  return [...getIntegrationsByAgent(agent), ...NATIVE_TOOLS.filter(t => t.agents.includes(agent))];
}
