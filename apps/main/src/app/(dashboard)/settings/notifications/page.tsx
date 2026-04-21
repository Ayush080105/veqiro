"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"

import { type NotificationFrequency } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/veqiro/shared"

// ─── Mock State ───────────────────────────────────────────────────────────────
// TODO: GET /api/v1/notifications/settings?organizationId=xxx
// TODO: PATCH /api/v1/notifications/settings  Body: NotificationSettings

const DEFAULT_SETTINGS = {
  deliveryTime: "08:00",
  channels: { inApp: true, email: true, push: false },
  frequency: "daily" as NotificationFrequency,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [deliveryTime, setDeliveryTime] = useState(DEFAULT_SETTINGS.deliveryTime)
  const [channels, setChannels] = useState(DEFAULT_SETTINGS.channels)
  const [frequency, setFrequency] = useState<NotificationFrequency>(DEFAULT_SETTINGS.frequency)
  const [saving, setSaving] = useState(false)

  function toggleChannel(key: keyof typeof channels) {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      toast.success("Notification preferences saved")
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="notifications"
        subtitle="Choose when and how your team keeps you in the loop."
        sticker={{ label: "ping me", rot: 6, color: "var(--vq-pink)" }}
      />

      <SettingsNav />

      <div className="flex flex-col gap-4">
        {/* Briefing delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Briefing delivery</CardTitle>
            <CardDescription>
              Set when your daily AI briefing is delivered. Vega compiles the briefing from your
              full team each morning.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Time */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-time" className="text-xs font-medium">
                Delivery time
              </Label>
              <input
                id="delivery-time"
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="h-8 w-36 rounded-none border border-input bg-transparent px-2.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              />
              <p className="text-[10px] text-muted-foreground">
                Times are based on your timezone set in Profile.
              </p>
            </div>

            <Separator />

            {/* Frequency */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium">Frequency</Label>
              <RadioGroup
                value={frequency}
                onValueChange={(v) => setFrequency(v as NotificationFrequency)}
                className="flex flex-col gap-2"
              >
                {[
                  { value: "daily", label: "Daily", description: "One briefing every morning" },
                  {
                    value: "twice-daily",
                    label: "Twice daily",
                    description: "Morning briefing + evening summary",
                  },
                  {
                    value: "weekly",
                    label: "Weekly digest",
                    description: "One comprehensive briefing every Monday",
                  },
                ].map((option) => (
                  <div key={option.value} className="flex items-start gap-3">
                    <RadioGroupItem value={option.value} id={`freq-${option.value}`} className="mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <Label
                        htmlFor={`freq-${option.value}`}
                        className="text-xs font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      <p className="text-[10px] text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Notification channels</CardTitle>
            <CardDescription>
              Choose where you receive briefings and agent updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[
              {
                key: "inApp" as const,
                label: "In-app",
                description: "See notifications inside Veqiro",
              },
              {
                key: "email" as const,
                label: "Email",
                description: "Receive briefings to your email inbox",
              },
              {
                key: "push" as const,
                label: "Push notifications",
                description: "Browser push alerts (requires permission)",
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={`channel-${key}`} className="text-xs font-medium cursor-pointer">
                    {label}
                  </Label>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={`channel-${key}`}
                  checked={channels[key]}
                  onCheckedChange={() => toggleChannel(key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-3.5" />
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </div>
    </div>
  )
}
