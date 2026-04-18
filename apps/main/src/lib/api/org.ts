import type { OrgMember, OrgInvite } from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ─── LIST MEMBERS ─────────────────────────────────────────────────────────────
// GET /api/v1/org/members?organizationId=xxx
// TODO: build on Express — use Better Auth org plugin data
export async function getMembers(organizationId: string): Promise<OrgMember[]> {
  const res = await fetch(
    `${API_URL}/org/members?organizationId=${organizationId}`,
    { credentials: "include" }
  )
  if (!res.ok) throw new Error("Failed to load members")
  return res.json()
}

// ─── INVITE MEMBER ────────────────────────────────────────────────────────────
// POST /api/v1/org/members/invite
// Body: { email, role, organizationId }
// NOTE: Better Auth's organization plugin handles this via authClient.organization.inviteMember
export async function inviteMember(
  organizationId: string,
  invite: OrgInvite
): Promise<void> {
  const res = await fetch(`${API_URL}/org/members/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...invite, organizationId }),
  })
  if (!res.ok) throw new Error("Failed to invite member")
}
