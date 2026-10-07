/**
 * Which HubSpot properties become columns. HubSpot objects carry hundreds of properties; a dashboard
 * wants a few dozen clean ones. A property is sorted as recommended (Rex's curated set), custom
 * (the customer's own) or other (the rest of HubSpot's), and the customer picks extras on top of
 * the recommended set, up to MAX_COLUMNS. Personal data is only ever included by explicit opt-in.
 */
import type { ObjectSpec } from "./hubspot.objects.js";

export type ColumnKind = "numeric" | "date" | "categorical" | "text";

export const MAX_COLUMNS = 60;

export interface HsProperty {
  name: string;
  label: string;
  type: string;
  fieldType?: string;
  groupName?: string;
  hidden?: boolean;
  calculated?: boolean;
  hubspotDefined?: boolean;
  options?: Array<{ value: string; label: string; hidden?: boolean }>;
}

export type ColumnSource = "recommended" | "custom" | "other";
export type ColumnSpecial = "id" | "owner" | "stage" | "pipeline";

export interface ColumnPlan {
  property: string;
  column: string;
  kind: ColumnKind;
  source: ColumnSource;
  pii: boolean;
  label: string;
  group?: string;
  options?: Map<string, string>;
  special?: ColumnSpecial;
}

export function hsTypeToKind(type: string, _fieldType?: string): ColumnKind | null {
  switch (type) {
    case "number": return "numeric";
    case "date":
    case "datetime": return "date";
    case "enumeration":
    case "bool": return "categorical";
    case "string":
    case "phone_number": return "text";
    default: return null;
  }
}

const reservedNames = (spec: ObjectSpec) => new Set(["id", ...spec.derivedColumns]);

function specialFor(spec: ObjectSpec, property: string): ColumnSpecial | undefined {
  if (spec.ownerProps.includes(property)) return "owner";
  if (property === spec.stageProp) return "stage";
  if (property === spec.pipelineProp) return "pipeline";
  return undefined;
}

function toPlan(spec: ObjectSpec, prop: HsProperty, kind: ColumnKind, source: ColumnSource): ColumnPlan {
  return {
    property: prop.name,
    column: spec.defaults[prop.name] ?? prop.name,
    kind,
    source,
    pii: spec.pii.includes(prop.name),
    label: prop.label || prop.name,
    group: prop.groupName,
    special: specialFor(spec, prop.name),
    options: prop.options?.length ? new Map(prop.options.map((o) => [o.value, o.label])) : undefined,
  };
}

export function classifyProperties(spec: ObjectSpec, props: HsProperty[]) {
  const recommended: ColumnPlan[] = [];
  const custom: ColumnPlan[] = [];
  const other: ColumnPlan[] = [];
  for (const prop of props) {
    if (prop.hidden || prop.name === "hs_object_id") continue;
    const kind = hsTypeToKind(prop.type, prop.fieldType);
    if (!kind) continue;
    if (prop.name in spec.defaults) recommended.push(toPlan(spec, prop, kind, "recommended"));
    else if (prop.hubspotDefined === false) custom.push(toPlan(spec, prop, kind, "custom"));
    else other.push(toPlan(spec, prop, kind, "other"));
  }
  // Present the recommended set in the order Rex defines it, not HubSpot's.
  const order = Object.keys(spec.defaults);
  recommended.sort((a, b) => order.indexOf(a.property) - order.indexOf(b.property));
  return { recommended, custom, other };
}

export interface FieldSelection {
  extra: string[];
  includePii: string[];
}

export function planColumns(spec: ObjectSpec, props: HsProperty[], sel: FieldSelection) {
  const { recommended, custom, other } = classifyProperties(spec, props);
  const byProperty = new Map([...recommended, ...custom, ...other].map((c) => [c.property, c]));
  const dropped: Array<{ property: string; reason: string }> = [];
  const reserved = reservedNames(spec);
  const allowed = Math.max(1, MAX_COLUMNS - spec.derivedColumns.length);
  const columns: ColumnPlan[] = [{
    property: "hs_object_id", column: "id", kind: "text", source: "recommended", pii: false, label: "Record id", special: "id",
  }];
  const used = new Set<string>(["id"]);

  const take = (plan: ColumnPlan): boolean => {
    if (columns.length >= allowed) return false;
    let column = plan.column;
    for (let n = 2; used.has(column) || reserved.has(column); n++) column = `${plan.column}_${n}`;
    used.add(column);
    columns.push({ ...plan, column });
    return true;
  };

  for (const plan of recommended) {
    if (plan.pii && !sel.includePii.includes(plan.property)) continue;
    take(plan);
  }

  const chosen = [...new Set([...sel.extra, ...sel.includePii])];
  for (const name of chosen) {
    if (columns.some((c) => c.property === name)) continue;
    const plan = byProperty.get(name);
    if (!plan) {
      dropped.push({ property: name, reason: props.some((p) => p.name === name) ? "unsupported type" : "unknown property" });
      continue;
    }
    if (reserved.has(plan.column)) {
      dropped.push({ property: name, reason: "reserved name" });
      continue;
    }
    if (plan.pii && !sel.includePii.includes(name)) {
      dropped.push({ property: name, reason: "personal data (not opted in)" });
      continue;
    }
    if (!take(plan)) dropped.push({ property: name, reason: "column limit" });
  }
  return { columns, dropped };
}
