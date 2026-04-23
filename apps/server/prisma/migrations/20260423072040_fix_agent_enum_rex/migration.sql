-- AlterEnum: rename MARK -> REX on the Agent enum.
-- Any existing message rows holding agent = 'MARK' are converted to 'REX'.
BEGIN;

CREATE TYPE "Agent_new" AS ENUM ('MAYA', 'SAGE', 'LEX', 'REX', 'SCOUT', 'VEGA');

ALTER TABLE "message"
  ALTER COLUMN "agent" TYPE "Agent_new"
  USING (
    CASE "agent"::text
      WHEN 'MARK' THEN 'REX'
      ELSE "agent"::text
    END
  )::"Agent_new";

ALTER TYPE "Agent" RENAME TO "Agent_old";
ALTER TYPE "Agent_new" RENAME TO "Agent";
DROP TYPE "Agent_old";

COMMIT;
