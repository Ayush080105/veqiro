"use client"

import type { DashboardWidget, WidgetResult } from "@/lib/api/rexDashboards"
import { DashboardCanvas } from "@/components/agents/rex/dashboards/DashboardCanvas"

/**
 * Dev-only gallery of every Rex dashboard tile form, on fixed sample data, so chart changes can be
 * reviewed (and screenshotted in both themes) without a dataset or a sign-in.
 */
const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]
const mrr = [41200, 43900, 45100, 48800, 52300, 51700, 56900, 61200, 64800]

type Fixture = [DashboardWidget, WidgetResult]

const w = (id: string, kind: DashboardWidget["kind"], title: string, layout: DashboardWidget["layout"], spec: DashboardWidget["spec"]): DashboardWidget =>
  ({ id, kind, title, layout, spec, filterIds: [] })

const fixtures: Fixture[] = [
  [w("k1", "kpi", "MRR per month", { x: 0, y: 0, w: 3, h: 2 }, { kpi: { valueKey: "mrr", periodKey: "month", prefix: "$" } }),
    { columns: ["month", "mrr"], rows: months.map((m, i) => ({ month: m, mrr: mrr[i] })) }],
  [w("k2", "kpi", "Churn rate per month", { x: 3, y: 0, w: 3, h: 2 }, { kpi: { valueKey: "churn", periodKey: "month", format: "percent", goodDirection: "down" } }),
    { columns: ["month", "churn"], rows: months.map((m, i) => ({ month: m, churn: [0.041, 0.038, 0.04, 0.036, 0.033, 0.035, 0.031, 0.029, 0.027][i] })) }],
  [w("k3", "kpi", "New deals per month", { x: 6, y: 0, w: 3, h: 2 }, { kpi: { valueKey: "deals", periodKey: "month" } }),
    { columns: ["month", "deals"], rows: months.map((m, i) => ({ month: m, deals: [18, 22, 19, 25, 24, 27, 23, 21, 19][i] })) }],
  [w("k4", "kpi", "Active customers", { x: 9, y: 0, w: 3, h: 2 }, { kpi: { valueKey: "n" } }),
    { columns: ["n"], rows: [{ n: 1284 }] }],

  [w("c1", "chart", "MRR vs plan", { x: 0, y: 2, w: 8, h: 5 }, { chart: { type: "combo", xKey: "month", reference: null, yKeys: [
      { key: "mrr", label: "MRR", as: "bar", color: "s1" }, { key: "plan", label: "Plan", as: "line", ghost: true }] } }),
    { columns: ["month", "mrr", "plan"], rows: months.map((m, i) => ({ month: m, mrr: mrr[i], plan: 40000 + i * 3000 })) }],
  [w("c2", "chart", "Deal funnel", { x: 8, y: 2, w: 4, h: 5 }, { chart: { type: "funnel", xKey: "stage", yKeys: [{ key: "deals" }] } }),
    { columns: ["stage", "deals"], rows: [
      { stage: "Lead", deals: 1240 }, { stage: "Qualified", deals: 610 }, { stage: "Demo", deals: 342 },
      { stage: "Proposal", deals: 164 }, { stage: "Won", deals: 71 }] }],

  [w("c3", "chart", "MRR bridge, September", { x: 0, y: 7, w: 6, h: 5 }, { chart: { type: "waterfall", xKey: "step", baseFirst: true, yKeys: [{ key: "amount" }] } }),
    { columns: ["step", "amount"], rows: [
      { step: "Opening", amount: 61200 }, { step: "New", amount: 6100 }, { step: "Expansion", amount: 2400 },
      { step: "Contraction", amount: -1300 }, { step: "Churn", amount: -3600 }] }],
  [w("c4", "chart", "Revenue by region and month", { x: 6, y: 7, w: 6, h: 5 }, { chart: { type: "heatmap", xKey: "month", groupKey: "region", yKeys: [{ key: "revenue" }] } }),
    { columns: ["month", "region", "revenue"], rows: ["North", "South", "East", "West", "Central"].flatMap((r, ri) =>
      months.map((m, mi) => ({ month: m.slice(5), region: r, revenue: Math.round(6000 + ri * 1800 + mi * 650 + ((ri * 7 + mi * 3) % 5) * 900) }))) }],

  [w("c5", "chart", "Top customers by revenue", { x: 0, y: 12, w: 4, h: 6 }, { chart: { type: "ranked", xKey: "customer", yKeys: [{ key: "revenue" }] } }),
    { columns: ["customer", "revenue"], rows: ["Acme Corp", "Globex", "Initech", "Umbrella", "Stark Industries", "Wayne Enterprises", "Hooli", "Soylent", "Tyrell", "Cyberdyne", "Wonka", "Gringotts", "Monsters Inc"]
      .map((c, i) => ({ customer: c, revenue: Math.round(48000 / (1 + i * 0.45)) })) }],
  [w("c6", "chart", "Revenue by product", { x: 4, y: 12, w: 4, h: 6 }, { chart: { type: "treemap", xKey: "product", yKeys: [{ key: "revenue" }] } }),
    { columns: ["product", "revenue"], rows: [
      { product: "Analytics Pro", revenue: 182000 }, { product: "Core", revenue: 121000 }, { product: "Add-on seats", revenue: 64000 },
      { product: "API access", revenue: 41000 }, { product: "Support plus", revenue: 22000 }, { product: "Training", revenue: 9000 }] }],
  [w("c7", "chart", "Quota attainment", { x: 8, y: 12, w: 4, h: 6 }, { chart: { type: "progress", xKey: "rep", targetKey: "quota", yKeys: [{ key: "won" }] } }),
    { columns: ["rep", "won", "quota"], rows: [
      { rep: "Priya", won: 142000, quota: 120000 }, { rep: "Marcus", won: 98000, quota: 120000 },
      { rep: "Lena", won: 121000, quota: 120000 }, { rep: "Tomás", won: 54000, quota: 100000 }] }],

  [w("c8", "chart", "Signups by month", { x: 0, y: 18, w: 6, h: 5 }, { chart: { type: "area", xKey: "month", reference: "average", yKeys: [{ key: "signups", color: "s1" }] } }),
    { columns: ["month", "signups"], rows: months.map((m, i) => ({ month: m, signups: [320, 410, 380, 520, 610, 560, 700, 760, 820][i] })) }],
  [w("c9", "chart", "Channel mix", { x: 6, y: 18, w: 6, h: 5 }, { chart: { type: "bar", xKey: "month", stacked: true, normalize: true, yKeys: [
      { key: "organic", label: "Organic" }, { key: "paid", label: "Paid" }, { key: "referral", label: "Referral" }] } }),
    { columns: ["month", "organic", "paid", "referral"], rows: months.slice(3).map((m, i) => ({ month: m, organic: 200 + i * 30, paid: 150 - i * 8, referral: 60 + i * 12 })) }],
]

export default function DashboardChartsPage() {
  const widgets = fixtures.map(([wd]) => wd)
  const results = Object.fromEntries(fixtures.map(([wd, r]) => [wd.id, r]))
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold [font-family:var(--font-head)]">Dashboard chart gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every Rex tile form on sample data.</p>
      </header>
      <DashboardCanvas widgets={widgets} results={results} />
    </div>
  )
}
