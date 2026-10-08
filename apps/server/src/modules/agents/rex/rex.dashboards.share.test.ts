import { describe, it, assert, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  rexDashboard: { findFirst: vi.fn(), update: vi.fn() },
  rexDataset: { count: vi.fn() },
}));
vi.mock("../../../config/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("./hubspot/hubspot.runtime.js", () => ({ hubspotSync: { ensureFresh: vi.fn(), syncMany: vi.fn() } }));
vi.mock("../../../common/utils/aiService.js", () => ({ aiService: { post: vi.fn() } }));

import { ConflictError } from "../../../common/errors/conflict.js";
import { shareDashboard } from "./rex.dashboards.service.js";

const dashboard = { id: "d1", organizationId: "org1", datasetIds: ["ds1"], shareToken: null, widgets: [] };

beforeEach(() => {
  prismaMock.rexDashboard.findFirst.mockReset().mockResolvedValue(dashboard);
  prismaMock.rexDashboard.update.mockReset().mockResolvedValue({});
  prismaMock.rexDataset.count.mockReset();
});

describe("shareDashboard and personal data", () => {
  it("asks for confirmation before making a dashboard with HubSpot personal data public", async () => {
    prismaMock.rexDataset.count.mockResolvedValue(1);
    let err: unknown;
    try { await shareDashboard("org1", "d1", true); } catch (e) { err = e; }
    assert.instanceOf(err, ConflictError);
    assert.match((err as Error).message, /personal data/i);
    assert.equal(prismaMock.rexDashboard.update.mock.calls.length, 0);
  });

  it("publishes once the person confirms", async () => {
    prismaMock.rexDataset.count.mockResolvedValue(1);
    const out = await shareDashboard("org1", "d1", true, true);
    assert.isTrue(out.isPublic);
    assert.isString(out.shareToken);
  });

  it("does not ask when there is no personal data, or when turning sharing off", async () => {
    prismaMock.rexDataset.count.mockResolvedValue(0);
    assert.isTrue((await shareDashboard("org1", "d1", true)).isPublic);
    prismaMock.rexDataset.count.mockResolvedValue(3);
    assert.isFalse((await shareDashboard("org1", "d1", false)).isPublic);
  });

  it("only looks at the datasets this dashboard reads, within the organization", async () => {
    prismaMock.rexDataset.count.mockResolvedValue(0);
    await shareDashboard("org1", "d1", true);
    assert.deepEqual(prismaMock.rexDataset.count.mock.calls[0]![0].where, { organizationId: "org1", id: { in: ["ds1"] }, containsPii: true });
  });
});
