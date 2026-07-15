import { assert, beforeEach, describe, test, vi } from "vitest";

type EventRow = { eventId: string; result: string };
let rows: EventRow[] = [];
// When set, the NEXT call to `update` throws this error instead of writing,
// then clears itself — lets tests simulate a one-off transient DB blip on
// the closing ledger write without affecting later calls/tests.
let updateFailsNext: Error | null = null;

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
      if (updateFailsNext) {
        const err = updateFailsNext;
        updateFailsNext = null;
        throw err;
      }
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

const { withWebhookEvent, providerEventId } = await import("../../modules/billing/billing.webhooks.js");

beforeEach(() => {
  rows = [];
  updateFailsNext = null;
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

  // Retitled from "distinct events sharing a timestamp are both processed":
  // the original title claimed to test timestamp-based collision behavior,
  // but the body passed two literal, already-distinct event ids and never
  // touched `providerEventId` — it only proved that two different ids don't
  // collide, which is a much weaker claim. Retitled to describe what it
  // actually asserts; the real timestamp-collision regression is covered by
  // "same payload except timestamp collides" in the `providerEventId`
  // `describe` block below, which goes through the real key function.
  test("distinct event ids are both processed", async () => {
    const fn = vi.fn(async () => "ok");
    await withWebhookEvent("evt_a", "subscription.active", "sub_1", "org_1", fn);
    await withWebhookEvent("evt_b", "subscription.renewed", "sub_1", "org_1", fn);
    assert.equal(fn.mock.calls.length, 2);
  });

  test("REGRESSION: a failure in the closing ledger update releases the claim so a retry re-enters", async () => {
    const fn = vi.fn(async () => "applied-active");
    updateFailsNext = Object.assign(new Error("transient db blip"), { code: "40001" });

    let threw = false;
    try {
      await withWebhookEvent("evt_3", "subscription.active", "sub_3", "org_1", fn);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, "the ledger-update failure must propagate so Dodo retries");
    assert.equal(fn.mock.calls.length, 1, "the handler ran and its effects are already committed");

    // The claim must not be stuck at "processing" — a retry must be able to
    // re-enter. (For this key, re-running is safe because the handler is
    // idempotent; see the comment on withWebhookEvent.)
    const retry = vi.fn(async () => "applied-active");
    const out = await withWebhookEvent("evt_3", "subscription.active", "sub_3", "org_1", retry);
    assert.equal(retry.mock.calls.length, 1, "the retry must actually re-run, not be swallowed");
    assert.equal(out, "applied-active");
  });
});

describe("providerEventId", () => {
  const basePayload = {
    type: "subscription.active",
    timestamp: "2026-07-15T10:00:00.000Z",
    data: {
      subscription_id: "sub_1",
      next_billing_date: "2026-08-15T00:00:00.000Z",
    },
  };

  test("same payload except timestamp collides (the actual defect-#1 regression)", () => {
    const a = providerEventId(basePayload);
    const b = providerEventId({ ...basePayload, timestamp: "2026-07-15T10:05:00.000Z" });
    assert.equal(a, b, "a redelivery with a different timestamp must compute the same key");
  });

  test("different type produces a different key", () => {
    const a = providerEventId(basePayload);
    const b = providerEventId({ ...basePayload, type: "subscription.renewed" });
    assert.notEqual(a, b);
  });

  test("different next_billing_date produces a different key", () => {
    const a = providerEventId(basePayload);
    const b = providerEventId({
      ...basePayload,
      data: { ...basePayload.data, next_billing_date: "2026-09-15T00:00:00.000Z" },
    });
    assert.notEqual(a, b);
  });

  test("different current_period_end produces a different key", () => {
    const withPeriodEnd = {
      type: "payment.failed",
      data: { subscription_id: "sub_1", current_period_end: "2026-08-01T00:00:00.000Z" },
    };
    const a = providerEventId(withPeriodEnd);
    const b = providerEventId({
      ...withPeriodEnd,
      data: { ...withPeriodEnd.data, current_period_end: "2026-08-02T00:00:00.000Z" },
    });
    assert.notEqual(a, b);
  });

  test("a real provider id is preferred over the fallback business key", () => {
    const withId = { ...basePayload, id: "evt_real_123" };
    assert.equal(providerEventId(withId), "evt_real_123");

    const withWebhookId = { ...basePayload, webhook_id: "evt_real_456" };
    assert.equal(providerEventId(withWebhookId), "evt_real_456");
  });
});
