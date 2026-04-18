"use client"

import { CreditCard, Zap, CheckCircle2, Download } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: GET /api/v1/billing?organizationId=xxx  (Stripe customer data)

const CURRENT_PLAN = {
  name: "Free",
  price: "$0",
  period: "forever",
  features: [
    "5 AI conversations / day",
    "All 6 agents (limited)",
    "Brain page (read-only after 500 words)",
    "1 organization member",
    "Community support",
  ],
}

const PRO_PLAN = {
  name: "Pro",
  price: "$49",
  period: "per month",
  features: [
    "Unlimited AI conversations",
    "Full access to all 6 agents",
    "Complete Brain page editing",
    "Up to 10 organization members",
    "Daily briefings via email",
    "Priority support",
    "API access",
  ],
}

const MOCK_INVOICES = [
  { id: "INV-001", date: "2026-03-01", amount: "$0.00", status: "paid", plan: "Free" },
  { id: "INV-002", date: "2026-02-01", amount: "$0.00", status: "paid", plan: "Free" },
  { id: "INV-003", date: "2026-01-01", amount: "$0.00", status: "paid", plan: "Free" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your account and organization preferences.</p>
      </div>

      <SettingsNav />

      <div className="flex flex-col gap-4">
        {/* Current plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-sm font-semibold">Current plan</CardTitle>
                <CardDescription>Your organization is on the Free plan.</CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0">
                {CURRENT_PLAN.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1.5">
              {CURRENT_PLAN.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 shrink-0 text-chart-2" />
                  {feature}
                </li>
              ))}
            </ul>

            <Separator />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="size-3.5" />
              No payment method on file
            </div>
          </CardContent>
        </Card>

        {/* Upgrade card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Upgrade to Pro</CardTitle>
            </div>
            <CardDescription>
              Unlock unlimited conversations, all integrations, and full team access.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{PRO_PLAN.price}</span>
              <span className="text-xs text-muted-foreground">{PRO_PLAN.period}</span>
            </div>

            <ul className="flex flex-col gap-1.5">
              {PRO_PLAN.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button className="self-start">
              <Zap className="size-3.5" />
              Upgrade to Pro
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Cancel anytime. Billed monthly via Stripe. No hidden fees.
            </p>
          </CardContent>
        </Card>

        {/* Invoice history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Invoice history</CardTitle>
            <CardDescription>Your billing history for this organization.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {MOCK_INVOICES.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-xs text-muted-foreground">No invoices yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_INVOICES.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <span className="text-xs font-mono text-foreground">{invoice.id}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDate(invoice.date)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{invoice.plan}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground font-mono">{invoice.amount}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon-sm" title="Download PDF" disabled>
                            <Download className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
