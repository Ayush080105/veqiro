"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type { DashboardSummary } from "@/lib/api/dashboard"

const PLATFORM_COLORS: Record<"twitter" | "linkedin" | "instagram", string> = {
  twitter: "#6FCDE8",
  linkedin: "#8A8AF0",
  instagram: "#F79FD4",
}

const STATUS_COLORS: Record<"draft" | "scheduled" | "published" | "failed", string> = {
  draft: "var(--vq-bg)",
  scheduled: "var(--vq-yellow)",
  published: "var(--vq-green)",
  failed: "var(--vq-red)",
}

function sectionHeader(title: string, kicker: string) {
  return (
    <>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ {kicker} ]
      </div>
      <div className="font-display text-2xl tracking-tight text-foreground mt-0.5 mb-3">
        {title}
      </div>
    </>
  )
}

export function ContentPipeline({
  data,
}: {
  data: DashboardSummary["contentPipeline"]
}) {
  const platforms = Object.entries(data.byPlatform)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, color: PLATFORM_COLORS[k as keyof typeof PLATFORM_COLORS] }))
  const total = platforms.reduce((s, p) => s + p.value, 0)
  const statuses = (
    ["draft", "scheduled", "published", "failed"] as const
  ).map((s) => ({ key: s, count: data.byStatus[s] }))
  const maxStatus = Math.max(1, ...statuses.map((s) => s.count))

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Card 1: By Platform */}
      <div className="bg-card border border-(--vq-line-2) rounded-2xl shadow-(--vq-shadow) p-5">
        {sectionHeader("posts published", "by platform")}
        {total === 0 ? (
          <div className="px-4 py-7 border border-dashed border-(--vq-line-2) rounded-xl bg-card font-mono text-xs text-muted-foreground text-center">
            {"// no posts yet"}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div style={{ width: 140, height: 140, position: "relative" }}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 140, height: 140 }}
              >
                <PieChart>
                  <Pie
                    data={platforms}
                    dataKey="value"
                    innerRadius={40}
                    outerRadius={64}
                    stroke="#111"
                    strokeWidth={2}
                    paddingAngle={2}
                  >
                    {platforms.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--vq-line-2)",
                      borderRadius: 10,
                      boxShadow: "var(--vq-shadow-lg)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="font-display text-[28px] leading-none text-foreground">
                    {total}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
                    posts
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 w-full">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 px-2 py-1 border border-(--vq-line-2) rounded-lg bg-card"
                >
                  <span
                    className="size-3 border border-(--vq-line-2) rounded-xs shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-foreground flex-1">
                    {p.name}
                  </span>
                  <span className="font-head text-[14px]">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Pipeline Status */}
      <div className="bg-card border border-(--vq-line-2) rounded-2xl shadow-(--vq-shadow) p-5">
        {sectionHeader("pipeline status", "pipeline")}
        <div className="flex flex-col gap-2.5">
          {statuses.map((s) => (
            <div key={s.key} className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[11px] uppercase tracking-[0.15em] text-foreground">
                <span>{s.key}</span>
                <span className="font-head">{s.count}</span>
              </div>
              <div
                className="h-4.5 bg-card border border-(--vq-line-2) rounded-md overflow-hidden"
                role="progressbar"
                aria-label={`${s.key} content count`}
                aria-valuemin={0}
                aria-valuemax={maxStatus}
                aria-valuenow={s.count}
              >
                <div
                  style={{
                    width: `${(s.count / maxStatus) * 100}%`,
                    height: "100%",
                    background: STATUS_COLORS[s.key],
                    transition: "width 300ms ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
