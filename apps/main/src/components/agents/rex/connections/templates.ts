/** What people can ask Rex to build once HubSpot data is in. Prompts name the real tables and columns. */

export interface HubspotTemplate {
  id: string
  title: string
  blurb: string
  /** HubSpot objects that must be synced for this dashboard to make sense. */
  needs: string[]
  prompt: string
}

export const HUBSPOT_TEMPLATES: HubspotTemplate[] = [
  {
    id: "pipeline",
    title: "Sales pipeline",
    blurb: "Open value, weighted forecast and where deals sit",
    needs: ["deals"],
    prompt:
      "Sales pipeline dashboard from the HubSpot deals table (hubspot_deals). KPIs: open pipeline value (sum of amount where is_open is true), weighted pipeline (sum of weighted_amount where is_open is true), number of open deals, average deal size. Charts: open deal value by stage, open deal value by owner_name, deals created per month from created_at. A table of the 10 largest open deals with deal_name, stage, owner_name, amount and close_date. Filters for pipeline and owner_name.",
  },
  {
    id: "revenue",
    title: "Revenue and win rate",
    blurb: "Closed-won revenue, win rate and who is winning",
    needs: ["deals"],
    prompt:
      "Revenue and win rate dashboard from the HubSpot deals table (hubspot_deals). KPIs: closed-won revenue (sum of amount where is_won is true), deals won, win rate (won divided by won plus lost). Charts: closed-won revenue per month by close_date, win rate per month, closed-won revenue by owner_name, closed-won revenue by lead_source. Add a date range filter on close_date.",
  },
  {
    id: "leads",
    title: "Leads and lifecycle",
    blurb: "Where contacts come from and how far they get",
    needs: ["contacts"],
    prompt:
      "Lead sources and lifecycle dashboard from the HubSpot contacts table (hubspot_contacts). Use counts only and never show individual people. KPIs: total contacts, contacts created in the last 30 days. Charts: contacts created per month from created_at, contacts by lifecycle_stage, contacts by lead_source, contacts by lead_status. Filters for lifecycle_stage and lead_source.",
  },
  {
    id: "tickets",
    title: "Support tickets",
    blurb: "Backlog, volume and how quickly tickets close",
    needs: ["tickets"],
    prompt:
      "Support dashboard from the HubSpot tickets table (hubspot_tickets). KPIs: open tickets (is_open is true), tickets created in the last 30 days, average days from created_at to closed_at for closed tickets. Charts: tickets created per month, open tickets by stage, tickets by priority, open tickets by owner_name. Filters for pipeline and priority.",
  },
  {
    id: "accounts",
    title: "Top accounts",
    blurb: "Which companies bring in the most",
    needs: ["deals"],
    prompt:
      "Top accounts dashboard from the HubSpot deals table (hubspot_deals). KPIs: number of accounts with a won deal, average won amount per account. Charts: top 10 accounts by closed-won revenue using associated_company_name, open pipeline value by associated_company_name (top 10), deals won per month. A table of the 10 largest open deals with associated_company_name, deal_name, stage and amount.",
  },
]

/** Read-only access for the four core objects plus what labels them. The optional ones unlock more objects. */
export const HUBSPOT_CORE_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.companies.read",
  "crm.objects.contacts.read",
  "crm.objects.owners.read",
  "crm.schemas.deals.read",
  "crm.schemas.companies.read",
  "crm.schemas.contacts.read",
]

export const HUBSPOT_OPTIONAL_SCOPES = [
  "tickets",
  "crm.objects.line_items.read",
  "crm.objects.quotes.read",
  "e-commerce",
  "crm.objects.custom.read",
  "crm.schemas.custom.read",
]
