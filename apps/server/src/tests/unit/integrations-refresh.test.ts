import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { SocialPlatform } from "../../../prisma/generated/prisma/client.js";
import type { SocialAccount } from "../../../prisma/generated/prisma/client.js";
import type { SocialProvider } from "../../modules/integrations/integrations.types.js";

vi.mock("../../modules/integrations/integrations.repository.js", () => ({
  findById: vi.fn(),
  findByOrg: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../modules/integrations/providers/index.js", () => ({
  getProvider: vi.fn(),
}));

const account = (overrides: Partial<SocialAccount> = {}): SocialAccount => ({
  id: "acct_1",
  organizationId: "org_1",
  userId: "user_1",
  platform: SocialPlatform.TWITTER,
  providerAccountId: "tw_1",
  accountName: "@veqiro",
  accessToken: "old_access",
  refreshToken: "old_refresh",
  accessTokenExpiresAt: new Date(Date.now() + 30_000),
  scope: "tweet.read tweet.write users.read offline.access",
  metadata: { username: "veqiro" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("twitter OAuth refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TWITTER_CLIENT_ID = "client_id";
    process.env.TWITTER_CLIENT_SECRET = "client_secret";
  });

  test("maps rotated refresh token and expires_in from X token endpoint", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "new_access",
        refresh_token: "new_refresh",
        expires_in: 7200,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { twitter } = await import("../../modules/integrations/providers/twitter.js");
    const result = await twitter.refresh("old_refresh");

    assert.equal(fetchMock.mock.calls[0]![0], "https://api.x.com/2/oauth2/token");
    assert.equal(result.accessToken, "new_access");
    assert.equal(result.refreshToken, "new_refresh");
    assert.ok(result.expiresAt instanceof Date);
  });
});

describe("social account refresh helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("near-expired Twitter account refreshes and persists rotated refresh token", async () => {
    const repo = await import("../../modules/integrations/integrations.repository.js");
    const providers = await import("../../modules/integrations/providers/index.js");
    const expiresAt = new Date(Date.now() + 7_200_000);
    const provider = {
      refresh: vi.fn().mockResolvedValue({
        accessToken: "new_access",
        refreshToken: "new_refresh",
        expiresAt,
      }),
    } as unknown as SocialProvider;
    vi.mocked(providers.getProvider).mockReturnValue(provider);
    vi.mocked(repo.findById).mockResolvedValue(account());
    vi.mocked(repo.update).mockImplementation(async (_id, data) => ({
      ...account(),
      accessToken: data.accessToken ?? "old_access",
      refreshToken: data.refreshToken ?? "old_refresh",
      accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
    }));

    const { getUsableSocialAccount } = await import("../../modules/integrations/integrations.service.js");
    const result = await getUsableSocialAccount("org_1", "acct_1");

    assert.equal(result.account.accessToken, "new_access");
    assert.equal(result.account.refreshToken, "new_refresh");
    expect(repo.update).toHaveBeenCalledWith("acct_1", {
      accessToken: "new_access",
      accessTokenExpiresAt: expiresAt,
      refreshToken: "new_refresh",
    });
  });

  test("refresh without a new refresh token preserves the stored one", async () => {
    const repo = await import("../../modules/integrations/integrations.repository.js");
    const expiresAt = new Date(Date.now() + 7_200_000);
    const provider = {
      refresh: vi.fn().mockResolvedValue({ accessToken: "new_access", expiresAt }),
    } as unknown as SocialProvider;
    vi.mocked(repo.update).mockResolvedValue({
      ...account(),
      accessToken: "new_access",
      accessTokenExpiresAt: expiresAt,
    });

    const { refreshSocialAccount } = await import("../../modules/integrations/integrations.service.js");
    await refreshSocialAccount(account(), provider);

    const updateArg = vi.mocked(repo.update).mock.calls[0]![1];
    assert.equal("refreshToken" in updateArg, false);
  });

  test("refresh failure asks the user to reconnect", async () => {
    const provider = {
      refresh: vi.fn().mockRejectedValue(new Error("invalid_grant")),
    } as unknown as SocialProvider;

    const { refreshSocialAccount } = await import("../../modules/integrations/integrations.service.js");

    await expect(refreshSocialAccount(account(), provider, { force: true }))
      .rejects.toThrow("Twitter/X connection expired. Please reconnect this integration.");
  });
});
