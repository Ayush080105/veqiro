import { describe, it, assert } from "vitest";
import { buildPlan, summarize, MARKER_DOMAIN, type PlanOptions } from "./plan.js";

const NOW = new Date("2026-10-09T10:00:00.000Z");

const base = (over: Partial<PlanOptions> = {}): PlanOptions => ({
  seed: 42, now: NOW, scale: 1, ownerIds: ["11", "22", "33"],
  allowed: {
    industry: ["COMPUTER_SOFTWARE", "RETAIL", "FINANCIAL_SERVICES", "HOSPITAL_HEALTH_CARE"],
    lifecyclestage: ["subscriber", "lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer", "evangelist"],
    leadStatus: ["NEW", "OPEN", "IN_PROGRESS", "UNQUALIFIED"],
    dealType: ["newbusiness", "existingbusiness"],
    ticketPriority: ["LOW", "MEDIUM", "HIGH"],
    ticketCategory: ["PRODUCT_ISSUE", "BILLING_ISSUE"],
    ticketSource: ["EMAIL", "CHAT"],
  },
  dealPipelineId: "default",
  dealStages: [
    { id: "appointmentscheduled", closed: false, won: false }, { id: "qualifiedtobuy", closed: false, won: false },
    { id: "presentationscheduled", closed: false, won: false }, { id: "contractsent", closed: false, won: false },
    { id: "closedwon", closed: true, won: true }, { id: "closedlost", closed: true, won: false },
  ],
  ticketPipelineId: "0",
  ticketStages: [{ id: "1", closed: false }, { id: "2", closed: false }, { id: "3", closed: false }, { id: "4", closed: true }],
  ...over,
});

