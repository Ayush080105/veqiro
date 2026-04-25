// Typed contracts mirroring FastAPI Pydantic models. Frontend calls Express at
// /api/v1/{agent}/{action}; Express is expected to forward to FastAPI and
// return the FastAPI response unchanged (matching today's Sage pattern).

import type { AgentSlug } from "./index"

// ─── Shared ──────────────────────────────────────────────────────────────────

export interface DataPoint {
  date: string // ISO date
  value: number
}

export type ContentPlatform = "linkedin" | "twitter" | "instagram"

// ─── Sage ────────────────────────────────────────────────────────────────────

export interface SageKeywordResearchRequest {
  seed_topic: string
  niche?: string
  competitor_urls?: string[]
  count?: number
}

export interface KeywordItem {
  keyword: string
  search_intent: string
  estimated_difficulty: number
  relevance_score: number
  suggested_content_type: string
  related_keywords: string[]
}

export interface KeywordCluster {
  cluster_name: string
  keywords: KeywordItem[]
  primary_intent: string
}

export interface SageKeywordResearchResult {
  keywords: KeywordItem[]
  clusters: KeywordCluster[]
}

export interface SageGenerateBlogRequest {
  topic: string
  target_keyword: string
  secondary_keywords?: string[]
  word_count?: number
  output_format?: "markdown" | "html" | "wordpress" | "wix"
  include_meta?: boolean
  include_schema_markup?: boolean
  tone_override?: string
}

export interface SageGenerateBlogResult {
  blog: {
    title: string
    meta_title?: string
    meta_description?: string
    slug?: string
    content: string
    word_count: number
    headings: string[]
    target_keyword: string
    secondary_keywords: string[]
    schema_markup?: string
    wordpress_format?: string
    wix_format?: string
  }
  seo_score: number
  seo_suggestions: string[]
}

export interface SageAnalyzeContentRequest {
  content: string
  target_keyword: string
  url?: string
}

export interface SageContentAnalysisResult {
  score: number
  issues: string[]
  improvements: string[]
  missing_keywords: string[]
  readability_grade: string
}

export interface SageContentBriefRequest {
  topic: string
  target_keyword: string
  competitor_urls?: string[]
}

export interface SageContentBriefResult {
  brief: {
    search_intent: string
    recommended_word_count: number
    content_type: string
    title_options: string[]
    h2_structure: string[]
    must_include_topics: string[]
    must_answer_questions: string[]
    competitor_gaps: string[]
    internal_linking_opportunities: string[]
    cta_recommendation: string
    estimated_traffic_potential: string
  }
}

// ─── Maya ────────────────────────────────────────────────────────────────────

export interface MayaIdeationRequest {
  platform: ContentPlatform
  topic_hint?: string
  count?: number
}

export interface ContentIdea {
  title: string
  content_type: string
  platform: ContentPlatform
  hook: string
  predicted_engagement: string
  reasoning: string
  suggested_hashtags: string[]
}

export interface MayaIdeationResult {
  ideas: ContentIdea[]
  generated_at: string
}

export interface MayaDraftRequest {
  topic: string
  platform: ContentPlatform
  tone_override?: string
  word_count_target?: number
  include_image?: boolean
  use_logo?: boolean
  use_mascot?: boolean
  additional_context?: string
}

export interface ImageResult {
  image_base64?: string
  image_url?: string
  content_type: string
  prompt_used: string
}

export interface MayaDraftResult {
  draft: {
    title?: string
    body: string
    hashtags: string[]
    cta: string
    meta_description?: string
    word_count: number
    platform: ContentPlatform
    tone_used?: string
  }
  image?: ImageResult | null
}

export interface MayaVariantRequest {
  original_content: string
  original_platform: ContentPlatform
  target_platforms: ContentPlatform[]
  include_images?: boolean
}

export interface MayaVariantResult {
  variants: Array<{
    platform: ContentPlatform
    title?: string
    body: string
    hashtags: string[]
    char_count: number
    image?: ImageResult | null
  }>
}

export interface MayaReviseRequest {
  original_content: string
  platform: ContentPlatform
  feedback: string
  specific_instructions?: string
}

export interface MayaReviseResult {
  revised: {
    title?: string
    body: string
    hashtags: string[]
    cta: string
  }
  changes_made: string[]
  platform: ContentPlatform
}

export interface MayaImageRegenRequest {
  image_url: string
  prompt: string
  platform: ContentPlatform
  use_logo?: boolean
  use_mascot?: boolean
}

export interface MayaImageRegenResult {
  image: ImageResult
}

export interface MayaContentRegenRequest {
  caption: string
  prompt: string
  platform: ContentPlatform
}

export interface MayaContentRegenResult {
  caption: string
  hashtags: string[]
  cta: string
  platform: ContentPlatform
}

// ─── Scout ───────────────────────────────────────────────────────────────────

export interface ScoutCompetitorWatch {
  id: string
  name: string
  url: string
  latestHash: string | null
  lastScannedAt: string | null
  createdAt: string
}

