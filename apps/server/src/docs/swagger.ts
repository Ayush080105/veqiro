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

// ── Document ──────────────────────────────────────────────────────────────

export const openApiDocument = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Veqiro Server API",
    version: "1.0.0",
    description:
      "Sage SEO agent endpoints. Two auth modes:\n\n" +
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
  tags: [{ name: "Sage", description: "SEO agent — chat and tool endpoints" }],
  paths: {
    "/api/v1/agents/sage/chat": sageChatPath,
    "/api/v1/agents/sage/keyword-research": { post: keywordResearchPost },
    "/api/v1/agents/sage/generate-blog": { post: generateBlogPost },
    "/api/v1/agents/sage/analyze-content": { post: analyzeContentPost },
    "/api/v1/agents/sage/content-brief": { post: contentBriefPost },
  },
});
