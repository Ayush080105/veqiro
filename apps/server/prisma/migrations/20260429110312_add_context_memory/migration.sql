-- CreateTable
CREATE TABLE "agent_memory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "runningSummary" TEXT NOT NULL DEFAULT '',
    "longTermFacts" JSONB NOT NULL DEFAULT '[]',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastSummarizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runningSummary" TEXT NOT NULL DEFAULT '',
    "longTermFacts" JSONB NOT NULL DEFAULT '[]',
    "sharedMemory" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_memory_organizationId_idx" ON "agent_memory"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_memory_organizationId_agent_key" ON "agent_memory"("organizationId", "agent");

-- CreateIndex
CREATE UNIQUE INDEX "org_memory_organizationId_key" ON "org_memory"("organizationId");

-- AddForeignKey
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memory" ADD CONSTRAINT "org_memory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
