import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  listIntegrations: vi.fn(),
  listMcpConnections: vi.fn(),
}));

vi.mock("./dashboard.repository.js", () => ({}));
vi.mock("../integrations/integrations.service.js", () => ({
  list: mocks.listIntegrations,
}));
vi.mock("../mcp/mcp.service.js", () => ({
  listConnections: mocks.listMcpConnections,
}));

import { getDashboardIntegrationHealth } from "./dashboard.service.js";
import { integrationHealth } from "./dashboard.controller.js";

describe("dashboard integration health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("aggregates organization-scoped connection state without leaking provider fields", async () => {
    const expiresAt = new Date("2026-09-01T12:00:00.000Z");
    mocks.listIntegrations.mockResolvedValue([
      {
        id: "account-1",
        organizationId: "org-1",
        userId: "user-1",
        platform: "LINKEDIN",
        providerAccountId: "provider-user-1",
        accountName: "Founder",
        metadata: { private: true },
        accessTokenExpiresAt: expiresAt,
        canRefresh: true,
      },
    ]);
    mocks.listMcpConnections.mockResolvedValue([
      {
        slug: "gmail",
        connectionId: "provider-connection-1",
        toolkitSlug: "gmail",
        ownerAgent: "VEGA",
        status: "CONNECTED",
        lastConnectedAt: expiresAt,
        lastError: "sensitive provider detail",
      },
    ]);

    await expect(getDashboardIntegrationHealth("org-1")).resolves.toEqual({
      accounts: [
        {
          platform: "LINKEDIN",
          accountName: "Founder",
          accessTokenExpiresAt: expiresAt,
          canRefresh: true,
        },
      ],
      mcpConnections: [{ slug: "gmail", status: "CONNECTED" }],
    });
    expect(mocks.listIntegrations).toHaveBeenCalledWith("org-1");
    expect(mocks.listMcpConnections).toHaveBeenCalledWith("org-1");
  });

  test("marks the organization-scoped response as non-cacheable", async () => {
    mocks.listIntegrations.mockResolvedValue([]);
    mocks.listMcpConnections.mockResolvedValue([]);
    const response = {
      set: vi.fn(),
      status: vi.fn(),
      json: vi.fn(),
    };
    response.set.mockReturnValue(response);
    response.status.mockReturnValue(response);

    await integrationHealth(
      { organizationId: "org-1" } as Request,
      response as unknown as Response,
    );

    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ accounts: [], mcpConnections: [] });
  });
});
