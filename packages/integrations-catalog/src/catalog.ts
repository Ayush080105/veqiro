import type { AgentSlug, IntegrationCatalogEntry } from "./types.js";

/**
 * Source of truth for the integrations catalog (originally scoped from
 * MCP_INTEGRATIONS_FINAL.pdf's 94 candidates; pared down to the 51 rows with
 * a real, verified provider toolkit — the other 43 had no usable match after
 * a full coverage audit + manual review and were removed rather than kept as
 * permanent disabled "coming-soon" cards). Nearly every row ships
 * `status: "composio"` with a real `toolkitSlug`, confirmed against
 * Composio's toolkit catalog by scripts/audit-composio-toolkits.mts.
 *
 * Instagram runs entirely on Composio — analytics and publishing both. The
 * native Meta Graph provider it used to publish through has been removed;
 * Maya targets it with `platform: "instagram"` instead of a SocialAccount.
 *
 * Adding a new row: default it via `entry({...})` with no `status`/`composio`
 * (defaults to "coming-soon") until you've confirmed a real Composio
 * toolkitSlug for it — do not hand-guess one; a wrong one fails silently at
 * connect time. Once confirmed, set `status: "composio"` and remove the row
 * entirely if no real match ever turns up, rather than leaving a
 * permanently-disabled card.
 */

function entry(
  partial: Omit<IntegrationCatalogEntry, "status" | "composio"> &
    Partial<Pick<IntegrationCatalogEntry, "status" | "composio">>
): IntegrationCatalogEntry {
  return { status: "coming-soon", ...partial };
}

