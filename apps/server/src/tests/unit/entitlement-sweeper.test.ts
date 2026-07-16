import { assert, beforeEach, describe, test, vi } from "vitest";

let ents: Array<Record<string, unknown>> = [];
const mockPrisma = {
  entitlement: {
    updateMany: vi.fn(async ({ where, data }: never) => {
      const w = where as { currentPeriodEnd: { lt: Date }; status: { in: string[] } };
      let count = 0;
      for (const e of ents) {
        if ((e.currentPeriodEnd as Date) < w.currentPeriodEnd.lt && w.status.in.includes(e.status as string)) {
          Object.assign(e, data); count++;
        }
      }
      return { count };
    }),
  },
};
vi.mock("../../config/prisma.js", () => ({ prisma: mockPrisma }));

const { sweepExpiredEntitlements } = await import("../../jobs/entitlementSweeper.job.js");

const past   = new Date(Date.now() - 86400_000);
const future = new Date(Date.now() + 86400_000);

beforeEach(() => { ents = []; vi.clearAllMocks(); });

describe("sweepExpiredEntitlements", () => {
  test("lapsed rows become EXPIRED", async () => {
    ents = [{ agent: "MAYA", status: "ACTIVE", currentPeriodEnd: past }];
    const out = await sweepExpiredEntitlements();
    assert.equal(out.expired, 1);
    assert.equal(ents[0].status, "EXPIRED");
  });

  test("unexpired rows are untouched", async () => {
    ents = [{ agent: "MAYA", status: "ACTIVE", currentPeriodEnd: future }];
    await sweepExpiredEntitlements();
    assert.equal(ents[0].status, "ACTIVE");
  });

  test("only the lapsed agent expires — others are independent", async () => {
    ents = [
      { agent: "MAYA", status: "ACTIVE", currentPeriodEnd: past },
      { agent: "REX",  status: "ACTIVE", currentPeriodEnd: future },
    ];
    await sweepExpiredEntitlements();
    assert.equal(ents[0].status, "EXPIRED");
    assert.equal(ents[1].status, "ACTIVE");
  });

  test("SUPERSEDED rows are left alone (not resurrected as EXPIRED)", async () => {
    ents = [{ agent: "MAYA", status: "SUPERSEDED", currentPeriodEnd: past }];
    await sweepExpiredEntitlements();
    assert.equal(ents[0].status, "SUPERSEDED");
  });

  test("is idempotent — a second run expires nothing new", async () => {
    ents = [{ agent: "MAYA", status: "ACTIVE", currentPeriodEnd: past }];
    await sweepExpiredEntitlements();
    const out = await sweepExpiredEntitlements();
    assert.equal(out.expired, 0);
  });
});
