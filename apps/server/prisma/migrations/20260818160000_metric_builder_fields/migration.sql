-- AlterTable: turn dashboard tiles from list-counters into arbitrary metrics
-- (a field plus an aggregation), so any numeric a provider reports — Search
-- Console clicks, Razorpay revenue, GA sessions — can be pinned, not just
-- the length of a list.
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "aggregation" TEXT NOT NULL DEFAULT 'count';
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "fieldPath" TEXT;
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "scale" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "decimals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "prefix" TEXT;
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "suffix" TEXT;
