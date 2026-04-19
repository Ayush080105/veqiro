"use client"

import Link from "next/link"
import { MessageSquare, FileText, Users, BookOpen, Bot } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { StatusRow } from "@/components/dashboard/StatusRow"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { Button as VqButton, FONT, Sticker } from "@/components/veqiro/shared"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const QUICK_ACTIONS = [
  {
    title: "Chat with assistant",
    description: "Start a conversation with any member of your AI team.",
    href: "/assistants",
    icon: MessageSquare,
    color: "var(--vq-red)",
  },
  {
    title: "Create content",
    description: "Generate social posts, blogs, and ad copy instantly.",
    href: "/workspace/content",
    icon: FileText,
    color: "var(--vq-yellow)",
  },
  {
    title: "Find leads",
    description: "Scout new prospects and surface high-fit companies.",
    href: "/workspace/leads",
    icon: Users,
    color: "var(--vq-pink)",
  },
  {
    title: "View briefing",
    description: "Read your daily executive summary from Vega.",
    href: "/workspace/briefing",
    icon: BookOpen,
    color: "var(--vq-blue)",
  },
]

const METRICS = [
  { label: "MRR", value: "$12,400", change: "8%", trend: "up" as const },
  { label: "Leads this week", value: "7", change: "+3", trend: "up" as const },
  {
    label: "Content published",
    value: "12",
    change: "stable",
    trend: "neutral" as const,
  },
]

const sectionLabel: React.CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: 3,
  textTransform: "uppercase",
  color: "#555",
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession()
  const name = session?.user?.name?.split(" ")[0] ?? "there"
  const today = new Date()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, paddingBottom: 40 }}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: -10, right: 10 }}>
          <Sticker rot={6} color="#F5C518">
            your day
          </Sticker>
        </div>
        <div style={{ ...sectionLabel, marginBottom: 8 }}>
          [ {formatDate(today)} ]
        </div>
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: "clamp(44px, 5vw, 68px)",
            lineHeight: 0.95,
            letterSpacing: -1,
            color: "#111",
            margin: 0,
          }}
        >
          {getGreeting().toLowerCase()}, {name.toLowerCase()}.
        </h1>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 16,
            color: "#333",
            margin: "10px 0 0",
          }}
        >
          Here&apos;s what your team is working on.
        </p>
      </div>

      {/* briefing card */}
      <div
        style={{
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 16,
          boxShadow: "6px 6px 0 #111",
          padding: 22,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: -18, left: 18 }}>
          <Sticker rot={-4} color="#1DBC87">
            daily brief
          </Sticker>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#111",
              color: "#EFE7D6",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              border: "2.5px solid #111",
              boxShadow: "3px 3px 0 var(--vq-yellow)",
              transform: "rotate(-4deg)",
            }}
          >
            <Bot className="size-5" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: FONT.head,
                fontSize: 20,
                color: "#111",
                letterSpacing: -0.3,
              }}
            >
              Today&apos;s briefing
            </div>
            <p
              style={{
                fontFamily: FONT.body,
                fontSize: 14,
                lineHeight: 1.55,
                color: "#333",
                margin: "8px 0 14px",
              }}
            >
              Your AI team worked through the night. 3 new leads surfaced by Scout,
              content pipeline is healthy with 4 posts scheduled, and revenue is on
              track — MRR up 8% month-over-month.
            </p>
            <VqButton href="/workspace/briefing" variant="dark">
              Read full briefing
            </VqButton>
          </div>
        </div>
      </div>

      {/* status row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={sectionLabel}>[ crew status ]</div>
        <StatusRow />
      </div>

      {/* quick actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={sectionLabel}>[ quick actions ]</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              style={{
                textDecoration: "none",
                background: "#FFF9ED",
                border: "3px solid #111",
                borderRadius: 14,
                boxShadow: `5px 5px 0 ${action.color}`,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition: "transform 160ms ease, box-shadow 160ms ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translate(2px,2px)"
                e.currentTarget.style.boxShadow = `3px 3px 0 ${action.color}`
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translate(0,0)"
                e.currentTarget.style.boxShadow = `5px 5px 0 ${action.color}`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translate(0,0)"
                e.currentTarget.style.boxShadow = `5px 5px 0 ${action.color}`
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: action.color,
                  border: "2.5px solid #111",
                  display: "grid",
                  placeItems: "center",
                  color: "#111",
                }}
              >
                <action.icon className="size-4" />
              </div>
              <div
                style={{
                  fontFamily: FONT.head,
                  fontSize: 15,
                  color: "#111",
                  letterSpacing: -0.2,
                }}
              >
                {action.title}
              </div>
              <p
                style={{
                  fontFamily: FONT.body,
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: "#555",
                  margin: 0,
                }}
              >
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* metrics */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={sectionLabel}>[ at a glance ]</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {METRICS.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </div>
    </div>
  )
}
