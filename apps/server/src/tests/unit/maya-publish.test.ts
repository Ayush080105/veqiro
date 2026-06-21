import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { SocialPlatform } from "../../../prisma/generated/prisma/client.js";
import type { SocialAccount } from "../../../prisma/generated/prisma/client.js";
import type { SocialProvider } from "../../modules/integrations/integrations.types.js";

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    publishedPost: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../common/utils/aiService.js", () => ({
  aiService: { post: vi.fn() },
}));

vi.mock("../../common/utils/contextService.js", () => ({
  callAgentWithContext: vi.fn(),
}));

vi.mock("../../common/utils/r2.js", () => ({
  fetchImageAsBuffer: vi.fn(),
  getBrandImagesForGeneration: vi.fn(),
  isR2Configured: vi.fn(() => false),
  uploadImageBase64: vi.fn(),
}));

vi.mock("../../modules/brand-images/brand-images.service.js", () => ({
  getBrandImagesForGeneration: vi.fn(),
}));

vi.mock("../../modules/agents/maya/maya.repository.js", () => ({
  createAssistantMessage: vi.fn(),
  createUserMessage: vi.fn(),
  findAllMayaMessages: vi.fn(),
  findPublishedPosts: vi.fn(),
  findRecentMessages: vi.fn(),
  getRecentIdeas: vi.fn(),
  saveIdeas: vi.fn(),
  updateMessageImage: vi.fn(),
}));

vi.mock("../../modules/integrations/integrations.service.js", () => ({
  getUsableSocialAccount: vi.fn(),
  isAuthTokenError: vi.fn(),
}));

const twitterAccount = (accessToken: string): SocialAccount => ({
  id: "acct_1",
  organizationId: "org_1",
  userId: "user_1",
  platform: SocialPlatform.TWITTER,
  providerAccountId: "tw_1",
  accountName: "@veqiro",
  accessToken,
  refreshToken: "refresh_token",
  accessTokenExpiresAt: new Date(Date.now() + 7_200_000),
  scope: "tweet.read tweet.write users.read offline.access",
  metadata: { username: "veqiro" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("maya publish token refresh retry", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("../../config/prisma.js");
    vi.mocked(prisma.publishedPost.create).mockResolvedValue({
      id: "post_1",
      organizationId: "org_1",
      userId: "user_1",
      socialAccountId: "acct_1",
      platform: SocialPlatform.TWITTER,
      caption: "Hello",
      hashtags: [],
      imageUrl: null,
      status: "pending",
      error: null,
      platformPostId: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.publishedPost.update).mockResolvedValue({} as never);
  });

  test("auth failure forces a refresh and retries publish once", async () => {
    const integrations = await import("../../modules/integrations/integrations.service.js");
    const firstProvider = {
      publish: vi.fn().mockRejectedValue(new Error("Twitter POST /2/tweets failed (401): invalid_token")),
    } as unknown as SocialProvider;
    const secondProvider = {
      publish: vi.fn().mockResolvedValue({ platformPostId: "tweet_1", url: "https://x.com/veqiro/status/tweet_1" }),
    } as unknown as SocialProvider;

    vi.mocked(integrations.getUsableSocialAccount)
      .mockResolvedValueOnce({
        account: twitterAccount("old_access"),
        provider: firstProvider,
        platform: "twitter",
      })
      .mockResolvedValueOnce({
        account: twitterAccount("new_access"),
        provider: secondProvider,
        platform: "twitter",
      });
    vi.mocked(integrations.isAuthTokenError).mockReturnValue(true);

    const { publish } = await import("../../modules/agents/maya/maya.service.js");
    const result = await publish("user_1", "org_1", {
      socialAccountId: "acct_1",
      caption: "Hello",
      hashtags: [],
    });

    expect(firstProvider.publish).toHaveBeenCalledTimes(1);
    expect(secondProvider.publish).toHaveBeenCalledTimes(1);
    expect(integrations.getUsableSocialAccount).toHaveBeenLastCalledWith(
      "org_1",
      "acct_1",
      { forceRefresh: true }
    );
    assert.equal(result.platformPostId, "tweet_1");
  });

  test("forced refresh failure marks publish failed and returns reconnect guidance", async () => {
    const integrations = await import("../../modules/integrations/integrations.service.js");
    const provider = {
      publish: vi.fn().mockRejectedValue(new Error("Twitter POST /2/tweets failed (401): invalid_token")),
    } as unknown as SocialProvider;

    vi.mocked(integrations.getUsableSocialAccount)
      .mockResolvedValueOnce({
        account: twitterAccount("old_access"),
        provider,
        platform: "twitter",
      })
      .mockRejectedValueOnce(new Error("Twitter/X connection expired. Please reconnect this integration."));
    vi.mocked(integrations.isAuthTokenError).mockReturnValue(true);

    const { prisma } = await import("../../config/prisma.js");
    const { publish } = await import("../../modules/agents/maya/maya.service.js");

    await expect(publish("user_1", "org_1", {
      socialAccountId: "acct_1",
      caption: "Hello",
      hashtags: [],
    })).rejects.toThrow("Twitter/X connection expired. Please reconnect this integration.");

    const failedUpdate = vi.mocked(prisma.publishedPost.update).mock.calls.at(-1)![0];
    assert.deepEqual(failedUpdate, {
      where: { id: "post_1" },
      data: {
        status: "failed",
        error: "Twitter/X connection expired. Please reconnect this integration.",
      },
    });
  });
});
