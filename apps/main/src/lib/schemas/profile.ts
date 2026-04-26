import { z } from "zod"

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  timezone: z.string().min(1, "Timezone is required"),
})

export type ProfileValues = z.infer<typeof profileSchema>
