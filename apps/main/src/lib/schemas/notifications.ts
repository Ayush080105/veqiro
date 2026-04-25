import { z } from "zod"

export const NOTIFICATION_FREQUENCIES = [
  "daily",
  "twice-daily",
  "weekly",
] as const
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number]

export const notificationSettingsSchema = z.object({
  deliveryTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Use 24-hour HH:MM format"),
  frequency: z.enum(NOTIFICATION_FREQUENCIES),
  channels: z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  }),
})

export type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>
