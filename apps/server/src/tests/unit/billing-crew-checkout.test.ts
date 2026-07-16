import { assert, beforeEach, describe, test, vi } from "vitest";

// billing.service.ts imports lib/auth.ts at module scope, which pulls in the
// mailer -> Resend chain and crashes without RESEND_API_KEY set. Same
// workaround as the other billing.service tests.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

let ents: Array<Record<string, unknown>> = [];
let pendingCheckoutsCreated: Array<Record<string, unknown>> = [];
let sub: { organizationId: string; dodoCustomerId: string } = {
  organizationId: "o1",
  dodoCustomerId: "cus_1",
};

const mockPrisma = {
  entitlement: {
    findMany: vi.fn(async () => ents),
  },
  subscription: {
    findUnique: vi.fn(async () => sub),
  },
  pendingCheckout: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      pendingCheckoutsCreated.push(data);
      return { id: "pc_1", ...data };
    }),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const mockDodo = {
  discounts: {
    create: vi.fn(async () => ({ code: "CREWCREDIT1" })),
  },
  checkoutSessions: {
    create: vi.fn(async () => ({
      session_id: "sess_1",
      checkout_url: "https://checkout.dodo.test/sess_1",
    })),
  },
};
vi.mock("../../lib/dodo.js", () => ({ dodoClient: mockDodo }));

const { createCheckoutForOrg, getUpgradeQuoteForOrg } = await import(
  "../../modules/billing/billing.service.js"
);

const future = new Date(Date.now() + 10 * 86400_000);
const ent = (agent: string, source: string, priceCents: number) => ({
  agent,
  source,
  status: "ACTIVE",
  currentPeriodEnd: future,
  cancelAtPeriodEnd: false,
  priceCents,
});

beforeEach(() => {
  ents = [];
  pendingCheckoutsCreated = [];
  sub = { organizationId: "o1", dodoCustomerId: "cus_1" };
  vi.clearAllMocks();
  process.env.CREW_MONTHLY_CENTS = "3900";
  process.env.CREW_ANNUAL_CENTS = "34800";
  process.env.DODO_PRODUCT_CREW_MONTHLY = "pdt_crew_monthly";
  process.env.DODO_PRODUCT_CREW_ANNUAL = "pdt_crew_annual";
  process.env.CLIENT_URL = "http://localhost:3001";
  // re-wire the mock implementations vi.clearAllMocks() strips
  mockPrisma.entitlement.findMany = vi.fn(async () => ents);
  mockPrisma.subscription.findUnique = vi.fn(async () => sub);
  mockPrisma.pendingCheckout.create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    pendingCheckoutsCreated.push(data);
    return { id: "pc_1", ...data };
  });
  mockDodo.discounts.create = vi.fn(async () => ({ code: "CREWCREDIT1" }));
  mockDodo.checkoutSessions.create = vi.fn(async () => ({
    session_id: "sess_1",
    checkout_url: "https://checkout.dodo.test/sess_1",
  }));
});

describe("getUpgradeQuoteForOrg", () => {
  test("org with AGENT rows [1900, 900] → eligible, credit 2800, payNow 1100", async () => {
    ents = [ent("MAYA", "AGENT", 1900), ent("REX", "AGENT", 900)];
    const q = await getUpgradeQuoteForOrg("o1", "MONTHLY");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 2800);
    assert.equal(q.payNowCents, 1100);
  });

  test("org with a CREW row → ineligible, reason already-on-crew", async () => {
    ents = [ent("MAYA", "CREW", 3900)];
    const q = await getUpgradeQuoteForOrg("o1", "MONTHLY");
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "already-on-crew");
  });

  test("org with no AGENT rows → ineligible, reason no-agents-owned", async () => {
    ents = [];
    const q = await getUpgradeQuoteForOrg("o1", "MONTHLY");
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "no-agents-owned");
  });

  test("org whose AGENT rows sum >= crew price → ineligible, credit-exceeds-crew-price", async () => {
    ents = [ent("MAYA", "AGENT", 1900), ent("REX", "AGENT", 900), ent("SAGE", "AGENT", 900), ent("LEX", "AGENT", 900)];
    const q = await getUpgradeQuoteForOrg("o1", "MONTHLY");
    assert.equal(q.eligible, false);
    if (q.eligible) return;
    assert.equal(q.reason, "credit-exceeds-crew-price");
  });

  test("credit uses each entitlement's stored priceCents, not catalog price", async () => {
    // 1234 is not a catalog price for any agent — proves the credit is read
    // from the stored row, not recomputed from billing.catalog.ts.
    ents = [ent("REX", "AGENT", 1234)];
    const q = await getUpgradeQuoteForOrg("o1", "MONTHLY");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 1234);
  });

  test("TRIAL rows are excluded from the credit sum", async () => {
    // Give the TRIAL row a nonzero price specifically to prove it is
    // excluded by source, not merely because trial prices happen to be 0.
    ents = [ent("REX", "AGENT", 900), ent("MAYA", "TRIAL", 1900)];
    const q = await getUpgradeQuoteForOrg("o1", "MONTHLY");
    assert.equal(q.eligible, true);
    if (!q.eligible) return;
    assert.equal(q.creditCents, 900);
  });
});

