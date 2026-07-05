"use client"

import * as React from "react"
import {
  ActionDialog,
  type ActionResultContext,
  type ActionStartContext,
  type ActionStage,
} from "@/components/chat/ActionDialog"
import { findAction } from "@/lib/agents/actions"
import { runAgentAction, generateCampaignVideoStoryboard } from "@/lib/api/assistants"
import type { AgentActionId, ContentPlatform } from "@/lib/types/agents"

// Sage forms
import {
  SageKeywordResearchForm,
  SageGenerateBlogForm,
  SageAnalyzeContentForm,
  SageContentBriefForm,
  SageGenerateBlogIdeasForm,
  SagePageSeoAuditForm,
  SageSiteAuditForm,
} from "@/components/agents/sage/forms"
// Maya forms
import {
  MayaIdeationForm,
  MayaDraftForm,
  MayaVariantsForm,
  MayaReviseForm,
  MayaImageRegenForm,
  MayaContentRegenForm,
  MayaCampaignForm,
  MayaGenerateVideoForm,
  MayaCampaignVideoForm,
  MayaCampaignVideoStoryboardForm,
} from "@/components/agents/maya/forms"
// Scout forms
import {
  ScoutResearchTopicForm,
  ScoutResearchCompanyForm,
  ScoutTrendingTopicsForm,
  ScoutDiscoverCompetitorsForm,
} from "@/components/agents/scout/forms"
// Rex forms
import {
  RexAnalyzeMetricsForm,
  RexForecastForm,
  RexFinancialAnalysisForm,
  RexBriefingForm,
  RexRunwayForm,
  RexUnitEconomicsForm,
  RexScenarioForm,
  RexWeeklyDigestForm,
  RexInvestorUpdateForm,
  RexVarianceForm,
  RexBoardDeckForm,
  RexQueryDatasetActionForm,
  RexAnalyzeDatasetForm,
  RexGenerateReportForm,
  type RexGenerateReportValues,
} from "@/components/agents/rex/forms"
import { queryDataset, analyzeDataset } from "@/lib/api/rex"
// Lex forms
import {
  LexUploadSourceForm,
  LexAnalyzeContractForm,
  LexQueryDocumentForm,
  LexDraftDocumentForm,
  LexExplainForm,
  LexLegalResearchForm,
  LexComplianceCheckForm,
  LexStampLetterheadForm,
} from "@/components/agents/lex/forms"
import { uploadLexDocument, stampLexLetterhead } from "@/lib/api/lex"
// Vega forms
import {
  VegaProcessInboxForm,
  VegaDraftReplyForm,
  VegaCalendarSummaryForm,
  VegaCreateEventForm,
  VegaExecutiveBriefingForm,
  VegaComposeEmailForm,
} from "@/components/agents/vega/forms"

/* eslint-disable @typescript-eslint/no-explicit-any -- heterogeneous form dispatch across agent actions */
type FormComponent = React.ComponentType<{
  value: any
  onChange: (patch: any) => void
  submitting?: boolean
  stage?: ActionStage | null
}>

