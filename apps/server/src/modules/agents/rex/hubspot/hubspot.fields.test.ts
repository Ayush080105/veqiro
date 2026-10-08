import { describe, it, assert } from "vitest";
import { OBJECT_SPECS, customObjectSpec } from "./hubspot.objects.js";
import { classifyProperties, hsTypeToKind, planColumns, MAX_COLUMNS, type HsProperty } from "./hubspot.fields.js";

const p = (name: string, type = "string", extra: Partial<HsProperty> = {}): HsProperty => ({
  name, label: name, type, hubspotDefined: true, ...extra,
});

const DEAL_PROPS: HsProperty[] = [
  p("dealname"), p("amount", "number"), p("dealstage", "enumeration", { options: [{ value: "closedwon", label: "Closed won" }] }),
  p("pipeline", "enumeration"), p("closedate", "datetime"), p("createdate", "datetime"), p("hs_lastmodifieddate", "datetime"),
  p("hubspot_owner_id", "enumeration"), p("hs_analytics_source", "enumeration"),
  p("contract_tier", "enumeration", { hubspotDefined: false, groupName: "dealinformation" }),
  p("secret_blob", "json"), p("hidden_thing", "string", { hidden: true }),
  p("hs_object_id", "number"),
];

describe("hsTypeToKind", () => {
  it("maps HubSpot types onto Rex column types", () => {
    assert.equal(hsTypeToKind("number"), "numeric");
    assert.equal(hsTypeToKind("date"), "date");
    assert.equal(hsTypeToKind("datetime"), "date");
    assert.equal(hsTypeToKind("enumeration"), "categorical");
    assert.equal(hsTypeToKind("bool"), "categorical");
    assert.equal(hsTypeToKind("string"), "text");
    assert.equal(hsTypeToKind("json"), null);
    assert.equal(hsTypeToKind("object_coordinates"), null);
  });
});

describe("classifyProperties", () => {
  const c = classifyProperties(OBJECT_SPECS.deals!, DEAL_PROPS);
  it("sorts properties into recommended, custom and other, dropping hidden and unsupported ones", () => {
    assert.includeMembers(c.recommended.map((x) => x.property), ["dealname", "amount", "dealstage"]);
    assert.deepEqual(c.custom.map((x) => x.property), ["contract_tier"]);
    const all = [...c.recommended, ...c.custom, ...c.other].map((x) => x.property);
    assert.notInclude(all, "secret_blob");
    assert.notInclude(all, "hidden_thing");
    assert.notInclude(all, "hs_object_id");
  });
  it("keeps enumeration labels", () => {
    const stage = c.recommended.find((x) => x.property === "dealstage")!;
    assert.equal(stage.options?.get("closedwon"), "Closed won");
    assert.equal(stage.column, "stage");
  });
});

describe("planColumns", () => {
  it("starts with id and the recommended set", () => {
    const { columns } = planColumns(OBJECT_SPECS.deals!, DEAL_PROPS, { extra: [], includePii: [] });
    assert.equal(columns[0]!.column, "id");
    assert.includeMembers(columns.map((x) => x.column), ["deal_name", "amount", "stage", "pipeline", "close_date", "owner_name"]);
  });

  it("adds chosen extra fields under their own name", () => {
    const { columns } = planColumns(OBJECT_SPECS.deals!, DEAL_PROPS, { extra: ["contract_tier"], includePii: [] });
    assert.include(columns.map((x) => x.column), "contract_tier");
  });

  it("leaves personal data out unless the customer opts in per column", () => {
    const props = [p("lifecyclestage", "enumeration"), p("email"), p("phone"), p("firstname"), p("lastname")];
    const off = planColumns(OBJECT_SPECS.contacts!, props, { extra: ["email", "firstname"], includePii: [] });
    assert.notInclude(off.columns.map((x) => x.property), "email");
    assert.notInclude(off.columns.map((x) => x.property), "firstname");
    assert.isTrue(off.dropped.some((d) => d.property === "email" && /personal/i.test(d.reason)));
    const on = planColumns(OBJECT_SPECS.contacts!, props, { extra: ["email"], includePii: ["email"] });
    assert.include(on.columns.map((x) => x.property), "email");
    assert.notInclude(on.columns.map((x) => x.property), "phone");
  });

  it("never exceeds the column limit, counting derived columns", () => {
    const many = Array.from({ length: 120 }, (_, i) => p(`custom_${i}`, "string", { hubspotDefined: false }));
    const { columns, dropped } = planColumns(OBJECT_SPECS.deals!, [...DEAL_PROPS, ...many], {
      extra: many.map((m) => m.name), includePii: [],
    });
    const derived = OBJECT_SPECS.deals!.derivedColumns.length;
    assert.isAtMost(columns.length + derived, MAX_COLUMNS);
    assert.isTrue(dropped.some((d) => d.reason === "column limit"));
  });

  it("refuses a property whose name would overwrite a derived column", () => {
    const props = [...DEAL_PROPS, p("is_won", "bool", { hubspotDefined: false }), p("id", "string", { hubspotDefined: false })];
    const { columns, dropped } = planColumns(OBJECT_SPECS.deals!, props, { extra: ["is_won", "id"], includePii: [] });
    assert.equal(columns.filter((x) => x.column === "is_won").length, 0);
    assert.equal(columns.filter((x) => x.column === "id").length, 1);
    assert.equal(dropped.filter((d) => d.reason === "reserved name").length, 2);
  });

  it("gives clashing friendly names a numeric suffix", () => {
    const props = [...DEAL_PROPS, p("stage", "string", { hubspotDefined: false })];
    const { columns } = planColumns(OBJECT_SPECS.deals!, props, { extra: ["stage"], includePii: [] });
    const names = columns.map((x) => x.column);
    assert.equal(new Set(names).size, names.length);
    assert.include(names, "stage_2");
  });

  it("ignores extras that are not real, selectable properties", () => {
    const { columns, dropped } = planColumns(OBJECT_SPECS.deals!, DEAL_PROPS, { extra: ["nope", "secret_blob"], includePii: [] });
    assert.notInclude(columns.map((x) => x.property), "nope");
    assert.equal(dropped.length, 2);
  });
});

describe("customObjectSpec", () => {
  it("builds a usable spec from a schema", () => {
    const s = customObjectSpec({ objectTypeId: "2-123", name: "projects", labels: { plural: "Projects" }, primaryDisplayProperty: "project_name" });
    assert.equal(s.type, "2-123");
    assert.equal(s.tier, 3);
    assert.equal(s.defaults.project_name, "primary_name");
    assert.equal(s.defaults.hs_lastmodifieddate, "updated_at");
  });
});
