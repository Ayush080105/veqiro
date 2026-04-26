import { z } from "zod";
import {
  createDocument,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathItemObject,
} from "zod-openapi";
import {
  sendMessageSchema,
  keywordResearchSchema,
  generateBlogSchema,
  analyzeContentSchema,
  contentBriefSchema,
} from "../modules/agents/sage/sage.schema.js";
import {
  sendMessageSchema as scoutSendMessageSchema,
  researchTopicSchema,
  researchCompanySchema,
  trendingTopicsSchema,
} from "../modules/agents/scout/scout.schema.js";
import {
  sendMessageSchema as mayaSendMessageSchema,
  generateIdeasSchema,
  draftContentSchema,
  generateVariantsSchema,
  reviseSchema,
  regenerateImageSchema,
  regenerateContentSchema,
  publishSchema,
} from "../modules/agents/maya/maya.schema.js";
import {
  sendMessageSchema as lexSendMessageSchema,
  analyzeContractSchema,
  draftDocumentSchema,
  explainSchema,
  legalResearchSchema,
  complianceCheckSchema,
  queryDocumentSchema,
} from "../modules/agents/lex/lex.schema.js";
import {
  sendMessageSchema as vegaSendMessageSchema,
  processInboxSchema,
  draftReplySchema,
  calendarSummarySchema,
  createEventSchema,
  executiveBriefingSchema,
  composeEmailSchema,
} from "../modules/agents/vega/vega.schema.js";
import { env } from "../config/env.js";

// Internal-Bearer callers must supply userId + organizationId in the body.
// Session callers don't — the middleware resolves them from the session.
// This augmentation lives only in the OpenAPI doc so Postman shows the fields;
// the runtime Zod validators stay clean.
const withInternalIdentity = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({
    userId: z.string().optional().describe("Required when using bearerAuth"),
    organizationId: z.string().optional().describe("Required when using bearerAuth"),
  });

// Shared identity values used in request examples. Real callers should replace these.
const IDENTITY_EXAMPLE = {
  userId: "tCkkD1WmH1cd0ZTGuOxQDQxkxIw05URn",
  organizationId: "org_test_01",
};

// Response schemas (doc-only — mirror sage.types.ts interfaces)
const keywordItemSchema = z.object({
  keyword: z.string(),
  search_intent: z.string(),
  estimated_difficulty: z.number().int(),
  relevance_score: z.number(),
  suggested_content_type: z.string(),
  related_keywords: z.array(z.string()),
});

const keywordClusterSchema = z.object({
  cluster_name: z.string(),
  keywords: z.array(z.string()),
  primary_intent: z.string(),
});

const keywordResearchResponseSchema = z.object({
  keywords: z.array(keywordItemSchema),
  clusters: z.array(keywordClusterSchema),
});

const blogContentSchema = z.object({
  title: z.string(),
  meta_title: z.string(),
  meta_description: z.string(),
  slug: z.string(),
  content: z.string(),
  word_count: z.number().int(),
  headings: z.array(z.string()),
  target_keyword: z.string(),
  secondary_keywords: z.array(z.string()),
  schema_markup: z.record(z.string(), z.unknown()).nullable().optional(),
  wordpress_format: z.record(z.string(), z.unknown()).nullable().optional(),
  wix_format: z.record(z.string(), z.unknown()).nullable().optional(),
});

const generateBlogResponseSchema = z.object({
  blog: blogContentSchema,
  seo_score: z.number().int(),
  seo_suggestions: z.array(z.string()),
});

const contentAnalysisResponseSchema = z.object({
  score: z.number().int(),
  issues: z.array(z.string()),
  improvements: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  readability_grade: z.string(),
});

const contentBriefResponseSchema = z.object({
  brief: z.record(z.string(), z.unknown()),
});

const assistantMessageResponseSchema = z.object({
  role: z.literal("assistant"),
  content: z.string(),
  imageUrl: z.string().optional(),
  createdAt: z.string(),
});

const sageMessageListSchema = z.array(
  z.object({
    role: z.string(),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    createdAt: z.string(),
  })
);

// ── Scout response schemas (doc-only) ─────────────────────────────────────

const researchTopicResponseSchema = z.object({
  findings: z.string(),
  synthesis: z.string(),
  sources_scraped: z.array(z.string()),
  keywords_found: z.array(z.string()),
});

const companyProfileSchema = z.object({
  name: z.string(),
  description: z.string(),
  founded: z.string(),
  team_size: z.string(),
  funding: z.string(),
  key_features: z.array(z.string()),
  pricing: z.record(z.string(), z.string()),
  target_market: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recent_news: z.array(z.string()),
});

const researchCompanyResponseSchema = z.object({
  company: companyProfileSchema,
  scraped_at: z.string(),
});

const trendItemSchema = z.object({
  topic: z.string(),
  momentum: z.string(),
  relevance_score: z.number(),
  content_angle: z.string(),
  search_volume_estimate: z.string(),
});

const trendingTopicsResponseSchema = z.object({
  trends: z.array(trendItemSchema),
  generated_at: z.string(),
});

const scoutMessageListSchema = z.array(
  z.object({
    role: z.string(),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    customInput: z.unknown().optional(),
  })
);

// Shared error responses
const errorResponses = {
  "400": { description: "Validation error or missing internal-call identity" },
  "401": { description: "Unauthorized" },
  "500": { description: "Upstream AI service error" },
};

