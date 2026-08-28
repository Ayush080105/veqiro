-- Links a run to the trigger event that caused it, so actions it stages trace
-- back to the event the same way the direct trigger path already does.
-- Nullable and additive: every existing run was started from chat or a play.
ALTER TABLE "agent_run" ADD COLUMN "triggerEventId" TEXT;
