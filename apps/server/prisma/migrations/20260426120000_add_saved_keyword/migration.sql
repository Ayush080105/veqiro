CREATE TABLE "saved_keyword" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchIntent" TEXT NOT NULL DEFAULT '',
    "estimatedDifficulty" INTEGER NOT NULL DEFAULT 50,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "searchVolumeEstimate" TEXT,
    "suggestedContentType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_keyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_keyword_organizationId_keyword_key" ON "saved_keyword"("organizationId", "keyword");
CREATE INDEX "saved_keyword_organizationId_idx" ON "saved_keyword"("organizationId");