// ── Operations ────────────────────────────────────────────────────────────

const sageChatPost: ZodOpenApiOperationObject = {
  operationId: "sageChat",
  summary: "Sage chat",
  description:
    "Conversational SEO chat. Persists the user message and assistant reply to the Messages table (tagged with userId + organizationId).",
  tags: ["Sage"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(sendMessageSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          content:
            "What are the top 3 SEO trends I should focus on this month for my SaaS startup?",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Assistant message",
      content: {
        "application/json": { schema: assistantMessageResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const sageChatGet: ZodOpenApiOperationObject = {
  operationId: "sageListMessages",
  summary: "List Sage messages for an organization",
  tags: ["Sage"],
  requestParams: {
    query: z.object({
      userId: z
        .string()
        .optional()
        .meta({
          description: "Required when using bearerAuth; resolved from session for cookieAuth",
          example: IDENTITY_EXAMPLE.userId,
        }),
      organizationId: z
        .string()
        .optional()
        .meta({
          description: "Required when using bearerAuth; falls back to session's active org for cookieAuth",
          example: IDENTITY_EXAMPLE.organizationId,
        }),
    }),
  },
  responses: {
    "200": {
      description: "Messages, newest first",
      content: {
        "application/json": { schema: sageMessageListSchema },
      },
    },
    ...errorResponses,
  },
};

const keywordResearchPost: ZodOpenApiOperationObject = {
  operationId: "sageKeywordResearch",
  summary: "Keyword research",
  description: "Proxies to the AI service; generates keyword candidates and intent clusters.",
  tags: ["Sage"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(keywordResearchSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          seedTopic: "AI productivity tools for founders",
          niche: "SaaS",
          competitorUrls: [],
          count: 10,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Keyword research results",
      content: {
        "application/json": { schema: keywordResearchResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const generateBlogPost: ZodOpenApiOperationObject = {
  operationId: "sageGenerateBlog",
  summary: "Generate SEO blog post",
  tags: ["Sage"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(generateBlogSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          topic:
            "How AI Productivity Tools Are Changing How Founders Work in 2025",
          targetKeyword: "AI productivity tools for founders",
          secondaryKeywords: [
            "founder tools",
            "AI automation startup",
            "startup productivity",
          ],
          wordCount: 2000,
          outputFormat: "markdown",
          includeMeta: true,
          includeSchemaMarkup: false,
          toneOverride: null,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Generated blog post with SEO metadata",
      content: {
        "application/json": { schema: generateBlogResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const analyzeContentPost: ZodOpenApiOperationObject = {
  operationId: "sageAnalyzeContent",
  summary: "Analyze content SEO",
  tags: ["Sage"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(analyzeContentSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          content:
            "AI tools are changing the way startups work. Many founders are adopting AI-first workflows to save time on repetitive tasks like email triage, scheduling, and first-draft content. In this post we'll cover the five categories every founder should evaluate in 2025.",
          targetKeyword: "AI tools for startups",
          url: "https://myblog.example.com/ai-tools",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "SEO analysis with score and improvements",
      content: {
        "application/json": { schema: contentAnalysisResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const contentBriefPost: ZodOpenApiOperationObject = {
  operationId: "sageContentBrief",
  summary: "Generate content brief",
  tags: ["Sage"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(contentBriefSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          topic: "AI productivity tools for founders",
          targetKeyword: "AI productivity tools for founders",
          competitorUrls: [],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Comprehensive SEO content brief",
      content: {
        "application/json": { schema: contentBriefResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const sageChatPath: ZodOpenApiPathItemObject = {
  post: sageChatPost,
  get: sageChatGet,
};

// ── Scout Operations ──────────────────────────────────────────────────────

const scoutChatPost: ZodOpenApiOperationObject = {
  operationId: "scoutChat",
  summary: "Scout chat",
  description:
    "Conversational research chat. Persists the user message and assistant reply to the Messages table (tagged with userId + organizationId, agent=SCOUT).",
  tags: ["Scout"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(scoutSendMessageSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          content:
            "Research the AI productivity tools market and tell me who the top 3 competitors are right now.",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Assistant message",
      content: {
        "application/json": { schema: assistantMessageResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const scoutChatGet: ZodOpenApiOperationObject = {
  operationId: "scoutListMessages",
  summary: "List Scout messages for an organization",
  tags: ["Scout"],
  requestParams: {
    query: z.object({
      userId: z.string().optional().meta({
        description: "Required when using bearerAuth; resolved from session for cookieAuth",
        example: IDENTITY_EXAMPLE.userId,
      }),
      organizationId: z.string().optional().meta({
        description: "Required when using bearerAuth; falls back to session's active org for cookieAuth",
        example: IDENTITY_EXAMPLE.organizationId,
      }),
    }),
  },
  responses: {
    "200": {
      description: "Messages, newest first",
      content: {
        "application/json": { schema: scoutMessageListSchema },
      },
    },
    ...errorResponses,
  },
};

const scoutResearchTopicPost: ZodOpenApiOperationObject = {
  operationId: "scoutResearchTopic",
  summary: "Research a topic",
  description: "Deep web research on any topic using scraping and LLM synthesis.",
  tags: ["Scout"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(researchTopicSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          topic: "AI productivity tools for founders 2025",
          depth: "standard",
          sourcesHint: [],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Research findings + strategic synthesis",
      content: {
        "application/json": { schema: researchTopicResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const scoutResearchCompanyPost: ZodOpenApiOperationObject = {
  operationId: "scoutResearchCompany",
  summary: "Research a company",
  description: "Build a structured company profile (features, pricing, funding, strengths, weaknesses).",
  tags: ["Scout"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(researchCompanySchema),
        example: {
          ...IDENTITY_EXAMPLE,
          companyName: "Notion",
          companyUrl: "https://notion.so",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Company profile",
      content: {
        "application/json": { schema: researchCompanyResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const scoutTrendingTopicsPost: ZodOpenApiOperationObject = {
  operationId: "scoutTrendingTopics",
  summary: "Get trending topics",
  description: "Discover trending topics and content opportunities in a given industry.",
  tags: ["Scout"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(trendingTopicsSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          industry: "SaaS / AI Productivity",
          count: 5,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Trending topics with momentum + content angles",
      content: {
        "application/json": { schema: trendingTopicsResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const scoutChatPath: ZodOpenApiPathItemObject = {
  post: scoutChatPost,
  get: scoutChatGet,
};

// ── Maya response schemas (doc-only) ──────────────────────────────────────

const imageResultSchema = z.object({
  image_base64: z.string().optional(),
  image_url: z.string().optional(),
  content_type: z.string(),
  prompt_used: z.string(),
});

const contentIdeaSchema = z.object({
  title: z.string(),
  content_type: z.string(),
  platform: z.enum(["linkedin", "twitter", "instagram"]),
  hook: z.string(),
  predicted_engagement: z.string(),
  reasoning: z.string(),
  suggested_hashtags: z.array(z.string()),
});

const ideationResponseSchema = z.object({
  ideas: z.array(contentIdeaSchema),
  generated_at: z.string(),
  image: imageResultSchema.nullable().optional(),
});

const draftResponseSchema = z.object({
  draft: z.object({
    title: z.string(),
    body: z.string(),
    hashtags: z.array(z.string()),
    cta: z.string(),
    meta_description: z.string(),
    word_count: z.number().int(),
    platform: z.enum(["linkedin", "twitter", "instagram"]),
    tone_used: z.string(),
  }),
  image: imageResultSchema.nullable().optional(),
});

const variantResponseSchema = z.object({
  variants: z.array(
    z.object({
      platform: z.enum(["linkedin", "twitter", "instagram"]),
      title: z.string(),
      body: z.string(),
      hashtags: z.array(z.string()),
      char_count: z.number().int(),
      image: imageResultSchema.nullable().optional(),
    })
  ),
});

const reviseResponseSchema = z.object({
  revised: z.object({
    title: z.string(),
    body: z.string(),
    hashtags: z.array(z.string()),
    cta: z.string(),
  }),
  changes_made: z.array(z.string()),
});

const imageRegenResponseSchema = z.object({
  image: imageResultSchema,
});

const contentRegenResponseSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

const publishResponseSchema = z.object({
  platform: z.enum(["twitter", "linkedin", "instagram"]),
  platformPostId: z.string(),
  url: z.string().optional(),
  publishedAt: z.string(),
});

const mayaMessageListSchema = z.array(
  z.object({
    role: z.string(),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    customInput: z.unknown().optional(),
  })
);

// ── Maya Operations ───────────────────────────────────────────────────────

const mayaChatPost: ZodOpenApiOperationObject = {
  operationId: "mayaChat",
  summary: "Maya chat",
  description:
    "Conversational marketing & content chat. Maya auto-routes to the right tool (ideas, draft, revise, etc.) based on intent.",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(mayaSendMessageSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          content: "Draft a LinkedIn post about how AI saves founders 10 hours a week.",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Assistant message",
      content: { "application/json": { schema: assistantMessageResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaChatGet: ZodOpenApiOperationObject = {
  operationId: "mayaListMessages",
  summary: "List Maya messages for an organization",
  tags: ["Maya"],
  requestParams: {
    query: z.object({
      userId: z.string().optional().meta({
        description: "Required when using bearerAuth; resolved from session for cookieAuth",
        example: IDENTITY_EXAMPLE.userId,
      }),
      organizationId: z.string().optional().meta({
        description: "Required when using bearerAuth; falls back to session's active org for cookieAuth",
        example: IDENTITY_EXAMPLE.organizationId,
      }),
    }),
  },
  responses: {
    "200": {
      description: "Messages, newest first",
      content: { "application/json": { schema: mayaMessageListSchema } },
    },
    ...errorResponses,
  },
};

const mayaGenerateIdeasPost: ZodOpenApiOperationObject = {
  operationId: "mayaGenerateIdeas",
  summary: "Generate content ideas",
  description: "Brainstorm high-performing content ideas for a platform.",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(generateIdeasSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          platform: "linkedin",
          topicHint: "AI productivity for founders",
          count: 3,
          includeImage: false,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Generated ideas",
      content: { "application/json": { schema: ideationResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaDraftContentPost: ZodOpenApiOperationObject = {
  operationId: "mayaDraftContent",
  summary: "Draft a platform-native post",
  description:
    "Generate a publish-ready draft with hashtags, CTA, and (optionally) an on-brand image. Images are uploaded to R2 when configured; the returned `image.image_url` is hosted.",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(draftContentSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          topic: "How AI saved our team 12 hours per week",
          platform: "linkedin",
          wordCountTarget: 250,
          includeImage: true,
          useLogo: true,
          useMascot: false,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Draft with optional hosted image",
      content: { "application/json": { schema: draftResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaGenerateVariantsPost: ZodOpenApiOperationObject = {
  operationId: "mayaGenerateVariants",
  summary: "Adapt content for multiple platforms",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(generateVariantsSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          originalContent: "We just launched our AI productivity suite for founders...",
          originalPlatform: "linkedin",
          targetPlatforms: ["twitter", "instagram"],
          includeImages: false,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Platform-specific variants",
      content: { "application/json": { schema: variantResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaRevisePost: ZodOpenApiOperationObject = {
  operationId: "mayaRevise",
  summary: "Revise content with feedback",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(reviseSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          originalContent: "We launched our AI tool today. It saves time.",
          platform: "linkedin",
          feedback: "Too vague — add a specific stat and a stronger hook",
          specificInstructions: "Open with a number",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Revised post + change log",
      content: { "application/json": { schema: reviseResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaRegenerateImagePost: ZodOpenApiOperationObject = {
  operationId: "mayaRegenerateImage",
  summary: "Regenerate an existing image",
  description:
    "Fetches an existing image by URL (typically an R2 URL from a prior draft) and regenerates it with a new prompt.",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(regenerateImageSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          imageUrl: "https://pub-xxx.r2.dev/org_test_01/maya/abc.png",
          prompt: "Make the background more vibrant",
          platform: "instagram",
          useLogo: true,
          useMascot: false,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Regenerated image",
      content: { "application/json": { schema: imageRegenResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaRegenerateContentPost: ZodOpenApiOperationObject = {
  operationId: "mayaRegenerateContent",
  summary: "Refresh caption with new instructions",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(regenerateContentSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          caption: "We just launched our new AI tool...",
          prompt: "Make it more engaging and end with a question",
          platform: "linkedin",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Updated caption + hashtags + CTA",
      content: { "application/json": { schema: contentRegenResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaPublishPost: ZodOpenApiOperationObject = {
  operationId: "mayaPublish",
  summary: "Publish a draft to a connected social account",
  description:
    "Publishes `caption` (with optional hashtags and image) to the social platform for the given SocialAccount. " +
    "If `imageBase64` is provided it's uploaded to R2 first; `imageUrl` is used as-is. " +
    "Instagram requires an image.",
  tags: ["Maya"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(publishSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          socialAccountId: "acc_01HX...",
          caption: "How we saved 12 hours per week using AI.",
          hashtags: ["#FounderLife", "#AIProductivity"],
          imageUrl: "https://pub-xxx.r2.dev/org_test_01/maya/abc.png",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Published post metadata",
      content: { "application/json": { schema: publishResponseSchema } },
    },
    ...errorResponses,
  },
};

const mayaChatPath: ZodOpenApiPathItemObject = {
  post: mayaChatPost,
  get: mayaChatGet,
};

// ── Integrations Operations ────────────────────────────────────────────────

const socialAccountSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  platform: z.enum(["TWITTER", "LINKEDIN", "INSTAGRAM"]),
  providerAccountId: z.string(),
  accountName: z.string().nullable(),
  scope: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  accessTokenExpiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const integrationsListGet: ZodOpenApiOperationObject = {
  operationId: "listIntegrations",
  summary: "List connected social accounts for the active org",
  description:
    "Access tokens and refresh tokens are redacted from this response. Use `/agents/maya/publish` to publish with a connected account by `id`.",
  tags: ["Integrations"],
  responses: {
    "200": {
      description: "Connected SocialAccounts",
      content: { "application/json": { schema: z.array(socialAccountSchema) } },
    },
    "401": { description: "Unauthorized" },
  },
};

const integrationsAuthorizeGet: ZodOpenApiOperationObject = {
  operationId: "integrationsAuthorize",
  summary: "Begin OAuth for a platform (302 redirect)",
  description:
    "Requires a session. Builds the platform's OAuth authorize URL with an HMAC-signed `state` (carries orgId + userId + PKCE verifier for Twitter) and 302-redirects. " +
    "After the user approves, the platform bounces to `/integrations/{platform}/callback`.",
  tags: ["Integrations"],
  requestParams: {
    path: z.object({
      platform: z.enum(["twitter", "linkedin", "instagram"]),
    }),
  },
  responses: {
    "302": { description: "Redirect to platform OAuth" },
    "401": { description: "Unauthorized (no session)" },
  },
};

const integrationsCallbackGet: ZodOpenApiOperationObject = {
  operationId: "integrationsCallback",
  summary: "OAuth callback (public; state-verified)",
  description:
    "Exchanges the authorization code for tokens, fetches platform-native identity metadata " +
    "(Twitter handle, LinkedIn person URN, Instagram Business account id + FB Page token), " +
    "upserts a SocialAccount row, and redirects to `${CLIENT_URL}/settings/integrations?connected={platform}`. " +
    "This endpoint is NOT protected by authMiddleware — authenticity comes from the HMAC-signed `state` param.",
  tags: ["Integrations"],
  security: [],
  requestParams: {
    path: z.object({
      platform: z.enum(["twitter", "linkedin", "instagram"]),
    }),
    query: z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
    }),
  },
  responses: {
    "302": { description: "Redirect back to /settings/integrations (with ?connected or ?error)" },
  },
};

// ── Lex response schemas (doc-only) ────────────────────────────────────────

const sourceDtoSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string(),
  type: z.string(),
  typeDetected: z.string().nullable(),
  r2Url: z.string(),
  sizeBytes: z.number().int(),
  pageCount: z.number().int(),
  chunksCreated: z.number().int(),
  summary: z.string(),
  keyTopics: z.array(z.string()),
  createdAt: z.string(),
});

const queryDocumentResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      content: z.string(),
      score: z.number(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  tokens_used: z.number().int().optional(),
  model_used: z.string().optional(),
});

const contractRiskSchema = z.object({
  clause: z.string(),
  risk: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

const analyzeContractResponseSchema = z.object({
  analysis: z.object({
    summary: z.string(),
    risk_level: z.string(),
    risks: z.array(contractRiskSchema),
    unusual_clauses: z.array(z.string()),
    missing_protections: z.array(z.string()),
    key_terms: z.record(z.string(), z.string()),
    overall_assessment: z.string(),
  }),
  disclaimer: z.string(),
});

const draftDocumentResponseSchema = z.object({
  document: z.string(),
  review_notes: z.array(z.string()),
  disclaimer: z.string(),
});

const explainResponseSchema = z.object({
  explanation: z.string(),
  key_terms: z.record(z.string(), z.string()),
  related_concepts: z.array(z.string()),
  practical_implications: z.array(z.string()),
});

const legalResearchResponseSchema = z.object({
  summary: z.string(),
  applicable_laws: z.array(z.string()),
  key_requirements: z.array(z.string()),
  relevant_cases: z.array(z.string()),
  practical_guidance: z.array(z.string()),
  jurisdiction_notes: z.string(),
  confidence_level: z.string(),
  disclaimer: z.string(),
});

const frameworkResultSchema = z.object({
  framework: z.string(),
  status: z.string(),
  gaps: z.array(z.string()),
  requirements: z.array(z.string()),
});

const remediationStepSchema = z.object({
  priority: z.enum(["low", "medium", "high"]),
  action: z.string(),
});

const complianceCheckResponseSchema = z.object({
  overall_status: z.string(),
  framework_results: z.array(frameworkResultSchema),
  critical_gaps: z.array(z.string()),
  remediation_steps: z.array(remediationStepSchema),
  estimated_effort: z.string(),
  disclaimer: z.string(),
});

const lexMessageListSchema = z.array(
  z.object({
    role: z.string(),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    customInput: z.unknown().optional(),
  })
);

const lexAssistantMessageResponseSchema = z.object({
  role: z.literal("assistant"),
  content: z.string(),
  imageUrl: z.string().optional(),
  disclaimer: z.string().optional(),
  createdAt: z.string(),
});

// ── Lex Operations ─────────────────────────────────────────────────────────

const lexChatPost: ZodOpenApiOperationObject = {
  operationId: "lexChat",
  summary: "Lex chat",
  description:
    "Conversational legal chat. Responses include a standard legal disclaimer. Lex auto-routes to the right tool (ingest, analyze, draft, explain, research, compliance check) based on intent.",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(lexSendMessageSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          content:
            "What are the key risks in a typical mutual NDA for a SaaS partnership discussion?",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Assistant message with disclaimer",
      content: {
        "application/json": { schema: lexAssistantMessageResponseSchema },
      },
    },
    ...errorResponses,
  },
};

const lexChatGet: ZodOpenApiOperationObject = {
  operationId: "lexListMessages",
  summary: "List Lex messages for an organization",
  tags: ["Lex"],
  requestParams: {
    query: z.object({
      userId: z.string().optional().meta({
        description: "Required when using bearerAuth; resolved from session for cookieAuth",
        example: IDENTITY_EXAMPLE.userId,
      }),
      organizationId: z.string().optional().meta({
        description: "Required when using bearerAuth; falls back to session's active org for cookieAuth",
        example: IDENTITY_EXAMPLE.organizationId,
      }),
    }),
  },
  responses: {
    "200": {
      description: "Messages, newest first",
      content: { "application/json": { schema: lexMessageListSchema } },
    },
    ...errorResponses,
  },
};

const lexUploadSourcePost: ZodOpenApiOperationObject = {
  operationId: "lexUploadSource",
  summary: "Upload a legal document (PDF)",
  description:
    "Uploads a PDF via multipart form data. The server stores the file in R2, calls Lex's RAG ingestion, and persists a Source row. Returns the Source DTO with `sourceId`, `r2Url`, summary, and key topics.",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "multipart/form-data": {
        schema: z.object({
          file: z.string().meta({ format: "binary", description: "PDF file" }),
          documentName: z.string().min(1).max(200),
          documentType: z.string().max(100).optional(),
        }),
      },
    },
  },
  responses: {
    "200": {
      description: "Source DTO",
      content: { "application/json": { schema: sourceDtoSchema } },
    },
    ...errorResponses,
  },
};

const lexListSourcesGet: ZodOpenApiOperationObject = {
  operationId: "lexListSources",
  summary: "List uploaded Lex documents",
  tags: ["Lex"],
  responses: {
    "200": {
      description: "Array of Source DTOs ordered newest first",
      content: { "application/json": { schema: z.array(sourceDtoSchema) } },
    },
    ...errorResponses,
  },
};

const lexDeleteSourceOp: ZodOpenApiOperationObject = {
  operationId: "lexDeleteSource",
  summary: "Delete an uploaded Lex document",
  tags: ["Lex"],
  requestParams: {
    path: z.object({
      id: z.string().meta({ description: "The Source row id (uuid)" }),
    }),
  },
  responses: {
    "200": {
      description: "Confirmation of deletion",
      content: {
        "application/json": { schema: z.object({ deleted: z.literal(true) }) },
      },
    },
    ...errorResponses,
  },
};

const lexQueryDocumentPost: ZodOpenApiOperationObject = {
  operationId: "lexQueryDocument",
  summary: "Ask a question about an uploaded document",
  description:
    "Vector-similarity-retrieves chunks of an uploaded document filtered by `sourceId`, then asks the LLM to answer the user's question with chunk-level citations.",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(queryDocumentSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          sourceId: "doc_abc123",
          query: "What are the termination conditions?",
          topK: 5,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Answer with cited source chunks",
      content: { "application/json": { schema: queryDocumentResponseSchema } },
    },
    ...errorResponses,
  },
};

const lexAnalyzeContractPost: ZodOpenApiOperationObject = {
  operationId: "lexAnalyzeContract",
  summary: "Analyze a contract for risks",
  description:
    "Pass either `sourceId` (from a prior `/ingest-document` call) or raw `contractText`. Returns risk level, risks with clause-level severity, unusual clauses, missing protections, and an overall assessment.",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(analyzeContractSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          sourceId: "doc_abc123",
          contractText: "",
          analysisFocus: ["risk_assessment", "unusual_clauses"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Contract analysis with risks and disclaimer",
      content: { "application/json": { schema: analyzeContractResponseSchema } },
    },
    ...errorResponses,
  },
};

const lexDraftDocumentPost: ZodOpenApiOperationObject = {
  operationId: "lexDraftDocument",
  summary: "Draft a legal document template",
  description:
    "Generates a template for common legal documents (NDAs, MSAs, privacy policies, etc.). Output is marked DRAFT ONLY with review notes.",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(draftDocumentSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          documentType: "mutual_nda",
          requirements:
            "Mutual NDA between two SaaS companies for a potential partnership. 2-year term, covers product roadmap and customer data.",
          jurisdiction: "United States (Delaware)",
          additionalClauses: ["data_protection", "ip_assignment_exclusion"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Drafted document with review notes",
      content: { "application/json": { schema: draftDocumentResponseSchema } },
    },
    ...errorResponses,
  },
};

const lexExplainPost: ZodOpenApiOperationObject = {
  operationId: "lexExplain",
  summary: "Explain legal text in plain English",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(explainSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          text:
            "The Receiving Party agrees to hold the Confidential Information in strict confidence and not to disclose it to any third party without the prior written consent of the Disclosing Party.",
          context: "This is from an NDA we're about to sign with a potential investor",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Plain-English explanation with key terms and implications",
      content: { "application/json": { schema: explainResponseSchema } },
    },
    ...errorResponses,
  },
};

const lexLegalResearchPost: ZodOpenApiOperationObject = {
  operationId: "lexLegalResearch",
  summary: "Research laws, regulations, and case precedents",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(legalResearchSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          query:
            "What are the GDPR requirements for obtaining valid consent from users in the EU?",
          jurisdiction: "EU",
          legalAreas: ["data_privacy", "consent"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Applicable laws, cases, guidance, and confidence level",
      content: { "application/json": { schema: legalResearchResponseSchema } },
    },
    ...errorResponses,
  },
};

const lexComplianceCheckPost: ZodOpenApiOperationObject = {
  operationId: "lexComplianceCheck",
  summary: "Evaluate compliance against regulatory frameworks",
  description:
    "Checks a practice or document against frameworks like GDPR, CCPA, SOC2, HIPAA. Returns per-framework status, critical gaps, and prioritized remediation steps.",
  tags: ["Lex"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(complianceCheckSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          description:
            "We store EU user email addresses and behavioral analytics data on AWS US-East servers with 90-day retention and no explicit consent flow.",
          frameworks: ["GDPR", "CCPA"],
          businessContext: "B2B SaaS with EU and California customers",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Compliance assessment with remediation steps",
      content: { "application/json": { schema: complianceCheckResponseSchema } },
    },
    ...errorResponses,
  },
};

const lexChatPath: ZodOpenApiPathItemObject = {
  post: lexChatPost,
  get: lexChatGet,
};

// ── Vega response schemas (doc-only) ───────────────────────────────────────

const processedEmailSchema = z.object({
  email_id: z.string(),
  subject: z.string(),
  from_name: z.string(),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  summary: z.string(),
  suggested_action: z.string(),
  label_applied: z.string().nullable().optional(),
  draft_created: z.boolean().optional(),
  draft_id: z.string().nullable().optional(),
});

const inboxStatsSchema = z.object({
  total_processed: z.number().int(),
  urgent: z.number().int(),
  high: z.number().int(),
  medium: z.number().int(),
  low: z.number().int(),
  drafts_created: z.number().int(),
  labels_applied: z.number().int(),
});

const processInboxResponseSchema = z.object({
  processed: z.array(processedEmailSchema),
  stats: inboxStatsSchema,
  executed: z.number().int().optional(),
  errors: z.array(z.string()).optional(),
});

const draftReplyResponseSchema = z.object({
  draft: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    draft_id: z.string().optional(),
    saved: z.boolean().optional(),
  }),
  suggested_follow_up: z.string(),
  draft_id: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

const calendarSummaryResponseSchema = z.object({
  events: z.array(z.record(z.string(), z.unknown())),
  conflicts: z.array(z.record(z.string(), z.unknown())),
  free_slots: z.array(z.record(z.string(), z.unknown())),
  daily_summary: z.record(z.string(), z.unknown()),
});

const createEventResponseSchema = z.object({
  event: z.record(z.string(), z.unknown()),
  conflicts: z.array(z.record(z.string(), z.unknown())),
  google_event_id: z.string().optional(),
  created: z.boolean(),
  errors: z.array(z.string()).optional(),
});

const executiveBriefingResponseSchema = z.object({
  briefing: z.record(z.string(), z.unknown()),
});

const composeEmailResponseSchema = z.object({
  draft: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    draft_id: z.string().optional(),
  }),
  draft_id: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

const vegaMessageListSchema = z.array(
  z.object({
    role: z.string(),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    customInput: z.unknown().optional(),
  })
);

const vegaAssistantMessageResponseSchema = z.object({
  role: z.literal("assistant"),
  content: z.string(),
  imageUrl: z.string().optional(),
  nodeActionsExecuted: z.number().int().optional(),
  nodeActionErrors: z.array(z.string()).optional(),
  googleNotConnected: z.boolean().optional(),
  createdAt: z.string(),
});

// ── Vega Operations ────────────────────────────────────────────────────────

const vegaChatPost: ZodOpenApiOperationObject = {
  operationId: "vegaChat",
  summary: "Vega chat",
  description:
    "Conversational executive-assistant chat. If Google is connected, Vega can read emails, label, draft, and create events — the server fetches the user's Google access token automatically and executes any `node_actions` returned by the AI.",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(vegaSendMessageSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          content: "Summarize my inbox and schedule a 30-min demo with marcus@growthco.io Thursday 3pm ET.",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Assistant message with exec summary",
      content: { "application/json": { schema: vegaAssistantMessageResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaChatGet: ZodOpenApiOperationObject = {
  operationId: "vegaListMessages",
  summary: "List Vega messages for an organization",
  tags: ["Vega"],
  requestParams: {
    query: z.object({
      userId: z.string().optional().meta({
        description: "Required when using bearerAuth; resolved from session for cookieAuth",
        example: IDENTITY_EXAMPLE.userId,
      }),
      organizationId: z.string().optional().meta({
        description: "Required when using bearerAuth; falls back to session's active org for cookieAuth",
        example: IDENTITY_EXAMPLE.organizationId,
      }),
    }),
  },
  responses: {
    "200": {
      description: "Messages, newest first",
      content: { "application/json": { schema: vegaMessageListSchema } },
    },
    ...errorResponses,
  },
};

const vegaProcessInboxPost: ZodOpenApiOperationObject = {
  operationId: "vegaProcessInbox",
  summary: "Triage inbox: prioritize, label, and optionally draft replies",
  description:
    "Reads unread emails via the user's Gmail token, classifies them, and applies labels. Returns `executed` = number of server-side node_actions run.",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(processInboxSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          maxEmails: 20,
          autoLabel: true,
          draftReplies: false,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Triage results + execution summary",
      content: { "application/json": { schema: processInboxResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaDraftReplyPost: ZodOpenApiOperationObject = {
  operationId: "vegaDraftReply",
  summary: "Draft a Gmail reply (and optionally save it as a draft)",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(draftReplySchema),
        example: {
          ...IDENTITY_EXAMPLE,
          emailId: "msg_001",
          replyInstructions:
            "Accept the meeting, propose Thursday 3pm EST, attach our metrics deck",
          tone: "professional and enthusiastic",
          saveAsDraft: true,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Reply body + Gmail draft id (if saved)",
      content: { "application/json": { schema: draftReplyResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaCalendarSummaryPost: ZodOpenApiOperationObject = {
  operationId: "vegaCalendarSummary",
  summary: "Summarize upcoming calendar with conflicts + free slots",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(calendarSummarySchema),
        example: { ...IDENTITY_EXAMPLE, daysAhead: 7 },
      },
    },
  },
  responses: {
    "200": {
      description: "Calendar overview",
      content: { "application/json": { schema: calendarSummaryResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaCreateEventPost: ZodOpenApiOperationObject = {
  operationId: "vegaCreateEvent",
  summary: "Parse natural-language description and create a Google Calendar event",
  description:
    "Vega parses the description, checks for conflicts, and — on success — creates the event via the user's Calendar token. Returns the `google_event_id` and Meet link when applicable.",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(createEventSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          description:
            "Schedule a 30-minute call with marcus@growthco.io Wednesday at 10am EST. Add Google Meet.",
          checkConflicts: true,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Event result with Google event id and meet link",
      content: { "application/json": { schema: createEventResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaExecutiveBriefingPost: ZodOpenApiOperationObject = {
  operationId: "vegaExecutiveBriefing",
  summary: "Generate an executive daily briefing",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(executiveBriefingSchema),
        example: { ...IDENTITY_EXAMPLE, includeEmail: true, includeCalendar: true },
      },
    },
  },
  responses: {
    "200": {
      description: "Briefing payload",
      content: { "application/json": { schema: executiveBriefingResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaComposeEmailPost: ZodOpenApiOperationObject = {
  operationId: "vegaComposeEmail",
  summary: "Compose a new outbound Gmail draft",
  tags: ["Vega"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: withInternalIdentity(composeEmailSchema),
        example: {
          ...IDENTITY_EXAMPLE,
          to: "investor@accel.com",
          subject: "Veqiro AI — Monthly Update",
          instructions:
            "Write a concise investor update highlighting MRR growth to $58K and two new enterprise pilots. Request a 30-min call.",
          tone: "professional and enthusiastic",
          includeCta: true,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Composed draft + Gmail draft id",
      content: { "application/json": { schema: composeEmailResponseSchema } },
    },
    ...errorResponses,
  },
};

const vegaChatPath: ZodOpenApiPathItemObject = {
  post: vegaChatPost,
  get: vegaChatGet,
};

const integrationsDeleteOp: ZodOpenApiOperationObject = {
  operationId: "integrationsDisconnect",
  summary: "Disconnect (and best-effort revoke) a social account",
  tags: ["Integrations"],
  requestParams: {
    path: z.object({ id: z.string() }),
  },
  responses: {
    "204": { description: "Disconnected" },
    "401": { description: "Unauthorized" },
    "404": { description: "Integration not found or not owned by this org" },
  },
};

// ── Document ──────────────────────────────────────────────────────────────

export const openApiDocument = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Veqiro Server API",
    version: "1.0.0",
    description:
      "Veqiro agent endpoints (Sage for SEO, Scout for research). Two auth modes:\n\n" +
      "- **cookieAuth** (frontend): Better Auth session cookie. userId + organizationId are resolved from the session.\n" +
      "- **bearerAuth** (internal): `Authorization: Bearer <INTERNAL_API_KEY>` plus `userId` and `organizationId` in the request body or query string.",
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: "Local dev" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "Internal API key. Callers must also pass userId + organizationId in the body or query.",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Better Auth session cookie (frontend flow).",
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  tags: [
    { name: "Sage", description: "SEO agent — chat and tool endpoints" },
    { name: "Scout", description: "Research agent — chat and tool endpoints" },
    { name: "Maya", description: "Marketing & content agent — chat, drafts, and publishing" },
    { name: "Lex", description: "Legal & compliance agent — contracts, drafting, research, and compliance" },
    { name: "Vega", description: "Executive assistant agent — inbox, calendar, briefings (Gmail + Calendar)" },
    {
      name: "Integrations",
      description:
        "OAuth flows for connecting social platforms (X, LinkedIn, Instagram) that Maya publishes to.",
    },
  ],
  paths: {
    "/api/v1/agents/sage/chat": sageChatPath,
    "/api/v1/agents/sage/keyword-research": { post: keywordResearchPost },
    "/api/v1/agents/sage/generate-blog": { post: generateBlogPost },
    "/api/v1/agents/sage/analyze-content": { post: analyzeContentPost },
    "/api/v1/agents/sage/content-brief": { post: contentBriefPost },
    "/api/v1/agents/scout/chat": scoutChatPath,
    "/api/v1/agents/scout/research-topic": { post: scoutResearchTopicPost },
    "/api/v1/agents/scout/research-company": { post: scoutResearchCompanyPost },
    "/api/v1/agents/scout/trending-topics": { post: scoutTrendingTopicsPost },
    "/api/v1/agents/maya/chat": mayaChatPath,
    "/api/v1/agents/maya/generate-ideas": { post: mayaGenerateIdeasPost },
    "/api/v1/agents/maya/draft-content": { post: mayaDraftContentPost },
    "/api/v1/agents/maya/generate-variants": { post: mayaGenerateVariantsPost },
    "/api/v1/agents/maya/revise": { post: mayaRevisePost },
    "/api/v1/agents/maya/regenerate-image": { post: mayaRegenerateImagePost },
    "/api/v1/agents/maya/regenerate-content": { post: mayaRegenerateContentPost },
    "/api/v1/agents/maya/publish": { post: mayaPublishPost },
    "/api/v1/agents/lex/chat": lexChatPath,
    "/api/v1/agents/lex/sources/upload": { post: lexUploadSourcePost },
    "/api/v1/agents/lex/sources": { get: lexListSourcesGet },
    "/api/v1/agents/lex/sources/{id}": { delete: lexDeleteSourceOp },
    "/api/v1/agents/lex/analyze-contract": { post: lexAnalyzeContractPost },
    "/api/v1/agents/lex/query-document": { post: lexQueryDocumentPost },
    "/api/v1/agents/lex/draft-document": { post: lexDraftDocumentPost },
    "/api/v1/agents/lex/explain": { post: lexExplainPost },
    "/api/v1/agents/lex/legal-research": { post: lexLegalResearchPost },
    "/api/v1/agents/lex/compliance-check": { post: lexComplianceCheckPost },
    "/api/v1/agents/vega/chat": vegaChatPath,
    "/api/v1/agents/vega/process-inbox": { post: vegaProcessInboxPost },
    "/api/v1/agents/vega/draft-reply": { post: vegaDraftReplyPost },
    "/api/v1/agents/vega/calendar-summary": { post: vegaCalendarSummaryPost },
    "/api/v1/agents/vega/create-event": { post: vegaCreateEventPost },
    "/api/v1/agents/vega/executive-briefing": { post: vegaExecutiveBriefingPost },
    "/api/v1/agents/vega/compose-email": { post: vegaComposeEmailPost },
    "/api/v1/integrations": { get: integrationsListGet },
    "/api/v1/integrations/{platform}/authorize": { get: integrationsAuthorizeGet },
    "/api/v1/integrations/{platform}/callback": { get: integrationsCallbackGet },
    "/api/v1/integrations/{id}": { delete: integrationsDeleteOp },
  },
});
