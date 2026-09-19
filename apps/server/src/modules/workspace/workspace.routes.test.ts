import assert from "node:assert/strict";
import { describe, test, vi } from "vitest";

// This router imports its own auth and entitlement middleware (unlike the agent
// routers, which have it applied at the mount), and auth pulls in Resend, which
// throws at import time without an API key. The middleware behaviour is not
// what is under test here — the order routes are registered in is.
vi.mock("../../middlewares/auth.middleware.js", () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../middlewares/entitlement.middleware.js", () => ({
  entitlementMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  entitlementForAgentParam: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../middlewares/internal.middleware.js", () => ({
  internalKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: router } = await import("./workspace.routes.js");

/**
 * Route-ordering regression tests.
 *
 * These exist because of a real bug: every literal top-level route was
 * registered *after* the "/:agent" mount, so Express matched "/workspace/pulse"
 * as agent="pulse" and entitlementForAgentParam rejected it as an unknown
 * agent. The endpoints were correct, reachable only in principle, and 404ed in
 * practice with nothing in the logs pointing at routing.
 *
 * Nothing about the handlers would catch that, so the ordering is asserted
 * directly.
 */

interface Layer {
  name?: string;
  route?: { path: string; methods: Record<string, boolean> };
}

const layers = (router as unknown as { stack: Layer[] }).stack;

/**
 * Index of the "/:agent" mount, which everything literal must precede.
 *
 * Identified as the only layer without a `route` — a router.use() mount rather
 * than a route definition. Deliberately not matched on the compiled path
 * pattern: Express 5 replaced the `regexp` property with `matchers`, so that
 * approach silently found nothing and passed by accident.
 */
const agentMountIndex = layers.findIndex((layer) => !layer.route);

describe("workspace routes", () => {
  test("the /:agent mount exists and is not first", () => {
    assert.ok(agentMountIndex > 0, "expected a /:agent mount preceded by literal routes");
  });

  const literalRoutes = [
    "/pulse",
    "/insights/:id",
    "/memory-items/:id",
    "/handoffs",
    "/handoffs/:id/accept",
    "/handoffs/:id/decline",
  ];

  for (const path of literalRoutes) {
    test(`${path} is registered before the /:agent mount`, () => {
      const index = layers.findIndex((layer) => layer.route?.path === path);
      assert.notEqual(index, -1, `${path} is not registered at all`);
      assert.ok(
        index < agentMountIndex,
        `${path} is registered after /:agent, so Express will match "${path.split("/")[1]}" ` +
          `as an agent slug and the route will 404 as "Unknown agent"`,
      );
    });
  }
});
