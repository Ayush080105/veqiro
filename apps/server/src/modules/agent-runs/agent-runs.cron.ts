import * as repo from "./agent-runs.repository.js";
import {
  dispatchRun,
  ORPHAN_AFTER_MS,
  MAX_RESUMES,
} from "./agent-runs.dispatch.js";
import { AgentRunStatus } from "../../../prisma/generated/prisma/client.js";

/**
 * Re-dispatches runs whose executor went away.
 *
 * apps/ai holds run progress in process memory while it works, so a restart or
 * a crash mid-run leaves a RUNNING row that nothing is advancing. The user
 * would sit in front of a graph frozen at whichever step was in flight.
 *
 * Steps that already SUCCEEDED are not re-sent (see dispatchRun), so a resume
 * never repeats a write that already happened.
 */

const SWEEP_INTERVAL_MS = 60_000;
const MAX_PER_SWEEP = 5;

export const sweepStaleRuns = async () => {
  const cutoff = new Date(Date.now() - ORPHAN_AFTER_MS);
  const stale = await repo.findStaleRuns(cutoff, MAX_PER_SWEEP);

  for (const { id, resumeCount } of stale) {
    if (resumeCount >= MAX_RESUMES) {
      // A run that dies this reliably is dying deterministically; resuming it
      // again just burns tool calls on the same crash.
      await repo.updateRun(id, {
        status: AgentRunStatus.FAILED,
        errorMessage: `Stopped after ${resumeCount} failed attempts to resume.`,
        finishedAt: new Date(),
      });
      continue;
    }

    // Claimed before dispatch, so two server instances sweeping the same tick
    // cannot both resume the same run.
    await repo.updateRun(id, {
      resumeCount: { increment: 1 },
      heartbeatAt: new Date(),
    });

    const run = await repo.findRunById(id);
    if (!run) continue;
    const ok = await dispatchRun(run, run.approvedAt ? "execute" : "stage");
    if (!ok) {
      console.warn(`[agent-runs] resume dispatch failed | run=${id}`);
    }
  }

  return stale.length;
};

export const startAgentRunsCron = () => {
  setInterval(() => {
    sweepStaleRuns().catch((err) =>
      console.error("[agent-runs] sweep failed", err),
    );
  }, SWEEP_INTERVAL_MS);
};
