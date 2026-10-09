/**
 * Builds a believable, varied set of HubSpot records for demos and testing dashboards: companies of
 * different sizes and industries, contacts across the lifecycle, deals spread over a year in every
 * stage (won, lost, open), and support tickets. Pure and deterministic for a given seed, so it can be
 * tested without HubSpot. Nothing here talks to the network.
 *
 * Every record carries a unique code in its name or email (C-0001, D-0001 ...) so it can be told apart
 * from real data and mapped back after creation.
 */

export interface PlanOptions {
  seed: number;
  now: Date;
  /** Scales every count; 0.05 makes a small pilot run. */
  scale: number;
  ownerIds: string[];
  /** Values HubSpot accepts for each enumeration in this account. Anything not listed is not used. */
  allowed: {
    industry: string[];
    lifecyclestage: string[];
    leadStatus: string[];
    dealType: string[];
    ticketPriority: string[];
    ticketCategory: string[];
    ticketSource: string[];
  };
  dealPipelineId: string;
  dealStages: Array<{ id: string; closed: boolean; won: boolean }>;
  ticketPipelineId: string;
  ticketStages: Array<{ id: string; closed: boolean }>;
}

export type Props = Record<string, string>;

export interface Plan {
  companies: Array<{ code: string; props: Props; size: "small" | "mid" | "large" }>;
  contacts: Array<{ code: string; props: Props; company: number }>;
  deals: Array<{ code: string; props: Props; company: number; contact: number }>;
  tickets: Array<{ code: string; props: Props; company: number; contact: number }>;
}

export const MARKER_DOMAIN = "demo-veqiro.example.com";
const BASE = { companies: 60, contacts: 260, deals: 420, tickets: 130 };

/** Small, fast, seedable random numbers. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    weighted: <T,>(xs: ReadonlyArray<readonly [T, number]>): T => {
      const total = xs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [x, w] of xs) { r -= w; if (r <= 0) return x; }
      return xs[xs.length - 1]![0];
    },
  };
}

const FIRST = ["Asha", "Ravi", "Priya", "Arjun", "Neha", "Vikram", "Sneha", "Rohan", "Meera", "Karan", "Anika", "Dev", "Isha", "Kabir", "Tara", "Emma", "Liam", "Sofia", "Noah", "Olivia", "Lucas", "Mia", "Ethan", "Chloe", "Hana", "Omar", "Lena", "Mateo", "Zara", "Jonas"];
const LAST = ["Sharma", "Rao", "Iyer", "Mehta", "Nair", "Kapoor", "Gupta", "Reddy", "Singh", "Das", "Fischer", "Walker", "Costa", "Novak", "Haddad", "Tanaka", "Murphy", "Silva", "Ahmed", "Larsen"];
const CO_A = ["Blue", "Nova", "Zen", "Terra", "Apex", "Lumen", "Orbit", "Pixel", "Cedar", "Vertex", "Harbor", "Quill", "Ember", "Atlas", "Willow"];
const CO_B = ["Labs", "Systems", "Logistics", "Foods", "Health", "Capital", "Retail", "Works", "Networks", "Studio", "Energy", "Learning", "Motors", "Textiles"];
const CITIES: ReadonlyArray<readonly [string, string, string]> = [
  ["Bengaluru", "Karnataka", "India"], ["Mumbai", "Maharashtra", "India"], ["Delhi", "Delhi", "India"], ["Pune", "Maharashtra", "India"],
  ["London", "England", "United Kingdom"], ["Berlin", "Berlin", "Germany"], ["New York", "New York", "United States"],
  ["Austin", "Texas", "United States"], ["Singapore", "Singapore", "Singapore"], ["Dubai", "Dubai", "United Arab Emirates"],
  ["Sydney", "New South Wales", "Australia"], ["Toronto", "Ontario", "Canada"],
];
const TITLES = ["Founder", "CEO", "COO", "Head of Operations", "VP Sales", "Sales Manager", "Marketing Lead", "Finance Controller", "CTO", "Product Manager", "Procurement Lead", "IT Manager"];
const PRODUCTS = ["Platform subscription", "Annual license", "Implementation package", "Support plan", "Analytics add-on", "Pilot program", "Enterprise expansion", "Training bundle", "Data migration", "Premium onboarding"];
const TICKETS: ReadonlyArray<readonly [string, string]> = [
  ["Cannot log in", "The user reports being locked out after a password change."],
  ["Invoice amount looks wrong", "The latest invoice does not match the agreed plan price."],
  ["Export to CSV fails", "Exports time out for reports with more than a few thousand rows."],
  ["Feature request: dark mode", "Several users on the team have asked for a dark theme."],
  ["Integration is not syncing", "Records stopped syncing from the connected tool yesterday."],
  ["Dashboards are slow", "Pages take more than ten seconds to load during the morning."],
  ["Need to add more users", "We have hired four people and need seats for them."],
  ["Password reset email missing", "Reset emails are not arriving, even in spam."],
  ["How do I change my billing contact?", "Finance changed hands and we need to update the contact."],
  ["Data looks out of date", "Numbers have not refreshed since the weekend."],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);
const pad = (n: number, w = 4) => String(n).padStart(w, "0");

/** Only ever use enumeration values this account accepts; fall back to leaving the field out. */
const choose = (r: ReturnType<typeof rng>, wanted: ReadonlyArray<readonly [string, number]>, allowed: string[]): string | undefined => {
  const ok = wanted.filter(([v]) => allowed.includes(v));
  return ok.length ? r.weighted(ok) : allowed.length ? r.pick(allowed) : undefined;
};

