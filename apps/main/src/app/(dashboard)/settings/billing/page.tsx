"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Zap, CheckCircle2, Download, Loader2, CalendarDays, ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { authClient } from "@/lib/auth-client"
import { apiFetch } from "@/lib/api/client"

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED"

interface SubscriptionData {
  status: SubscriptionStatus
  subscriptionId: string | null
  nextBillingDate: string | null
  canceledAt: string | null
}

interface Invoice {
  paymentId: string
  invoiceId: string | null
  invoiceUrl: string | null
  date: string
  amount: number
  currency: string
  status: string
}

// ─── Plan config ──────────────────────────────────────────────────────────────

const FREE_PLAN_FEATURES = [
   "Your 6-Member AI Team (All Included)",
  "Lex, Maya, Rex, Sage, Scout & Vega — Ready to Work",
  "Everything Stays Connected (Shared Context)",
  "Faster Than Traditional Workflows",
  "Speaks Exactly Like Your Brand",
  "Works With Your Existing Tools",
]

const PRO_PLAN_FEATURES = [
  "Your 6-Member AI Team (All Included)",
  "Lex, Maya, Rex, Sage, Scout & Vega — Ready to Work",
  "Everything Stays Connected (Shared Context)",
  "Faster Than Traditional Workflows",
  "Speaks Exactly Like Your Brand",
  "Works With Your Existing Tools",
]

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; className: string }> = {
  FREE:     { label: "Free",     className: "border-muted-foreground/30 text-muted-foreground" },
  ACTIVE:   { label: "Pro",      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" },
  PAST_DUE: { label: "Past due", className: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  CANCELED: { label: "Canceled", className: "border-destructive/40 bg-destructive/10 text-destructive" },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()
  const [upgrading, setUpgrading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { data: sub, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: () => apiFetch("/payments/subscription"),
  })

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () => apiFetch("/payments/invoices"),
  })

  const status: SubscriptionStatus = sub?.status ?? "FREE"
  const isPro = status === "ACTIVE"
  const badge = STATUS_BADGE[status]

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await apiFetch<{ synced: boolean; status: string }>("/payments/sync", { method: "POST" })
      await queryClient.invalidateQueries({ queryKey: ["subscription"] })
      await queryClient.invalidateQueries({ queryKey: ["invoices"] })
      if (result.synced) {
        toast.success("Plan updated to " + (result.status === "ACTIVE" ? "Pro" : result.status))
      } else {
        toast.info("No active subscription found in Dodo — plan unchanged.")
      }
    } catch {
      toast.error("Could not sync subscription status.")
    } finally {
      setSyncing(false)
    }
  }

  const handleCancel = async () => {
    setCanceling(true)
    try {
      await apiFetch("/payments/cancel", { method: "POST" })
      await queryClient.invalidateQueries({ queryKey: ["subscription"] })
      setConfirmCancel(false)
      toast.success("Subscription canceled — you'll retain Pro access until the next billing date.")
    } catch {
      toast.error("Could not cancel subscription — please try again.")
    } finally {
      setCanceling(false)
    }
  }

  const handleUpgrade = async () => {
    const email = session?.user?.email
    if (!email) {
      toast.error("Could not read your email — please refresh and try again.")
      return
    }
    setUpgrading(true)
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>(
        "/payments/checkout",
        {
          method: "POST",
          body: {
            customer_email: email,
            customer_name: session?.user?.name ?? undefined,
          },
        }
      )
      window.location.href = checkout_url
    } catch {
      toast.error("Could not start checkout — please try again.")
      setUpgrading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Your plan, payment methods, and invoice history."
        sticker={{ label: "money matters", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      <div className="flex flex-col gap-4">
        {/* Current plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-sm font-semibold">Current plan</CardTitle>
                <CardDescription>
                  {isPro ? "Your organization is on the Pro plan." : "Your organization is on the Free plan."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Sync subscription status from Dodo"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                </Button>
                {subLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1.5">
              {(isPro ? PRO_PLAN_FEATURES : FREE_PLAN_FEATURES).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className={`size-3 shrink-0 ${isPro ? "text-primary" : "text-chart-2"}`} />
                  {feature}
                </li>
              ))}
            </ul>

            <Separator />

            {isPro && sub?.nextBillingDate ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {sub.canceledAt
                    ? `Access until ${formatDate(sub.nextBillingDate)} · will not renew`
                    : `Next billing on ${formatDate(sub.nextBillingDate)}`}
                </div>
                {!sub.canceledAt && (
                  confirmCancel ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Cancel at period end?</span>
                      <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={handleCancel} disabled={canceling}>
                        {canceling ? <Loader2 className="size-3 animate-spin" /> : "Confirm"}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setConfirmCancel(false)} disabled={canceling}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmCancel(true)}>
                      Cancel plan
                    </Button>
                  )
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CreditCard className="size-3.5" />
                No payment method on file
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade card — only shown when not on Pro */}
        {!isPro && (
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
                <span className="text-2xl font-bold text-foreground">$49</span>
                <span className="text-xs text-muted-foreground">per month</span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {PRO_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button className="self-start" onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5" />
                )}
                {upgrading ? "Redirecting…" : "Upgrade to Pro"}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Secure checkout via Dodo Payments · UPI & cards accepted · Cancel anytime.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Invoice history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Invoice history</CardTitle>
            <CardDescription>Your billing history for this organization.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-xs text-muted-foreground">No invoices yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.paymentId}>
                      <TableCell>
                        <span className="text-xs font-mono text-foreground">
                          {invoice.invoiceId ?? invoice.paymentId.slice(0, 12)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDate(invoice.date)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground font-mono">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {invoice.invoiceUrl ? (
                            <Button variant="ghost" size="icon-sm" title="Download PDF" asChild>
                              <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-3.5" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon-sm" title="No PDF available" disabled>
                              <Download className="size-3.5" />
                            </Button>
                          )}
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
