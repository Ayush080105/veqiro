"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createCheckout, useUpgradeQuote } from "@/lib/api/billing"
import { billingActionErrorMessage } from "@/components/billing/entitlement-errors"

function money(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`
}

export function CrewUpgradeCard({ organizationId }: { organizationId?: string | null }) {
  const { data: quote } = useUpgradeQuote(organizationId, "MONTHLY")
  const [busy, setBusy] = useState(false)

  // Only eligible orgs see this at all. Ineligible reasons are deliberately not
  // rendered as an error: "you already own more than Crew costs" is not a
  // failure the user needs to action, and we don't refund the difference.
  if (!quote?.eligible) return null

  async function upgrade() {
    setBusy(true)
    try {
      const result = await createCheckout({ crew: true, cadence: "MONTHLY" })
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
      window.location.href = result.url
    } catch (e) {
      toast.error(billingActionErrorMessage(e, "Couldn't start the upgrade"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Upgrade to the Crew plan
        </CardTitle>
        <CardDescription>
          Get all six agents. We&apos;ll credit everything you&apos;ve already paid for this month.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <dl className="text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Crew plan</dt>
            <dd>{money(quote.payNowCents + quote.creditCents)}/mo</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Agents you already own</dt>
            <dd className="text-green-600">−{money(quote.creditCents)}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-8 border-t pt-1 font-semibold">
            <dt>Due today</dt>
            <dd>{money(quote.payNowCents)}</dd>
          </div>
        </dl>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button onClick={upgrade} disabled={busy}>
            {busy ? "Opening checkout..." : `Upgrade for ${money(quote.payNowCents)}`}
          </Button>
          {/* Never show the discounted figure alone — it would misrepresent the
              recurring price. subscription_cycles:1 means only month one is credited. */}
          <p className="text-xs text-muted-foreground">
            Then {money(quote.payNowCents + quote.creditCents)}/mo from next month.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
