import { aiService } from "../../common/utils/aiService.js";
import * as repo from "./agent-runs.repository.js";
import {
  AgentRunStatus,
  AgentRunStepStatus,
} from "../../../prisma/generated/prisma/client.js";
import * as mcpService from "../mcp/mcp.service.js";
import type { McpConnectionRef } from "../mcp/mcp.types.js";

/**
 * Handing an approved run to apps/ai to execute.
 *
 * The call returns as soon as Python has scheduled the run — a run takes
 * minutes, and neither an approve request nor a cron tick can wait for it.
 * Progress comes back over /internal/runs.
 */

// Scheduling a run is near-instant work on the Python side; anything longer
// than this means the service is unhealthy, and aiService itself has no
// default timeout (axios defaults to 0 — wait forever).
const DISPATCH_TIMEOUT_MS = 15_000;

/**
 * A run whose heartbeat stopped this long ago is treated as orphaned. Well
 * above the executor's 15s beat, so an ordinary slow tool call is never
 * mistaken for a dead process.
 */
export const ORPHAN_AFTER_MS = 3 * 60 * 1000;

/** Beyond this, a run that keeps dying is failed rather than resumed forever. */
export const MAX_RESUMES = 3;

type DispatchableRun = Awaited<ReturnType<typeof repo.findRunById>>;

export const dispatchRun = async (
  run: NonNullable<DispatchableRun>,
  writeMode: "stage" | "execute",
): Promise<boolean> => {
  const steps = run.steps
    .filter((s) => s.enabled && s.status !== AgentRunStepStatus.DISABLED)
    .map((s) => ({
      key: s.key,
      agent: s.agent,
      title: s.title,
      intent: s.intent,
      integration_slug: s.integrationSlug,
      depends_on: s.dependsOn,
      is_write: s.isWrite,
      enabled: true,
      // A resumed run replays finished steps as already-succeeded rather than
      // re-running them, so a write never happens twice. They are sent, not
      // dropped, because their output is the input their dependents read.
      prior_status: s.status === AgentRunStepStatus.SUCCEEDED ? "SUCCEEDED" : null,
      prior_output: s.status === AgentRunStepStatus.SUCCEEDED ? (s.outputText ?? "") : "",
    }));

  if (!steps.some((s) => s.prior_status !== "SUCCEEDED")) return false;

  // Connections are resolved per agent, never as one union: a step must only
  // ever see the integrations its own agent owns. Sending a merged list would
  // let a Vega step reach a Sage connection and undo the ownership boundary
  // the planner enforces.
  const agentsInRun = [...new Set(run.steps.map((s) => s.agent))];
  const connectionsByAgent: Record<string, McpConnectionRef[]> = {};
  await Promise.all(
    agentsInRun.map(async (agent) => {
      connectionsByAgent[agent.toLowerCase()] =
        await mcpService.getConnectionsForAgent(run.organizationId, agent);
    }),
  );

  try {
    await aiService.post(
      "/ai/runs/execute",
      {
        run_id: run.id,
        organization_id: run.organizationId,
        user_id: run.userId,
        goal: run.goal ?? run.requestText,
        steps,
        write_mode: writeMode,
        connections_by_agent: connectionsByAgent,
        // A repair pass replans against these: what the user approved, and
        // what is actually connected. Without them it would invent steps for
        // integrations the org does not have.
        approved_writes: run.approvedWrites,
        allowed_agents: agentsInRun.map((a) => a.toLowerCase()),
        mcp_catalog: mcpService.getCatalogForAgent(run.agent, connectionsByAgent[
          run.agent.toLowerCase()
        ] ?? []),
      },
      { timeout: DISPATCH_TIMEOUT_MS },
    );
    return true;
  } catch (err) {
    console.error(`[agent-runs] dispatch failed | run=${run.id}`, err);
    return false;
  }
};

/**
 * Dispatch after approval. A failure here must not leave the run RUNNING with
 * nothing advancing it — the user would watch a graph that never moves.
 */
export const dispatchApprovedRun = async (runId: string) => {
  const run = await repo.findRunById(runId);
  if (!run) return;
  const ok = await dispatchRun(run, "execute");
  if (!ok) {
    await repo.updateRun(runId, {
      status: AgentRunStatus.FAILED,
      errorMessage: "Could not reach the execution service. Nothing was run.",
      finishedAt: new Date(),
    });
  }
};

/**
 * Dispatch for a run nobody approved. Stage mode: reads execute, writes become
 * approval cards. A failure leaves the run FAILED rather than RUNNING, so the
 * sweeper does not keep retrying a play that cannot start.
 */
export const dispatchUnattendedRun = async (runId: string) => {
  const run = await repo.findRunById(runId);
  if (!run) return;
  const ok = await dispatchRun(run, "stage");
  if (!ok) {
    await repo.updateRun(runId, {
      status: AgentRunStatus.FAILED,
      errorMessage: "Could not reach the execution service. Nothing was run.",
      finishedAt: new Date(),
    });
  }
};
