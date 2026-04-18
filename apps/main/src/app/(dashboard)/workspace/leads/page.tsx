"use client"

import { useState } from "react"
import {
  Building2,
  User,
  Globe,
  ExternalLink,
  TrendingUp,
  Mail,
  AlertCircle,
} from "lucide-react"

import { type Lead, type LeadStatus, type Competitor } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: Connect to GET /api/v1/leads?organizationId=xxx (via Scout)

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

const MOCK_COMPETITORS: Competitor[] = [
  {
    id: "1",
    name: "Marblism",
    website: "marblism.com",
    lastUpdated: "2026-04-01T08:00:00Z",
    summary:
      "Launched new Brain v2 with improved context retention. Added Stripe integration. Pricing unchanged.",
  },
  {
    id: "2",
    name: "Relevance AI",
    website: "relevanceai.com",
    lastUpdated: "2026-03-31T12:00:00Z",
    summary:
      "New team builder feature announced. Blog post on autonomous agents trending. Community growing fast.",
  },
  {
    id: "3",
    name: "AgentOps",
    website: "agentops.ai",
    lastUpdated: "2026-03-29T10:00:00Z",
    summary: "No major changes detected. Homepage copy updated to emphasize enterprise tier.",
  },
]

const MOCK_TRENDS = [
  {
    topic: "AI agents for SMBs",
    summary:
      "Search volume up 38% month-over-month. Multiple think-pieces being published by VCs. High opportunity for content targeting this keyword cluster.",
    date: "2026-04-01",
  },
  {
    topic: "Founder-led sales automation",
    summary:
      "Reddit and LinkedIn seeing increased discussion around automating outbound without sacrificing authenticity. Strong fit with Veqiro's positioning.",
    date: "2026-03-31",
  },
  {
    topic: "AI workforce cost comparison",
    summary:
      "Comparison articles between AI employee cost vs. traditional hires gaining traction. Good angle for a Veqiro blog post or LinkedIn thread.",
    date: "2026-03-30",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function icpBadge(score: number) {
  const variant =
    score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"
  return (
    <Badge variant={variant} className="font-mono">
      {score}
    </Badge>
  )
}

function statusBadge(status: LeadStatus) {
  const map: Record<LeadStatus, { variant: "default" | "secondary" | "outline"; label: string }> = {
    new: { variant: "outline", label: "New" },
    contacted: { variant: "secondary", label: "Contacted" },
    qualified: { variant: "default", label: "Qualified" },
    closed: { variant: "outline", label: "Closed" },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab() {
  if (MOCK_LEADS.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <User className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No leads yet</p>
          <p className="text-xs text-muted-foreground">
            Chat with Scout to start sourcing leads for your ICP.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="/assistants/scout">Ask Scout</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-center">ICP Score</TableHead>
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
                  <span className="text-xs font-medium text-foreground">{lead.company}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-foreground">{lead.contact}</span>
                  {lead.email && (
                    <span className="text-[10px] text-muted-foreground font-mono">{lead.email}</span>
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
                    <Button variant="ghost" size="icon-sm" title="Draft email">
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

// ─── Competitors Tab ──────────────────────────────────────────────────────────

function CompetitorsTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center gap-2 py-3">
          <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">
            Scout monitors your competitors automatically. Add competitors in the{" "}
            <a href="/brain" className="text-foreground underline underline-offset-2">
              Brain page
            </a>{" "}
            to track them here.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MOCK_COMPETITORS.map((competitor) => (
          <Card key={competitor.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{competitor.name}</CardTitle>
                <a
                  href={`https://${competitor.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={competitor.website}
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <CardDescription className="flex items-center gap-1">
                <Globe className="size-3" />
                {competitor.website}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs/relaxed text-muted-foreground">{competitor.summary}</p>
              <p className="text-[10px] text-muted-foreground">
                Last scan: {formatDate(competitor.lastUpdated)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Trends Tab ───────────────────────────────────────────────────────────────

function TrendsTab() {
  return (
    <div className="flex flex-col gap-4">
      {MOCK_TRENDS.map((trend, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-primary" />
              <CardTitle className="text-sm font-semibold">{trend.topic}</CardTitle>
            </div>
            <CardDescription>{formatDate(trend.date + "T00:00:00Z")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs/relaxed text-muted-foreground">{trend.summary}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/workspace/content">Create content</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="/assistants/sage">Ask Sage</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Leads & Research</h1>
            <Badge variant="secondary">Powered by Scout & Sage</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Lead pipeline, competitor monitoring, and market trends — all in one place.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/assistants/scout">Ask Scout to find leads</a>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <div className="pt-4">
            <PipelineTab />
          </div>
        </TabsContent>

        <TabsContent value="competitors">
          <div className="pt-4">
            <CompetitorsTab />
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <div className="pt-4">
            <TrendsTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
