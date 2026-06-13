import { z } from "zod"
import { Agent } from "../../../prisma/generated/prisma/client.js"

export const agentParamSchema = z.object({ agent: z.nativeEnum(Agent) })
export const addFactSchema = z.object({
  fact: z.string().min(1).max(500),
  scope: z.enum(["agent", "org"]).default("agent"),
})
export const removeFactSchema = z.object({ index: z.coerce.number().int().min(0) })
export const patchOrgMemorySchema = z.object({
  goals: z.array(z.string()).optional(),
  product: z.string().optional(),
  decisions: z.array(z.string()).optional(),
  userPreferences: z.array(z.string()).optional(),
  runningSummary: z.string().optional(),
})
