import { z } from "zod";
import {
  sendMessageSchema,
  keywordResearchSchema,
  generateBlogSchema,
  analyzeContentSchema,
  contentBriefSchema,
} from "./sage.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type KeywordResearchInput = z.infer<typeof keywordResearchSchema>;
export type GenerateBlogInput = z.infer<typeof generateBlogSchema>;
export type AnalyzeContentInput = z.infer<typeof analyzeContentSchema>;
export type ContentBriefInput = z.infer<typeof contentBriefSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url: string };
  tokens_used?: number;
  model_used?: string;
}

// Mirrors the AI service's response shapes (snake_case preserved — proxied verbatim)
export interface KeywordItem {
  keyword: string;
  search_intent: string;
  estimated_difficulty: number;
  relevance_score: number;
  suggested_content_type: string;
  related_keywords: string[];
}

export interface KeywordCluster {
  cluster_name: string;
  keywords: string[];
  primary_intent: string;
}

export interface KeywordResearchResponse {
  keywords: KeywordItem[];
  clusters: KeywordCluster[];
}

export interface BlogContent {
  title: string;
  meta_title: string;
  meta_description: string;
  slug: string;
  content: string;
  word_count: number;
  headings: string[];
  target_keyword: string;
  secondary_keywords: string[];
  schema_markup?: Record<string, unknown> | null;
  wordpress_format?: Record<string, unknown> | null;
  wix_format?: Record<string, unknown> | null;
}

export interface GenerateBlogResponse {
  blog: BlogContent;
  seo_score: number;
  seo_suggestions: string[];
}

export interface ContentAnalysisResponse {
  score: number;
  issues: string[];
  improvements: string[];
  missing_keywords: string[];
  readability_grade: string;
}

export interface ContentBriefResponse {
  brief: Record<string, unknown>;
}