export interface ScoutResearchTopicRequest {
  topic: string
  depth?: "quick" | "standard" | "deep"
  sources_hint?: string[]
}

export interface ScoutResearchTopicResult {
  bottom_line: string
  market_overview: string
  key_players: Array<{ name: string; role?: string; note?: string }>
  opportunities: string[]
  risks: string[]
  key_stats: Array<{ label: string; value: string }>
  emerging_trends: string[]
  target_customers: string
  recommended_actions: string[]
  sources_scraped: string[]
  keywords_found: string[]
}

export interface ScoutResearchCompanyRequest {
  company_name: string
  company_url?: string
}

export interface CompanyProfile {
  name: string
  description: string
  founded?: string
  team_size?: string
  funding?: string
  key_features: string[]
  pricing?: Record<string, string>
  target_market?: string
  strengths: string[]
  weaknesses: string[]
  recent_news: string[]
}

export interface ScoutResearchCompanyResult {
  company: CompanyProfile
  scraped_at: string
}

export interface ScoutTrendingTopicsRequest {
  industry: string
  count?: number
}

export interface ScoutTrendingTopicsResult {
  trends: Array<{
    topic: string
    momentum: "rising" | "stable" | "declining"
    relevance_score: number
    search_volume_estimate: string
    why_trending?: string
    market_size?: string
    target_audience?: string
    key_players?: string[]
    opportunity?: string
    key_challenges?: string[]
    time_horizon?: string
    related_trends?: string[]
    content_angle?: string
    content_hook?: string
    next_steps?: string[]
  }>
  generated_at: string
}

export interface ScoutDiscoverCompetitorsRequest {
  description: string
  industry: string
  count?: number
}

export interface ScoutDiscoverCompetitorsResult {
  competitors: Array<{
    name: string
    url: string
    why_competitive: string
    pricing_model: string
  }>
  generated_at: string
}

// ─── Rex ─────────────────────────────────────────────────────────────────────

export interface RexAnalyzeMetricsRequest {
  metrics: Record<string, DataPoint[]>
  period?: "daily" | "weekly" | "monthly" | "quarterly"
}

export interface RexAnalyzeMetricsResult {
  analysis: {
    summary: string
    trend: "up" | "down" | "flat"
    anomalies: string[]
    insights: string[]
    health_indicator: "red" | "amber" | "green"
  }
  charts_data: Record<string, DataPoint[]>
}

export interface RexForecastRequest {
  metric_name: string
  historical_data: DataPoint[]
  horizon_days?: number
}

export interface RexForecastResult {
  forecast: Array<{ date: string; value: number; lower_bound: number; upper_bound: number }>
  confidence: number
  methodology: string
  summary: string
}

export interface RexFinancialAnalysisRequest {
  revenue_data: DataPoint[]
  expenses_data?: DataPoint[]
  subscribers_data?: DataPoint[]
}

export interface RexFinancialAnalysisResult {
  metrics: {
    mrr?: number
    arr?: number
    growth_rate?: number
    growth_rate_pct?: number
    churn_rate?: number
    churn_rate_pct?: number
    burn_rate?: number
    net_burn?: number
    runway_months?: number
    is_profitable?: boolean
  }
  health_indicator: "red" | "amber" | "green"
  narrative: string
  recommendations: string[]
}

export interface RexBriefingRequest {
  date: string
  all_metrics: Record<string, DataPoint[]>
  agent_summaries: Record<string, string>
}

export interface RexBriefingResult {
  briefing: {
    date: string
    headline: string
    sections: Record<string, string>
    generated_at: string
  }
}

// ─── Lex ─────────────────────────────────────────────────────────────────────

/** A Lex Source row as returned by the server (camelCase). */
export interface LexSource {
  id: string
  sourceId: string
  name: string
  type: string
  typeDetected: string | null
  r2Url: string
  sizeBytes: number
  pageCount: number
  chunksCreated: number
  summary: string
  keyTopics: string[]
  createdAt: string
}

/** Form value for the upload-source action — `file` is local-only (not serialised to JSON). */
export interface LexUploadSourceRequest {
  file: File | null
  document_name: string
  document_type?: string
}

/** Result the upload-source action card renders (the server's Source DTO). */
export type LexUploadSourceResult = LexSource

export interface LexAnalyzeContractRequest {
  source_id?: string
  contract_text: string
  analysis_focus?: string[]
}

export interface LexQueryDocumentRequest {
  sourceId: string
  query: string
  topK?: number
}

export interface LexQueryDocumentChunk {
  content: string
  score: number
  metadata?: Record<string, unknown>
}

export interface LexQueryDocumentResult {
  answer: string
  sources: LexQueryDocumentChunk[]
  tokens_used?: number
  model_used?: string
}

export interface LexAnalyzeContractResult {
  analysis: {
    summary: string
    risk_level: "low" | "medium" | "high"
    risks: Array<{ clause: string; risk: string; severity: "low" | "medium" | "high" }>
    unusual_clauses: string[]
    missing_protections: string[]
    key_terms: Record<string, string>
    overall_assessment: string
  }
  disclaimer: string
}

