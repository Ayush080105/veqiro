/**
 * Catalog slugs still served by the legacy native connect paths (better-auth
 * for Google, the bespoke SocialAccount OAuth module for X/LinkedIn/Instagram)
 * instead of the uniform Smithery flow. Excluded from MCP catalog rendering
 * to avoid duplicate cards. Drop entries here as each row's Smithery cutover
 * ships (see plan Rollout phases 2-3).
 */
export const LEGACY_MCP_SLUGS = new Set(["gmail", "google-calendar", "twitter", "linkedin", "instagram"])
