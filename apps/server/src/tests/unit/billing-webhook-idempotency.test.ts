import { assert, beforeEach, describe, test, vi } from "vitest";

type EventRow = { eventId: string; result: string };
let rows: EventRow[] = [];

const mockPrisma = {
  billingWebhookEvent: {
    create: vi.fn(async ({ data }: { data: EventRow }) => {
      if (rows.some((r) => r.eventId === data.eventId)) {
        const err = Object.assign(new Error("unique"), { code: "P2002" });
        throw err;
      }
      rows.push({ ...data });
      return data;
    }),
    update: vi.fn(async ({ where, data }: { where: { eventId: string }; data: Partial<EventRow> }) => {
      const row = rows.find((r) => r.eventId === where.eventId);
      if (row) Object.assign(row, data);
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { eventId: string } }) => {
      rows = rows.filter((r) => r.eventId !== where.eventId);
    }),
  },
};

vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

// billing.webhooks.ts pulls in billing.service.ts, which imports `auth`
// (better-auth) and `dodoClient` at module scope — mock both so importing
// the real module under test doesn't construct a real auth/Resend instance
// or a real Dodo API client. Mirrors the pattern in billing-trial.test.ts.
vi.mock("../../lib/auth.js", () => ({
  default: { api: { getSession: vi.fn() } },
}));

vi.mock("../../lib/dodo.js", () => ({
  dodoClient: {
    customers: { create: vi.fn() },
  },
}));

const { withWebhookEvent } = await import("../../modules/billing/billing.webhooks.js");

beforeEach(() => {
  rows = [];
  vi.clearAllMocks();
});

describe("withWebhookEvent", () => {
  test("runs the handler once and records the result", async () => {
    const fn = vi.fn(async () => "applied-active");
    const out = await withWebhookEvent("evt_1", "subscription.active", "sub_1", "org_1", fn);
    assert.equal(out, "applied-active");
    assert.equal(fn.mock.calls.length, 1);
    assert.equal(rows[0].result, "applied-active");
  });

  test("a duplicate delivery of the same event id does not re-run the handler", async () => {
    const fn = vi.fn(async () => "applied-active");
    await withWebhookEvent("evt_1", "subscription.active", "sub_1", "org_1", fn);
    await withWebhookEvent("evt_1", "subscription.active", "sub_1", "org_1", fn);
    assert.equal(fn.mock.calls.length, 1, "handler must not run twice for one event id");
  });

  test("REGRESSION: a handler that throws leaves the event RETRYABLE, not stuck", async () => {
    const failing = vi.fn(async () => { throw new Error("db blip"); });

    let threw = false;
    try {
      await withWebhookEvent("evt_2", "subscription.active", "sub_2", "org_1", failing);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, "the error must propagate so Dodo retries");

    // The critical assertion: the claim must NOT still be blocking a retry.
    const succeeding = vi.fn(async () => "applied-active");
    const out = await withWebhookEvent("evt_2", "subscription.active", "sub_2", "org_1", succeeding);
    assert.equal(succeeding.mock.calls.length, 1, "the retry must actually run");
    assert.equal(out, "applied-active");
  });

  test("distinct events sharing a timestamp are both processed", async () => {
    const fn = vi.fn(async () => "ok");
    await withWebhookEvent("evt_a", "subscription.active", "sub_1", "org_1", fn);
    await withWebhookEvent("evt_b", "subscription.renewed", "sub_1", "org_1", fn);
    assert.equal(fn.mock.calls.length, 2);
  });
});
