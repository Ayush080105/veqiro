"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { Send } from "lucide-react"
import type { DashboardSummary } from "@/lib/api/dashboard"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"

const PLATFORM_COLORS: Record<"twitter" | "linkedin" | "instagram", string> = {
  twitter: "var(--foreground)",
  linkedin: "var(--muted-foreground)",
  instagram: "var(--border)",
}

const STATUS_COLORS: Record<"draft" | "scheduled" | "published" | "failed", string> = {
  draft: "var(--muted)",
  scheduled: "var(--foreground)",
  published: "var(--foreground)",
  failed: "var(--vq-red)",
}

function sectionHeader(title: string, caption: string) {
  return (
    <div className="mb-3">
      <div className="font-head text-2xl text-foreground">{title}</div>
      <p className="m-0 mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
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
  const totalStatuses = statuses.reduce((sum, status) => sum + status.count, 0)

  if (total === 0 && totalStatuses === 0) {
    return (
      <section className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        <DashboardEmptyState
          icon={Send}
          title="Content pipeline is empty"
          description="Create or schedule a post with Maya; drafts, scheduled work, and publishing results will collect here."
          action={{ label: "Create content", href: "/workspace/content" }}
          compact
          framed={false}
          className="w-full"
        />
      </section>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        {sectionHeader("Posts published", "Distribution by platform.")}
        {total === 0 ? (
          <DashboardEmptyState
            icon={Send}
            title="Nothing published yet"
            description="Published posts will be grouped by platform here."
            action={{ label: "Create content", href: "/workspace/content" }}
          />
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
                    stroke="var(--card)"
                    strokeWidth={3}
                    paddingAngle={2}
                  >
                    {platforms.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      boxShadow: "var(--vq-shadow-lg)",
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="font-head text-[28px] leading-none text-foreground">
                    {total}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    posts
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 w-full">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 rounded-[var(--vq-r-sm)] border border-border bg-card px-2 py-1"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-border"
                    style={{ background: p.color }}
                  />
                  <span className="flex-1 text-xs font-medium capitalize text-foreground">
                    {p.name}
                  </span>
                  <span className="font-head text-[14px]">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        {sectionHeader("Pipeline status", "Drafts, scheduled work, and published output.")}
        <div className="flex flex-col gap-2.5">
          {statuses.map((s) => (
            <div key={s.key} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-medium text-foreground">
                <span className="capitalize">{s.key}</span>
                <span className="font-head">{s.count}</span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full border border-border bg-muted"
                role="progressbar"
                aria-label={`${s.key} content count`}
                aria-valuemin={0}
                aria-valuemax={maxStatus}
                aria-valuenow={s.count}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: `scaleX(${s.count / maxStatus})`,
                    transformOrigin: "left",
                    background: STATUS_COLORS[s.key],
                    transition: "transform 300ms ease",
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
