/**
 * Catalog slugs still served by the legacy native connect paths (the bespoke
 * SocialAccount OAuth module for X/LinkedIn) instead of the uniform Composio
 * flow. Excluded from MCP catalog rendering to avoid duplicate cards.
 *
 * "gmail"/"google-calendar" are intentionally absent — Google no longer has
 * a native integration of any kind; it now connects the same way as every
 * other integration, purely opt-in via its Composio-backed MCP catalog card.
 *
 * "instagram" is absent because its native card is gone — it is a plain
 * Composio catalog row now, for analytics and publishing alike.
 */
export const LEGACY_MCP_SLUGS = new Set(["twitter", "linkedin"])
