import { z } from "zod";
import { Agent, McpApprovalMode } from "../../../prisma/generated/prisma/client.js";

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export const connectBodySchema = z.object({
  configValues: z.record(z.string(), z.unknown()).optional(),
});

export const callToolBodySchema = z.object({
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional().default({}),
});

export const pendingActionParamSchema = z.object({
  id: z.string().min(1),
});

export const agentParamSchema = z.object({
  agent: z.string().min(1),
});

export const toolPreferenceBodySchema = z.object({
  preferredIntegrationSlug: z.string().min(1).nullable(),
});

// Widget inputs are provider argument names mapped to scalars the customer
// typed or chose. Kept narrow deliberately: a widget must never accept
// arbitrary nested structures from the browser, since these values are passed
// straight into a provider call.
const widgetInputsSchema = z
  .record(z.string().max(60), z.union([z.string().max(400), z.number(), z.boolean()]))
  .optional();

/**
 * Audit-log filters. Booleans arrive as query strings, so "true"/"false" are
 * coerced explicitly rather than through z.coerce.boolean(), which treats the
 * string "false" as true.
 */
export const actionLogQuerySchema = z.object({
  integrationSlug: z.string().min(1).optional(),
  agent: z.nativeEnum(Agent).optional(),
  writesOnly: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  failuresOnly: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** Omitting integrationSlug/toolName means "applies to everything". */
export const approvalPolicyBodySchema = z.object({
  integrationSlug: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  mode: z.nativeEnum(McpApprovalMode),
});

export const policyIdParamSchema = z.object({ id: z.string().min(1) });

export const playIdParamSchema = z.object({ id: z.string().min(1) });
export const playEnabledBodySchema = z.object({ enabled: z.boolean() });
