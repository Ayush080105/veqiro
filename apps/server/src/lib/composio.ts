import { Composio } from "@composio/core";

/**
 * Composio's `userId` is its per-end-user scoping key. This app's MCP
 * tenancy is org-level only (one connection per [organizationId,
 * integrationSlug]), so `organizationId` is passed as Composio's `userId`
 * everywhere — it is NOT the human user who clicked "Connect". The human
 * userId is recorded only in McpConnection.connectedByUserId, for audit/UX,
 * and is never sent to Composio.
 */

// Lazy construction: the real Composio client throws immediately if
// COMPOSIO_API_KEY isn't set at construction time. Building it eagerly at
// module load broke every test that transitively imports mcp.service.ts
// without explicitly mocking it (env vars aren't loaded into process.env in
// the test runner) — deferring construction to first real use means only
// code paths that actually need Composio ever require the key.
let client: Composio | undefined;
const getClient = (): Composio => {
  if (!client) client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return client;
};

export const composioClient: Composio = new Proxy({} as Composio, {
  get: (_target, prop) => {
    const real = getClient();
    return Reflect.get(real, prop, real);
  },
});
