"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { CreditCard, CheckCircle2, Zap, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { authClient, useSession } from "@/lib/auth-client"
import { openBillingPortal } from "@/lib/api/billing"

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = "TRIALING" | "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED"

type Subscription = {
  status: SubStatus
  plan?: string | null
  daysRemaining?: number | null
  currentPeriodEnd?: string | null
  cancelledAt?: string | null
  dodoCustomerId?: string | null
}

type AugmentedSession = {
  activeOrganization?: { id?: string } | null
  subscription?: Subscription | null
}

// ─── Feature list ─────────────────────────────────────────────────────────────

const FEATURES = [
  "Unlimited AI conversations",
  "Full access to all 6 agents",
  "Complete Brain page editing",
  "Up to 10 organization members",
  "Daily briefings via email",
  "Priority support",
  "API access",
]

// ─── PlanCard ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
  title: string
  price: string
  period: string
  highlight?: string
  cta: string
  onClick: () => void
  disabled?: boolean
}

function PlanCard({ title, price, period, highlight, cta, onClick, disabled }: PlanCardProps) {
  return (
    <Card className="flex-1 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          {highlight && (
            <Badge className="shrink-0 text-[10px]">{highlight}</Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1 pt-1">
          <span className="text-2xl font-bold text-foreground">{price}</span>
          <span className="text-xs text-muted-foreground">{period}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
        <Button className="self-start" onClick={onClick} disabled={disabled}>
          <Zap className="size-3.5" />
          {cta}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusLabel(sub: Subscription | null | undefined): string {
  if (!sub) return "No subscription"
  if (sub.status === "ACTIVE") {
    if (sub.plan === "pro-annual") return "Pro Annual"
    return "Pro Monthly"
  }
  if (sub.status === "TRIALING") {
    const days = sub.daysRemaining ?? 0
    return `Free trial · ${days} ${days === 1 ? "day" : "days"} left`
  }
  if (sub.status === "CANCELLED") return "Cancelled"
  if (sub.status === "PAST_DUE") return "Payment failed"
  if (sub.status === "EXPIRED") return "Subscription expired"
  return "No subscription"
}

function statusDescription(sub: Subscription | null | undefined): string {
  if (!sub) return "You are not subscribed to any plan."
  if (sub.status === "ACTIVE") {
    return sub.currentPeriodEnd
      ? `Your plan renews on ${formatDate(sub.currentPeriodEnd)}.`
      : "Your Pro plan is active."
  }
  if (sub.status === "TRIALING") {
    return sub.currentPeriodEnd
      ? `Your trial ends on ${formatDate(sub.currentPeriodEnd)}. Upgrade to keep access.`
      : "Your trial is active. Upgrade to keep access."
  }
  if (sub.status === "CANCELLED") {
    return sub.currentPeriodEnd
      ? `Your subscription is cancelled. Access continues until ${formatDate(sub.currentPeriodEnd)}.`
      : "Your subscription has been cancelled."
  }
  if (sub.status === "PAST_DUE") {
    return "Your last payment failed. Update your payment method to keep your subscription."
  }
  if (sub.status === "EXPIRED") {
    return sub.cancelledAt
      ? `Your subscription expired on ${formatDate(sub.cancelledAt)}.`
      : "Your subscription has expired."
  }
  return ""
}

function statusBadge(sub: Subscription | null | undefined): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!sub) return { label: "Free", variant: "secondary" }
  if (sub.status === "ACTIVE") return { label: "Active", variant: "default" }
  if (sub.status === "TRIALING") return { label: "Trial", variant: "outline" }
  if (sub.status === "CANCELLED") return { label: "Cancelled", variant: "secondary" }
  if (sub.status === "PAST_DUE") return { label: "Past due", variant: "destructive" }
  if (sub.status === "EXPIRED") return { label: "Expired", variant: "secondary" }
  return { label: "Free", variant: "secondary" }
}

