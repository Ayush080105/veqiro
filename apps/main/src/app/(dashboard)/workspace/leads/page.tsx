"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import {
  Building2,
  User,
  TrendingUp,
  Mail,
} from "lucide-react"

import { type Lead, type LeadStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { StatusPill } from "@/components/ui/status-pill"

const MOCK_LEADS: Lead[] = [
  {
    id: "1",
    company: "Acme Labs",
    contact: "Sarah Chen",
    email: "sarah@acmelabs.io",
    icpScore: 92,
    source: "Scout / LinkedIn",
    status: "new",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "2",
    company: "Bright Ventures",
    contact: "Tom Nguyen",
    email: "tom@brightventures.com",
    icpScore: 78,
    source: "Scout / Web",
    status: "contacted",
    createdAt: "2026-03-30T14:00:00Z",
  },
  {
    id: "3",
    company: "Nexus AI",
    contact: "Priya Sharma",
    email: "priya@nexus.ai",
    icpScore: 85,
    source: "Scout / Crunchbase",
    status: "qualified",
    createdAt: "2026-03-29T09:00:00Z",
  },
  {
    id: "4",
    company: "Loopback Inc",
    contact: "Marcus Ford",
    email: "",
    icpScore: 60,
    source: "Scout / LinkedIn",
    status: "new",
    createdAt: "2026-03-28T11:00:00Z",
  },
  {
    id: "5",
    company: "Greystone Capital",
    contact: "Julia Park",
    email: "julia@greystonecap.com",
    icpScore: 71,
    source: "Scout / Web",
    status: "closed",
    createdAt: "2026-03-25T08:30:00Z",
  },
]

const MOCK_TRENDS = [
  {
    topic: "AI agents for SMBs",
    summary:
      "Search volume up 38% month-over-month. Multiple think-pieces are being published by VCs. High opportunity for content targeting this keyword cluster.",
    date: "2026-04-01",
  },
  {
    topic: "Founder-led sales automation",
    summary:
      "Reddit and LinkedIn are seeing increased discussion around automating outbound without sacrificing authenticity. Strong fit with Veqiro's positioning.",
    date: "2026-03-31",
  },
  {
    topic: "AI workforce cost comparison",
    summary:
      "Comparison articles between AI employee cost and traditional hires are gaining traction. Good angle for a Veqiro blog post or LinkedIn thread.",
    date: "2026-03-30",
  },
]

function icpBadge(score: number) {
  const level: ComponentProps<typeof StatusPill>["level"] =
    score >= 80 ? "ok" : score >= 60 ? "warn" : "info"
  return <StatusPill level={level}>{score}</StatusPill>
}

function statusBadge(status: LeadStatus) {
  const map: Record<LeadStatus, { level: ComponentProps<typeof StatusPill>["level"]; label: string }> = {
    new: { level: "info", label: "New" },
    contacted: { level: "warn", label: "Contacted" },
    qualified: { level: "ok", label: "Qualified" },
    closed: { level: "info", label: "Closed" },
  }
  const { level, label } = map[status]
  return <StatusPill level={level}>{label}</StatusPill>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function PipelineTab() {
  if (MOCK_LEADS.length === 0) {
    return (
      <EmptyState
        icon={<User />}
        title="No leads yet"
        description="Ask Scout to source leads for your ICP and they will appear here."
        action={{ label: "Ask Scout", href: "/assistants/scout", variant: "outline" }}
      />
    )
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-center">ICP score</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOCK_LEADS.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{lead.company}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">{lead.contact}</span>
                  {lead.email && (
                    <span className="text-xs text-muted-foreground">{lead.email}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">{icpBadge(lead.icpScore)}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{lead.source}</span>
              </TableCell>
              <TableCell>{statusBadge(lead.status)}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {lead.email && (
                    <Button variant="ghost" size="icon-sm" title="Draft email" aria-label="Draft email">
                      <Mail className="size-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function TrendsTab() {
  return (
    <div className="grid gap-3">
      {MOCK_TRENDS.map((trend) => (
        <Card key={trend.topic} variant="brand">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[var(--vq-r-sm)] border border-border bg-muted/35 text-muted-foreground">
                <TrendingUp className="size-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold">{trend.topic}</CardTitle>
                <CardDescription>{formatDate(`${trend.date}T00:00:00Z`)}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">{trend.summary}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/workspace/content">Create content</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/assistants/sage">Ask Sage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title="Leads & research"
        subtitle="Lead pipeline, competitor monitoring, and market trends in one place."
        right={
          <Button variant="outline" size="sm" asChild>
            <Link href="/assistants/scout">Ask Scout to find leads</Link>
          </Button>
        }
      />

      <Tabs defaultValue="pipeline" className="gap-4">
        <TabsList className="border border-[var(--vq-line-2)] bg-card">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineTab />
        </TabsContent>

        <TabsContent value="trends">
          <TrendsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
