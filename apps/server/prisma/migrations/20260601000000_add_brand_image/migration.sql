-- CreateTable
CREATE TABLE "brand_image" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_image_organizationId_idx" ON "brand_image"("organizationId");
