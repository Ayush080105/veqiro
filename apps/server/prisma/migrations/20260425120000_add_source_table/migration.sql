-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "typeDetected" TEXT,
    "r2Key" TEXT NOT NULL,
    "r2Url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "chunksCreated" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '',
    "keyTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_userId_sourceId_key" ON "source"("userId", "sourceId");

-- CreateIndex
CREATE INDEX "source_organizationId_agent_idx" ON "source"("organizationId", "agent");

-- CreateIndex
CREATE INDEX "source_userId_agent_idx" ON "source"("userId", "agent");
