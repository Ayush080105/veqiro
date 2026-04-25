import { z } from "zod"

export const MEMBER_ROLES = ["owner", "admin", "member"] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

// Invite is restricted to admin/member — owner is reserved for org creator.
export const INVITABLE_ROLES = ["admin", "member"] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(INVITABLE_ROLES),
})

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>
