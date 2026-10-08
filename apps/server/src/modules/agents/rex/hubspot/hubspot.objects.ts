/**
 * The HubSpot objects Rex can mirror, as data. Adding an object is adding an entry here; the pull,
 * table and sync code is generic over `ObjectSpec`.
 *
 * `defaults` maps a HubSpot property to the friendly column name Rex uses for it. Everything not in
 * `defaults` keeps HubSpot's own internal name, so a rename in HubSpot never breaks a dashboard.
 */

export interface ObjectSpec {
  /** The API object type: "deals", or "2-123456" for a custom object. */
  type: string;
  label: string;
  /** 1 = on by default, 2 = opt-in standard objects, 3 = custom objects. */
  tier: 1 | 2 | 3;
  rowCap: number;
  /** HubSpot property -> friendly column name. These are the recommended fields. */
  defaults: Record<string, string>;
  /** Properties that identify a person or place; off unless the customer opts in per column. */
  pii: string[];
  /** The property to filter on for "what changed since". */
  modifiedProp: string;
  /** Tried once if HubSpot rejects modifiedProp for this account. */
  alternateModifiedProp?: string;
  /** Properties holding an owner id; shown as the owner's name. */
  ownerProps: string[];
  stageProp?: string;
  pipelineProp?: string;
  pipelineObject?: "deals" | "tickets";
  /** Columns the table builder generates itself; no HubSpot property may take these names. */
  derivedColumns: string[];
}

const ROW_CAP = 100_000;
const ACTIVITY_CAP = 50_000;
const OWNER = "hubspot_owner_id";
const COMPANY_COLUMNS = ["associated_company_id", "associated_company_name"];

