-- CreateTable
CREATE TABLE "competitor_watch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "latestHash" TEXT,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_watch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competitor_watch_organizationId_url_key" ON "competitor_watch"("organizationId", "url");

-- CreateIndex
CREATE INDEX "competitor_watch_organizationId_idx" ON "competitor_watch"("organizationId");
