"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
})

const orgSchema = z.object({
  orgName: z.string().min(1, "Workspace name is required"),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type ProfileForm = z.infer<typeof profileSchema>
type OrgForm = z.infer<typeof orgSchema>
type PasswordForm = z.infer<typeof passwordSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsProfilePage() {
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const user = session?.user

  // ── Personal info ──────────────────────────────────────────────────────────
  const [savingProfile, setSavingProfile] = useState(false)
  const {
    register: regProfile,
    setValue: setProfileValue,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (user) setProfileValue("name", user.name ?? "")
  }, [user, setProfileValue])

  async function onSaveProfile(values: ProfileForm) {
    setSavingProfile(true)
    try {
      await authClient.updateUser({ name: values.name })
      toast.success("Profile updated")
    } catch (err) {
      toast.error(`Failed to save: ${(err as Error).message}`)
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Workspace name ─────────────────────────────────────────────────────────
  const [savingOrg, setSavingOrg] = useState(false)
  const {
    register: regOrg,
    setValue: setOrgValue,
    handleSubmit: handleOrgSubmit,
    formState: { errors: orgErrors, isDirty: orgDirty },
  } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: { orgName: "" },
  })

  useEffect(() => {
    if (activeOrg?.name) setOrgValue("orgName", activeOrg.name)
  }, [activeOrg, setOrgValue])

  async function onSaveOrg(values: OrgForm) {
    if (!activeOrg?.id) return
    setSavingOrg(true)
    try {
      const res = await authClient.organization.update({
        organizationId: activeOrg.id,
        data: { name: values.orgName },
      })
      const err = (res as { error?: { message?: string } | null }).error
      if (err) throw new Error(err.message ?? "Unknown error")
      toast.success("Workspace name updated")
    } catch (err) {
      toast.error(`Failed to save: ${(err as Error).message}`)
    } finally {
      setSavingOrg(false)
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  const [savingPassword, setSavingPassword] = useState(false)
  const {
    register: regPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isDirty: passwordDirty },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onSavePassword(values: PasswordForm) {
    setSavingPassword(true)
    try {
      const res = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: false,
      })
      const err = (res as { error?: { message?: string } | null }).error
      if (err) throw new Error(err.message ?? "Unknown error")
      toast.success("Password changed")
      resetPassword()
    } catch (err) {
      toast.error(`Failed to change password: ${(err as Error).message}`)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="settings"
        subtitle="Manage your account and organization preferences."
        sticker={{ label: "your space", rot: 4, color: "var(--vq-yellow)" }}
      />

      <SettingsNav />

      {/* ── Personal information ── */}
      <form onSubmit={handleProfileSubmit(onSaveProfile)} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Personal information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
              <Input id="name" {...regProfile("name")} placeholder="Your name" />
              {profileErrors.name && (
                <p className="text-xs text-destructive">{profileErrors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email</Label>
              <div className="flex items-center gap-2">
                <Input id="email" value={user?.email ?? ""} placeholder="you@example.com" disabled readOnly />
                <Badge variant="secondary" className="shrink-0">
                  {user?.emailVerified ? "Verified" : "Unverified"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Email changes require verification. Contact support to update.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingProfile || !profileDirty}>
            <Save className="size-3.5" />
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      {/* ── Workspace ── */}
      <form onSubmit={handleOrgSubmit(onSaveOrg)} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Workspace</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgName" className="text-xs font-medium">Workspace name</Label>
              <Input id="orgName" {...regOrg("orgName")} placeholder="Your workspace name" />
              {orgErrors.orgName && (
                <p className="text-xs text-destructive">{orgErrors.orgName.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingOrg || !orgDirty}>
            <Save className="size-3.5" />
            {savingOrg ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      {/* ── Change password ── */}
      <form onSubmit={handlePasswordSubmit(onSavePassword)} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Change password</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-medium">Current password</Label>
              <Input id="currentPassword" type="password" {...regPassword("currentPassword")} placeholder="••••••••" />
              {passwordErrors.currentPassword && (
                <p className="text-xs text-destructive">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword" className="text-xs font-medium">New password</Label>
              <Input id="newPassword" type="password" {...regPassword("newPassword")} placeholder="••••••••" />
              {passwordErrors.newPassword && (
                <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-medium">Confirm new password</Label>
              <Input id="confirmPassword" type="password" {...regPassword("confirmPassword")} placeholder="••••••••" />
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingPassword || !passwordDirty}>
            <Save className="size-3.5" />
            {savingPassword ? "Saving…" : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  )
}
