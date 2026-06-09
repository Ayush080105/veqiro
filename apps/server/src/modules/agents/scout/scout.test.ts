import { Agent } from "../../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import type { AgentChatResponse } from "../../../common/utils/contextService.js";
import router from "./scout.routes.js";
import {
  discoverCompetitorsSchema,
  researchCompanySchema,
  researchTopicSchema,
  sendMessageSchema,
  trendingTopicsSchema,
} from "./scout.schema.js";
import * as service from "./scout.service.js";
import * as serviceModule from "./scout.service.js";
import { assert, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiPost: vi.fn(),
  callAgentWithContext: vi.fn(),
  createUserMessage: vi.fn(),
  createAssistantMessage: vi.fn(),
  findRecentMessages: vi.fn(),
  findAllScoutMessages: vi.fn(),
}));

vi.mock("./scout.repository.js", () => ({
  createUserMessage: mocks.createUserMessage,
  createAssistantMessage: mocks.createAssistantMessage,
  findRecentMessages: mocks.findRecentMessages,
  findAllScoutMessages: mocks.findAllScoutMessages,
}));

vi.mock("../../../common/utils/aiService.js", () => ({
  aiService: {
    post: mocks.aiPost,
  },
}));

vi.mock("../../../common/utils/contextService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../common/utils/contextService.js")>();

  return {
    ...actual,
    callAgentWithContext: mocks.callAgentWithContext,
  };
});

const userId = "user-1";
const organizationId = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRecentMessages.mockResolvedValue([
    { role: "assistant", content: "Older answer" },
    { role: "user", content: "Older question" },
  ]);
  mocks.createUserMessage.mockImplementation(async (data: object) => ({
    id: "user-message-1",
    ...data,
  }));
  mocks.createAssistantMessage.mockImplementation(async (data: object) => ({
    id: "assistant-message-1",
    ...data,
  }));
  mocks.findAllScoutMessages.mockResolvedValue([
    { role: "assistant", content: "Hello", customInput: null },
  ]);
});

