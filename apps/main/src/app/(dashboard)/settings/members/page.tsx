"use client"

import { useCallback, useEffect, useState } from "react"
import { UserPlus, Trash2, Crown, Shield, User, Mail, X } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { type OrgRole } from "@/lib/types"
import { authClient } from "@/lib/auth-client"
import { toastFriendlyError } from "@/lib/api/error-message"
import { Card } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/ui/page-header"
import { RhfField } from "@/components/forms/RhfField"
import {
  inviteMemberSchema,
  type InviteMemberValues,
} from "@/lib/schemas/members"

// ─── Local row types (match Better Auth organization plugin response) ────────

interface MemberRow {
  id: string
  role: OrgRole
  user: {
    id: string
    email: string
    name: string
    image?: string | null
  }
}

interface InvitationRow {
  id: string
  email: string
  role: OrgRole
  status: string
  expiresAt: string | Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<OrgRole, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Owner", icon: Crown, variant: "default" },
  admin: { label: "Admin", icon: Shield, variant: "secondary" },
  member: { label: "Member", icon: User, variant: "outline" },
}

function roleBadge(role: OrgRole) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.member
  const { label, icon: Icon, variant } = cfg
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-2.5" />
      {label}
    </Badge>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  onInvited: () => void
}) {
  const { data: activeOrg } = authClient.useActiveOrganization()

  const form = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "member" },
  })

  const onSubmit = async ({ email, role }: InviteMemberValues) => {
    if (!activeOrg?.id) {
      toast.error("No active organization")
      return
    }
    try {
      const { error } = await authClient.organization.inviteMember({
        email,
        role,
        organizationId: activeOrg.id,
      })
      if (error) {
        toast.error(error.message ?? "Failed to send invitation")
        return
      }
      toast.success(`Invitation sent to ${email}`)
      form.reset()
      onInvited()
      onClose()
    } catch (err) {
      toastFriendlyError(err, "Failed to send invitation")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email with a link to join your organization.
          </DialogDescription>
        </DialogHeader>

        <form
          id="invite-member-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 py-2"
        >
          <RhfField
            control={form.control}
            name="email"
            label="Email address"
            required
          >
            {({ field, invalid, id }) => (
              <Input
                {...field}
                id={id}
                type="email"
                placeholder="colleague@example.com"
                aria-invalid={invalid}
              />
            )}
          </RhfField>

          <RhfField control={form.control} name="role" label="Role" required>
            {({ field, id }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access, no billing</SelectItem>
                  <SelectItem value="member">Member — view and chat only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </RhfField>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            form="invite-member-form"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            <UserPlus className="size-3.5" />
            {form.formState.isSubmitting ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!activeOrg?.id) {
      setMembers([])
      setInvitations([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([
        authClient.organization.listMembers({ query: { organizationId: activeOrg.id } }),
        authClient.organization.listInvitations({ query: { organizationId: activeOrg.id } }),
      ])
      if (mRes.data) {
        setMembers(mRes.data.members as unknown as MemberRow[])
      }
      if (iRes.data) {
        setInvitations(
          (iRes.data as unknown as InvitationRow[]).filter((inv) => inv.status === "pending")
        )
      }
    } catch (err) {
      console.error("Failed to load members:", err)
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleRemove() {
    if (!removeTarget || !activeOrg?.id) return
    try {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: removeTarget.id,
        organizationId: activeOrg.id,
      })
      if (error) {
        toast.error(error.message ?? "Failed to remove member")
        return
      }
      toast.success(`${removeTarget.user.name} removed`)
      refresh()
    } catch (err) {
      toastFriendlyError(err, "Failed to remove member")
    } finally {
      setRemoveTarget(null)
    }
  }

  async function handleCancelInvite(inv: InvitationRow) {
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId: inv.id,
      })
      if (error) {
        toast.error(error.message ?? "Failed to cancel invitation")
        return
      }
      toast.success(`Invitation to ${inv.email} canceled`)
      refresh()
    } catch (err) {
      toastFriendlyError(err, "Failed to cancel invitation")
    }
  }

  const memberCount = members.length

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="members"
        subtitle="Invite teammates and manage their roles."
        sticker={{ label: "your crew", rot: 5, color: "var(--vq-green)" }}
      />

      <SettingsNav />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">Team members</h2>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : `${memberCount} member${memberCount !== 1 ? "s" : ""} in your organization`}
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)} disabled={!activeOrg?.id}>
          <UserPlus className="size-3.5" />
          Invite member
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No members yet.
                </TableCell>
              </TableRow>
            )}
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm">
                      {member.user.image && <AvatarImage src={member.user.image} alt={member.user.name} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {getInitials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{member.user.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground font-mono">{member.user.email}</span>
                </TableCell>
                <TableCell>{roleBadge(member.role)}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    {member.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRemoveTarget(member)}
                        title="Remove member"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {invitations.length > 0 && (
        <>
          <div className="flex flex-col gap-0.5 mt-2">
            <h2 className="text-sm font-semibold text-foreground">Pending invitations</h2>
            <p className="text-xs text-muted-foreground">
              {invitations.length} invitation{invitations.length !== 1 ? "s" : ""} awaiting response
            </p>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono text-foreground">{inv.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{roleBadge(inv.role)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleCancelInvite(inv)}
                          title="Cancel invitation"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={refresh}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this organization immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
