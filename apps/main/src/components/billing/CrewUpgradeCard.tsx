"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { createCheckout, useBillingCatalog, useUpgradeQuote, type SubscriptionPlan } from "@/lib/api/billing"
import { billingActionErrorMessage } from "@/components/billing/entitlement-errors"
import { money } from "@/lib/format"

function unit(cadence: SubscriptionPlan) {
  return cadence === "ANNUAL" ? "yr" : "mo"
}

// Fallback only, for the brief window before /billing/catalog resolves.
// Needed for the "nothing owned" and "credit exceeds price" states, where
// /billing/upgrade-quote has no price fields at all (an ineligible quote is
// just { creditCents, reason }).
const DEFAULT_CREW_CENTS: Record<SubscriptionPlan, number> = {
  MONTHLY: 3900,
  ANNUAL: 34800,
}

const CADENCE_OPTIONS = [
  { value: "MONTHLY" as const, label: "Monthly" },
  { value: "ANNUAL" as const, label: "Annual" },
]

export function CrewUpgradeCard({
  organizationId, isOwner = true,
}: { organizationId?: string | null; isOwner?: boolean }) {
  const [cadence, setCadence] = useState<SubscriptionPlan>("MONTHLY")
  const [busy, setBusy] = useState(false)
  // Re-fetched whenever cadence changes: useUpgradeQuote's query key includes
  // cadence, so flipping the toggle re-quotes rather than reusing a stale
  // monthly credit against an annual price.
  const { data: quote, error, isPending, refetch } = useUpgradeQuote(organizationId, cadence)
  const { data: catalog } = useBillingCatalog()

  // Still loading: nothing to commit to a layout for yet.
  if (isPending) return null
  // A fetch error is not "loading" — show it, don't silently disappear the
  // whole upsell (the previous `if (!quote) return null` collapsed these two
  // states identically, so a 500 looked exactly like "nothing to show").
  if (error) {
    return (
      <Card variant="brand">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
          <p>We couldn&apos;t load Crew upgrade pricing. Please try again.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (!quote) return null
  // Already on Crew: there is nothing left to sell them, full stop — no card.
  if (!quote.eligible && quote.reason === "already-on-crew") return null

  const isCredited = quote.eligible
  const crewPriceCents = catalog
    ? (cadence === "ANNUAL" ? catalog.crew.annual.priceCents : catalog.crew.monthly.priceCents)
    : DEFAULT_CREW_CENTS[cadence]
  // For the credited path the quote itself carries the full list price
  // (payNowCents + creditCents); for the two uncredited paths (nothing
  // owned, or credit exceeds price) the quote has no price fields, so fall
  // back to Crew's own list price for the selected cadence.
  const fullPriceCents = quote.eligible ? quote.payNowCents + quote.creditCents : crewPriceCents
  const dueTodayCents = quote.eligible ? quote.payNowCents : fullPriceCents

  // Savings breakdown only makes sense once the real catalog has resolved —
  // computing it from DEFAULT_CREW_CENTS could show a number the customer is
  // never actually charged if the server-side catalog differs.
  const annualSavings = catalog && cadence === "ANNUAL"
    ? {
        monthlyEquivCents: Math.round(catalog.crew.annual.priceCents / 12),
        savingsCents: catalog.crew.monthly.priceCents * 12 - catalog.crew.annual.priceCents,
      }
    : null

  async function upgrade() {
    setBusy(true)
    try {
      const result = await createCheckout({ crew: true, cadence })
      // createCheckout's return type is shared with the per-agent purchase
      // path, where a cancelled-but-unexpired agent resumes instead of
      // charging and returns url: null. A Crew checkout never actually takes
      // that branch server-side, but the type doesn't know that here, so it
      // must still be checked before `.url` is used — otherwise a null slips
      // through as the literal string "null" in a redirect.
      if (result.resumed) {
        toast.error("Unexpected response from checkout — please try again.")
        return
      }
      // The discount is minted server-side right before checkout; if that
      // failed, the customer is about to be charged full price even though
      // this card showed a credited total — warn now rather than let them
      // discover it only after paying.
      if (result.discountApplied === "failed") {
        toast.warning("We couldn't apply your credit automatically", {
          description: "You'll be charged full price for Crew — contact support for a refund of the difference.",
        })
      }
      window.location.href = result.url
    } catch (e) {
      toast.error(billingActionErrorMessage(e, "Couldn't start the upgrade"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card variant="brand">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              {isCredited ? "Upgrade to the Crew plan" : "Get the Crew plan"}
            </CardTitle>
            <CardDescription>
              {isCredited
                ? "Get all six agents. We'll credit everything you've already paid for this month."
                : !quote.eligible && quote.reason === "credit-exceeds-crew-price"
                  ? "Get all six agents on one subscription. You already own agents worth more than Crew, so there's no additional credit — but Crew still consolidates billing into one plan."
                  : "All six agents, one subscription, one renewal date."}
            </CardDescription>
          </div>
          <SegmentedGroup
            size="sm"
            value={cadence}
            onValueChange={setCadence}
            options={CADENCE_OPTIONS}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {isCredited ? (
          <dl className="text-sm">
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Crew plan</dt>
              <dd>{money(fullPriceCents)}/{unit(cadence)}</dd>
            </div>
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Agents you already own</dt>
              <dd className="text-green-600">−{money(quote.creditCents)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-8 border-t pt-1 font-semibold">
              <dt>Due today</dt>
              <dd>{money(quote.payNowCents)}</dd>
            </div>
            {annualSavings && (
              <p className="mt-1 text-xs text-green-600">
                That's {money(annualSavings.monthlyEquivCents)}/mo — save {money(annualSavings.savingsCents)}/yr vs. monthly.
              </p>
            )}
          </dl>
        ) : (
          <div className="text-sm">
            <span className="text-2xl font-semibold">{money(fullPriceCents)}</span>
            <span className="ml-1 text-muted-foreground">/{unit(cadence)}</span>
            {annualSavings && (
              <p className="mt-1 text-xs text-green-600">
                That's {money(annualSavings.monthlyEquivCents)}/mo — save {money(annualSavings.savingsCents)}/yr vs. monthly.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button onClick={upgrade} disabled={busy || !isOwner}
            title={isOwner ? undefined : "Only the organization owner can manage billing"}>
            {busy
              ? "Opening checkout..."
              : isCredited
                ? `Upgrade for ${money(dueTodayCents)}`
                : `Buy Crew for ${money(fullPriceCents)}`}
          </Button>
          {/* Never show the discounted figure alone — it would misrepresent the
              recurring price. subscription_cycles:1 means only the first billing
              cycle is credited, so the very next cycle already bills full price. */}
          {isCredited && (
            <p className="text-xs text-muted-foreground">
              Then {money(fullPriceCents)}/{unit(cadence)} from next {cadence === "ANNUAL" ? "year" : "month"}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
