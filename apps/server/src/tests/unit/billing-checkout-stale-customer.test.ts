import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { NotFoundError } from "dodopayments";

// REGRESSION (2026-08-24, live-mode cutover): an org that bought agents
// before the test->live switch has a Subscription.dodoCustomerId created in
// Dodo's TEST environment. Reusing it as-is against the now-live-configured
// dodoClient gets rejected by Dodo's live API ("404 Customer ... not
// found") as an unhandled error -> bare 500 on /billing/checkout. This must
// self-heal: detect the customer-not-found error, mint a fresh customer for
// the CURRENT environment, persist it, and retry once.

vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

type PendingRow = { id: string; organizationId: string; agent: string | null; kind: string; createdAt: Date; sessionId?: string };

let pendingCheckouts: PendingRow[] = [];
let orgSubscription: { organizationId: string; dodoCustomerId: string } | null;

const mockPrisma = {
  entitlement: { findMany: vi.fn(async () => []) },
  subscription: {
    findUnique: vi.fn(async () => orgSubscription),
    update: vi.fn(async ({ data }: { data: { dodoCustomerId: string } }) => {
      orgSubscription = { ...orgSubscription!, dodoCustomerId: data.dodoCustomerId };
      return orgSubscription;
    }),
  },
  member: {
    findFirst: vi.fn(async () => ({
      id: "mem_1",
      user: { email: "owner@example.com", name: "Owner" },
    })),
  },
  pendingCheckout: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `pc_${pendingCheckouts.length + 1}`, ...data } as PendingRow;
      pendingCheckouts.push(row);
      return row;
    }),
    delete: vi.fn(async () => {}),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

function notFoundCustomerError(customerId: string) {
  const message = `Customer ${customerId} not found`;
  return new NotFoundError(404, { message }, message, new Headers());
}

const mockDodo = {
  checkoutSessions: {
    create: vi.fn(async ({ customer }: { customer: { customer_id: string } }) => {
      if (customer.customer_id === "cus_stale_test_mode") {
        throw notFoundCustomerError(customer.customer_id);
      }
      return { session_id: "sess_new", checkout_url: `https://checkout.dodo.test/sess_new` };
    }),
  },
  customers: {
    create: vi.fn(async () => ({ customer_id: "cus_fresh_live" })),
  },
};
vi.mock("../../lib/dodo.js", () => ({ dodoClient: mockDodo }));

const { createCheckoutForOrg } = await import("../../modules/billing/billing.service.js");

beforeEach(() => {
  vi.clearAllMocks();
  pendingCheckouts = [];
  orgSubscription = { organizationId: "o1", dodoCustomerId: "cus_stale_test_mode" };
  process.env.DODO_PRODUCT_AGENT_MAYA = "pdt_maya";

  mockPrisma.entitlement.findMany.mockImplementation(async () => []);
  mockPrisma.subscription.findUnique.mockImplementation(async () => orgSubscription);
  mockPrisma.subscription.update.mockImplementation(async ({ data }: { data: { dodoCustomerId: string } }) => {
    orgSubscription = { ...orgSubscription!, dodoCustomerId: data.dodoCustomerId };
    return orgSubscription;
  });
  mockPrisma.member.findFirst.mockImplementation(async () => ({
    id: "mem_1",
    user: { email: "owner@example.com", name: "Owner" },
  }));
  mockPrisma.pendingCheckout.findFirst.mockImplementation(async () => null);
});

describe("createCheckoutForOrg — self-heals a stale (wrong-environment) Dodo customer id", () => {
  test("REGRESSION: a 'customer not found' error triggers exactly one recreate + retry, and succeeds", async () => {
    const result = await createCheckoutForOrg("o1", { agent: "MAYA" });

    assert.equal(result.resumed, false);
    assert.equal(result.url, "https://checkout.dodo.test/sess_new");
    assert.equal(mockDodo.customers.create.mock.calls.length, 1, "must create exactly one replacement customer");
    assert.equal(mockDodo.checkoutSessions.create.mock.calls.length, 2, "first call fails, retry succeeds");
    assert.equal(orgSubscription!.dodoCustomerId, "cus_fresh_live", "the stale id must be persisted over, not just used in-memory");
  });

  test("a genuinely valid customer id is never recreated (no unnecessary API calls on the happy path)", async () => {
    orgSubscription = { organizationId: "o1", dodoCustomerId: "cus_fresh_live" };

    await createCheckoutForOrg("o1", { agent: "MAYA" });

    assert.equal(mockDodo.customers.create.mock.calls.length, 0);
    assert.equal(mockDodo.checkoutSessions.create.mock.calls.length, 1);
  });

  test("a non-customer 404 (e.g. an unrelated not-found error) is NOT treated as a stale customer and is not retried", async () => {
    mockDodo.checkoutSessions.create.mockImplementationOnce(async () => {
      const message = "Product pdt_ghost not found";
      throw new NotFoundError(404, { message }, message, new Headers());
    });

    await expect(createCheckoutForOrg("o1", { agent: "MAYA" })).rejects.toThrow(/Product pdt_ghost not found/);
    assert.equal(mockDodo.customers.create.mock.calls.length, 0, "must not recreate a customer for an unrelated 404");
  });
});
