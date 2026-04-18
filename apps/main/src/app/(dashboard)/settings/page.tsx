"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Save } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsNav } from "@/components/settings/SettingsNav"

// ─── Form Schema ──────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  timezone: z.string().min(1, "Timezone is required"),
})

type ProfileForm = z.infer<typeof profileSchema>

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsProfilePage() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      timezone: "UTC",
    },
  })

  useEffect(() => {
    if (user) {
      setValue("name", user.name ?? "")
      setValue("email", user.email ?? "")
    }
  }, [user, setValue])

  async function onSubmit(data: ProfileForm) {
    try {
      // TODO: PATCH /api/v1/user/profile  Body: { name, timezone }
      // authClient doesn't expose a direct update — call Express endpoint
      await new Promise((r) => setTimeout(r, 600))
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  const watchedTimezone = watch("timezone")

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your account and organization preferences.</p>
      </div>

      <SettingsNav />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Avatar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Profile picture</CardTitle>
            <CardDescription>Your avatar is shown across the platform and in briefings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                {user?.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" type="button" disabled>
                  Upload photo
                </Button>
                <p className="text-[10px] text-muted-foreground">JPG or PNG, max 2 MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Personal information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-xs font-medium">
                Full name
              </Label>
              <Input id="name" {...register("name")} placeholder="Your name" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <div className="flex items-center gap-2">
                <Input id="email" {...register("email")} placeholder="you@example.com" disabled />
                <Badge variant="secondary" className="shrink-0">
                  {user?.emailVerified ? "Verified" : "Unverified"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Email changes require verification. Contact support to update.
              </p>
            </div>

            <Separator />

            {/* Timezone */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone" className="text-xs font-medium">
                Timezone
              </Label>
              <Select value={watchedTimezone} onValueChange={(v) => setValue("timezone", v, { shouldDirty: true })}>
                <SelectTrigger id="timezone" className="w-full max-w-xs">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Used for briefing delivery times and scheduling.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            <Save className="size-3.5" />
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