export function buildPlan(o: PlanOptions): Plan {
  const r = rng(o.seed);
  const n = (base: number) => Math.max(1, Math.round(base * o.scale));
  const owner = (i: number): Props => (o.ownerIds.length ? { hubspot_owner_id: o.ownerIds[i % o.ownerIds.length]! } : {});
  const put = (p: Props, k: string, v: string | undefined) => { if (v !== undefined) p[k] = v; };

  // ── Companies ──
  const companies: Plan["companies"] = [];
  const names = new Set<string>();
  for (let i = 0; i < n(BASE.companies); i++) {
    // Unique by the web domain it will get, not just the spelling.
    let name = `${r.pick(CO_A)}${r.pick(CO_B)}`;
    for (let tries = 0; names.has(slug(name)); tries++) {
      name = tries < 40 ? `${r.pick(CO_A)}${r.pick(CO_B)}` : `${r.pick(CO_A)}${r.pick(CO_B)}${r.int(2, 99)}`;
    }
    names.add(slug(name));
    const size = r.weighted([["small", 50], ["mid", 35], ["large", 15]] as const);
    const employees = size === "small" ? r.int(5, 60) : size === "mid" ? r.int(61, 500) : r.int(501, 8000);
    const [city, state, country] = r.pick(CITIES);
    const code = `C-${pad(i + 1)}`;
    const p: Props = {
      name: `${name} (${code})`,
      domain: `${slug(name)}.${MARKER_DOMAIN}`,
      numberofemployees: String(employees),
      annualrevenue: String(round50(employees * r.int(40_000, 220_000))),
      city, state, country,
      ...owner(i),
    };
    put(p, "industry", choose(r, [["COMPUTER_SOFTWARE", 3], ["INFORMATION_TECHNOLOGY_AND_SERVICES", 3], ["FINANCIAL_SERVICES", 2], ["MARKETING_AND_ADVERTISING", 2], ["RETAIL", 2], ["HOSPITAL_HEALTH_CARE", 2], ["EDUCATION_MANAGEMENT", 1], ["CONSTRUCTION", 1]], o.allowed.industry));
    companies.push({ code, props: p, size });
  }

  // ── Contacts ──
  const contacts: Plan["contacts"] = [];
  for (let i = 0; i < n(BASE.contacts); i++) {
    const company = r.int(0, companies.length - 1);
    const first = r.pick(FIRST);
    const last = r.pick(LAST);
    const code = `P-${pad(i + 1)}`;
    const co = companies[company]!;
    const [city, , country] = r.pick(CITIES);
    const p: Props = {
      firstname: first,
      lastname: last,
      email: `${slug(first)}.${slug(last)}.${pad(i + 1)}@${co.props.domain}`,
      jobtitle: r.pick(TITLES),
      city, country,
      company: co.props.name!.replace(/ \(C-\d+\)$/, ""),
      ...owner(i + 1),
    };
    const stage = choose(r, [["subscriber", 12], ["lead", 28], ["marketingqualifiedlead", 18], ["salesqualifiedlead", 14], ["opportunity", 10], ["customer", 16], ["evangelist", 2]], o.allowed.lifecyclestage);
    put(p, "lifecyclestage", stage);
    if (stage && ["lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity"].includes(stage)) {
      put(p, "hs_lead_status", choose(r, [["NEW", 4], ["OPEN", 3], ["IN_PROGRESS", 3], ["ATTEMPTED_TO_CONTACT", 2], ["CONNECTED", 2], ["UNQUALIFIED", 1]], o.allowed.leadStatus));
    }
    contacts.push({ code, props: p, company });
  }

  // ── Deals ──
  const open = o.dealStages.filter((s) => !s.closed);
  const won = o.dealStages.filter((s) => s.won);
  const lost = o.dealStages.filter((s) => s.closed && !s.won);
  const deals: Plan["deals"] = [];
  for (let i = 0; i < n(BASE.deals); i++) {
    const company = r.int(0, companies.length - 1);
    const sizeFactor = { small: [1_500, 12_000], mid: [12_000, 60_000], large: [60_000, 250_000] }[companies[company]!.size];
    const amount = round50(sizeFactor[0]! + r.next() ** 2 * (sizeFactor[1]! - sizeFactor[0]!));
    const kind = r.weighted([["won", 32], ["lost", 22], ["open", 46]] as const);
    const pool = kind === "won" ? won : kind === "lost" ? lost : open;
    const stage = pool.length ? pool[kind === "open" ? Math.min(pool.length - 1, Math.floor(r.next() ** 1.5 * pool.length)) : r.int(0, pool.length - 1)]! : o.dealStages[0]!;
    const cycle = r.int(14, 120);
    // Spread creation over 14 months; closed deals close in the past, open ones in the future.
    const created = addDays(o.now, -r.int(kind === "open" ? 3 : cycle, 420));
    const closeDate = stage.closed ? addDays(created, cycle) : addDays(o.now, r.int(7, 120));
    const finalClose = stage.closed && closeDate > o.now ? addDays(o.now, -r.int(1, 14)) : closeDate;
    const code = `D-${pad(i + 1)}`;
    const co = companies[company]!;
    const p: Props = {
      dealname: `${co.props.name!.replace(/ \(C-\d+\)$/, "")}: ${r.pick(PRODUCTS)} (${code})`,
      amount: String(amount),
      pipeline: o.dealPipelineId,
      dealstage: stage.id,
      closedate: day(finalClose),
      createdate: created.toISOString(),
      ...owner(i + 2),
    };
    put(p, "dealtype", choose(r, [["newbusiness", 6], ["existingbusiness", 4]], o.allowed.dealType));
    deals.push({ code, props: p, company, contact: r.int(0, contacts.length - 1) });
  }

  // ── Tickets ──
  const openT = o.ticketStages.filter((s) => !s.closed);
  const closedT = o.ticketStages.filter((s) => s.closed);
  const tickets: Plan["tickets"] = [];
  for (let i = 0; i < n(BASE.tickets); i++) {
    const contact = r.int(0, contacts.length - 1);
    const [subject, content] = r.pick(TICKETS);
    const isClosed = r.next() < 0.62 && closedT.length > 0;
    const pool = isClosed ? closedT : openT.length ? openT : o.ticketStages;
    const created = addDays(o.now, -r.int(1, 190));
    const code = `T-${pad(i + 1)}`;
    const p: Props = {
      subject: `${subject} (${code})`,
      content,
      hs_pipeline: o.ticketPipelineId,
      hs_pipeline_stage: r.pick(pool).id,
      createdate: created.toISOString(),
      ...owner(i + 3),
    };
    put(p, "hs_ticket_priority", choose(r, [["LOW", 4], ["MEDIUM", 5], ["HIGH", 2]], o.allowed.ticketPriority));
    put(p, "hs_ticket_category", choose(r, [["PRODUCT_ISSUE", 4], ["BILLING_ISSUE", 2], ["FEATURE_REQUEST", 3], ["GENERAL_INQUIRY", 3]], o.allowed.ticketCategory));
    put(p, "source_type", choose(r, [["EMAIL", 4], ["CHAT", 3], ["PHONE", 1], ["FORM", 2]], o.allowed.ticketSource));
    if (isClosed) p.closed_date = addDays(created, r.int(1, 14)).toISOString();
    tickets.push({ code, props: p, company: contacts[contact]!.company, contact });
  }

  return { companies, contacts, deals, tickets };
}

export function summarize(plan: Plan) {
  const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  return {
    companies: plan.companies.length,
    contacts: plan.contacts.length,
    deals: plan.deals.length,
    tickets: plan.tickets.length,
    dealsByStage: count(plan.deals, (d) => d.props.dealstage!),
    dealsByMonth: count(plan.deals, (d) => d.props.createdate!.slice(0, 7)),
    contactsByLifecycle: count(plan.contacts, (c) => c.props.lifecyclestage ?? "(none)"),
    ticketsByStage: count(plan.tickets, (t) => t.props.hs_pipeline_stage!),
  };
}
