-- A step can pause on a native action so the user reviews its inputs in that
-- action's own form before it runs. Both columns are nullable and additive:
-- every existing step predates the feature and has nothing proposed.
ALTER TABLE "agent_run_step" ADD COLUMN "proposedActionId" TEXT;
ALTER TABLE "agent_run_step" ADD COLUMN "proposedArgs" JSONB;
