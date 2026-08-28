import { z } from "zod";
import {
  Agent,
  AgentRunStatus,
  AgentRunStepStatus,
} from "../../../prisma/generated/prisma/client.js";

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

// ── Internal (apps/ai) ──────────────────────────────────────────────────────

export const internalRunParamsSchema = z.object({
  id: z.string().uuid("Invalid run id"),
});

export const internalStepParamsSchema = internalRunParamsSchema.extend({
  key: z.string().min(1).max(64),
});

export const updateStepBodySchema = z.object({
  status: z.enum(AgentRunStepStatus).optional(),
  outputText: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  actionId: z.string().nullable().optional(),
  proposedActionId: z.string().nullable().optional(),
  proposedArgs: z.unknown().optional(),
  attempt: z.number().int().min(0).max(10).optional(),
  // Opaque provider payloads — stored verbatim for the graph and audit trail,
  // so they are deliberately not shape-validated.
  actionResult: z.unknown().optional(),
  toolTrace: z.unknown().optional(),
});

export const heartbeatBodySchema = z.object({
  toolCallsUsed: z.number().int().min(0).default(0),
});

export const executeWriteBodySchema = z.object({
  connectionId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}),
  summary: z.string().default(""),
});

export const finishRunBodySchema = z.object({
  status: z.enum(AgentRunStatus),
  summary: z.string().default(""),
  errorMessage: z.string().nullable().optional(),
});

export const stepKeyParamSchema = runIdParamSchema.extend({
  key: z.string().min(1).max(64),
});

export const submitStepActionSchema = z.object({
  actionId: z.string().min(1).max(100),
  // The action's own payload — shape varies per action, so it is stored as
  // given rather than validated here.
  result: z.unknown(),
  outputText: z.string().max(50_000).optional(),
});