export interface LexDraftDocumentRequest {
  document_type: string
  requirements: string
  jurisdiction?: string
  additional_clauses?: string[]
}

export interface LexDraftDocumentResult {
  document: string
  review_notes: string[]
  disclaimer: string
}

export interface LexExplainRequest {
  text: string
  context?: string
}

export interface LexExplainResult {
  explanation: string
  key_terms: Record<string, string>
  related_concepts: string[]
  practical_implications: string[]
}

export interface LexLegalResearchRequest {
  query: string
  jurisdiction?: string
  legal_areas?: string[]
}

export interface LexLegalResearchResult {
  summary: string
  applicable_laws: string[]
  key_requirements: string[]
  relevant_cases: string[]
  practical_guidance: string[]
  jurisdiction_notes: string
  confidence_level: string
  disclaimer: string
}

export interface LexComplianceCheckRequest {
  description: string
  frameworks: string[]
  business_context?: string
}

export interface LexComplianceCheckResult {
  overall_status: string
  framework_results: Array<{
    framework: string
    status: string
    gaps: string[]
    requirements: string[]
  }>
  critical_gaps: string[]
  remediation_steps: Array<{ priority: "low" | "medium" | "high"; action: string }>
  estimated_effort: string
  disclaimer: string
}

// ─── Vega ────────────────────────────────────────────────────────────────────

export interface VegaProcessInboxRequest {
  max_emails?: number
  auto_label?: boolean
  draft_replies?: boolean
}

export interface ProcessedEmail {
  email_id: string
  subject: string
  from_name: string
  priority: "urgent" | "high" | "medium" | "low"
  summary: string
  suggested_action: string
  label_applied?: string
  draft_created: boolean
  draft_id?: string
}

export interface VegaProcessInboxResult {
  processed: ProcessedEmail[]
  stats: {
    total_processed: number
    urgent: number
    high: number
    medium: number
    low: number
    drafts_created: number
    labels_applied: number
  }
}

export interface VegaDraftReplyRequest {
  email_id: string
  reply_instructions: string
  tone?: string
  save_as_draft?: boolean
}

export interface VegaDraftReplyResult {
  draft: { to: string; subject: string; body: string; draft_id?: string; saved: boolean }
  suggested_follow_up: string
}

export interface VegaCalendarSummaryRequest {
  days_ahead?: number
}

export interface VegaCalendarSummaryResult {
  events: Array<{ id: string; title: string; start: string; end: string; attendees?: string[] }>
  conflicts: Array<{ event_a: string; event_b: string; overlap_minutes: number }>
  free_slots: Array<{ start: string; end: string }>
  daily_summary: Record<string, string>
}

export interface VegaCreateEventRequest {
  description: string
  check_conflicts?: boolean
}

export interface VegaCreateEventResult {
  event: {
    id: string
    title: string
    start: string
    end: string
    attendees?: string[]
    meet_link?: string
    status: string
  }
  conflicts: string[]
  google_event_id?: string
  created: boolean
}

export interface VegaExecutiveBriefingRequest {
  include_email?: boolean
  include_calendar?: boolean
}

export interface VegaExecutiveBriefingResult {
  briefing: {
    date: string
    good_morning: string
    priority_score: number
    urgent_actions: string[]
    today_schedule: Array<{ time: string; title: string }>
    upcoming_this_week: Array<{ day: string; title: string }>
    email_summary: string
    free_time_today: string
    focus_recommendation: string
    generated_at: string
  }
}

export interface VegaComposeEmailRequest {
  to: string
  subject: string
  instructions: string
  tone?: string
  include_cta?: boolean
}

export interface VegaComposeEmailResult {
  draft: { to: string; subject: string; body: string; draft_id?: string }
  draft_id?: string
  errors?: string[]
}

// ─── Union result type (discriminated by action id) ─────────────────────────

export type AgentActionId =
  | "sage:keyword-research"
  | "sage:generate-blog"
  | "sage:analyze-content"
  | "sage:content-brief"
  | "maya:generate-ideas"
  | "maya:draft-content"
  | "maya:generate-variants"
  | "maya:revise"
  | "maya:regenerate-image"
  | "maya:regenerate-content"
  | "scout:research-topic"
  | "scout:research-company"
  | "scout:trending-topics"
  | "scout:discover-competitors"
  | "rex:analyze-metrics"
  | "rex:forecast"
  | "rex:financial-analysis"
  | "rex:compile-briefing"
  | "lex:upload-source"
  | "lex:analyze-contract"
  | "lex:query-document"
  | "lex:draft-document"
  | "lex:explain"
  | "lex:legal-research"
  | "lex:compliance-check"
  | "vega:process-inbox"
  | "vega:draft-reply"
  | "vega:calendar-summary"
  | "vega:create-event"
  | "vega:executive-briefing"
  | "vega:compose-email"

export interface ActionMessagePayload {
  actionId: AgentActionId
  agentSlug: AgentSlug
  input: unknown
  result: unknown
}
