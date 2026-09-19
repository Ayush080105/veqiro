-- MemoryItem: durable facts with provenance.
--
-- AgentMemory.longTermFacts is a JSON array, which is fine for feeding a prompt and
-- useless for showing a customer: a list of assertions about their business with no
-- indication of where each came from, when, or whether they ever agreed to it is not
-- something anyone can sensibly edit or trust. The PRD asks for provenance, and
-- provenance needs rows.
--
-- AgentMemory is NOT replaced and NOT migrated here. It stays the prompt-assembly
-- path; this is the reviewable surface. Making one shadow the other silently is how
-- you end up with two disagreeing ideas of what an agent believes.
--
-- Hand-written; this database has drift from migration history. Fully additive.

CREATE TYPE "MemoryOrigin" AS ENUM ('USER', 'AGENT', 'IMPORTED');

CREATE TABLE "memory_item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent",
    "kind" TEXT NOT NULL DEFAULT 'fact',
    "content" TEXT NOT NULL,
    "origin" "MemoryOrigin" NOT NULL DEFAULT 'AGENT',
    "sourceKind" TEXT,
    "sourceId" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memory_item_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "memory_item_organizationId_agent_retiredAt_idx" ON "memory_item"("organizationId", "agent", "retiredAt");
CREATE INDEX "memory_item_organizationId_kind_idx" ON "memory_item"("organizationId", "kind");
ALTER TABLE "memory_item" ADD CONSTRAINT "memory_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
