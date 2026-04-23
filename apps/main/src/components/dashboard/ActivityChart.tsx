"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { DashboardSummary } from "@/lib/api/dashboard"
import { AGENTS } from "@/lib/config/agents"
import { FONT } from "@/components/veqiro/shared"
import type { AgentSlug } from "@/lib/types"

const SLUGS: AgentSlug[] = ["vega", "lex", "sage", "scout", "rex", "maya"]

const COLORS: Record<AgentSlug, string> = {
  maya: "#F06464",
  rex: "#1DBC87",
  scout: "#F5C518",
  sage: "#F79FD4",
  lex: "#8A8AF0",
  vega: "#6FCDE8",
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function ActivityChart({ data }: { data: DashboardSummary["activityChart"] }) {
  const hasData = data.some((row) =>
    SLUGS.some((s) => (row[s] ?? 0) > 0),
  )

  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#555",
            }}
          >
            [ activity · last 14 days ]
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              letterSpacing: -0.5,
              color: "#111",
              marginTop: 2,
            }}
          >
            your crew this week
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AGENTS.map((a) => (
            <span
              key={a.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                border: "2px solid #111",
                borderRadius: 999,
                background: "#fff",
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#111",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: COLORS[a.id],
                  border: "1.5px solid #111",
                }}
              />
              {a.name}
            </span>
          ))}
        </div>
      </div>
      {hasData ? (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#11111118" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "#555" }}
                tickLine={false}
                axisLine={{ stroke: "#111", strokeWidth: 1.5 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "#555" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2.5px solid #111",
                  borderRadius: 10,
                  boxShadow: "3px 3px 0 #111",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
                labelFormatter={(v) => (typeof v === "string" ? formatDate(v) : "")}
              />
              {SLUGS.map((slug) => (
                <Area
                  key={slug}
                  type="monotone"
                  dataKey={slug}
                  stackId="a"
                  name={slug}
                  stroke={COLORS[slug]}
                  strokeWidth={1.5}
                  fill={COLORS[slug]}
                  fillOpacity={0.8}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          style={{
            height: 180,
            display: "grid",
            placeItems: "center",
            background: "#fff",
            border: "2px dashed #111",
            borderRadius: 10,
            fontFamily: FONT.mono,
            fontSize: 12,
            color: "#555",
            letterSpacing: 1,
          }}
        >
          {"// no activity yet — start chatting with your crew"}
        </div>
      )}
    </div>
  )
}
