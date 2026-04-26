"use client"

import Link from "next/link"
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { FONT } from "@/lib/fonts"
import type { DashboardSummary } from "@/lib/api/dashboard"

const PLATFORM_COLORS: Record<"twitter" | "linkedin" | "instagram", string> = {
  twitter: "#6FCDE8",
  linkedin: "#8A8AF0",
  instagram: "#F79FD4",
}

const STATUS_COLORS: Record<"draft" | "scheduled" | "published" | "failed", string> = {
  draft: "#EFE7D6",
  scheduled: "#F5C518",
  published: "#1DBC87",
  failed: "#F06464",
}

function sectionHeader(title: string, kicker: string) {
  return (
    <>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#555",
        }}
      >
        [ {kicker} ]
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 24,
          letterSpacing: -0.5,
          color: "#111",
          marginTop: 2,
          marginBottom: 12,
        }}
      >
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      {/* Donut: by platform */}
      <div
        style={{
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 16,
          boxShadow: "6px 6px 0 #111",
          padding: 20,
        }}
      >
        {sectionHeader("by platform", "content · published")}
        {total === 0 ? (
          <div
            style={{
              padding: "28px 16px",
              border: "2px dashed #111",
              borderRadius: 10,
              background: "#fff",
              fontFamily: FONT.mono,
              fontSize: 12,
              color: "#555",
              textAlign: "center",
            }}
          >
            {"// no posts yet"}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 140, height: 140, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
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
                      background: "#fff",
                      border: "2.5px solid #111",
                      borderRadius: 10,
                      boxShadow: "3px 3px 0 #111",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 1, color: "#111" }}>
                    {total}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: "#555",
                      marginTop: 2,
                    }}
                  >
                    posts
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {platforms.map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px",
                    border: "2px solid #111",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      background: p.color,
                      border: "1.5px solid #111",
                      borderRadius: 3,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: "#111",
                      flex: 1,
                    }}
                  >
                    {p.name}
                  </span>
                  <span style={{ fontFamily: FONT.head, fontSize: 14 }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Funnel bars: by status */}
      <div
        style={{
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 16,
          boxShadow: "6px 6px 0 #111",
          padding: 20,
        }}
      >
        {sectionHeader("pipeline status", "content · all time")}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {statuses.map((s) => (
            <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#111",
                }}
              >
                <span>{s.key}</span>
                <span style={{ fontFamily: FONT.head }}>{s.count}</span>
              </div>
              <div
                style={{
                  height: 18,
                  background: "#fff",
                  border: "2.5px solid #111",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
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
        {data.byStatus.failed > 0 && (
          <Link
            href="/workspace/content"
            style={{
              display: "inline-block",
              marginTop: 14,
              padding: "8px 12px",
              background: "#F06464",
              color: "#111",
              border: "2px solid #111",
              borderRadius: 999,
              boxShadow: "2px 2px 0 #111",
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            retry failed →
          </Link>
        )}
      </div>
    </div>
  )
}