describe("buildPlan", () => {
  it("is repeatable for one seed and different for another", () => {
    assert.deepEqual(buildPlan(base()), buildPlan(base()));
    assert.notDeepEqual(buildPlan(base()).deals.slice(0, 5), buildPlan(base({ seed: 7 })).deals.slice(0, 5));
  });

  it("scales the amount of data, never to zero", () => {
    const full = summarize(buildPlan(base()));
    assert.deepEqual([full.companies, full.contacts, full.deals, full.tickets], [60, 260, 420, 130]);
    const pilot = summarize(buildPlan(base({ scale: 0.05 })));
    assert.deepEqual([pilot.companies, pilot.contacts, pilot.deals, pilot.tickets], [3, 13, 21, 7]);
    assert.isAtLeast(summarize(buildPlan(base({ scale: 0.0001 }))).deals, 1);
  });

  it("gives every record a unique, recognisable code and keeps fake emails on a fake domain", () => {
    const p = buildPlan(base());
    for (const list of [p.companies, p.contacts, p.deals, p.tickets]) assert.equal(new Set(list.map((x) => x.code)).size, list.length);
    assert.equal(new Set(p.contacts.map((c) => c.props.email)).size, p.contacts.length, "emails are unique");
    assert.equal(new Set(p.companies.map((c) => c.props.domain)).size, p.companies.length);
    assert.equal(new Set(p.deals.map((d) => d.props.dealname)).size, p.deals.length, "deal names are unique so they can be matched back");
    assert.equal(new Set(p.tickets.map((t) => t.props.subject)).size, p.tickets.length);
    assert.isTrue(p.contacts.every((c) => c.props.email!.endsWith(`@${c.props.email!.split("@")[1]}`) && c.props.email!.includes(MARKER_DOMAIN)));
    assert.isTrue(p.companies.every((c) => c.props.domain!.endsWith(MARKER_DOMAIN)));
  });

  it("only uses dropdown values the account accepts", () => {
    const o = base();
    const p = buildPlan(o);
    assert.isTrue(p.companies.every((c) => !c.props.industry || o.allowed.industry.includes(c.props.industry)));
    assert.isTrue(p.contacts.every((c) => !c.props.lifecyclestage || o.allowed.lifecyclestage.includes(c.props.lifecyclestage)));
    assert.isTrue(p.contacts.every((c) => !c.props.hs_lead_status || o.allowed.leadStatus.includes(c.props.hs_lead_status)));
    assert.isTrue(p.tickets.every((t) => !t.props.hs_ticket_priority || o.allowed.ticketPriority.includes(t.props.hs_ticket_priority)));
    assert.isTrue(p.tickets.every((t) => !t.props.source_type || o.allowed.ticketSource.includes(t.props.source_type)));
  });

  it("leaves a field out rather than guess when the account offers no choices for it", () => {
    const p = buildPlan(base({ allowed: { industry: [], lifecyclestage: [], leadStatus: [], dealType: [], ticketPriority: [], ticketCategory: [], ticketSource: [] } }));
    assert.isTrue(p.companies.every((c) => !("industry" in c.props)));
    assert.isTrue(p.contacts.every((c) => !("lifecyclestage" in c.props) && !("hs_lead_status" in c.props)));
    assert.isTrue(p.deals.every((d) => !("dealtype" in d.props)));
  });

  it("makes a believable spread of deal outcomes across every stage", () => {
    const s = summarize(buildPlan(base()));
    const total = 420;
    const won = (s.dealsByStage.closedwon ?? 0) / total;
    const lost = (s.dealsByStage.closedlost ?? 0) / total;
    assert.isAbove(won, 0.24); assert.isBelow(won, 0.4);
    assert.isAbove(lost, 0.14); assert.isBelow(lost, 0.3);
    for (const stage of ["appointmentscheduled", "qualifiedtobuy", "presentationscheduled", "contractsent"]) assert.isAbove(s.dealsByStage[stage] ?? 0, 5, stage);
  });

  it("closes finished deals in the past and open deals in the future", () => {
    const p = buildPlan(base());
    const closedIds = new Set(["closedwon", "closedlost"]);
    for (const d of p.deals) {
      const close = Date.parse(`${d.props.closedate}T00:00:00Z`);
      if (closedIds.has(d.props.dealstage!)) assert.isAtMost(close, NOW.getTime(), d.code);
      else assert.isAbove(close, NOW.getTime() - 86_400_000, d.code);
    }
  });

  it("spreads deals over more than a year so monthly charts have a shape", () => {
    assert.isAtLeast(Object.keys(summarize(buildPlan(base())).dealsByMonth).length, 12);
  });

  it("uses a wide range of deal sizes", () => {
    const amounts = buildPlan(base()).deals.map((d) => Number(d.props.amount));
    assert.isTrue(amounts.every((a) => a >= 50 && a % 50 === 0));
    assert.isBelow(Math.min(...amounts), 5_000);
    assert.isAbove(Math.max(...amounts), 100_000);
  });

  it("spreads records across the owners that exist, and none when there are none", () => {
    const owners = new Set(buildPlan(base()).deals.map((d) => d.props.hubspot_owner_id));
    assert.deepEqual([...owners].sort(), ["11", "22", "33"]);
    assert.isTrue(buildPlan(base({ ownerIds: [] })).deals.every((d) => !("hubspot_owner_id" in d.props)));
  });

  it("links every record to something that exists", () => {
    const p = buildPlan(base());
    assert.isTrue(p.contacts.every((c) => c.company >= 0 && c.company < p.companies.length));
    assert.isTrue(p.deals.every((d) => d.contact < p.contacts.length && d.company < p.companies.length));
    assert.isTrue(p.tickets.every((t) => t.contact < p.contacts.length && t.company === p.contacts[t.contact]!.company));
  });

  it("gives closed tickets a close date after they were opened, and uses only the pipeline's stages", () => {
    const p = buildPlan(base());
    const closedStages = new Set(["4"]);
    for (const t of p.tickets) {
      assert.include(["1", "2", "3", "4"], t.props.hs_pipeline_stage);
      if (closedStages.has(t.props.hs_pipeline_stage!)) assert.isAbove(Date.parse(t.props.closed_date!), Date.parse(t.props.createdate!));
      else assert.notProperty(t.props, "closed_date");
    }
  });

  it("does not choke on a pipeline with no open or no closed stages", () => {
    const onlyOpen = buildPlan(base({ dealStages: [{ id: "a", closed: false, won: false }], ticketStages: [{ id: "1", closed: false }] }));
    assert.equal(onlyOpen.deals.length, 420);
    assert.isTrue(onlyOpen.deals.every((d) => d.props.dealstage === "a"));
    assert.isTrue(onlyOpen.tickets.every((t) => t.props.hs_pipeline_stage === "1"));
  });
});