export const OBJECT_SPECS: Record<string, ObjectSpec> = {
  deals: {
    type: "deals", label: "Deals", tier: 1, rowCap: ROW_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: {
      dealname: "deal_name", amount: "amount", dealstage: "stage", pipeline: "pipeline",
      closedate: "close_date", createdate: "created_at", hs_lastmodifieddate: "updated_at",
      [OWNER]: "owner_name", dealtype: "deal_type", deal_currency_code: "deal_currency_code",
      hs_forecast_amount: "forecast_amount", hs_closed_amount_in_home_currency: "closed_amount_home_currency",
      hs_analytics_source: "lead_source",
    },
    pii: [], ownerProps: [OWNER], stageProp: "dealstage", pipelineProp: "pipeline", pipelineObject: "deals",
    derivedColumns: ["is_open", "is_won", "is_lost", "stage_probability", "weighted_amount", ...COMPANY_COLUMNS],
  },
  companies: {
    type: "companies", label: "Companies", tier: 1, rowCap: ROW_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: {
      name: "name", domain: "domain", industry: "industry", numberofemployees: "employees",
      annualrevenue: "annual_revenue", city: "city", state: "state", country: "country",
      lifecyclestage: "lifecycle_stage", type: "company_type", createdate: "created_at",
      hs_lastmodifieddate: "updated_at", [OWNER]: "owner_name", hs_analytics_source: "lead_source",
    },
    pii: ["phone", "address", "address2", "zip"], ownerProps: [OWNER], derivedColumns: [],
  },
  contacts: {
    type: "contacts", label: "Contacts", tier: 1, rowCap: ROW_CAP, modifiedProp: "lastmodifieddate", alternateModifiedProp: "hs_lastmodifieddate",
    defaults: {
      lifecyclestage: "lifecycle_stage", hs_lead_status: "lead_status", createdate: "created_at",
      lastmodifieddate: "updated_at", hs_analytics_source: "lead_source", [OWNER]: "owner_name",
      jobtitle: "job_title", city: "city", country: "country",
    },
    pii: ["email", "phone", "mobilephone", "firstname", "lastname", "address", "zip", "fax", "hs_additional_emails", "hs_whatsapp_phone_number"],
    ownerProps: [OWNER], derivedColumns: [...COMPANY_COLUMNS],
  },
  tickets: {
    type: "tickets", label: "Tickets", tier: 1, rowCap: ROW_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: {
      subject: "subject", hs_pipeline: "pipeline", hs_pipeline_stage: "stage", hs_ticket_priority: "priority",
      source_type: "source", hs_ticket_category: "category", createdate: "created_at", closed_date: "closed_at",
      hs_lastmodifieddate: "updated_at", [OWNER]: "owner_name",
    },
    pii: [], ownerProps: [OWNER], stageProp: "hs_pipeline_stage", pipelineProp: "hs_pipeline", pipelineObject: "tickets",
    derivedColumns: ["is_open", ...COMPANY_COLUMNS],
  },
  products: {
    type: "products", label: "Products", tier: 2, rowCap: ROW_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: { name: "name", price: "price", hs_sku: "sku", hs_cost_of_goods_sold: "cost", createdate: "created_at", hs_lastmodifieddate: "updated_at" },
    pii: [], ownerProps: [], derivedColumns: [],
  },
  line_items: {
    type: "line_items", label: "Line items", tier: 2, rowCap: ROW_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: { name: "name", quantity: "quantity", price: "price", amount: "amount", hs_sku: "sku", createdate: "created_at", hs_lastmodifieddate: "updated_at" },
    pii: [], ownerProps: [], derivedColumns: [],
  },
  quotes: {
    type: "quotes", label: "Quotes", tier: 2, rowCap: ROW_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: { hs_title: "title", hs_status: "status", hs_expiration_date: "expiration_date", hs_quote_amount: "amount", hs_createdate: "created_at", hs_lastmodifieddate: "updated_at", [OWNER]: "owner_name" },
    pii: [], ownerProps: [OWNER], derivedColumns: [],
  },
  calls: {
    type: "calls", label: "Calls", tier: 2, rowCap: ACTIVITY_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: { hs_call_title: "title", hs_call_direction: "direction", hs_call_duration: "duration_ms", hs_call_disposition: "outcome", hs_timestamp: "occurred_at", [OWNER]: "owner_name", hs_lastmodifieddate: "updated_at" },
    pii: [], ownerProps: [OWNER], derivedColumns: [],
  },
  meetings: {
    type: "meetings", label: "Meetings", tier: 2, rowCap: ACTIVITY_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: { hs_meeting_title: "title", hs_meeting_outcome: "outcome", hs_meeting_start_time: "start_time", hs_meeting_end_time: "end_time", [OWNER]: "owner_name", hs_lastmodifieddate: "updated_at" },
    pii: [], ownerProps: [OWNER], derivedColumns: [],
  },
  tasks: {
    type: "tasks", label: "Tasks", tier: 2, rowCap: ACTIVITY_CAP, modifiedProp: "hs_lastmodifieddate",
    defaults: { hs_task_subject: "subject", hs_task_status: "status", hs_task_priority: "priority", hs_task_type: "task_type", hs_timestamp: "due_at", [OWNER]: "owner_name", hs_lastmodifieddate: "updated_at" },
    pii: [], ownerProps: [OWNER], derivedColumns: [],
  },
};

export const DEFAULT_OBJECTS = Object.values(OBJECT_SPECS).filter((s) => s.tier === 1).map((s) => s.type);

export function customObjectSpec(schema: {
  objectTypeId: string;
  name: string;
  labels: { plural: string };
  primaryDisplayProperty?: string;
}): ObjectSpec {
  const defaults: Record<string, string> = {
    hs_createdate: "created_at", hs_lastmodifieddate: "updated_at", [OWNER]: "owner_name",
  };
  if (schema.primaryDisplayProperty) defaults[schema.primaryDisplayProperty] = "primary_name";
  return {
    type: schema.objectTypeId, label: schema.labels.plural || schema.name, tier: 3, rowCap: ACTIVITY_CAP,
    defaults, pii: [], modifiedProp: "hs_lastmodifieddate", ownerProps: [OWNER], derivedColumns: [],
  };
}

/** A spec for a built-in object name or a custom object's type id (resolved from its schema). */
export function specFor(type: string, customSchemas: Parameters<typeof customObjectSpec>[0][] = []): ObjectSpec | null {
  if (OBJECT_SPECS[type]) return OBJECT_SPECS[type]!;
  const schema = customSchemas.find((s) => s.objectTypeId === type);
  return schema ? customObjectSpec(schema) : null;
}
