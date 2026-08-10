-- Add a provider discriminator to mcp_connection. Additive-only, defaulted —
-- every pre-existing row is implicitly Composio, so no backfill/data
-- migration is needed (contrast with 20260722000000_composio_mcp_connection,
-- which genuinely swapped providers and forced reconnects). This just adds
-- Smithery as a second, opt-in provider for the Instagram catalog row.

-- CreateEnum
CREATE TYPE "McpProvider" AS ENUM ('COMPOSIO', 'SMITHERY');

-- AlterTable
ALTER TABLE "mcp_connection" ADD COLUMN "provider" "McpProvider" NOT NULL DEFAULT 'COMPOSIO';
