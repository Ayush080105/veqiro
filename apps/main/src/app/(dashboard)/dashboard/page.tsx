"use client"

import Link from "next/link"
import { MessageSquare, FileText, Users, BookOpen, Bot } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusRow } from "@/components/dashboard/StatusRow"
import { MetricCard } from "@/components/dashboard/MetricCard"

// ─── Greeting ─────────────────────────────────────────────────────────────────

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

// ─── Quick Actions Config ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    title: "Chat with assistant",
    description: "Start a conversation with any member of your AI team.",
    href: "/assistants",
    icon: MessageSquare,
  },
  {
    title: "Create content",
    description: "Generate social posts, blogs, and ad copy instantly.",
    href: "/workspace/content",
    icon: FileText,
  },
  {
    title: "Find leads",
    description: "Scout new prospects and surface high-fit companies.",
    href: "/workspace/leads",
    icon: Users,
  },
  {
    title: "View briefing",
    description: "Read your daily executive summary from Vega.",
    href: "/workspace/briefing",
    icon: BookOpen,
  },
]

// ─── Metrics Config ───────────────────────────────────────────────────────────

const METRICS = [
  { label: "MRR", value: "$12,400", change: "8%", trend: "up" as const },
  { label: "Leads this week", value: "7", change: "+3", trend: "up" as const },
  { label: "Content published", value: "12", change: "stable", trend: "neutral" as const },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = authClient.useSession()
  const name = session?.user?.name?.split(" ")[0] ?? "there"
  const today = new Date()

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* 1. Greeting header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">
          {getGreeting()}, {name}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what your team is working on.
        </p>
      </div>

      {/* 2. Today's Briefing card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                <Bot className="size-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-sm font-semibold">Today&apos;s Briefing</CardTitle>
              <p className="text-xs text-muted-foreground">{formatDate(today)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your AI team worked through the night. 3 new leads surfaced by Scout, content
            pipeline is healthy with 4 posts scheduled, and revenue is on track — MRR up 8%
            month-over-month.
          </p>
          <div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/workspace/briefing">Read full briefing</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Assistant Status Row */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assistant status
        </h2>
        <StatusRow />
      </div>

      {/* 4. Quick Actions */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className="group">
              <Card className="h-full transition-colors hover:bg-muted">
                <CardContent className="flex flex-col gap-2 py-4">
                  <div className="flex size-8 items-center justify-center rounded-none bg-muted group-hover:bg-background transition-colors">
                    <action.icon className="size-4 text-foreground" />
                  </div>
                  <p className="text-xs font-medium text-foreground">{action.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 5. Metrics Strip */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          At a glance
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          {METRICS.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </div>
    </div>
  )
}