describe("createCheckoutForOrg — crew: true (createCrewCheckout)", () => {
  test("eligible upgrade: creates a percentage discount restricted to the Crew product and applies it to checkout", async () => {
    ents = [ent("MAYA", "AGENT", 1900), ent("REX", "AGENT", 900)];
    const result = await createCheckoutForOrg("o1", { crew: true, cadence: "MONTHLY" });

    assert.equal(mockDodo.discounts.create.mock.calls.length, 1);
    const discountArgs = mockDodo.discounts.create.mock.calls[0][0];
    assert.equal(discountArgs.type, "percentage");
    assert.equal(discountArgs.amount, 7179); // discountBasisPoints from quoteCrewUpgrade
    assert.equal(discountArgs.subscription_cycles, 1);
    assert.equal(discountArgs.usage_limit, 1);
    assert.deepEqual(discountArgs.restricted_to, ["pdt_crew_monthly"]);

    const checkoutArgs = mockDodo.checkoutSessions.create.mock.calls[0][0];
    assert.equal(checkoutArgs.discount_code, "CREWCREDIT1");
    assert.equal(checkoutArgs.product_cart[0].product_id, "pdt_crew_monthly");

    assert.equal((result as { url: string }).url, "https://checkout.dodo.test/sess_1");

    assert.equal(pendingCheckoutsCreated.length, 1);
    assert.equal(pendingCheckoutsCreated[0].kind, "CREW_UPGRADE");
    assert.equal(pendingCheckoutsCreated[0].discountCode, "CREWCREDIT1");
  });

  test("ineligible (no agents owned): plain Crew checkout, no discount created", async () => {
    ents = [];
    const result = await createCheckoutForOrg("o1", { crew: true, cadence: "MONTHLY" });

    assert.equal(mockDodo.discounts.create.mock.calls.length, 0);
    const checkoutArgs = mockDodo.checkoutSessions.create.mock.calls[0][0];
    assert.equal(checkoutArgs.discount_code, undefined);

    assert.equal((result as { url: string }).url, "https://checkout.dodo.test/sess_1");
    assert.equal(pendingCheckoutsCreated[0].kind, "CREW");
    assert.equal(pendingCheckoutsCreated[0].discountCode ?? null, null);
  });

  test("already on Crew: rejected, no checkout or discount created", async () => {
    ents = [ent("MAYA", "CREW", 3900)];
    await createCheckoutForOrg("o1", { crew: true, cadence: "MONTHLY" }).then(
      () => assert.fail("buying Crew while already on Crew must be rejected"),
      (e) => assert.match(String(e), /already-on-crew/),
    );
    assert.equal(mockDodo.discounts.create.mock.calls.length, 0);
    assert.equal(mockDodo.checkoutSessions.create.mock.calls.length, 0);
  });

  test("discount creation failure falls through to an undiscounted Crew checkout rather than blocking the purchase", async () => {
    ents = [ent("MAYA", "AGENT", 1900), ent("REX", "AGENT", 900)];
    mockDodo.discounts.create = vi.fn(async () => {
      throw new Error("dodo-discount-service-down");
    });

    const result = await createCheckoutForOrg("o1", { crew: true, cadence: "MONTHLY" });

    assert.equal((result as { url: string }).url, "https://checkout.dodo.test/sess_1");
    const checkoutArgs = mockDodo.checkoutSessions.create.mock.calls[0][0];
    assert.equal(checkoutArgs.discount_code, undefined);
    assert.equal(pendingCheckoutsCreated[0].kind, "CREW");
  });
});
