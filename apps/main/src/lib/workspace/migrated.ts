import type { AgentSlug } from "@/lib/types"

/**
 * Which agents have a workspace good enough to replace their chat page.
 *
 * This is the one file you edit to roll an agent out, and the only place in
 * lib/workspace outside agents/ that is allowed to name an agent — it is
 * rollout data, not framework logic, which is why it lives apart from
 * registry.ts and is exempt from the no-slug-literals check.
 *
 * Adding an agent here makes /assistants/<agent> redirect into its workspace
 * (when the WORKSPACE_UI flag is on). Removing it is the per-agent rollback.
 * Deliberately code rather than a database column: rolling an agent out is a
 * deploy, not a per-customer setting. The per-customer switch is a separate
 * question and lives on Organization.workspaceUiEnabled.
 */
export const WORKSPACE_MIGRATED: ReadonlySet<AgentSlug> = new Set<AgentSlug>(["lex", "maya"])
