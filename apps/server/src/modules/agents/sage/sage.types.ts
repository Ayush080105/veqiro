import { z } from "zod";
import {
  sendMessageSchema,
  keywordResearchSchema,
  generateBlogSchema,
  analyzeContentSchema,
  contentBriefSchema,
  generateBlogIdeasSchema,
  serpAnalysisSchema,
  topicalMapSchema,
  metaOptimizerSchema,
  pageSeoAuditSchema,
  discoverPagesSchema,
  siteAuditSchema,
} from "./sage.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type KeywordResearchInput = z.infer<typeof keywordResearchSchema>;
export type GenerateBlogInput = z.infer<typeof generateBlogSchema>;
export type AnalyzeContentInput = z.infer<typeof analyzeContentSchema>;
export type ContentBriefInput = z.infer<typeof contentBriefSchema>;
export type GenerateBlogIdeasInput = z.infer<typeof generateBlogIdeasSchema>;
export type SerpAnalysisInput = z.infer<typeof serpAnalysisSchema>;
export type TopicalMapInput = z.infer<typeof topicalMapSchema>;
export type MetaOptimizerInput = z.infer<typeof metaOptimizerSchema>;
export type PageSeoAuditInput = z.infer<typeof pageSeoAuditSchema>;
export type DiscoverPagesInput = z.infer<typeof discoverPagesSchema>;
export type SiteAuditInput = z.infer<typeof siteAuditSchema>;

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
  tokens_used?: number;
  model_used?: string;
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
  tokens_used?: number;
  model_used?: string;
}

export interface ContentAnalysisResponse {
  score: number;
  issues: string[];
  improvements: string[];
  missing_keywords: string[];
  readability_grade: string;
  word_count?: number;
  keyword_density?: string;
  tokens_used?: number;
  model_used?: string;
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
  tokens_used?: number;
  model_used?: string;
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
  tokens_used?: number;
  model_used?: string;
}

export interface SerpAnalysisResponse {
  keyword: string;
  serp_features: string[];
  paa_questions: string[];
  top_result_formats: string[];
  recommended_format: string;
  recommended_word_count_range: string;
  featured_snippet_opportunity: boolean;
  featured_snippet_tip: string;
  competition_assessment: string;
  content_angle: string;
  tokens_used?: number;
  model_used?: string;
}

export interface ClusterPage {
  title: string;
  target_keyword: string;
  content_type: string;
  funnel_stage: string;
  search_intent: string;
  estimated_difficulty: number;
  priority: number;
}

export interface TopicalMapResponse {
  pillar_topic: string;
  pillar_page: ClusterPage | null;
  cluster_pages: ClusterPage[];
  strategy_summary: string;
  estimated_weeks_to_authority: string;
  quick_win_page: ClusterPage | null;
  tokens_used?: number;
  model_used?: string;
}

export interface MetaAlternative {
  meta_title: string;
  meta_description: string;
}

export interface MetaOptimizerResponse {
  meta_title: string;
  meta_title_chars: number;
  meta_description: string;
  meta_description_chars: number;
  alternatives: MetaAlternative[];
  ctr_tips: string[];
  tokens_used?: number;
  model_used?: string;
}

// ─── Page SEO Audit ───────────────────────────────────────────────────────────

export interface UrlAnalysis {
  url: string; is_https: boolean; keyword_in_slug: boolean;
  url_length: number; url_depth: number; has_stop_words: boolean;
  slug: string; score: number; issues: string[];
}

export interface TechnicalSeoAudit {
  score: number; title: string; title_length: number; title_has_keyword: boolean; title_has_brand: boolean;
  meta_description: string; meta_description_length: number; meta_description_has_keyword: boolean; meta_description_has_cta: boolean;
  has_canonical: boolean; canonical_url: string | null; canonical_is_self: boolean;
  is_indexable: boolean; is_followable: boolean;
  h1_count: number; h1_text: string; h1_has_keyword: boolean;
  h2_count: number; h3_count: number; keyword_in_h2: boolean;
  heading_hierarchy_valid: boolean; heading_hierarchy_issues: string[];
  has_schema_markup: boolean; schema_types: string[]; schema_issues: string[];
  schema_eligible_rich_results: string[];
  has_og_tags: boolean; og_title: string; og_description: string; og_image: string;
  has_twitter_card: boolean; has_viewport: boolean; has_hreflang: boolean; has_preconnect_hints: boolean;
  issues: string[];
}

