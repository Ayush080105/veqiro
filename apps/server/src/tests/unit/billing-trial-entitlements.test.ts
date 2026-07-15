import { assert, beforeEach, describe, test, vi } from "vitest";

let ents: Array<Record<string, unknown>> = [];
let org: { id: string; trialStartedAt: Date | null } = { id: "o1", trialStartedAt: null };

const mockPrisma = {
  organization: {
    findUnique: vi.fn(async () => org),
    update: vi.fn(async ({ data }: never) => Object.assign(org, data)),
  },
  entitlement: {
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      ents.push(...data); return { count: data.length };
    }),
  },
  mayaUsage: { create: vi.fn(async () => ({})) },
  // startTrialForOrg calls ensureBillingCustomerForOrg, which (when no
  // Subscription exists yet) looks up the org owner and creates one — mock
  // that path too so the real ensureBillingCustomerForOrg implementation
  // under test doesn't hit undefined mocks.
  subscription: {
    findUnique: vi.fn(async () => null),
    create: vi.fn(async () => ({ id: "sub_1" })),
  },
  member: {
    findFirst: vi.fn(async () => ({ user: { email: "owner@acme.test", name: "Owner" } })),
  },
  $transaction: vi.fn(async (fn: never) => (fn as (tx: unknown) => unknown)(mockPrisma)),
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../lib/dodo.js", () => ({
  dodoClient: { customers: { create: vi.fn(async () => ({ customer_id: "cus_1" })) } },
}));
// billing.service.ts imports lib/auth.ts at module scope, which pulls in the
// mailer -> Resend chain and crashes without RESEND_API_KEY set. Mock it out
// the same way billing-trial.test.ts does, since this test never exercises
// auth.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

const { startTrialForOrg } = await import("../../modules/billing/billing.service.js");

beforeEach(() => { ents = []; org = { id: "o1", trialStartedAt: null }; vi.clearAllMocks(); });

describe("startTrialForOrg", () => {
  test("grants all six agents — there is no agent selection at trial time", async () => {
    await startTrialForOrg("o1");
    const agents = ents.map((e) => e.agent).sort();
    assert.deepEqual(agents, ["LEX", "MAYA", "REX", "SAGE", "SCOUT", "VEGA"]);
  });

  test("trial rows are TRIAL/TRIALING with zero price and no billing subscription", async () => {
    await startTrialForOrg("o1");
    for (const e of ents) {
      assert.equal(e.source, "TRIAL");
      assert.equal(e.status, "TRIALING");
      assert.equal(e.priceCents, 0);
      assert.equal(e.billingSubscriptionId ?? null, null);
    }
  });

  test("the trial runs 7 days", async () => {
    const out = await startTrialForOrg("o1");
    const days = Math.round((out.trialEndsAt.getTime() - Date.now()) / 86400_000);
    assert.equal(days, 7);
  });

  test("stamps trialStartedAt", async () => {
    await startTrialForOrg("o1");
    assert.isNotNull(org.trialStartedAt);
  });

  test("REGRESSION: a second trial is refused — this is the anti-farming guard", async () => {
    org.trialStartedAt = new Date("2026-01-01");
    await startTrialForOrg("o1").then(
      () => assert.fail("a second trial must not be granted"),
      (e) => assert.match(String(e), /trial-already-used/),
    );
    assert.equal(ents.length, 0);
  });

  test("an EXPIRED past trial still blocks a new one (once ever, not once concurrently)", async () => {
    org.trialStartedAt = new Date("2020-01-01");
    await startTrialForOrg("o1").then(
      () => assert.fail("expired trials must not permit a fresh trial"),
      (e) => assert.match(String(e), /trial-already-used/),
    );
  });
});
