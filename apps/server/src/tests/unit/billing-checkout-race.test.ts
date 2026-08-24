import { assert, beforeEach, describe, expect, test, vi } from "vitest";

// createCheckoutForOrg (via billing.service.ts) imports lib/auth.ts (mailer ->
// Resend chain, crashes without RESEND_API_KEY) and lib/dodo.ts (constructs a
// real DodoPayments client, crashes without DODO_PAYMENTS_API_KEY). Same
// workaround as the other billing.service tests.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

type PendingRow = { id: string; organizationId: string; agent: string | null; kind: string; createdAt: Date; sessionId?: string };

let pendingCheckouts: PendingRow[] = [];
let orgSubscription: { organizationId: string; dodoCustomerId: string } | null;

const mockPrisma = {
  entitlement: {
    // These tests never exercise an already-owned agent, so an empty active
    // list is all createCheckoutForOrg's internal getActiveEntitlements call
    // needs.
    findMany: vi.fn(async () => []),
  },
  subscription: {
    findUnique: vi.fn(async () => orgSubscription),
  },
  pendingCheckout: {
    findFirst: vi.fn(async ({ where }: { where: { organizationId: string; agent: string; kind: string } }): Promise<PendingRow | null> => {
      const rows = pendingCheckouts
        .filter((p) => p.organizationId === where.organizationId && p.agent === where.agent && p.kind === where.kind)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows[0] ?? null;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const conflict = pendingCheckouts.some(
        (p) => p.organizationId === data.organizationId && p.agent === data.agent,
      );
      if (conflict) throw Object.assign(new Error("unique constraint"), { code: "P2002" });
      const row = { id: `pc_${pendingCheckouts.length + 1}`, ...data } as PendingRow;
      pendingCheckouts.push(row);
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      pendingCheckouts = pendingCheckouts.filter((p) => p.id !== where.id);
    }),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const mockDodo = {
  checkoutSessions: {
    create: vi.fn(async () => ({ session_id: "sess_new", checkout_url: "https://checkout.dodo.test/sess_new" })),
  },
  customers: {
    create: vi.fn(async () => ({ customer_id: "cus_new" })),
  },
};
vi.mock("../../lib/dodo.js", () => ({ dodoClient: mockDodo }));

const { createCheckoutForOrg } = await import("../../modules/billing/billing.service.js");

beforeEach(() => {
  vi.clearAllMocks();
  pendingCheckouts = [];
  orgSubscription = { organizationId: "o1", dodoCustomerId: "cus_1" };
  process.env.DODO_PRODUCT_AGENT_MAYA = "pdt_maya";

  mockPrisma.entitlement.findMany.mockImplementation(async () => []);
  mockPrisma.subscription.findUnique.mockImplementation(async () => orgSubscription);
  mockPrisma.pendingCheckout.findFirst.mockImplementation(
    async ({ where }: { where: { organizationId: string; agent: string; kind: string } }) => {
      const rows = pendingCheckouts
        .filter((p) => p.organizationId === where.organizationId && p.agent === where.agent && p.kind === where.kind)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows[0] ?? null;
    },
  );
});

describe("createCheckoutForOrg — double-purchase race", () => {
  test("REGRESSION: a second checkout for an agent already mid-checkout is rejected, not silently doubled", async () => {
    pendingCheckouts = [{ id: "pc_1", organizationId: "o1", agent: "MAYA", kind: "AGENT", createdAt: new Date() }];

    await expect(createCheckoutForOrg("o1", { agent: "MAYA" })).rejects.toThrow(/checkout-already-pending:MAYA/);

    assert.equal(pendingCheckouts.length, 1, "must not create a second pending checkout row");
    assert.equal(mockDodo.checkoutSessions.create.mock.calls.length, 0, "must not mint a second Dodo checkout session either");
  });

  test("a stale (>24h) pending checkout is cleared and a fresh checkout proceeds normally", async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    pendingCheckouts = [{ id: "pc_1", organizationId: "o1", agent: "MAYA", kind: "AGENT", createdAt: old }];

    const result = await createCheckoutForOrg("o1", { agent: "MAYA" });

    assert.equal(result.resumed, false);
    assert.equal(pendingCheckouts.length, 1);
    assert.equal(mockPrisma.pendingCheckout.delete.mock.calls[0]![0].where.id, "pc_1", "the stale row must be explicitly cleared");
    assert.equal(pendingCheckouts[0]!.sessionId, "sess_new", "a fresh Dodo checkout session must be recorded");
  });

  test("a pending checkout for a DIFFERENT agent does not block this purchase", async () => {
    pendingCheckouts = [{ id: "pc_1", organizationId: "o1", agent: "REX", kind: "AGENT", createdAt: new Date() }];

    const result = await createCheckoutForOrg("o1", { agent: "MAYA" });

    assert.equal(result.resumed, false);
    assert.equal(pendingCheckouts.length, 2);
  });

  test("REGRESSION: DB-level backstop catches a true concurrent race the pre-check missed", async () => {
    // Simulates two requests interleaving: this request's findFirst sees
    // nothing (as if the other request's row hadn't committed yet), but by
    // the time this request's create() runs, the other row is already
    // there — the exact TOCTOU gap the unique constraint exists to close.
    mockPrisma.pendingCheckout.findFirst.mockImplementationOnce(async () => {
      pendingCheckouts.push({ id: "pc_racer", organizationId: "o1", agent: "MAYA", kind: "AGENT", createdAt: new Date() });
      return null;
    });

    await expect(createCheckoutForOrg("o1", { agent: "MAYA" })).rejects.toThrow(/checkout-already-pending:MAYA/);
  });
});
