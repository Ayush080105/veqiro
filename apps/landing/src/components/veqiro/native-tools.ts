import type { AgentSlug } from '@repo/integrations-catalog';

/**
 * Tools that connect through a native provider (not Composio/MCP), so they
 * live outside @repo/integrations-catalog — mirrors LEGACY_INTEGRATIONS in
 * apps/main's settings/integrations page. Instagram publishes via the native
 * Meta Graph API provider; Twitter/X and LinkedIn are already Composio-backed
 * catalog entries, so only Instagram needs to be added here.
 */
export const NATIVE_TOOLS: { slug: string; name: string; logoUrl: string; agents: AgentSlug[] }[] = [
  {
    slug: 'instagram',
    name: 'Instagram',
    logoUrl: 'https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/instagram.svg',
    agents: ['maya'],
  },
];
