-- Planned runs (the planner + DAG run engine, and the team room's plan graph)
-- are on by default. Was opt-in per organisation.
--
-- Two parts, and both are needed: changing only the default would leave every
-- existing organisation on the old single-pass path while new ones got planning,
-- which is the kind of inconsistency that is very hard to spot from a support
-- ticket.
--
-- The per-organisation switch stays, so a single org can still be turned off.

ALTER TABLE "organization" ALTER COLUMN "plannedRunsEnabled" SET DEFAULT true;

UPDATE "organization" SET "plannedRunsEnabled" = true WHERE "plannedRunsEnabled" = false;
