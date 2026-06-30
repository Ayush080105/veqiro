"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, CreditCard, ShoppingCart, Sparkles, Zap } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { useSession } from "@/lib/auth-client"
import {
  BillingAgent,
  SubscriptionPlan,
  createCheckout,
  openBillingPortal,
  useBillingStatus,
} from "@/lib/api/billing"
import { ApiError } from "@/lib/api/client"
import { AGENTS } from "@/lib/config/agents"

const ALL_AGENTS: BillingAgent[] = ["MAYA", "SAGE", "LEX", "REX", "SCOUT", "VEGA"]
const CREW_MONTHLY_CENTS = Number(process.env.NEXT_PUBLIC_CREW_MONTHLY_CENTS ?? 3900)
const CREW_ANNUAL_CENTS = Number(process.env.NEXT_PUBLIC_CREW_ANNUAL_CENTS ?? 34800)

const AGENT_PRICE_ENV: Record<BillingAgent, string | undefined> = {
  MAYA: process.env.NEXT_PUBLIC_AGENT_PRICE_MAYA_MONTHLY_CENTS,
  SAGE: process.env.NEXT_PUBLIC_AGENT_PRICE_SAGE_MONTHLY_CENTS,
  LEX: process.env.NEXT_PUBLIC_AGENT_PRICE_LEX_MONTHLY_CENTS,
  REX: process.env.NEXT_PUBLIC_AGENT_PRICE_REX_MONTHLY_CENTS,
  SCOUT: process.env.NEXT_PUBLIC_AGENT_PRICE_SCOUT_MONTHLY_CENTS,
  VEGA: process.env.NEXT_PUBLIC_AGENT_PRICE_VEGA_MONTHLY_CENTS,
}

const DEFAULT_AGENT_MONTHLY_CENTS: Record<BillingAgent, number> = {
  MAYA: 1900,
  SAGE: 900,
  LEX: 900,
  REX: 900,
  SCOUT: 900,
  VEGA: 900,
}

const SLUG_TO_AGENT: Record<string, BillingAgent> = {
  maya: "MAYA",
  sage: "SAGE",
  lex: "LEX",
  rex: "REX",
  scout: "SCOUT",
  vega: "VEGA",
}

const AGENT_IMAGES: Record<BillingAgent, string> = {
  MAYA: "/agents/maya.jpeg",
  SAGE: "/agents/sage.jpeg",
  LEX: "/agents/lex.jpeg",
  REX: "/agents/rex.jpeg",
  SCOUT: "/agents/scout.jpeg",
  VEGA: "/agents/vega.jpeg",
}

type AugmentedSession = {
  activeOrganization?: { id?: string } | null
}

type PurchaseMode = "CREW" | "CUSTOM"

