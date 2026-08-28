import { z } from "zod";
import { Agent } from "../../../prisma/generated/prisma/client.js";

export const runIdParamSchema = z.object({
  id: z.string().uuid("Invalid run id"),
});

export const approveRunBodySchema = z.object({
  /** Steps the user switched off. Dependents are cascaded server-side. */
  disabledStepKeys: z.array(z.string()).default([]),
});

export const listRunsQuerySchema = z.object({
  agent: z.enum(Agent).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
