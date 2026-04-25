import { z } from "zod"
import { MEMBER_ROLES } from "./members"

export const orgMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(MEMBER_ROLES),
})

export type OrgMemberValues = z.infer<typeof orgMemberSchema>

export const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be under 100 characters"),
  members: z.array(orgMemberSchema).optional(),
})

export type CreateOrgValues = z.infer<typeof createOrgSchema>
