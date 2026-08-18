import { z } from "zod";

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

export const runWidgetBodySchema = z.object({
  widgetId: z.string().min(1).max(120),
  inputs: widgetInputsSchema,
});

export const addTileBodySchema = z.object({
  widgetId: z.string().min(1).max(120),
  inputs: widgetInputsSchema,
  /** Optional rename, in the customer's own words. */
  label: z.string().min(1).max(48).nullable().optional(),
});

export const tileIdParamSchema = z.object({
  id: z.string().uuid(),
});