function showPlanPicker(sub: Subscription | null | undefined): boolean {
  if (!sub) return true
  return sub.status === "TRIALING" || sub.status === "EXPIRED"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const augmented = session as (AugmentedSession & typeof session) | null
  const sub = augmented?.subscription as Subscription | null | undefined
  const organizationId = augmented?.activeOrganization?.id

  const [upgrading, setUpgrading] = useState<"monthly" | "annual" | null>(null)
  const [portaling, setPortaling] = useState(false)

  // ── Checkout polling on ?status=success ───────────────────────────────────
  const polledRef = useRef(false)
  useEffect(() => {
    const status = searchParams.get("status")
    if (status !== "success" || polledRef.current) return
    polledRef.current = true

    let attempts = 0
    const MAX = 3
    const INTERVAL = 1000

    const poll = async () => {
      try {
        await authClient.getSession({ query: { disableCookieCache: true } })
        attempts++
        const latest = (authClient as any)._getSession?.()?.subscription as Subscription | null
        if (latest?.status === "ACTIVE" || attempts >= MAX) {
          toast.success("Welcome to Pro!", {
            description: "Your subscription is now active.",
          })
          router.replace("/settings/billing")
          return
        }
      } catch {
        // ignore, keep polling
      }
      if (attempts < MAX) {
        setTimeout(poll, INTERVAL)
      } else {
        toast.success("Welcome to Pro!", {
          description: "Your subscription is now active.",
        })
        router.replace("/settings/billing")
      }
    }

    // Start polling after a short initial delay
    setTimeout(poll, INTERVAL)
  }, [searchParams, router])

  // ── Upgrade function ──────────────────────────────────────────────────────
  async function handleUpgrade(billingPeriod: "monthly" | "annual") {
    const slug = billingPeriod === "annual" ? "pro-annual" : "pro-monthly"
    setUpgrading(billingPeriod)
    try {
      await (authClient as any).dodopayments.checkoutSession({
        slug,
        customer: sub?.dodoCustomerId
          ? { customer_id: sub.dodoCustomerId }
          : undefined,
        metadata: organizationId ? { organizationId } : undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout")
    } finally {
      setUpgrading(null)
    }
  }

  // ── Portal function ───────────────────────────────────────────────────────
  async function handlePortal() {
    setPortaling(true)
    try {
      const res = await openBillingPortal()
      if (res?.url) {
        window.location.href = res.url
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal")
    } finally {
      setPortaling(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const badge = statusBadge(sub)
  const showPicker = showPlanPicker(sub)

  const portalButtonLabel =
    sub?.status === "CANCELLED" ? "Resume subscription"
    : sub?.status === "PAST_DUE" ? "Update payment"
    : "Manage billing"

  const showPortalButton =
    sub?.status === "ACTIVE" ||
    sub?.status === "CANCELLED" ||
    sub?.status === "PAST_DUE"

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Your plan, payment methods, and subscription status."
        sticker={{ label: "money matters", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      <div className="flex flex-col gap-4">
        {/* Current state */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-sm font-semibold">Current plan</CardTitle>
                <CardDescription>{statusDescription(sub)}</CardDescription>
              </div>
              <Badge variant={badge.variant} className="shrink-0">
                {badge.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CreditCard className="size-4 text-muted-foreground" />
              {statusLabel(sub)}
            </div>

            {/* Past due alert */}
            {sub?.status === "PAST_DUE" && (
              <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold text-destructive">Payment failed</p>
                  <p className="text-xs text-muted-foreground">
                    Your subscription is past due. Update your payment method to avoid losing access.
                  </p>
                </div>
              </div>
            )}

            {showPortalButton && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={handlePortal}
                  disabled={portaling}
                >
                  <CreditCard className="size-3.5" />
                  {portaling ? "Opening portal…" : portalButtonLabel}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Plan picker */}
        {showPicker && (
          <>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Choose a plan
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <PlanCard
                title="Pro Monthly"
                price="$39"
                period="/mo"
                cta="Upgrade — monthly"
                onClick={() => handleUpgrade("monthly")}
                disabled={upgrading !== null}
              />
              <PlanCard
                title="Pro Annual"
                price="$29"
                period="/mo · billed annually"
                highlight="Save 26%"
                cta="Upgrade — annual"
                onClick={() => handleUpgrade("annual")}
                disabled={upgrading !== null}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
