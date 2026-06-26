-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('DISCUSSION', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "community_post" (
    "id" TEXT NOT NULL,
    "type" "CommunityPostType" NOT NULL DEFAULT 'DISCUSSION',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_post_createdAt_idx" ON "community_post"("createdAt");

-- CreateIndex
CREATE INDEX "community_post_type_isPinned_idx" ON "community_post"("type", "isPinned");

-- CreateIndex
CREATE INDEX "community_comment_postId_idx" ON "community_comment"("postId");

-- AddForeignKey
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment" ADD CONSTRAINT "community_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment" ADD CONSTRAINT "community_comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
