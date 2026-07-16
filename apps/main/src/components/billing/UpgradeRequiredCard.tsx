"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

const COPY: Record<string, { title: string; body: string }> = {
  "trial-not-started":      { title: "Start your free trial",      body: "You haven't started your trial yet. Activate it to unlock agents." },
  "trial-expired":          { title: "Your trial has ended",       body: "Upgrade to keep using agents." },
  "subscription-expired":   { title: "Subscription ended",         body: "Reactivate your plan to continue." },
  "payment-failed":         { title: "Payment failed",             body: "Update your card to keep your subscription active." },
  "agent-not-purchased":    { title: "Agent not in your plan",     body: "Add this agent to your subscription to run chats and actions." },
  default:                  { title: "Upgrade required",           body: "This feature is part of the Pro plan." },
}

export function UpgradeRequiredCard({ reason }: { reason: string | null | undefined }) {
  const { title, body } = COPY[reason ?? "default"] ?? COPY.default

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card variant="brand" className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/settings/billing">Go to billing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