export const INTEGRATIONS_CATALOG: IntegrationCatalogEntry[] = [
  // --- Vega: Email, Calendar & Scheduling ---
  entry({ slug: "gmail", name: "Gmail", description: "Lets Vega read, label, and draft in your inbox.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "gmail" }, proof: { toolMatch: ["FETCH_EMAILS", "LIST_MESSAGES", "LIST_THREADS"], args: { max_results: 25 }, noun: "emails" }, logoUrl: "https://logos.composio.dev/api/gmail" }),
  entry({ slug: "outlook-mail", name: "Outlook / Microsoft 365 Mail", description: "Same mail tools as Gmail, for Microsoft-tenant users.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "outlook" }, proof: { toolMatch: ["LIST_MESSAGES", "FETCH_EMAILS", "GET_MESSAGES"], noun: "emails" }, logoUrl: "https://logos.composio.dev/api/outlook" }),
  entry({ slug: "google-calendar", name: "Google Calendar", description: "Lets Vega check your schedule and manage events.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "googlecalendar" }, proof: { toolMatch: ["FIND_EVENT", "LIST_EVENTS", "EVENTS_LIST"], noun: "events" }, logoUrl: "https://logos.composio.dev/api/googlecalendar" }),
  entry({ slug: "outlook-calendar", name: "Microsoft Outlook Calendar", description: "Same calendar tools, Microsoft-tenant parity.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "outlook" }, logoUrl: "https://logos.composio.dev/api/outlook" }),
  entry({ slug: "calendly", name: "Calendly", description: "Lets Vega see your booking activity.", category: "Email & Calendar", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "calendly" }, logoUrl: "https://logos.composio.dev/api/calendly" }),

  // --- Vega: Team Chat & Video ---
  entry({ slug: "slack", name: "Slack", description: "Lets Vega post updates and digests to a channel.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "slack" }, proof: { toolMatch: ["LIST_ALL_CHANNELS", "LIST_CONVERSATIONS", "LIST_CHANNELS"], noun: "channels" }, logoUrl: "https://logos.composio.dev/api/slack" }),
  entry({ slug: "microsoft-teams", name: "Microsoft Teams", description: "Same as Slack, Microsoft-shop parity.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "microsoft_teams" }, logoUrl: "https://logos.composio.dev/api/microsoft_teams" }),
  entry({ slug: "discord", name: "Discord", description: "Same as Slack, for community/dev-team channels.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "discord" }, logoUrl: "https://logos.composio.dev/api/discord" }),
  entry({ slug: "zoom", name: "Zoom", description: "Lets Vega pull meeting summaries and schedule.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "zoom" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/zoom.svg" }),
  entry({ slug: "google-meet", name: "Google Meet", description: "Meeting metadata for calendar summaries.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "googlemeet" }, logoUrl: "https://logos.composio.dev/api/googlemeet" }),
  entry({ slug: "telegram", name: "Telegram", description: "For founder/ops teams that run on Telegram.", category: "Chat & Video", primaryAgent: "vega", agents: ["vega"], status: "composio", composio: { toolkitSlug: "telegram" }, logoUrl: "https://logos.composio.dev/api/telegram" }),

  // --- Maya: Social Media & Publishing ---
  // Composio's "twitter" toolkit has no Composio-managed OAuth scheme — it
  // needs a real X Developer App (client_id/secret) registered manually in
  // the Composio dashboard before this can be wired up. Stays coming-soon.
  entry({ slug: "twitter", name: "X (Twitter)", description: "Publish flow for Maya.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], logoUrl: "https://logos.composio.dev/api/twitter" }),
  entry({ slug: "linkedin", name: "LinkedIn", description: "Publish flow for Maya.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "composio", composio: { toolkitSlug: "linkedin" }, logoUrl: "https://logos.composio.dev/api/linkedin" }),
  // Uses instagram_business_* Instagram-Login scopes, so no Facebook Page is
  // required. Publishing goes through instagram.composio.ts (verified live);
  // the Cloudinary restage in meta-staging.ts is still required because Meta
  // allow-lists media hosts regardless of how the API is called.
  entry({ slug: "instagram", name: "Instagram", description: "Post performance, reach, and engagement for your Instagram business account.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "composio", composio: { toolkitSlug: "instagram" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/instagram.svg" }),
  entry({ slug: "facebook-pages", name: "Facebook Pages", description: "Extends Maya to Meta Pages.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "composio", composio: { toolkitSlug: "facebook" }, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" }),
  entry({ slug: "reddit", name: "Reddit", description: "Post/comment and subreddit monitoring.", category: "Social Media", primaryAgent: "maya", agents: ["maya"], status: "composio", composio: { toolkitSlug: "reddit" }, logoUrl: "https://logos.composio.dev/api/reddit" }),

  // --- Marketing, Ads & CRM: Maya (creative) / Rex (spend & data) ---
  entry({ slug: "google-ads", name: "Google Ads", description: "Rex: ROAS/CAC by channel. Maya: ad creative drafts.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "composio", composio: { toolkitSlug: "googleads" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/googleads.png" }),
  entry({ slug: "hubspot-marketing", name: "HubSpot Marketing Hub", description: "Central marketing data for Rex, campaign drafts for Maya.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "composio", composio: { toolkitSlug: "hubspot" }, logoUrl: "https://logos.composio.dev/api/hubspot" }),
  entry({ slug: "mailchimp", name: "Mailchimp", description: "Campaign performance data plus newsletter drafts.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "composio", composio: { toolkitSlug: "mailchimp" }, logoUrl: "https://logos.composio.dev/api/mailchimp" }),
  entry({ slug: "zoho", name: "Zoho", description: "CRM contacts/deals for Rex, campaign drafts for Maya — same role as HubSpot for teams on Zoho.", category: "Marketing & Ads", primaryAgent: "rex", agents: ["maya", "rex"], status: "composio", composio: { toolkitSlug: "zoho" }, logoUrl: "https://logos.composio.dev/api/zoho" }),
  entry({ slug: "google-analytics-4", name: "Google Analytics 4", description: "Traffic trends feeding Rex's forecasts.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "google_analytics" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/googleanalytics.png" }),
  entry({ slug: "google-search-console", name: "Google Search Console", description: "Ranking/impression data for Sage's SEO audits.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "composio", composio: { toolkitSlug: "google_search_console" }, logoUrl: "https://logos.composio.dev/api/google_search_console" }),
  entry({ slug: "ahrefs", name: "Ahrefs", description: "Sage: backlink audits, keyword gaps.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "composio", composio: { toolkitSlug: "ahrefs" }, logoUrl: "https://logos.composio.dev/api/ahrefs" }),

  // --- Sage: SEO & CMS Publishing ---
  // No Composio toolkit found for WordPress or Strapi (audited via
  // scripts/audit-composio-toolkits.mts) — stay coming-soon.
  entry({ slug: "wordpress", name: "WordPress", description: "Direct-publish generated blog posts.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], logoUrl: "https://api.smithery.ai/servers/node2flow/wordpress/icon" }),
  entry({ slug: "sanity", name: "Sanity", description: "Structured content publishing, for dev teams.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], status: "composio", composio: { toolkitSlug: "sanity" }, logoUrl: "https://logos.composio.dev/api/sanity" }),
  entry({ slug: "strapi", name: "Strapi", description: "Self-hosted publish target.", category: "SEO & CMS", primaryAgent: "sage", agents: ["sage"], logoUrl: "https://api.smithery.ai/servers/alex2zimmermann-ux/strapi-mcp/icon" }),

  // --- Scout: Web Research & Data Extraction ---
  entry({ slug: "tavily", name: "Tavily", description: "Faster, cleaner grounding for research-topic.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "composio", composio: { toolkitSlug: "tavily" }, logoUrl: "https://logos.composio.dev/api/tavily" }),
  entry({ slug: "exa", name: "Exa", description: "Neural/semantic competitor discovery.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "composio", composio: { toolkitSlug: "exa" }, logoUrl: "https://logos.composio.dev/api/exa" }),
  entry({ slug: "apify", name: "Apify", description: "Custom scrapers for niche sources.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "composio", composio: { toolkitSlug: "apify" }, logoUrl: "https://logos.composio.dev/api/apify" }),
  entry({ slug: "bright-data", name: "Bright Data", description: "Large-scale resilient scraping and proxies.", category: "Web Research", primaryAgent: "scout", agents: ["scout"], status: "composio", composio: { toolkitSlug: "brightdata" }, logoUrl: "https://www.google.com/s2/favicons?domain=brightdata.com&sz=64" }),

  // --- Rex: Analytics, BI & Spreadsheets ---
  entry({ slug: "posthog", name: "PostHog", description: "Self-hosted product-analytics alternative.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "posthog" }, logoUrl: "https://www.google.com/s2/favicons?domain=posthog.com&sz=64" }),
  entry({ slug: "google-sheets", name: "Google Sheets", description: "Lightweight dataset source.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "googlesheets" }, logoUrl: "https://logos.composio.dev/api/googlesheets" }),
  entry({ slug: "microsoft-excel", name: "Microsoft Excel", description: "Enterprise spreadsheet source.", category: "Analytics & BI", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "excel" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/Excel.png" }),

  // --- Rex: Finance, Payments & Billing ---
  entry({ slug: "quickbooks-online", name: "QuickBooks Online", description: "Direct P&L/balance-sheet data for financial-analysis.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "quickbooks" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/quickbooks.jpg" }),
  entry({ slug: "stripe", name: "Stripe", description: "Revenue/MRR/churn — core Rex input.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "stripe" }, proof: { toolMatch: ["LIST_CUSTOMERS", "LIST_CHARGES", "LIST_PAYMENTS"], noun: "customers" }, logoUrl: "https://logos.composio.dev/api/stripe" }),
  // Composio's "paypal" toolkit only offers S2S_OAUTH2 with no Composio-managed
  // scheme — needs a real PayPal app client id/secret registered manually in
  // the Composio dashboard before this can be wired up. Stays coming-soon.
  entry({ slug: "paypal", name: "PayPal", description: "Alternate payment-rail revenue data.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], logoUrl: "https://logos.composio.dev/api/paypal" }),
  entry({ slug: "razorpay", name: "Razorpay", description: "India-market revenue data.", category: "Finance & Payments", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "razorpay" }, logoUrl: "https://www.google.com/s2/favicons?domain=razorpay.com&sz=64" }),

  // --- Lex: Documents, Files & Knowledge Bases ---
  entry({ slug: "google-drive", name: "Google Drive", description: "Ingest contracts/docs for Lex's RAG pipeline.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex", "vega"], status: "composio", composio: { toolkitSlug: "googledrive" }, proof: { toolMatch: ["LIST_FILES", "FIND_FILE", "SEARCH_FILES"], noun: "files" }, logoUrl: "https://logos.composio.dev/api/googledrive" }),
  entry({ slug: "dropbox", name: "Dropbox", description: "Alternative file-storage source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "composio", composio: { toolkitSlug: "dropbox" }, logoUrl: "https://logos.composio.dev/api/dropbox" }),
  entry({ slug: "box", name: "Box", description: "Enterprise document-management source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "composio", composio: { toolkitSlug: "box" }, logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/box.svg" }),
  entry({ slug: "onedrive-sharepoint", name: "OneDrive / SharePoint", description: "Microsoft-shop document source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "composio", composio: { toolkitSlug: "one_drive" }, logoUrl: "https://logos.composio.dev/api/one_drive" }),
  entry({ slug: "notion", name: "Notion", description: "Company knowledge into Lex/Vega Q&A.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex", "vega"], status: "composio", composio: { toolkitSlug: "notion" }, proof: { toolMatch: ["SEARCH_NOTION_PAGE", "LIST_PAGES", "SEARCH"], noun: "pages" }, logoUrl: "https://logos.composio.dev/api/notion" }),
  entry({ slug: "confluence", name: "Confluence", description: "Enterprise knowledge-base source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "composio", composio: { toolkitSlug: "confluence" }, logoUrl: "https://logos.composio.dev/api/confluence" }),
  entry({ slug: "google-docs", name: "Google Docs", description: "Read/write drafted legal docs.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "composio", composio: { toolkitSlug: "googledocs" }, logoUrl: "https://logos.composio.dev/api/googledocs" }),
  entry({ slug: "airtable", name: "Airtable", description: "Contract/deal metadata source.", category: "Docs & Knowledge", primaryAgent: "lex", agents: ["lex"], status: "composio", composio: { toolkitSlug: "airtable" }, proof: { toolMatch: ["LIST_BASES", "LIST_RECORDS"], noun: "bases" }, logoUrl: "https://logos.composio.dev/api/airtable" }),

  // --- Project & Task Management (cross-agent, mainly Rex) ---
  entry({ slug: "asana", name: "Asana", description: "Project-status signals for exec briefings.", category: "Project Management", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "asana" }, proof: { toolMatch: ["LIST_TASKS", "GET_TASKS", "LIST_PROJECTS"], noun: "tasks" }, logoUrl: "https://logos.composio.dev/api/asana" }),
  entry({ slug: "linear", name: "Linear", description: "Modern eng-team velocity data.", category: "Project Management", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "linear" }, proof: { toolMatch: ["LIST_LINEAR_ISSUES", "LIST_ISSUES"], noun: "issues" }, logoUrl: "https://logos.composio.dev/api/linear" }),
  entry({ slug: "clickup", name: "ClickUp", description: "SMB project-status source.", category: "Project Management", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "clickup" }, logoUrl: "https://logos.composio.dev/api/clickup" }),

  // --- Databases & Data Infrastructure: Rex ---
  entry({ slug: "supabase", name: "Supabase", description: "Popular with startups already on Supabase.", category: "Databases", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "supabase" }, logoUrl: "https://logos.composio.dev/api/supabase" }),
  // No Composio toolkit found for BigQuery (audited via
  // scripts/audit-composio-toolkits.mts) — stays coming-soon.
  entry({ slug: "bigquery", name: "BigQuery", description: "Cloud warehouse, GCP-native.", category: "Databases", primaryAgent: "rex", agents: ["rex"], logoUrl: "https://api.smithery.ai/servers/bigquery/icon" }),
  entry({ slug: "clickhouse", name: "ClickHouse", description: "High-volume event analytics.", category: "Databases", primaryAgent: "rex", agents: ["rex"], status: "composio", composio: { toolkitSlug: "clickhouse" }, logoUrl: "https://logos.composio.dev/api/clickhouse" }),
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
