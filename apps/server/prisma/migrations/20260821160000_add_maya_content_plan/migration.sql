-- A week's content plan. rawText is always kept so a JSON parse failure still
-- renders something useful rather than an error.

CREATE TABLE "maya_content_plan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "items" JSONB,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maya_content_plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "maya_content_plan_organizationId_createdAt_idx"
  ON "maya_content_plan"("organizationId", "createdAt");
