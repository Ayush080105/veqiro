-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TWITTER', 'LINKEDIN', 'INSTAGRAM');

-- CreateTable
CREATE TABLE "social_account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accountName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_post" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "platformPostId" TEXT,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_account_organizationId_idx" ON "social_account"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "social_account_organizationId_platform_providerAccountId_key" ON "social_account"("organizationId", "platform", "providerAccountId");

-- CreateIndex
CREATE INDEX "published_post_organizationId_idx" ON "published_post"("organizationId");

-- CreateIndex
CREATE INDEX "published_post_socialAccountId_idx" ON "published_post"("socialAccountId");

-- AddForeignKey
ALTER TABLE "published_post" ADD CONSTRAINT "published_post_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
