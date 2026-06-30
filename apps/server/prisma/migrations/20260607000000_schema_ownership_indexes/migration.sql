-- Rename agent-owned tables without dropping data. DO blocks keep this safe
-- for local databases that may already have some renamed tables.
DO $$
BEGIN
  IF to_regclass('"content_idea"') IS NOT NULL AND to_regclass('"maya_content_idea"') IS NULL THEN
    ALTER TABLE "content_idea" RENAME TO "maya_content_idea";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"saved_keyword"') IS NOT NULL AND to_regclass('"sage_saved_keyword"') IS NULL THEN
    ALTER TABLE "saved_keyword" RENAME TO "sage_saved_keyword";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"source"') IS NOT NULL AND to_regclass('"lex_source"') IS NULL THEN
    ALTER TABLE "source" RENAME TO "lex_source";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"vega_briefing"') IS NOT NULL AND to_regclass('"vega_briefing_cache"') IS NULL THEN
    ALTER TABLE "vega_briefing" RENAME TO "vega_briefing_cache";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"vega_inbox_cache"') IS NOT NULL AND to_regclass('"vega_inbox_snapshot"') IS NULL THEN
    ALTER TABLE "vega_inbox_cache" RENAME TO "vega_inbox_snapshot";
  END IF;
END $$;

-- Some deployed/local databases have ContentIdea from prisma db push, but the
-- committed migration history never created it. Shadow databases therefore
-- need the renamed table created from scratch.
CREATE TABLE IF NOT EXISTS "maya_content_idea" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "maya_content_idea_pkey" PRIMARY KEY ("id")
);

-- Raw vector tables owned by the AI/context service. They are intentionally
-- not represented in Prisma models, but must be present in migration history
-- so Prisma shadow DBs match deployed Supabase schemas.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "rag_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT '',
    "source_agent" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT "rag_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_idx"
    ON "rag_chunks" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS "rag_chunks_source_idx"
    ON "rag_chunks" ("user_id", "source_id");

CREATE INDEX IF NOT EXISTS "rag_chunks_user_agent_idx"
    ON "rag_chunks" ("user_id", "source_agent");

CREATE TABLE IF NOT EXISTS "conversation_memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "metadata" JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT "conversation_memories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conv_mem_embedding_idx"
    ON "conversation_memories" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS "conv_mem_org_agent_time_idx"
    ON "conversation_memories" ("org_id", "agent", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "conv_mem_org_idx"
    ON "conversation_memories" ("org_id", "created_at" DESC);

-- URLs for uploaded objects are derived from R2 keys.
ALTER TABLE IF EXISTS "lex_source" DROP COLUMN IF EXISTS "r2Url";
ALTER TABLE IF EXISTS "brand_image" DROP COLUMN IF EXISTS "url";

-- Remove the passive Scout watcher table after CompetitorWatch was removed.
DROP TABLE IF EXISTS "competitor_watch";

-- PublishedPost.socialAccountId is optional in the current schema and should
-- keep posts if a social account is disconnected.
ALTER TABLE IF EXISTS "published_post" DROP CONSTRAINT IF EXISTS "published_post_socialAccountId_fkey";
ALTER TABLE IF EXISTS "published_post" ALTER COLUMN "socialAccountId" DROP NOT NULL;
ALTER TABLE IF EXISTS "published_post"
  ADD CONSTRAINT "published_post_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "social_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Organization/admin entitlement indexes.
CREATE INDEX IF NOT EXISTS "organization_subscriptionStatus_idx" ON "organization"("subscriptionStatus");
CREATE INDEX IF NOT EXISTS "organization_createdAt_idx" ON "organization"("createdAt");
CREATE INDEX IF NOT EXISTS "organization_subscriptionStatus_entitlementExpiresAt_idx" ON "organization"("subscriptionStatus", "entitlementExpiresAt");

-- Membership and OAuth lookup indexes.
CREATE INDEX IF NOT EXISTS "member_organizationId_userId_role_idx" ON "member"("organizationId", "userId", "role");
CREATE INDEX IF NOT EXISTS "member_organizationId_role_idx" ON "member"("organizationId", "role");
CREATE INDEX IF NOT EXISTS "account_userId_providerId_updatedAt_idx" ON "account"("userId", "providerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "account_providerId_userId_idx" ON "account"("providerId", "userId");

-- Message history and reporting indexes.
CREATE INDEX IF NOT EXISTS "message_organizationId_agent_createdAt_idx" ON "message"("organizationId", "agent", "createdAt");
CREATE INDEX IF NOT EXISTS "message_organizationId_createdAt_idx" ON "message"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "message_organizationId_role_createdAt_idx" ON "message"("organizationId", "role", "createdAt");
CREATE INDEX IF NOT EXISTS "message_role_createdAt_idx" ON "message"("role", "createdAt");
CREATE INDEX IF NOT EXISTS "message_agent_role_createdAt_idx" ON "message"("agent", "role", "createdAt");

-- Social and publishing indexes.
CREATE INDEX IF NOT EXISTS "social_account_organizationId_createdAt_idx" ON "social_account"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "social_account_organizationId_accessTokenExpiresAt_idx" ON "social_account"("organizationId", "accessTokenExpiresAt");
CREATE INDEX IF NOT EXISTS "published_post_organizationId_createdAt_idx" ON "published_post"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "published_post_organizationId_status_publishedAt_idx" ON "published_post"("organizationId", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "published_post_organizationId_status_createdAt_idx" ON "published_post"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "published_post_organizationId_platform_createdAt_idx" ON "published_post"("organizationId", "platform", "createdAt");

-- Agent-owned feature indexes.
CREATE INDEX IF NOT EXISTS "brand_image_organizationId_createdAt_idx" ON "brand_image"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "maya_content_idea_organizationId_platform_createdAt_idx" ON "maya_content_idea"("organizationId", "platform", "createdAt");
CREATE INDEX IF NOT EXISTS "maya_content_idea_organizationId_isPublished_createdAt_idx" ON "maya_content_idea"("organizationId", "isPublished", "createdAt");
CREATE INDEX IF NOT EXISTS "maya_content_idea_createdAt_idx" ON "maya_content_idea"("createdAt");
CREATE INDEX IF NOT EXISTS "sage_saved_keyword_organizationId_createdAt_idx" ON "sage_saved_keyword"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "sage_saved_keyword_estimatedDifficulty_idx" ON "sage_saved_keyword"("estimatedDifficulty");
CREATE INDEX IF NOT EXISTS "lex_source_userId_organizationId_agent_createdAt_idx" ON "lex_source"("userId", "organizationId", "agent", "createdAt");
CREATE INDEX IF NOT EXISTS "lex_source_organizationId_agent_createdAt_idx" ON "lex_source"("organizationId", "agent", "createdAt");
CREATE INDEX IF NOT EXISTS "rex_dataset_organizationId_updatedAt_idx" ON "rex_dataset"("organizationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "rex_dataset_organizationId_metricKey_purpose_updatedAt_idx" ON "rex_dataset"("organizationId", "metricKey", "purpose", "updatedAt");
CREATE INDEX IF NOT EXISTS "rex_settings_weeklyDigestEnabled_idx" ON "rex_settings"("weeklyDigestEnabled");
CREATE INDEX IF NOT EXISTS "vega_follow_up_organizationId_status_dueAt_idx" ON "vega_follow_up"("organizationId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "vega_follow_up_status_dueAt_idx" ON "vega_follow_up"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "vip_contact_organizationId_createdAt_idx" ON "vip_contact"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "vega_label_organizationId_createdAt_idx" ON "vega_label"("organizationId", "createdAt");
