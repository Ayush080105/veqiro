import { z } from "zod";

const AGENT_SLUGS = ["maya", "rex", "scout", "sage", "lex", "vega"] as const;

const rangeKindSchema = z.enum(["24h", "7d", "30d", "custom"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// Input may arrive as a comma-separated string. We normalize to string[] before validation.
const agentArraySchema = z
  .array(z.enum(AGENT_SLUGS))
  .max(AGENT_SLUGS.length);

export const dashboardQuerySchema = z
  .object({
    range: rangeKindSchema.default("7d"),
    from: isoDate.optional(),
    to: isoDate.optional(),
    agents: agentArraySchema.optional(),
  })
  .refine(
    (v) => v.range !== "custom" || (v.from !== undefined && v.to !== undefined),
    { message: "from and to are required when range=custom" },
  )
  .refine(
    (v) => v.range !== "custom" || !v.from || !v.to || v.from <= v.to,
    { message: "from must be on or before to" },
  );

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
export type AgentSlugInput = (typeof AGENT_SLUGS)[number];
