-- AlterTable
ALTER TABLE "published_post" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "published_post" ADD COLUMN "postType" TEXT;
ALTER TABLE "published_post" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "published_post" ADD COLUMN "failureNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "published_post_status_scheduledAt_idx" ON "published_post"("status", "scheduledAt");
