import { z } from "zod";
import {
  sendMessageSchema,
  keywordResearchSchema,
  generateBlogSchema,
  analyzeContentSchema,
  contentBriefSchema,
  generateBlogIdeasSchema,
} from "./sage.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type KeywordResearchInput = z.infer<typeof keywordResearchSchema>;
export type GenerateBlogInput = z.infer<typeof generateBlogSchema>;
export type AnalyzeContentInput = z.infer<typeof analyzeContentSchema>;
export type ContentBriefInput = z.infer<typeof contentBriefSchema>;
export type GenerateBlogIdeasInput = z.infer<typeof generateBlogIdeasSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url?: string; image_base64?: string; content_type?: string; prompt_used?: string };
  tokens_used?: number;
  model_used?: string;
  action_id?: string;
  action_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Mirrors the AI service's response shapes (snake_case preserved — proxied verbatim)
export interface KeywordItem {
  keyword: string;
  search_intent: string;
  estimated_difficulty: number;
  relevance_score: number;
  suggested_content_type: string;
  related_keywords: string[];
  search_volume_estimate?: string;
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
  word_count?: number;
  keyword_density?: string;
}

export interface ContentBriefData {
  search_intent: string;
  recommended_word_count: number;
  content_type: string;
  title_options: string[];
  h2_structure: string[];
  must_include_topics: string[];
  must_answer_questions: string[];
  competitor_gaps: string[];
  internal_linking_opportunities: string[];
  cta_recommendation: string;
  estimated_traffic_potential: string;
  serp_features: string[];
  topical_authority_tip: string;
}

export interface ContentBriefResponse {
  brief: ContentBriefData;
}

export interface BlogIdeaItem {
  title: string;
  topic: string;
  target_keyword: string;
  secondary_keywords: string[];
  rationale: string;
  content_angle: string;
  estimated_difficulty: number;
}

export interface GenerateBlogIdeasResponse {
  ideas: BlogIdeaItem[];
  generated_at: string;
}

export interface SavedKeyword {
  id: string;
  organizationId: string;
  keyword: string;
  searchIntent: string;
  estimatedDifficulty: number;
  relevanceScore: number;
  searchVolumeEstimate?: string | null;
  suggestedContentType: string;
  createdAt: Date;
}