export interface SpeedSignals {
  score: number; render_blocking_scripts: number; render_blocking_stylesheets: number;
  total_external_requests: number; images_lazy_loaded: number; images_not_lazy_loaded: number;
  images_using_modern_format: number; images_total: number;
  has_inline_critical_css: boolean; has_font_preloading: boolean; issues: string[];
}

export interface ImageSeoAudit {
  score: number; images_total: number; images_missing_alt: number;
  images_with_descriptive_alt: number; images_with_generic_alt: number;
  images_with_keyword_filename: number; images_with_dimensions: number; images_without_dimensions: number;
  webp_avif_percentage: number; issues: string[];
}

export interface OnPageSeoAudit {
  score: number; word_count: number; reading_time_minutes: number;
  keyword_density: string; keyword_occurrences: number;
  keyword_in_title: boolean; keyword_in_h1: boolean; keyword_in_meta: boolean;
  keyword_in_first_100_words: boolean; keyword_in_h2s: boolean; keyword_in_last_paragraph: boolean;
  lsi_keywords_found: string[]; lsi_keywords_missing: string[];
  paa_answered: string[]; paa_unanswered: string[];
  has_featured_snippet_structure: boolean; featured_snippet_type: string | null;
  has_faq_section: boolean; content_freshness: string | null; last_modified: string | null;
  readability_grade: string; content_depth_assessment: string;
  anchor_text_generic_count: number; anchor_text_descriptive_count: number;
  issues: string[]; improvements: string[];
}

export interface EeatAudit {
  score: number; has_author_byline: boolean; has_author_bio: boolean;
  has_publication_date: boolean; has_updated_date: boolean;
  has_external_citations: boolean; citation_count: number; has_authoritative_citations: boolean;
  has_trust_links: boolean; has_social_proof_schema: boolean;
  credentials_signals: string[]; missing_signals: string[]; issues: string[];
}

export interface CompetitorSnapshot {
  url: string; title: string; meta_description: string;
  word_count_estimate: number; main_h2s: string[];
  schema_types: string[]; main_topics: string[];
}

export interface CompetitiveSeoAudit {
  score: number; serp_features_present: string[]; serp_features_missing: string[];
  avg_competitor_word_count: number; your_word_count: number; word_count_gap: number;
  word_count_verdict: string; top_competitors: CompetitorSnapshot[];
  content_gaps: string[]; unique_angle_opportunity: string;
  featured_snippet_holder: string | null; featured_snippet_format: string | null;
  featured_snippet_tip: string; paa_questions: string[]; competitor_schema_types: string[];
}

export interface PageSeoAuditResponse {
  url: string; target_keyword: string; overall_score: number;
  url_analysis: UrlAnalysis; technical: TechnicalSeoAudit;
  speed_signals: SpeedSignals; image_seo: ImageSeoAudit;
  on_page: OnPageSeoAudit; eeat: EeatAudit; competitive: CompetitiveSeoAudit;
  critical_issues: string[]; high_priority: string[]; medium_priority: string[]; quick_wins: string[];
  mentor_summary: string; next_move: string;
  action_plan_30d: string[]; action_plan_60d: string[]; action_plan_90d: string[];
  tokens_used?: number; model_used?: string;
}

// ─── Discover Pages ───────────────────────────────────────────────────────────

export interface DiscoveredPage {
  url: string;
  title: string;
  status_code: number;
}

export interface DiscoverPagesResponse {
  domain: string;
  pages: DiscoveredPage[];
  total_found: number;
  sitemap_found: boolean;
}

// ─── Batch Page Audit (site-audit action) ─────────────────────────────────────

export interface SiteAuditResponse {
  domain: string;
  total_audited: number;
  results: PageSeoAuditResponse[];
  tokens_used?: number;
  model_used?: string;
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