function toBillingAgent(slug: string): BillingAgent {
  return slug.toUpperCase() as BillingAgent
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function getMonthlyPrice(agent: BillingAgent): number | null {
  const raw = AGENT_PRICE_ENV[agent]
  if (!raw) return DEFAULT_AGENT_MONTHLY_CENTS[agent]
  const cents = Number(raw)
  return Number.isInteger(cents) && cents > 0 ? cents : DEFAULT_AGENT_MONTHLY_CENTS[agent]
}

function selectionIsCrew(agents: BillingAgent[]) {
  return agents.length === ALL_AGENTS.length && ALL_AGENTS.every((agent) => agents.includes(agent))
}

function calculateTotal(agents: BillingAgent[], cadence: SubscriptionPlan): number | null {
  if (selectionIsCrew(agents)) return cadence === "ANNUAL" ? CREW_ANNUAL_CENTS : CREW_MONTHLY_CENTS
  const prices = agents.map(getMonthlyPrice)
  if (prices.some((price) => price == null)) return null
  const monthly = (prices as number[]).reduce((sum, price) => sum + price, 0)
  return cadence === "MONTHLY" ? monthly : Math.round(monthly * 12 * 0.75)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function checkoutErrorMessage(err: unknown) {
  if (err instanceof ApiError && err.message.startsWith("missing-dodo_custom_")) {
    return "Custom agent checkout is not configured yet. Add the Dodo custom monthly product ID on the server."
  }
  return err instanceof Error ? err.message : "Failed to start checkout"
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const augmented = session as (AugmentedSession & typeof session) | null
  const organizationId = augmented?.activeOrganization?.id
  const { data: billing, refetch } = useBillingStatus(organizationId)
  const sub = billing?.subscription

  const currentAgents = useMemo(
    () => new Set<BillingAgent>(sub?.selectedAgents ?? []),
    [sub?.selectedAgents],
  )
  const [selected, setSelected] = useState<BillingAgent[]>([])
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>("CREW")
  const [cadence, setCadence] = useState<SubscriptionPlan>("MONTHLY")
  const [checkingOut, setCheckingOut] = useState(false)
  const [portaling, setPortaling] = useState(false)
  const [syncingCheckout, setSyncingCheckout] = useState(false)

  useEffect(() => {
    const preselected = searchParams.get("agents")
    if (preselected) {
      const agents = preselected
        .split(",")
        .map((item) => SLUG_TO_AGENT[item.trim().toLowerCase()])
        .filter((agent): agent is BillingAgent => Boolean(agent))
      if (agents.length) {
        const sorted = [...new Set(agents)].sort((a, b) => ALL_AGENTS.indexOf(a) - ALL_AGENTS.indexOf(b))
        setSelected(sorted)
        setPurchaseMode(selectionIsCrew(sorted) ? "CREW" : "CUSTOM")
        return
      }
    }
    if (!sub) {
      setSelected(ALL_AGENTS)
      setPurchaseMode("CREW")
      return
    }
    setSelected(sub.selectedAgents)
    setPurchaseMode(sub.entitlementMode === "CREW" ? "CREW" : "CUSTOM")
    setCadence(sub.plan ?? "MONTHLY")
  }, [searchParams, sub])

  useEffect(() => {
    if (searchParams.get("status") !== "success") return
    void refetch().then(() => {
      setSyncingCheckout(true)
      toast.info("Payment complete", { description: "Syncing your agent access..." })
      router.replace("/settings/billing")
    })
  }, [searchParams, refetch, router])

  useEffect(() => {
    if (!syncingCheckout) return
    const interval = window.setInterval(() => {
      void refetch().then((result) => {
        if (!result.data?.subscription?.pendingCheckout) {
          setSyncingCheckout(false)
          toast.success("Billing updated", { description: "Your agent access is ready." })
        }
      })
    }, 2000)
    return () => window.clearInterval(interval)
  }, [syncingCheckout, refetch])

  const crew = purchaseMode === "CREW"
  const checkoutCadence: SubscriptionPlan = crew ? cadence : "MONTHLY"
  const checkoutAgents = crew ? ALL_AGENTS : selected
  const total = calculateTotal(checkoutAgents, checkoutCadence)
  const hasPortalManagedSubscription =
    sub?.status === "ACTIVE" || sub?.status === "CANCELLED" || sub?.status === "PAST_DUE"
  const canCheckout = checkoutAgents.length > 0 && total != null && !checkingOut && !hasPortalManagedSubscription
  const isPaidOrTrial = sub?.status === "ACTIVE" || sub?.status === "TRIALING" || sub?.status === "CANCELLED"

  function toggleAgent(agent: BillingAgent) {
    if (isPaidOrTrial && currentAgents.has(agent)) return
    setPurchaseMode("CUSTOM")
    setSelected((prev) => {
      const next = prev.includes(agent)
        ? prev.filter((item) => item !== agent)
        : [...prev, agent].sort((a, b) => ALL_AGENTS.indexOf(a) - ALL_AGENTS.indexOf(b))
      if (selectionIsCrew(next)) setPurchaseMode("CREW")
      return next
    })
  }

  function selectCrew() {
    setSelected(ALL_AGENTS)
    setPurchaseMode("CREW")
  }

  function selectCustom() {
    setPurchaseMode("CUSTOM")
    setSelected((prev) => selectionIsCrew(prev) ? [] : prev)
  }

  async function handleCheckout() {
    setCheckingOut(true)
    try {
      const result = await createCheckout({ agents: checkoutAgents, cadence: checkoutCadence })
      window.location.href = result.url
    } catch (err) {
      toast.error(checkoutErrorMessage(err))
    } finally {
      setCheckingOut(false)
    }
  }

  async function handlePortal() {
    setPortaling(true)
    try {
      const res = await openBillingPortal()
      if (res.url) window.location.href = res.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal")
    } finally {
      setPortaling(false)
    }
  }

  const statusLabel =
    !sub ? "No subscription"
    : sub.status === "TRIALING" ? `Trial · ${sub.daysRemaining ?? 0} days left`
    : sub.status === "ACTIVE" ? (sub.entitlementMode === "CREW" ? "Crew plan" : "Custom agent plan")
    : sub.status === "PAST_DUE" ? "Payment failed"
    : sub.status === "CANCELLED" ? "Cancelled"
    : "Expired"

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="billing"
        subtitle="Choose the agents your workspace can use."
        sticker={{ label: "agent cart", rot: -6, color: "var(--vq-blue)" }}
      />

      <SettingsNav />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold">Current access</CardTitle>
              <CardDescription>
                {sub?.currentPeriodEnd
                  ? `Renews or remains available until ${formatDate(sub.currentPeriodEnd)}.`
                  : "Your subscription status and unlocked agents."}
              </CardDescription>
            </div>
            <Badge variant={sub?.status === "ACTIVE" ? "default" : "secondary"}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(sub?.unlockedAgents?.length ? sub.unlockedAgents : []).map((agent) => (
              <Badge key={agent} variant="outline">{agent}</Badge>
            ))}
            {!sub?.unlockedAgents?.length && (
              <span className="text-sm text-muted-foreground">No agents unlocked yet.</span>
            )}
          </div>
          {sub?.pendingCheckout && (
            <Badge variant="secondary" className="w-fit">
              Checkout syncing
            </Badge>
          )}
          {(sub?.status === "ACTIVE" || sub?.status === "CANCELLED" || sub?.status === "PAST_DUE") && (
            <>
              <Separator />
              <Button variant="outline" className="self-start" onClick={handlePortal} disabled={portaling}>
                <CreditCard className="size-3.5" />
                {portaling ? "Opening portal..." : "Manage billing"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="size-4 text-primary" />
                Choose your access
              </CardTitle>
              <CardDescription>
                Start with the full Crew, or build a monthly cart with individual agents.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div
            role="button"
            tabIndex={0}
            onClick={selectCrew}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                selectCrew()
              }
            }}
            className={`rounded-lg border p-4 transition ${
              crew ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span
                  className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border transition ${
                    crew ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background"
                  }`}
                  aria-hidden="true"
                >
                  {crew && <Check className="size-3" />}
                </span>
                <div className="flex -space-x-3 pt-1">
                  {AGENTS.map((agent) => {
                    const billingAgent = toBillingAgent(agent.id)
                    return (
                      <div key={agent.id} className="relative size-11 overflow-hidden rounded-full border-2 border-background bg-muted">
                        <Image
                          src={AGENT_IMAGES[billingAgent]}
                          alt={`${agent.name} portrait`}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                    )
                  })}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Crew plan</span>
                    <Badge variant="secondary">Best value</Badge>
                    {crew && <Badge>Selected</Badge>}
                  </div>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                    Unlock Maya, Sage, Lex, Rex, Scout, and Vega together with monthly or annual billing.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="inline-flex rounded-md border bg-muted p-1" onClick={(event) => event.stopPropagation()}>
                  {(["MONTHLY", "ANNUAL"] as SubscriptionPlan[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setCadence(item)
                        selectCrew()
                      }}
                      className={`rounded px-3 py-1.5 text-xs font-medium ${
                        cadence === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {item === "MONTHLY" ? "Monthly" : "Annual - 25% off"}
                    </button>
                  ))}
                </div>
                <div className="text-xl font-bold">
                  {formatMoney(cadence === "ANNUAL" ? CREW_ANNUAL_CENTS : CREW_MONTHLY_CENTS)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {cadence === "MONTHLY" ? "/mo" : "/yr"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={crew ? "secondary" : "default"}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectCrew()
                  }}
                >
                  {crew ? "Crew selected" : "Choose Crew"}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Monthly agent cart</h3>
                {!crew && <Badge>Selected</Badge>}
                <Badge variant="outline">Monthly only</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Choose this if you only want specific agents.</p>
            </div>
            <Button size="sm" variant={crew ? "outline" : "secondary"} onClick={selectCustom}>
              {crew ? "Customize agents" : "Custom cart selected"}
            </Button>
          </div>

          <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${crew ? "opacity-70" : ""}`}>
            {AGENTS.map((agent) => {
              const billingAgent = toBillingAgent(agent.id)
              const active = !crew && selected.includes(billingAgent)
              const lockedCurrent = isPaidOrTrial && currentAgents.has(billingAgent)
              const price = getMonthlyPrice(billingAgent)

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAgent(billingAgent)}
                  className={`rounded-lg border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"} ${lockedCurrent ? "cursor-default" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 overflow-hidden rounded-full border bg-muted">
                        <Image
                          src={AGENT_IMAGES[billingAgent]}
                          alt={`${agent.name} portrait`}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.role}</div>
                      </div>
                    </div>
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                      aria-hidden="true"
                    >
                      {active && <Check className="size-3" />}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">
                      {price == null ? "Price pending" : `${formatMoney(price)}/mo`}
                    </span>
                    {lockedCurrent && <Badge variant="secondary">Current</Badge>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {crew ? <Sparkles className="size-4 text-primary" /> : <Zap className="size-4 text-primary" />}
                  {crew ? "Crew plan selected" : `${selected.length} agent${selected.length === 1 ? "" : "s"} selected`}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {crew
                    ? "All six agents are included at the best-value Crew rate."
                    : "Individual agent carts are billed monthly. Use the portal for removals or cancellation."}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="text-2xl font-bold">
                  {total == null ? "Price pending" : formatMoney(total)}
                  {total != null && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {checkoutCadence === "MONTHLY" ? "/mo" : "/yr"}
                    </span>
                  )}
                </div>
                {hasPortalManagedSubscription ? (
                  <Button onClick={handlePortal} disabled={portaling}>
                    <CreditCard className="size-3.5" />
                    {portaling ? "Opening portal..." : "Manage in billing portal"}
                  </Button>
                ) : (
                  <Button onClick={handleCheckout} disabled={!canCheckout}>
                    <ShoppingCart className="size-3.5" />
                    {checkingOut
                      ? "Opening checkout..."
                      : crew
                        ? "Checkout Crew plan"
                        : selected.length
                          ? "Checkout agent cart"
                          : "Select agents to continue"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
