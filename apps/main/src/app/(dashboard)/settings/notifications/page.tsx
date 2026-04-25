"use client"

import { Save } from "lucide-react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { RhfField } from "@/components/forms/RhfField"
import {
  notificationSettingsSchema,
  type NotificationSettingsValues,
} from "@/lib/schemas/notifications"

// ─── Mock State ───────────────────────────────────────────────────────────────
// TODO: GET /api/v1/notifications/settings?organizationId=xxx
// TODO: PATCH /api/v1/notifications/settings  Body: NotificationSettings

const DEFAULT_SETTINGS: NotificationSettingsValues = {
  deliveryTime: "08:00",
  frequency: "daily",
  channels: { inApp: true, email: true, push: false },
}

const FREQUENCIES = [
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
] as const

const CHANNELS = [
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
]

export default function NotificationsPage() {
  const form = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: DEFAULT_SETTINGS,
  })

  // Submit handler is wired so RHF works the moment the backend lands.
  const onSubmit = (_values: NotificationSettingsValues) => {
    // PATCH /api/v1/notifications/settings — coming soon
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

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
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
            <RhfField
              control={form.control}
              name="deliveryTime"
              label="Delivery time"
              description="Times are based on your timezone set in Profile."
            >
              {({ field, invalid, id }) => (
                <input
                  {...field}
                  id={id}
                  type="time"
                  aria-invalid={invalid}
                  className="h-8 w-36 rounded-none border border-input bg-transparent px-2.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                />
              )}
            </RhfField>

            <Separator />

            <RhfField control={form.control} name="frequency" label="Frequency">
              {({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-col gap-2"
                >
                  {FREQUENCIES.map((option) => (
                    <div key={option.value} className="flex items-start gap-3">
                      <RadioGroupItem
                        value={option.value}
                        id={`freq-${option.value}`}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5">
                        <Label
                          htmlFor={`freq-${option.value}`}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {option.label}
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </RhfField>
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
            {CHANNELS.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor={`channel-${key}`}
                    className="text-xs font-medium cursor-pointer"
                  >
                    {label}
                  </Label>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
                <Controller
                  control={form.control}
                  name={`channels.${key}`}
                  render={({ field }) => (
                    <Switch
                      id={`channel-${key}`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Notification preferences · coming soon
          </span>
          <Button type="submit" disabled>
            <Save className="size-3.5" />
            Save preferences
          </Button>
        </div>
      </form>
    </div>
  )
}
