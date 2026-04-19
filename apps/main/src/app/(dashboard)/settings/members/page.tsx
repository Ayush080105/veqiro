"use client"

import { useState } from "react"
import { UserPlus, Trash2, Crown, Shield, User } from "lucide-react"
import { toast } from "sonner"

import { type OrgMember, type OrgRole } from "@/lib/types"
import { authClient } from "@/lib/auth-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { PageHeader } from "@/components/veqiro/shared"

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: Replace with authClient.organization.getMembers({ organizationId })

const MOCK_MEMBERS: OrgMember[] = [
  { id: "1", name: "Naresh Mahiya", email: "naresh@veqiro.com", role: "owner", image: null },
  { id: "2", name: "Arjun Mehta", email: "arjun@veqiro.com", role: "admin", image: null },
  { id: "3", name: "Priya Singh", email: "priya@veqiro.com", role: "member", image: null },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<OrgRole, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Owner", icon: Crown, variant: "default" },
  admin: { label: "Admin", icon: Shield, variant: "secondary" },
  member: { label: "Member", icon: User, variant: "outline" },
}

function roleBadge(role: OrgRole) {
  const { label, icon: Icon, variant } = ROLE_CONFIG[role]
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
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("member")
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState("")

  async function handleInvite() {
    setEmailError("")
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Valid email is required")
      return
    }
    if (!activeOrg?.id) return

    setLoading(true)
    try {
      await authClient.organization.inviteMember({
        email,
        role,
        organizationId: activeOrg.id,
      })
      toast.success(`Invitation sent to ${email}`)
      setEmail("")
      setRole("member")
      onClose()
    } catch {
      toast.error("Failed to send invitation")
    } finally {
      setLoading(false)
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

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email" className="text-xs font-medium">
              Email address
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role" className="text-xs font-medium">
              Role
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access, no billing</SelectItem>
                <SelectItem value="member">Member — view and chat only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            <UserPlus className="size-3.5" />
            {loading ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)
  const [members] = useState<OrgMember[]>(MOCK_MEMBERS)

  async function handleRemove() {
    if (!removeTarget) return
    try {
      // TODO: authClient.organization.removeMember({ memberId: removeTarget.id, organizationId })
      toast.success(`${removeTarget.name} removed`)
    } catch {
      toast.error("Failed to remove member")
    } finally {
      setRemoveTarget(null)
    }
  }

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
          <p className="text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""} in your organization</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
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
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm">
                      {member.image && <AvatarImage src={member.image} alt={member.name} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{member.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground font-mono">{member.email}</span>
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

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
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
