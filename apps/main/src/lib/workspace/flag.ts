import "server-only"

/**
 * Whether the agent workspace UI is on for this request.
 *
 * Two switches, deliberately:
 *
 *  - WORKSPACE_UI (env) is the deploy-wide one, and the only one wired today.
 *    It is what dogfooding needs: on in dev and for the internal deployment,
 *    off in production, flipped without touching a database.
 *
 *  - Organization.workspaceUiEnabled exists in the schema and is the eventual
 *    per-customer switch. It is NOT read here yet, on purpose: the console's
 *    server session does not carry org flags, so reading it would mean an
 *    extra blocking HTTP call on every /assistants/:id render — a real cost on
 *    every page load to answer a question that is currently "no" for everyone.
 *    When the rollout reaches real customers, add the field to the session
 *    payload (better-auth's customSession plugin is already imported in
 *    apps/server/src/lib/auth.ts, though not yet registered) and check it here.
 *
 * Until then: env on means workspaces for migrated agents, env off means the
 * existing chat page for everyone. That is the rollback, and it is one
 * variable.
 */
export async function isWorkspaceUiEnabled(): Promise<boolean> {
  return process.env.WORKSPACE_UI === "1" || process.env.NEXT_PUBLIC_WORKSPACE_UI === "1"
}