describe("Scout schemas", () => {
  test("sendMessageSchema validates required content and conversation id bounds", () => {
    assert.equal(sendMessageSchema.parse({ content: "Research this" }).content, "Research this");
    assert.throws(() => sendMessageSchema.parse({ content: "" }));
    assert.throws(() => sendMessageSchema.parse({ content: "x".repeat(1001) }));
    assert.throws(() => sendMessageSchema.parse({ content: "ok", conversationId: "" }));
  });

  test("researchTopicSchema applies defaults and rejects invalid inputs", () => {
    const parsed = researchTopicSchema.parse({ topic: "AI CRMs" });
    assert.equal(parsed.depth, "standard");
    assert.deepEqual(parsed.sourcesHint, []);
    assert.equal(parsed.location, "");

    assert.throws(() => researchTopicSchema.parse({ topic: "", depth: "standard" }));
    assert.throws(() => researchTopicSchema.parse({ topic: "AI", depth: "wide" }));
    assert.throws(() => researchTopicSchema.parse({ topic: "AI", sourcesHint: ["not-a-url"] }));
    assert.throws(() =>
      researchTopicSchema.parse({
        topic: "AI",
        sourcesHint: Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`),
      }),
    );
  });

  test("researchCompanySchema validates optional nullable URL", () => {
    assert.equal(researchCompanySchema.parse({ companyName: "Acme" }).companyUrl, null);
    assert.equal(
      researchCompanySchema.parse({ companyName: "Acme", companyUrl: null }).companyUrl,
      null,
    );
    assert.throws(() => researchCompanySchema.parse({ companyName: "" }));
    assert.throws(() => researchCompanySchema.parse({ companyName: "Acme", companyUrl: "bad" }));
  });

  test("trendingTopicsSchema and discoverCompetitorsSchema enforce count bounds", () => {
    assert.equal(trendingTopicsSchema.parse({ industry: "SaaS" }).count, 10);
    assert.equal(
      discoverCompetitorsSchema.parse({
        description: "AI workspace",
        industry: "AI SaaS",
      }).count,
      8,
    );

    assert.throws(() => trendingTopicsSchema.parse({ industry: "SaaS", count: 0 }));
    assert.throws(() => trendingTopicsSchema.parse({ industry: "SaaS", count: 51 }));
    assert.throws(() =>
      discoverCompetitorsSchema.parse({
        description: "AI workspace",
        industry: "AI SaaS",
        count: 21,
      }),
    );
  });
});

describe("Scout service", () => {
  test("sendMessage builds context call before saving the assistant response", async () => {
    mocks.callAgentWithContext.mockResolvedValue({
      response: "Here is the research",
      agent: "scout",
      message_id: "ai-message-1",
      tokens_used: 42,
      model_used: "gpt-test",
      metadata: {},
      image: { url: "https://cdn.example.com/image.png" },
      action_id: "scout:research-topic",
      action_result: { bottom_line: "Market is growing" },
    } satisfies AgentChatResponse);

    const result = await service.sendMessage(userId, organizationId, {
      content: "Research AI CRMs",
    });

    assert.equal(result.content, "Here is the research");
    assert.equal(mocks.findRecentMessages.mock.calls.length, 1);
    assert.equal(mocks.createUserMessage.mock.calls.length, 1);
    assert.equal(mocks.createAssistantMessage.mock.calls.length, 1);

    const contextPayload = mocks.callAgentWithContext.mock.calls[0]![0] as Record<string, unknown>;
    assert.equal(contextPayload.agentApiPath, "/ai/scout/chat");
    assert.equal(contextPayload.agentEnum, Agent.SCOUT);
    assert.equal(contextPayload.conversationId, "user-message-1");
    assert.equal(contextPayload.userMessage, "Research AI CRMs");

    const assistant = mocks.createAssistantMessage.mock.calls[0]![0] as Record<string, unknown>;
    assert.equal(assistant.imageUrl, "https://cdn.example.com/image.png");
    assert.equal(assistant.tokensUsed, 42);
    assert.equal(assistant.model, "gpt-test");
    assert.deepEqual(assistant.customInput, {
      actionId: "scout:research-topic",
      input: {},
      result: { bottom_line: "Market is growing" },
    });
  });

  test("sendMessage uses explicit conversation id and omits action custom input when no result exists", async () => {
    mocks.callAgentWithContext.mockResolvedValue({
      response: "Plain answer",
      agent: "scout",
      message_id: "ai-message-1",
      tokens_used: 3,
      model_used: "gpt-test",
      metadata: {},
    } satisfies AgentChatResponse);

    await service.sendMessage(userId, organizationId, {
      content: "Hello",
      conversationId: "conversation-123",
    });

    assert.equal(
      (mocks.callAgentWithContext.mock.calls[0]![0] as Record<string, unknown>).conversationId,
      "conversation-123",
    );
    assert.equal(
      (mocks.createAssistantMessage.mock.calls[0]![0] as Record<string, unknown>).customInput,
      undefined,
    );
  });

  test("sendMessage throws BadRequestError when AI returns no response", async () => {
    mocks.callAgentWithContext.mockResolvedValue(null);

    await expect(service.sendMessage(userId, organizationId, { content: "Hello" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  test("researchTopic maps camelCase server input to snake_case AI payload", async () => {
    const response = {
      bottom_line: "BLUF",
      market_overview: "Overview",
      key_players: [],
      opportunities: [],
      risks: [],
      key_stats: [],
      emerging_trends: [],
      target_customers: "",
      recommended_actions: [],
      sources_scraped: ["https://source.example"],
      keywords_found: ["ai crm"],
      tokens_used: 9,
      model_used: "gpt-test",
    };
    mocks.callAgentWithContext.mockResolvedValue(response);

    const data = await service.researchTopic(userId, organizationId, {
      topic: "AI CRMs",
      depth: "deep",
      sourcesHint: ["https://source.example"],
      location: "India",
    });

    assert.equal(data, response);
    assert.deepEqual(mocks.callAgentWithContext.mock.calls[0]![0], {
      agentApiPath: "/ai/scout/research-topic",
      agentEnum: Agent.SCOUT,
      agentRole: "Scout: Competitive intelligence assistant",
      userId,
      organizationId,
      conversationId: "user-message-1",
      userMessage: "Research topic: AI CRMs",
      rawHistory: [
        { role: "assistant", content: "Older answer" },
        { role: "user", content: "Older question" },
      ],
      topLevelPayload: {
      topic: "AI CRMs",
      depth: "deep",
      sources_hint: ["https://source.example"],
      location: "India",
      },
    });
    assert.deepEqual(
      (mocks.createAssistantMessage.mock.calls[0]![0] as Record<string, unknown>).customInput,
      {
        actionId: "scout:research-topic",
        input: {
          topic: "AI CRMs",
          depth: "deep",
          sourcesHint: ["https://source.example"],
          location: "India",
        },
        result: response,
      },
    );
  });

  test("direct actions pass default empty location and persist AI results", async () => {
    const trendResponse = {
      trends: [
        {
          topic: "Agentic CRM",
          momentum: "rising",
          relevance_score: 0.9,
          content_angle: "Post",
          search_volume_estimate: "10K",
        },
      ],
      generated_at: "2026-06-09T00:00:00Z",
      tokens_used: 10,
      model_used: "gpt-test",
    };
    mocks.callAgentWithContext.mockResolvedValue(trendResponse);

    await service.trendingTopics(userId, organizationId, {
      industry: "AI SaaS",
      count: 3,
      location: "",
    });

    assert.deepEqual(mocks.callAgentWithContext.mock.calls[0]![0], {
      agentApiPath: "/ai/scout/trending-topics",
      agentEnum: Agent.SCOUT,
      agentRole: "Scout: Competitive intelligence assistant",
      userId,
      organizationId,
      conversationId: "user-message-1",
      userMessage: "Trends in AI SaaS",
      rawHistory: [
        { role: "assistant", content: "Older answer" },
        { role: "user", content: "Older question" },
      ],
      topLevelPayload: {
      industry: "AI SaaS",
      count: 3,
      location: "",
      },
    });
    assert.equal(
      (mocks.createAssistantMessage.mock.calls[0]![0] as Record<string, unknown>).tokensUsed,
      10,
    );
  });

  test("discoverCompetitors maps location and competitor response", async () => {
    const response = {
      competitors: [
        {
          name: "Acme AI",
          url: "https://acme.example",
          why_competitive: "Similar ICP",
          pricing_model: "Freemium",
        },
      ],
      generated_at: "2026-06-09T00:00:00Z",
      tokens_used: 7,
      model_used: "gpt-test",
    };
    mocks.callAgentWithContext.mockResolvedValue(response);

    const result = await service.discoverCompetitors(userId, organizationId, {
      description: "AI workspace for founders",
      industry: "AI productivity",
      count: 5,
      location: "Pune",
    });

    assert.equal(result, response);
    assert.deepEqual(mocks.callAgentWithContext.mock.calls[0]![0], {
      agentApiPath: "/ai/scout/discover-competitors",
      agentEnum: Agent.SCOUT,
      agentRole: "Scout: Competitive intelligence assistant",
      userId,
      organizationId,
      conversationId: "user-message-1",
      userMessage: "Discover competitors: AI productivity",
      rawHistory: [
        { role: "assistant", content: "Older answer" },
        { role: "user", content: "Older question" },
      ],
      topLevelPayload: {
      description: "AI workspace for founders",
      industry: "AI productivity",
      count: 5,
      location: "Pune",
      },
    });
  });
});

describe("Scout routes", () => {
  test("exposes active Scout routes and omits removed watchlist endpoints", () => {
    const stack = (
      (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack ?? []
    )
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route!.path,
        methods: Object.keys(layer.route!.methods).sort(),
      }));

    assert.deepEqual(stack, [
      { path: "/chat", methods: ["post"] },
      { path: "/chat", methods: ["get"] },
      { path: "/research-topic", methods: ["post"] },
      { path: "/research-company", methods: ["post"] },
      { path: "/trending-topics", methods: ["post"] },
      { path: "/discover-competitors", methods: ["post"] },
    ]);
    assert.equal(stack.some((route) => route.path === "/competitors"), false);
    assert.equal(stack.some((route) => route.path === "/competitors/:id"), false);
  });

  test("does not export removed watchlist service functions", () => {
    const exports = serviceModule as Record<string, unknown>;
    assert.equal("listCompetitors" in exports, false);
    assert.equal("addCompetitor" in exports, false);
    assert.equal("removeCompetitor" in exports, false);
  });
});
