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
  search_volume_estimate?: string
}

export interface KeywordCluster {
  cluster_name: string
  keywords: string[]
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
  word_count?: number
  keyword_density?: string
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
    serp_features: string[]
    topical_authority_tip: string
  }
}

// ─── Maya ────────────────────────────────────────────────────────────────────

export interface MayaIdeationRequest {
  platform: ContentPlatform
  topic_hint?: string
  count?: number
  use_brandkit?: boolean
}

export interface ContentIdea {
  title: string
  content_type: string
  platform: ContentPlatform
  hook: string
  predicted_engagement: string
  reasoning: string
  suggested_hashtags: string[]
  visual_description?: string
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
  _previousImage?: ImageResult | null
}

export interface MayaCarouselSlide {
  slide_number: number
  image?: ImageResult | null
}

export interface MayaCarouselDraftResult {
  draft: MayaDraftResult["draft"]   // single caption for the whole post
  slides: MayaCarouselSlide[]       // one image per swipeable slide
  platform: ContentPlatform
  tokens_used?: number
  model_used?: string
}

export interface MayaCarouselDraftRequest {
  topic: string
  platform: ContentPlatform
  carousel_count?: number
  tone_override?: string
  include_images?: boolean
  use_logo?: boolean
  use_mascot?: boolean
  additional_context?: string
  image_aspect_ratio?: string
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
  _originalImage?: ImageResult | null
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
  platform?: ContentPlatform
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
  location?: string
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
  location?: string
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
  location?: string
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

export interface RexAnomalyItem {
  date: string
  value: number
  z_score: number
  direction: "spike" | "dip"
  severity: "high" | "medium"
  correlated_with?: string[]
  root_cause_hypothesis?: string
}

export interface RexAnalyzeMetricsResult {
  analysis: {
    summary: string
    trend: "up" | "down" | "flat"
    anomalies: RexAnomalyItem[]
    insights: string[]
    health_indicator: "red" | "amber" | "green"
  }
  charts_data: Record<string, DataPoint[]>
  data_points_analyzed?: number
  confidence_level?: "high" | "medium" | "low"
}

export interface RexRawTable {
  headers: string[]
  rows: Record<string, string>[]
  columnTypes: Record<string, "date" | "numeric" | "categorical" | "text">
}

export interface RexDatasetRecord {
  id: string
  organizationId: string
  name: string
  metricKey: string
  unit: string | null
  period: string
  purpose: "actual" | "budget"
  points: DataPoint[]
  meta?: { rawTable?: RexRawTable } | null
  createdAt: string
  updatedAt: string
}

export interface RexQueryDatasetChartSpec {
  type: "bar" | "line" | "pie" | "scatter" | "table"
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKeys: Array<{ key: string; label: string; color: string }>
}

export interface RexQueryDatasetRequest {
  query: string
}

export interface RexQueryDatasetResult {
  answer: string
  chart?: RexQueryDatasetChartSpec
  tokens_used?: number
  model_used?: string
}

export interface RexAnalyzeDatasetRequest {
  dataset_id: string
}

export interface RexColumnStat {
  min?: number
  max?: number
  mean?: number
  unique_count?: number
  sample_values?: string[]
}

export interface RexAnalyzeDatasetResult {
  summary: string
  key_findings: string[]
  column_stats: Record<string, RexColumnStat>
  insights: string[]
  recommendations: string[]
  chart?: RexQueryDatasetChartSpec
  tokens_used?: number
  model_used?: string
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
  data_points_analyzed?: number
  confidence_level?: "high" | "medium" | "low"
  health_indicator: "red" | "amber" | "green"
  narrative: string
  recommendations: string[]
}

export interface RexBriefingRequest {
  date: string
  all_metrics: Record<string, DataPoint[]>
  agent_summaries: Record<string, string>
}

export interface RexBriefingSectionObj {
  status?: "green" | "amber" | "red"
  summary?: string
  key_actions?: string[]
}

export interface RexBriefingResult {
  briefing: {
    date: string
    headline: string
    sections: Record<string, string | RexBriefingSectionObj>
    generated_at: string
  }
}

export interface RexRunwayRequest {
  cash_on_hand: number
  monthly_burn: number
  monthly_revenue?: number
  growth_rate_pct?: number
}

export interface RexRunwayScenario {
  name: string
  months: number | null
  date_of_zero: string
  assumption: string
}

export interface RexRunwayResult {
  months_remaining: number | null
  date_of_zero: string
  cash_on_hand: number
  monthly_burn: number
  monthly_revenue: number
  net_burn: number
  scenarios: RexRunwayScenario[]
  verdict: "red" | "amber" | "green"
  recommendation: string
}

export interface RexUnitEconomicsRequest {
  marketing_spend: DataPoint[]
  new_customers: DataPoint[]
  avg_monthly_revenue_per_customer: number
  avg_customer_lifetime_months?: number
}

export interface RexUnitEconomicsResult {
  cac: number
  ltv: number
  ltv_cac_ratio: number
  payback_months: number
  total_spend_analyzed: number
  total_new_customers_analyzed: number
  arpu: number
  lifetime_months: number
  ltv_cac_health: "red" | "amber" | "green"
  payback_health: "red" | "amber" | "green"
  health: "red" | "amber" | "green"
  benchmark_context: string
  recommendations: string[]
}

export interface RexScenarioChange {
  burn_delta?: number
  mrr_delta?: number
  growth_rate_override?: number
}

export interface RexScenarioItem {
  name: string
  changes: RexScenarioChange
}

export interface RexScenarioRequest {
  base_metrics: {
    mrr: number
    burn: number
    cash: number
    growth_rate: number
  }
  scenarios: RexScenarioItem[]
}

export interface RexScenarioResultItem {
  name: string
  runway_months: number | null
  date_of_zero: string
  arr_12mo: number
  breakeven_month: number | null
  verdict: "red" | "amber" | "green"
  vs_base: { runway_delta: number | null; arr_delta: number }
}

export interface RexScenarioResult {
  base_case: {
    runway_months: number | null
    date_of_zero: string
    arr_12mo: number
    breakeven_month: number | null
    verdict: "red" | "amber" | "green"
  }
  scenarios: RexScenarioResultItem[]
  recommendation: string
}

export interface RexWeeklyDigestRequest {
  metrics: Record<string, number>
  prev_week?: Record<string, number>
}

export interface RexWoWChange {
  metric: string
  current: number
  previous: number
  change_pct: number
  direction: "up" | "down"
}

export interface RexAlert {
  severity: "low" | "medium" | "high"
  message: string
}

export interface RexGreenFlag {
  message: string
}

export interface RexWeeklyDigestResult {
  period: string
  headline: string
  wow_changes: RexWoWChange[]
  alerts: RexAlert[]
  green_flags: RexGreenFlag[]
  focus_this_week: string[]
  generated_at: string
  confidence_level?: "high" | "medium" | "low"
  metrics_count?: number
}

export interface RexInvestorUpdateRequest {
  period: string
  metrics?: Record<string, unknown>
  highlights?: string[]
  asks?: string[]
}

export interface RexInvestorUpdateResult {
  subject_line: string
  executive_summary: string
  metrics_section: Record<string, unknown>
  highlights_section: string[]
  challenges_section: string[]
  asks_section: string[]
  full_email_body: string
}

// Phase 3 types

export interface RexSnapshot {
  ready: boolean
  source?: "digest" | "datasets"
  data?: {
    mrr?: number | null
    burn?: number | null
    cash?: number | null
    runway_months?: number | null
    headline?: string
    wow_changes?: RexWoWChange[]
  }
}

export interface RexPinnedCard {
  id: string
  organizationId: string
  userId: string
  kind: string
  payload: unknown
  position: number
  createdAt: string
}

export interface RexAlertRule {
  id: string
  metric: string
  operator: "lt" | "gt" | "change_gt_pct" | "change_lt_pct"
  threshold: number
  enabled: boolean
  label?: string
}

export interface RexSettingsData {
  organizationId: string
  weeklyDigestEnabled: boolean
  weeklyDigestTimezone: string
  weeklyDigestRecipients: string[]
  alertRules?: RexAlertRule[] | null
  ingestApiKey?: string | null
  columnMappingTemplates?: unknown
}

// ─── Variance (C9) ──────────────────────────────────────────────────────────

export interface RexVarianceRequest {
  metric: string
  period?: string
}

export interface RexVarianceRow {
  date: string
  actual: number
  budget: number
  variance: number
  variance_pct: number
  direction: "over" | "under" | "on_track"
}

export interface RexVarianceResult {
  metric: string
  period: string
  rows: RexVarianceRow[]
  total_actual: number
  total_budget: number
  total_variance_pct: number
  headline: string
  narrative: string
}

// ─── Board deck (C5) ────────────────────────────────────────────────────────

export interface RexBoardDeckRequest {
  period: string
  metrics?: Record<string, unknown>
  highlights?: string[]
  risks?: string[]
  ask?: string
}

export interface RexBoardDeckResult {
  period: string
  headline: string
  sections: {
    company_overview: string
    financial_health: string
    metrics_analysis: string
    risks_mitigations: string
    key_ask: string
  }
  html: string
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

export interface LexContractRisk {
  clause: string
  risk: string
  severity: "low" | "medium" | "high" | "critical"
  recommendation: string
}

export interface LexClauseBreakdown {
  section: string
  title: string
  summary: string
  risk_level: string
  notes: string
}

export interface LexNegotiationPoint {
  priority: "high" | "medium" | "low"
  clause: string
  issue: string
  suggested_change: string
}

export interface LexAnalyzeContractResult {
  analysis: {
    document_type: string
    parties: string[]
    effective_date: string
    governing_law: string
    jurisdiction: string
    executive_summary: string
    risk_level: "low" | "medium" | "high" | "critical"
    risk_score: number
    risks: LexContractRisk[]
    unusual_clauses: string[]
    missing_protections: string[]
    clause_breakdown: LexClauseBreakdown[]
    key_terms: Record<string, string>
    obligations: Record<string, string[]>
    negotiation_points: LexNegotiationPoint[]
    overall_assessment: string
    recommended_action: string
  }
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

export interface SageBlogIdeaItem {
  title: string
  topic: string
  target_keyword: string
  secondary_keywords: string[]
  rationale: string
  content_angle: string
  estimated_difficulty: number
}

export interface SageGenerateBlogIdeasResult {
  ideas: SageBlogIdeaItem[]
  generated_at: string
}

// ─── Sage saved keywords ─────────────────────────────────────────────────────

export interface SageSavedKeyword {
  id: string
  organizationId: string
  keyword: string
  searchIntent: string
  estimatedDifficulty: number
  relevanceScore: number
  searchVolumeEstimate?: string | null
  suggestedContentType: string
  createdAt: string
}

// ─── Union result type (discriminated by action id) ─────────────────────────

export interface MayaCampaignRequest {
  product_image_url: string
  campaign_brief: string
  photo_count: 1 | 2 | 3 | 4 | 6
  use_logo: boolean
  use_mascot: boolean
  platform: ContentPlatform
}

export interface MayaCampaignPhoto {
  image: ImageResult
  composition_role: string
}

export interface MayaCampaignCaption {
  body: string
  hashtags: string[]
  cta?: string
}

export interface MayaCampaignResult {
  photos: MayaCampaignPhoto[]
  caption?: MayaCampaignCaption | null
  tokens_used?: number
  model_used?: string
}

export type AgentActionId =
  | "sage:keyword-research"
  | "sage:generate-blog"
  | "sage:analyze-content"
  | "sage:content-brief"
  | "sage:generate-blog-ideas"
  | "maya:generate-ideas"
  | "maya:draft-content"
  | "maya:draft-carousel"
  | "maya:generate-variants"
  | "maya:revise"
  | "maya:regenerate-image"
  | "maya:regenerate-content"
  | "maya:campaign"
  | "scout:research-topic"
  | "scout:research-company"
  | "scout:trending-topics"
  | "scout:discover-competitors"
  | "rex:analyze-metrics"
  | "rex:forecast"
  | "rex:financial-analysis"
  | "rex:compile-briefing"
  | "rex:runway"
  | "rex:unit-economics"
  | "rex:scenario"
  | "rex:weekly-digest"
  | "rex:investor-update"
  | "rex:variance"
  | "rex:board-deck"
  | "rex:query-dataset"
  | "rex:analyze-dataset"
  | "rex:generate-report"
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
