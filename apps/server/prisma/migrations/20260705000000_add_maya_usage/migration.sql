-- CreateTable
CREATE TABLE "maya_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "videoSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maya_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maya_usage_organizationId_periodStart_key" ON "maya_usage"("organizationId", "periodStart");

-- CreateIndex
CREATE INDEX "maya_usage_organizationId_idx" ON "maya_usage"("organizationId");

-- AddForeignKey
ALTER TABLE "maya_usage" ADD CONSTRAINT "maya_usage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
