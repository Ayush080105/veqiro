import type { AgentSlug, IntegrationCatalogEntry } from "./types.js";

/**
 * Source of truth for the integrations catalog (originally scoped from
 * MCP_INTEGRATIONS_FINAL.pdf's 94 candidates; pared down to the 51 rows with
 * a real, verified Smithery server reachable over HTTP — the other 43 had no
 * usable match after a full registry audit + manual review and were removed
 * rather than kept as permanent disabled "coming-soon" cards). Every row here
 * ships `status: "smithery"` with a real `qualifiedName`.
 *
 * Adding a new row: default it via `entry({...})` with no `status`/`smithery`
 * (defaults to "coming-soon") until you've confirmed a real Smithery
 * qualifiedName for it — do not hand-guess one; a wrong one fails silently
 * at connect time. Once confirmed, set `status: "smithery"` and remove the
 * row entirely if no real match ever turns up, rather than leaving a
 * permanently-disabled card.
 */

function entry(
  partial: Omit<IntegrationCatalogEntry, "status" | "smithery"> &
    Partial<Pick<IntegrationCatalogEntry, "status" | "smithery">>
): IntegrationCatalogEntry {
  return { status: "coming-soon", ...partial };
}

export const INTEGRATIONS_CATALOG: IntegrationCatalogEntry[] = [
  // --- Vega: Email, Calendar & Scheduling ---
  entry({ slug: "gmail", name: "Gmail", description: "Powers process_inbox, draft_reply, compose_email.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "gmail" }, logoUrl: "https://api.smithery.ai/servers/gmail/icon" }),
  entry({ slug: "outlook-mail", name: "Outlook / Microsoft 365 Mail", description: "Same mail tools as Gmail, for Microsoft-tenant users.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "outlook" }, logoUrl: "https://logos.composio.dev/api/outlook" }),
  entry({ slug: "google-calendar", name: "Google Calendar", description: "Powers calendar_summary, create_event.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "googlecalendar" }, logoUrl: "https://logos.composio.dev/api/googlecalendar" }),
  entry({ slug: "outlook-calendar", name: "Microsoft Outlook Calendar", description: "Same calendar tools, Microsoft-tenant parity.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "outlook" }, logoUrl: "https://logos.composio.dev/api/outlook" }),
  entry({ slug: "calendly", name: "Calendly", description: "Pulls bookings into the morning briefing.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "calendly" }, logoUrl: "https://api.smithery.ai/servers/calendly/icon" }),

  // --- Vega: Team Chat & Video ---
  entry({ slug: "slack", name: "Slack", description: "Post briefings and digests to a channel.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "node2flow/slack" }, logoUrl: "https://api.smithery.ai/servers/node2flow/slack/icon" }),
  entry({ slug: "microsoft-teams", name: "Microsoft Teams", description: "Same as Slack, Microsoft-shop parity.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "microsoft_teams" }, logoUrl: "https://logos.composio.dev/api/microsoft_teams" }),
  entry({ slug: "discord", name: "Discord", description: "Same as Slack, for community/dev-team channels.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "discord" }, logoUrl: "https://api.smithery.ai/servers/discord/icon" }),
  entry({ slug: "zoom", name: "Zoom", description: "Pull meeting summaries into briefings.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "zoom" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/zoom.svg" }),
  entry({ slug: "google-meet", name: "Google Meet", description: "Meeting metadata for calendar summaries.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "googlemeet" }, logoUrl: "https://logos.composio.dev/api/googlemeet" }),
  entry({ slug: "telegram", name: "Telegram", description: "For founder/ops teams that run on Telegram.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "smithery", smithery: { qualifiedName: "node2flow/telegram-bot" }, logoUrl: "https://api.smithery.ai/servers/node2flow/telegram-bot/icon" }),

  // --- Maya: Social Media & Publishing ---
  entry({ slug: "twitter", name: "X (Twitter)", description: "Publish flow for Maya.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "smithery", smithery: { qualifiedName: "twitter" }, logoUrl: "https://api.smithery.ai/servers/twitter/icon" }),
  entry({ slug: "linkedin", name: "LinkedIn", description: "Publish flow for Maya.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "smithery", smithery: { qualifiedName: "linkedin" }, logoUrl: "https://logos.composio.dev/api/linkedin" }),
  entry({ slug: "instagram", name: "Instagram", description: "Publish flow for Maya.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "smithery", smithery: { qualifiedName: "instagram" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/instagram.svg" }),
  entry({ slug: "facebook-pages", name: "Facebook Pages", description: "Extends Maya to Meta Pages.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "smithery", smithery: { qualifiedName: "node2flow/facebook-pages" }, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" }),
  entry({ slug: "reddit", name: "Reddit", description: "Post/comment and subreddit monitoring.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "smithery", smithery: { qualifiedName: "reddit" }, logoUrl: "https://logos.composio.dev/api/reddit" }),

  // --- Marketing, Ads & CRM: Maya (creative) / Rex (spend & data) ---
  entry({ slug: "google-ads", name: "Google Ads", description: "Rex: ROAS/CAC by channel. Maya: ad creative drafts.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "smithery", smithery: { qualifiedName: "googleads" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/googleads.png" }),
  entry({ slug: "hubspot-marketing", name: "HubSpot Marketing Hub", description: "Central marketing data for Rex, campaign drafts for Maya.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "smithery", smithery: { qualifiedName: "hubspot" }, logoUrl: "https://api.smithery.ai/servers/hubspot/icon" }),
  entry({ slug: "mailchimp", name: "Mailchimp", description: "Campaign performance data plus newsletter drafts.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "smithery", smithery: { qualifiedName: "mailchimp" }, logoUrl: "https://logos.composio.dev/api/mailchimp" }),
  entry({ slug: "zoho", name: "Zoho", description: "CRM contacts/deals for Rex, campaign drafts for Maya — same role as HubSpot for teams on Zoho.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "smithery", smithery: { qualifiedName: "zoho" }, logoUrl: "https://logos.composio.dev/api/zoho" }),
  entry({ slug: "google-analytics-4", name: "Google Analytics 4", description: "Traffic trends feeding Rex's forecasts.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "google_analytics" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/googleanalytics.png" }),
  entry({ slug: "google-search-console", name: "Google Search Console", description: "Ranking/impression data for Sage's SEO audits.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "smithery", smithery: { qualifiedName: "google_search_console" }, logoUrl: "https://api.smithery.ai/servers/google_search_console/icon" }),
  entry({ slug: "ahrefs", name: "Ahrefs", description: "Sage: backlink audits, keyword gaps.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "smithery", smithery: { qualifiedName: "ahrefs" }, logoUrl: "https://api.smithery.ai/servers/ahrefs/icon" }),

  // --- Sage: SEO & CMS Publishing ---
  entry({ slug: "wordpress", name: "WordPress", description: "Direct-publish generated blog posts.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "smithery", smithery: { qualifiedName: "node2flow/wordpress" }, logoUrl: "https://api.smithery.ai/servers/node2flow/wordpress/icon" }),
  entry({ slug: "sanity", name: "Sanity", description: "Structured content publishing, for dev teams.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "smithery", smithery: { qualifiedName: "sanity" }, logoUrl: "https://api.smithery.ai/servers/sanity/icon" }),
  entry({ slug: "strapi", name: "Strapi", description: "Self-hosted publish target.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "smithery", smithery: { qualifiedName: "alex2zimmermann-ux/strapi-mcp" }, logoUrl: "https://api.smithery.ai/servers/alex2zimmermann-ux/strapi-mcp/icon" }),

  // --- Scout: Web Research & Data Extraction ---
  entry({ slug: "tavily", name: "Tavily", description: "Faster, cleaner grounding for research-topic.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "smithery", smithery: { qualifiedName: "Tavily" }, logoUrl: "https://api.smithery.ai/servers/Tavily/icon" }),
  entry({ slug: "exa", name: "Exa", description: "Neural/semantic competitor discovery.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "smithery", smithery: { qualifiedName: "exa" }, logoUrl: "https://api.smithery.ai/servers/exa/icon" }),
  entry({ slug: "apify", name: "Apify", description: "Custom scrapers for niche sources.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "smithery", smithery: { qualifiedName: "apify" }, logoUrl: "https://api.smithery.ai/servers/apify/icon" }),
  entry({ slug: "bright-data", name: "Bright Data", description: "Large-scale resilient scraping and proxies.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "smithery", smithery: { qualifiedName: "brightdata" }, logoUrl: "https://www.google.com/s2/favicons?domain=brightdata.com&sz=64" }),

  // --- Rex: Analytics, BI & Spreadsheets ---
  entry({ slug: "posthog", name: "PostHog", description: "Self-hosted product-analytics alternative.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "PostHog" }, logoUrl: "https://www.google.com/s2/favicons?domain=posthog.com&sz=64" }),
  entry({ slug: "google-sheets", name: "Google Sheets", description: "Lightweight dataset source.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "googlesheets" }, logoUrl: "https://logos.composio.dev/api/googlesheets" }),
  entry({ slug: "microsoft-excel", name: "Microsoft Excel", description: "Enterprise spreadsheet source.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "excel" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/Excel.png" }),

  // --- Rex: Finance, Payments & Billing ---
  entry({ slug: "quickbooks-online", name: "QuickBooks Online", description: "Direct P&L/balance-sheet data for financial-analysis.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "quickbooks" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/quickbooks.jpg" }),
  entry({ slug: "stripe", name: "Stripe", description: "Revenue/MRR/churn — core Rex input.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "stripe" }, logoUrl: "https://api.smithery.ai/servers/stripe/icon" }),
  entry({ slug: "paypal", name: "PayPal", description: "Alternate payment-rail revenue data.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "paypal" }, logoUrl: "https://api.smithery.ai/servers/paypal/icon" }),
  entry({ slug: "razorpay", name: "Razorpay", description: "India-market revenue data.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "wishpool/india-payments" }, logoUrl: "https://www.google.com/s2/favicons?domain=razorpay.com&sz=64" }),

  // --- Lex: Documents, Files & Knowledge Bases ---
  entry({ slug: "google-drive", name: "Google Drive", description: "Ingest contracts/docs for Lex's RAG pipeline.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex", "vega"], status: "smithery", smithery: { qualifiedName: "googledrive" }, logoUrl: "https://logos.composio.dev/api/googledrive" }),
  entry({ slug: "dropbox", name: "Dropbox", description: "Alternative file-storage source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "smithery", smithery: { qualifiedName: "dropbox" }, logoUrl: "https://logos.composio.dev/api/dropbox" }),
  entry({ slug: "box", name: "Box", description: "Enterprise document-management source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "smithery", smithery: { qualifiedName: "box" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/box.svg" }),
  entry({ slug: "onedrive-sharepoint", name: "OneDrive / SharePoint", description: "Microsoft-shop document source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "smithery", smithery: { qualifiedName: "one_drive" }, logoUrl: "https://logos.composio.dev/api/one_drive" }),
  entry({ slug: "notion", name: "Notion", description: "Company knowledge into Lex/Vega Q&A.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex", "vega"], status: "smithery", smithery: { qualifiedName: "notion" }, logoUrl: "https://api.smithery.ai/servers/notion/icon" }),
  entry({ slug: "confluence", name: "Confluence", description: "Enterprise knowledge-base source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "smithery", smithery: { qualifiedName: "confluence" }, logoUrl: "https://logos.composio.dev/api/confluence" }),
  entry({ slug: "google-docs", name: "Google Docs", description: "Read/write drafted legal docs.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "smithery", smithery: { qualifiedName: "googledocs" }, logoUrl: "https://logos.composio.dev/api/googledocs" }),
  entry({ slug: "airtable", name: "Airtable", description: "Contract/deal metadata source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "smithery", smithery: { qualifiedName: "node2flow/airtable" }, logoUrl: "https://api.smithery.ai/servers/node2flow/airtable/icon" }),

  // --- Project & Task Management (cross-agent, mainly Rex) ---
  entry({ slug: "asana", name: "Asana", description: "Project-status signals for exec briefings.", category: "Project Management", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "asana" }, logoUrl: "https://api.smithery.ai/servers/asana/icon" }),
  entry({ slug: "linear", name: "Linear", description: "Modern eng-team velocity data.", category: "Project Management", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "linear" }, logoUrl: "https://api.smithery.ai/servers/linear/icon" }),
  entry({ slug: "clickup", name: "ClickUp", description: "SMB project-status source.", category: "Project Management", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "clickup" }, logoUrl: "https://api.smithery.ai/servers/clickup/icon" }),

  // --- Databases & Data Infrastructure: Rex ---
  entry({ slug: "supabase", name: "Supabase", description: "Popular with startups already on Supabase.", category: "Databases", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "node2flow/supabase" }, logoUrl: "https://api.smithery.ai/servers/node2flow/supabase/icon" }),
  entry({ slug: "bigquery", name: "BigQuery", description: "Cloud warehouse, GCP-native.", category: "Databases", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "bigquery" }, logoUrl: "https://api.smithery.ai/servers/bigquery/icon" }),
  entry({ slug: "clickhouse", name: "ClickHouse", description: "High-volume event analytics.", category: "Databases", primaryAgent: "rex", agents: ["rex"], status: "smithery", smithery: { qualifiedName: "clickhouse" }, logoUrl: "https://api.smithery.ai/servers/clickhouse/icon" }),
];

export function getIntegrationsByAgent(agent: AgentSlug): IntegrationCatalogEntry[] {
  return INTEGRATIONS_CATALOG.filter((e) => e.agents.includes(agent));
}

export function getIntegrationBySlug(slug: string): IntegrationCatalogEntry | undefined {
  return INTEGRATIONS_CATALOG.find((e) => e.slug === slug);
}

export function getIntegrationCategories(): string[] {
  return Array.from(new Set(INTEGRATIONS_CATALOG.map((e) => e.category)));
}
