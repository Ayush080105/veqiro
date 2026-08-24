-- Closes the double-purchase checkout race at the DB level: at most one
-- in-flight AGENT-kind pending checkout per (organizationId, agent).
-- MAYA_TOPUP rows always have agent = NULL and are unaffected — Postgres
-- never treats two NULLs as equal in a unique constraint.
--
-- Deduplicate first: keep only the newest AGENT-kind pending_checkout row
-- per (organizationId, agent) so the ADD CONSTRAINT below cannot fail
-- against any pre-existing duplicate rows on the live DB.
DELETE FROM "pending_checkout" a
USING "pending_checkout" b
WHERE a."organizationId" = b."organizationId"
  AND a."agent" = b."agent"
  AND a."kind" = 'AGENT'
  AND a."id" <> b."id"
  AND a."createdAt" < b."createdAt";

ALTER TABLE "pending_checkout" ADD CONSTRAINT "pending_checkout_organizationId_agent_key" UNIQUE ("organizationId", "agent");