interface ActionSpec {
  defaultValue: unknown
  Form: FormComponent
  validate?: (v: any) => string | null
  /** Override the default JSON `runAgentAction` submit, e.g. for file uploads. `onStage` lets
   * multi-step submits report interim progress (e.g. a storyboard before the final video). */
  customSubmit?: (
    value: any,
    organizationId: string,
    conversationId?: string,
    onStage?: (stage: ActionStage | null) => void
  ) => Promise<unknown>
  /** Dynamically resolve action ID from current form value (e.g. carousel routing). */
  resolveActionId?: (v: any) => AgentActionId
  /** Override the footer submit button label. */
  submitLabel?: string
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const today = () => new Date().toISOString().slice(0, 10)

const SPECS: Record<AgentActionId, ActionSpec> = {
  "sage:keyword-research": {
    defaultValue: { seed_topic: "", count: 20 },
    Form: SageKeywordResearchForm,
    validate: (v) => (v.seed_topic?.trim() ? null : "Seed topic is required."),
  },
  "sage:generate-blog": {
    defaultValue: {
      topic: "",
      target_keyword: "",
      secondary_keywords: [],
      word_count: 1500,
      output_format: "markdown",
      include_meta: true,
      include_schema_markup: false,
    },
    Form: SageGenerateBlogForm,
    validate: (v) =>
      !v.topic?.trim()
        ? "Topic is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
  },
  "sage:analyze-content": {
    defaultValue: { content: "", target_keyword: "" },
    Form: SageAnalyzeContentForm,
    validate: (v) =>
      !v.content?.trim()
        ? "Content is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
  },
  "sage:content-brief": {
    defaultValue: { topic: "", target_keyword: "", competitor_urls: [] },
    Form: SageContentBriefForm,
    validate: (v) =>
      !v.topic?.trim()
        ? "Topic is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
  },
  "sage:generate-blog-ideas": {
    defaultValue: { count: 5 },
    Form: SageGenerateBlogIdeasForm,
  },
  "sage:page-seo-audit": {
    defaultValue: { url: "", target_keyword: "" },
    Form: SagePageSeoAuditForm,
    validate: (v) =>
      !v.url?.trim()
        ? "Page URL is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
    submitLabel: "Run Audit",
  },
  "sage:site-audit": {
    defaultValue: { domain: "", urls: [], target_keyword: "" },
    Form: SageSiteAuditForm,
    validate: (v) =>
      !v.domain?.trim()
        ? "Enter a domain to get started."
        : !v.target_keyword?.trim()
          ? "Enter a target keyword before finding pages."
          : !v.urls?.length
            ? "Find pages, then select at least one to audit."
            : null,
    submitLabel: "Audit Pages",
  },

  "maya:campaign": {
    defaultValue: {
      product_image_urls: [],
      campaign_brief: "",
      photo_count: 4,
      use_logo: true,
      use_mascot: true,
      use_brand_colors: true,
      platform: "instagram",
    },
    Form: MayaCampaignForm,
    validate: (v) =>
      !v.product_image_urls?.length
        ? "Upload at least one product image."
        : !v.campaign_brief?.trim()
          ? "Campaign brief is required."
          : null,
  },
  "maya:generate-video": {
    defaultValue: {
      prompt: "",
      platform: "instagram",
      aspect_ratio: "9:16",
      duration_seconds: 8,
      use_logo: false,
    },
    Form: MayaGenerateVideoForm,
    validate: (v) => (!v.prompt?.trim() ? "Video prompt is required." : null),
  },
  "maya:campaign-video": {
    defaultValue: {
      product_image_urls: [],
      campaign_brief: "",
      platform: "instagram",
      aspect_ratio: "9:16",
      duration_seconds: 8,
      use_logo: false,
    },
    Form: MayaCampaignVideoForm,
    validate: (v) =>
      !v.product_image_urls?.length
        ? "Upload at least one product image."
        : !v.campaign_brief?.trim()
          ? "Campaign brief is required."
          : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customSubmit: async (v: any, organizationId: string, conversationId?: string, onStage?: (stage: ActionStage | null) => void) => {
      // If a storyboard was already generated for this exact input (e.g. "Turn into video"
      // from an existing Storyboard result card), reuse it instead of regenerating.
      let storyboardBeats: string[] | undefined = v.storyboard_beats
      let storyboardImageUrl: string | undefined = v.storyboard_image_url

      if (!storyboardImageUrl || !storyboardBeats?.length) {
        onStage?.({ label: "Generating storyboard for you…" })
        try {
          const storyboard = await generateCampaignVideoStoryboard(
            organizationId,
            {
              product_image_urls: v.product_image_urls,
              campaign_brief: v.campaign_brief,
              platform: v.platform,
              aspect_ratio: v.aspect_ratio,
              duration_seconds: v.duration_seconds,
              use_logo: v.use_logo,
            },
            conversationId
          )
          storyboardBeats = storyboard.beats
          storyboardImageUrl = storyboard.storyboard_image_url
        } catch {
          // Storyboard generation is a nice-to-have preview — fall back silently to a
          // plain video generation if it fails, rather than blocking the user.
        }
      }
      onStage?.({ label: "Generating video…", data: { storyboardImageUrl } })
      return runAgentAction(
        "maya:campaign-video",
        organizationId,
        { ...v, storyboard_beats: storyboardBeats, storyboard_image_url: storyboardImageUrl },
        conversationId
      )
    },
  },
  "maya:campaign-video-storyboard": {
    defaultValue: {
      product_image_urls: [],
      campaign_brief: "",
      platform: "instagram",
      aspect_ratio: "9:16",
      duration_seconds: 10,
      use_logo: false,
    },
    Form: MayaCampaignVideoStoryboardForm,
    validate: (v) =>
      !v.product_image_urls?.length
        ? "Upload at least one product image."
        : !v.campaign_brief?.trim()
          ? "Campaign brief is required."
          : null,
    submitLabel: "Generate storyboard",
  },
  "maya:generate-ideas": {
    defaultValue: { platform: "linkedin", count: 5, topic_hint: "", use_brandkit: false },
    Form: MayaIdeationForm,
  },
  "maya:draft-content": {
    defaultValue: {
      topic: "",
      platforms: ["linkedin"],
      word_count_target: 200,
      include_image: true,
      use_logo: true,
      use_mascot: false,
      use_brand_colors: true,
      make_carousel: false,
      carousel_count: 3,
    },
    Form: MayaDraftForm,
    validate: (v) => (!v.topic?.trim() ? "Topic is required." : !v.platforms?.length ? "Pick at least one platform." : null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveActionId: (v: any) => (v.make_carousel ? "maya:draft-carousel" : "maya:draft-content"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customSubmit: async (v: any, organizationId: string, conversationId?: string) => {
      const platforms: ContentPlatform[] = v.platforms?.length ? v.platforms : ["linkedin"]
      if (v.make_carousel) {
        return runAgentAction("maya:draft-carousel", organizationId, { ...v, platform: platforms[0] }, conversationId)
      }
      if (platforms.length === 1) {
        return runAgentAction("maya:draft-content", organizationId, { ...v, platform: platforms[0] }, conversationId)
      }
      const results = await Promise.all(
        platforms.map((p: ContentPlatform) =>
          runAgentAction("maya:draft-content", organizationId, { ...v, platform: p }, conversationId)
        )
      )
      return { drafts: results }
    },
  },
  "maya:draft-carousel": {
    defaultValue: {
      topic: "",
      platforms: ["linkedin"],
      include_image: true,
      use_logo: true,
      use_mascot: false,
      make_carousel: true,
      carousel_count: 3,
    },
    Form: MayaDraftForm,
    validate: (v) => (v.topic?.trim() ? null : "Topic is required."),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customSubmit: async (v: any, organizationId: string, conversationId?: string) => {
      const platforms: ContentPlatform[] = v.platforms?.length ? v.platforms : ["linkedin"]
      return runAgentAction("maya:draft-carousel", organizationId, { ...v, platform: platforms[0] }, conversationId)
    },
  },
  "maya:generate-variants": {
    defaultValue: {
      original_content: "",
      original_platform: "linkedin",
      target_platforms: ["twitter", "instagram"],
      include_images: false,
    },
    Form: MayaVariantsForm,
    validate: (v) =>
      !v.original_content?.trim()
        ? "Original content is required."
        : v.target_platforms?.length === 0
          ? "Pick at least one target platform."
          : null,
  },
  "maya:revise": {
    defaultValue: {
      original_content: "",
      platform: "linkedin",
      feedback: "",
    },
    Form: MayaReviseForm,
    validate: (v) =>
      !v.original_content?.trim()
        ? "Original content is required."
        : !v.feedback?.trim()
          ? "Feedback is required."
          : null,
  },
  "maya:regenerate-image": {
    defaultValue: { image_url: "", prompt: "" },
    Form: MayaImageRegenForm,
    validate: (v) => (!v.prompt?.trim() ? "Prompt is required." : null),
  },
  "maya:regenerate-content": {
    defaultValue: { caption: "", prompt: "", platform: "instagram" },
    Form: MayaContentRegenForm,
    validate: (v) =>
      !v.caption?.trim()
        ? "Caption is required."
        : !v.prompt?.trim()
          ? "Prompt is required."
          : null,
  },

  "scout:research-topic": {
    defaultValue: { topic: "", depth: "standard", sources_hint: [], location: "" },
    Form: ScoutResearchTopicForm,
    validate: (v) => (v.topic?.trim() ? null : "Topic is required."),
  },
  "scout:research-company": {
    defaultValue: { company_name: "", company_url: "" },
    Form: ScoutResearchCompanyForm,
    validate: (v) => (v.company_name?.trim() ? null : "Company name is required."),
  },
  "scout:trending-topics": {
    defaultValue: { industry: "", count: 10, location: "" },
    Form: ScoutTrendingTopicsForm,
    validate: (v) => (v.industry?.trim() ? null : "Industry is required."),
  },
  "scout:discover-competitors": {
    defaultValue: { description: "", industry: "", count: 8, location: "" },
    Form: ScoutDiscoverCompetitorsForm,
    validate: (v) =>
      !v.description?.trim()
        ? "Product description is missing — fill in your Brain first."
        : null,
  },

  "rex:analyze-metrics": {
    defaultValue: { metrics: {}, period: "monthly" },
    Form: RexAnalyzeMetricsForm,
    validate: (v) =>
      Object.keys(v.metrics ?? {}).length ? null : "Add at least one metric.",
  },
  "rex:forecast": {
    defaultValue: { metric_name: "", historical_data: [], horizon_days: 90 },
    Form: RexForecastForm,
    validate: (v) =>
      !v.metric_name?.trim()
        ? "Metric name is required."
        : (v.historical_data?.length ?? 0) < 3
          ? "Provide at least 3 historical data points."
          : null,
  },
  "rex:financial-analysis": {
    defaultValue: { revenue_data: [], expenses_data: [], subscribers_data: [] },
    Form: RexFinancialAnalysisForm,
    validate: (v) =>
      (v.revenue_data?.length ?? 0) < 2
        ? "Provide at least 2 revenue data points."
        : null,
  },
  "rex:compile-briefing": {
    defaultValue: { date: today(), all_metrics: {}, agent_summaries: {} },
    Form: RexBriefingForm,
    validate: (v) => (v.date ? null : "Date is required."),
  },
  "rex:runway": {
    defaultValue: { cash_on_hand: 0, monthly_burn: 0, monthly_revenue: 0, growth_rate_pct: 0 },
    Form: RexRunwayForm,
    validate: (v) =>
      !v.cash_on_hand || v.cash_on_hand <= 0
        ? "Cash on hand must be a positive number."
        : !v.monthly_burn || v.monthly_burn <= 0
          ? "Monthly burn must be a positive number."
          : null,
  },
  "rex:unit-economics": {
    defaultValue: {
      marketing_spend: [],
      new_customers: [],
      avg_monthly_revenue_per_customer: 0,
      avg_customer_lifetime_months: 24,
    },
    Form: RexUnitEconomicsForm,
    validate: (v) =>
      !v.marketing_spend?.length
        ? "Add at least one marketing spend data point."
        : !v.new_customers?.length
          ? "Add at least one new customers data point."
          : !v.avg_monthly_revenue_per_customer || v.avg_monthly_revenue_per_customer <= 0
            ? "Avg monthly revenue per customer is required."
            : null,
  },
  "rex:scenario": {
    defaultValue: {
      base_metrics: { mrr: 0, burn: 0, cash: 0, growth_rate: 0 },
      scenarios: [{ name: "", changes: {} }], // Merged from file 2's structure
    },
    Form: RexScenarioForm,
    validate: (v) =>
      !v.scenarios?.length
        ? "Add at least one scenario."
        : v.scenarios.some((s: { name: string }) => !s.name?.trim())
          ? "All scenarios need a name."
          : null,
  },
  "rex:weekly-digest": {
    defaultValue: { metrics: {}, prev_week: {} },
    Form: RexWeeklyDigestForm,
    validate: (v) =>
      !Object.keys(v.metrics ?? {}).length ? "Add at least one metric." : null,
  },
  "rex:investor-update": {
    defaultValue: { period: "", metrics: {}, highlights: [], asks: [] },
    Form: RexInvestorUpdateForm,
    validate: (v) => (v.period?.trim() ? null : "Period is required."),
  },
  "rex:variance": {
    defaultValue: { metric: "", period: "monthly" },
    Form: RexVarianceForm,
    validate: (v) => (v.metric?.trim() ? null : "Pick a metric."),
  },
  "rex:board-deck": {
    defaultValue: { period: "", metrics: {}, highlights: [], risks: [], ask: "" },
    Form: RexBoardDeckForm,
    validate: (v) => (v.period?.trim() ? null : "Period is required."),
  },
  "rex:query-dataset": {
    defaultValue: { dataset_id: "", query: "" },
    Form: RexQueryDatasetActionForm,
    validate: (v) =>
      !v.dataset_id ? "Select a dataset." : !v.query?.trim() ? "Enter a question." : null,
    customSubmit: async (v) => queryDataset(v.dataset_id, { query: v.query }),
  },
  "rex:analyze-dataset": {
    defaultValue: { dataset_id: "" },
    Form: RexAnalyzeDatasetForm,
    validate: (v) => (v.dataset_id ? null : "Select a dataset."),
    customSubmit: async (v) => analyzeDataset(v.dataset_id),
  },
  "rex:generate-report": {
    defaultValue: { dataset_id: "" } as RexGenerateReportValues,
    Form: RexGenerateReportForm,
    validate: () => null,
    customSubmit: async () => ({ ok: true }),
    submitLabel: "Close",
  },

  "lex:upload-source": {
    defaultValue: { file: null, document_name: "", document_type: "contract" },
    Form: LexUploadSourceForm,
    validate: (v) =>
      !v.file
        ? "Choose a PDF file."
        : !v.document_name?.trim()
          ? "Document name is required."
          : null,
    customSubmit: async (v) =>
      uploadLexDocument({
        file: v.file as File,
        documentName: v.document_name,
        documentType: v.document_type ?? "contract",
      }),
  },
  "lex:analyze-contract": {
    defaultValue: { source_id: "", contract_text: "", analysis_focus: [] },
    Form: LexAnalyzeContractForm,
    validate: (v) =>
      v.source_id?.trim() || v.contract_text?.trim()
        ? null
        : "Pick a document or paste contract text.",
  },
  "lex:query-document": {
    defaultValue: { source_id: "", query: "" },
    Form: LexQueryDocumentForm,
    validate: (v) =>
      !v.source_id?.trim()
        ? "Pick a document."
        : !v.query?.trim()
          ? "Enter a question."
          : null,
  },
  "lex:draft-document": {
    defaultValue: {
      document_type: "",
      requirements: "",
      jurisdiction: "",
      additional_clauses: [],
    },
    Form: LexDraftDocumentForm,
    validate: (v) =>
      !v.document_type?.trim()
        ? "Document type is required."
        : !v.requirements?.trim()
          ? "Requirements are required."
          : null,
  },
  "lex:explain": {
    defaultValue: { text: "", context: "" },
    Form: LexExplainForm,
    validate: (v) => (v.text?.trim() ? null : "Legal text is required."),
  },
  "lex:legal-research": {
    defaultValue: { query: "", jurisdiction: "United States", legal_areas: [] },
    Form: LexLegalResearchForm,
    validate: (v) => (v.query?.trim() ? null : "Question is required."),
  },
  "lex:compliance-check": {
    defaultValue: { description: "", frameworks: [], business_context: "" },
    Form: LexComplianceCheckForm,
    validate: (v) =>
      !v.description?.trim()
        ? "Describe what you're checking."
        : !v.frameworks?.length
          ? "Add at least one framework."
          : null,
  },
  "lex:stamp-letterhead": {
    defaultValue: { source_id: "", source_url: "", source_name: "" },
    Form: LexStampLetterheadForm,
    validate: (v) => (v.source_id?.trim() ? null : "Pick a document."),
    submitLabel: "Stamp letterhead",
    customSubmit: async (v) => {
      const ext = (v.source_name as string).split(".").pop()?.toLowerCase() ?? ""
      const format = ext === "docx" ? "docx" : "pdf"
      return stampLexLetterhead({ fileUrl: v.source_url as string, filename: v.source_name as string, format })
    },
  },

  "vega:process-inbox": {
    defaultValue: { max_emails: 20, auto_label: true, draft_replies: false },
    Form: VegaProcessInboxForm,
  },
  "vega:draft-reply": {
    defaultValue: { email_id: "", reply_instructions: "", save_as_draft: true },
    Form: VegaDraftReplyForm,
    validate: (v) =>
      !v.email_id?.trim()
        ? "Email ID is required."
        : !v.reply_instructions?.trim()
          ? "Reply instructions are required."
          : null,
  },
  "vega:calendar-summary": {
    defaultValue: { days_ahead: 7 },
    Form: VegaCalendarSummaryForm,
  },
  "vega:create-event": {
    defaultValue: { description: "", check_conflicts: true },
    Form: VegaCreateEventForm,
    validate: (v) => (v.description?.trim() ? null : "Describe the event."),
  },
  "vega:executive-briefing": {
    defaultValue: { include_email: true, include_calendar: true },
    Form: VegaExecutiveBriefingForm,
  },
  "vega:compose-email": {
    defaultValue: {
      to: "",
      subject: "",
      instructions: "",
      tone: "professional",
      include_cta: true,
    },
    Form: VegaComposeEmailForm,
    validate: (v) =>
      !v.to?.trim()
        ? "Recipient email is required."
        : !v.subject?.trim()
          ? "Subject is required."
          : !v.instructions?.trim()
            ? "Instructions are required."
            : null,
  },
}

export interface RunActionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  actionId: AgentActionId | null
  organizationId: string
  conversationId?: string
  /** Optional partial that's shallow-merged over the spec's defaultValue. */
  prefill?: Record<string, unknown>
  /** Fired when validation passes and the API call begins. */
  onStart?: (ctx: ActionStartContext<unknown>) => void
  onSettled?: (ctx: ActionStartContext<unknown>) => void
  onComplete: (ctx: ActionResultContext<unknown, unknown>) => void
  /** Bubble up submitting state so the chat page can show the typing indicator. */
  onSubmittingChange?: (submitting: boolean) => void
}

export function RunActionDialog({
  open,
  onOpenChange,
  actionId,
  organizationId,
  conversationId,
  prefill,
  onStart,
  onSettled,
  onComplete,
  onSubmittingChange,
}: RunActionDialogProps) {
  if (!actionId) return null
  const meta = findAction(actionId)
  const spec = SPECS[actionId]
  if (!meta || !spec) return null

  const { Form, defaultValue, validate, customSubmit, resolveActionId, submitLabel } = spec

  // Cast to Record<string, unknown> before spreading to satisfy TS —
  // defaultValue is typed as `unknown` so a direct spread would error.
  const merged: Record<string, unknown> = {
    ...(defaultValue as Record<string, unknown>),
    ...(prefill ?? {}),
    organization_id: organizationId,
  }

  return (
    <ActionDialog<unknown, unknown>
      open={open}
      onOpenChange={onOpenChange}
      actionId={actionId}
      title={meta.label}
      description={meta.description}
      organizationId={organizationId}
      conversationId={conversationId}
      defaultValue={merged}
      validate={validate}
      customSubmit={customSubmit}
      submitLabel={submitLabel}
      resolveActionId={resolveActionId}
      onSubmittingChange={onSubmittingChange}
      renderForm={({ value, onChange, submitting, stage }) => (
        <Form value={value} onChange={onChange} submitting={submitting} stage={stage} />
      )}
      onStart={onStart}
      onSettled={onSettled}
      onComplete={onComplete}
    />
  )
}