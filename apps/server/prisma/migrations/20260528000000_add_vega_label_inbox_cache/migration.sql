-- CreateTable
CREATE TABLE "vega_label" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#999999',
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vega_label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vega_inbox_cache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vega_inbox_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vega_label_organizationId_idx" ON "vega_label"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "vega_label_name_organizationId_key" ON "vega_label"("name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "vega_inbox_cache_organizationId_key" ON "vega_inbox_cache"("organizationId");
