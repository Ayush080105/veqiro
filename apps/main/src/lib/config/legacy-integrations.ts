/**
 * Catalog slugs still served by the legacy native connect paths (the bespoke
 * SocialAccount OAuth module for X/LinkedIn) instead of the uniform Composio
 * flow. Excluded from MCP catalog rendering to avoid duplicate cards.
 *
 * "gmail"/"google-calendar" are intentionally absent — Google no longer has
 * a native integration of any kind; it now connects the same way as every
 * other integration, purely opt-in via its Composio-backed MCP catalog card.
 *
 * "instagram" is absent because it's not in the MCP catalog at all — it
 * publishes via the native Meta Graph API provider and renders as a native
 * OAuth card (see settings/integrations LEGACY_INTEGRATIONS).
 */
export const LEGACY_MCP_SLUGS = new Set(["twitter", "linkedin"])
